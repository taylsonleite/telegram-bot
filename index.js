require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const token = process.env.TOKEN;
let chatId = process.env.CHAT_ID;

if (!token) {
  console.error("TOKEN não definido.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const remindersFile = path.join(__dirname, "reminders.json");
const scheduledJobs = new Map();

function loadReminders() {
  try {
    if (!fs.existsSync(remindersFile)) {
      fs.writeFileSync(remindersFile, "[]", "utf8");
    }
    const data = fs.readFileSync(remindersFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao carregar reminders.json:", error.message);
    return [];
  }
}

function saveReminders(reminders) {
  try {
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar reminders.json:", error.message);
  }
}

function send(toChatId, msg) {
  return bot.sendMessage(String(toChatId), msg)
    .then(() => console.log("Enviado para", toChatId, ":", msg))
    .catch((err) => console.error("Erro ao enviar mensagem:", err.message));
}

function parseTime(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return { hour: match[1], minute: match[2] };
}

function scheduleReminder(reminder) {
  const parsed = parseTime(reminder.time);
  if (!parsed) return;

  if (scheduledJobs.has(reminder.id)) {
    scheduledJobs.get(reminder.id).stop();
    scheduledJobs.delete(reminder.id);
  }

  const expression = `${parsed.minute} ${parsed.hour} * * *`;

  const job = cron.schedule(expression, () => {
    send(reminder.chatId, `⏰ Lembrete #${reminder.id}: ${reminder.text}`);
  }, {
    timezone: process.env.TZ || "America/Fortaleza"
  });

  scheduledJobs.set(reminder.id, job);
  console.log(`Lembrete agendado: #${reminder.id} às ${reminder.time}`);
}

function scheduleAllReminders() {
  const reminders = loadReminders();
  reminders.forEach(scheduleReminder);
}

function getNextId(reminders) {
  if (reminders.length === 0) return 1;
  return Math.max(...reminders.map((r) => r.id)) + 1;
}

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

bot.on("message", (msg) => {
  chatId = String(msg.chat.id);
  console.log(`Mensagem recebida de ${chatId}: ${msg.text || "[sem texto]"}`);
});

bot.onText(/\/start/, (msg) => {
  send(msg.chat.id,
`Bot ativo 🚀

Comandos:
/help - ajuda
/status - ver status
/teste - testar resposta
/add HH:MM texto - criar lembrete
/list - listar lembretes
/remove ID - remover lembrete

Exemplos:
/add 08:30 tomar água
/add 21:00 estudar node
/list
/remove 1`);
});

bot.onText(/\/help/, (msg) => {
  send(msg.chat.id,
`Comandos disponíveis:

/start - iniciar
/help - ajuda
/status - ver status
/teste - testar resposta
/add HH:MM texto - adicionar lembrete
/list - listar lembretes
/remove ID - remover lembrete`);
});

bot.onText(/\/status/, (msg) => {
  send(msg.chat.id, "Online e funcionando ✅");
});

bot.onText(/\/teste/, (msg) => {
  send(msg.chat.id, "Teste funcionando ✅");
});

bot.onText(/^\/add\s+(\d{2}:\d{2})\s+(.+)$/i, (msg, match) => {
  const currentChatId = String(msg.chat.id);
  const time = match[1];
  const text = match[2].trim();

  const parsed = parseTime(time);
  if (!parsed) {
    send(currentChatId, "Horário inválido. Use o formato HH:MM, exemplo: /add 21:00 estudar");
    return;
  }

  const reminders = loadReminders();
  const newReminder = {
    id: getNextId(reminders),
    chatId: currentChatId,
    time,
    text,
    createdAt: new Date().toISOString()
  };

  reminders.push(newReminder);
  saveReminders(reminders);
  scheduleReminder(newReminder);

  send(currentChatId, `Lembrete criado ✅\nID: ${newReminder.id}\nHorário: ${newReminder.time}\nTexto: ${newReminder.text}`);
});

bot.onText(/^\/list$/i, (msg) => {
  const currentChatId = String(msg.chat.id);
  const reminders = loadReminders().filter((r) => String(r.chatId) === currentChatId);

  if (reminders.length === 0) {
    send(currentChatId, "Você não tem lembretes cadastrados.");
    return;
  }

  const lines = reminders
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((r) => `#${r.id} - ${r.time} - ${r.text}`);

  send(currentChatId, `Seus lembretes:\n\n${lines.join("\n")}`);
});

bot.onText(/^\/remove\s+(\d+)$/i, (msg, match) => {
  const currentChatId = String(msg.chat.id);
  const reminderId = Number(match[1]);

  const reminders = loadReminders();
  const exists = reminders.find((r) => r.id === reminderId && String(r.chatId) === currentChatId);

  if (!exists) {
    send(currentChatId, `Não encontrei um lembrete com ID ${reminderId}.`);
    return;
  }

  const updated = reminders.filter((r) => !(r.id === reminderId && String(r.chatId) === currentChatId));
  saveReminders(updated);

  if (scheduledJobs.has(reminderId)) {
    scheduledJobs.get(reminderId).stop();
    scheduledJobs.delete(reminderId);
  }

  send(currentChatId, `Lembrete #${reminderId} removido ✅`);
});

// rotina fixa opcional
cron.schedule("30 7 * * *", () => {
  if (chatId) send(chatId, "Bom dia. Levanta e começa. Nada de entrar no automático.");
}, { timezone: process.env.TZ || "America/Fortaleza" });

cron.schedule("0 18 * * *", () => {
  if (chatId) send(chatId, "Hora do treino. Sem negociar com a preguiça.");
}, { timezone: process.env.TZ || "America/Fortaleza" });

scheduleAllReminders();

console.log("Bot iniciado...");
console.log("CHAT_ID atual:", chatId || "não definido");