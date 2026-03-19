require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const token = process.env.TOKEN;
const defaultChatId = process.env.CHAT_ID;
const timezone = process.env.TZ || "America/Fortaleza";

if (!token) {
  console.error("TOKEN não definido.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const remindersFile = path.join(__dirname, "reminders.json");
const scheduledJobs = new Map();
let chatId = defaultChatId ? String(defaultChatId) : null;

const fixedRemindersTemplate = [
  { time: "07:30", text: "Bom dia. Levanta e começa. Nada de entrar no automático.", fixedKey: "morning" },
  { time: "09:00", text: "Define agora a prioridade principal do dia e executa sem enrolar.", fixedKey: "priority" },
  { time: "13:00", text: "Pausa consciente: água, comida certa e volta pro eixo.", fixedKey: "nutrition" },
  { time: "18:00", text: "Hora do treino. Sem negociar com a preguiça.", fixedKey: "training" },
  { time: "21:00", text: "Checa o dia: alimentação, estudo e evolução. O que falta, faz agora.", fixedKey: "review" },
  { time: "22:30", text: "Fecha o dia com postura. Não stalkeia, não manda mensagem, respeita o processo.", fixedKey: "mental" }
];

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

function parseTime(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return { hour: match[1], minute: match[2] };
}

function getNextId(reminders) {
  if (reminders.length === 0) return 1;
  return Math.max(...reminders.map((r) => r.id)) + 1;
}

function send(toChatId, msg) {
  return bot
    .sendMessage(String(toChatId), msg)
    .then(() => console.log("Enviado para", toChatId, ":", msg))
    .catch((err) => console.error("Erro ao enviar mensagem:", err.message));
}

function scheduleReminder(reminder) {
  const parsed = parseTime(reminder.time);
  if (!parsed) return;

  if (scheduledJobs.has(reminder.id)) {
    scheduledJobs.get(reminder.id).stop();
    scheduledJobs.delete(reminder.id);
  }

  const expression = `${parsed.minute} ${parsed.hour} * * *`;

  const job = cron.schedule(
    expression,
    () => {
      send(reminder.chatId, `⏰ ${reminder.fixed ? "[Rotina]" : "[Lembrete]"} #${reminder.id}: ${reminder.text}`);
    },
    { timezone }
  );

  scheduledJobs.set(reminder.id, job);
  console.log(`Lembrete agendado: #${reminder.id} às ${reminder.time}`);
}

function unscheduleReminder(reminderId) {
  if (scheduledJobs.has(reminderId)) {
    scheduledJobs.get(reminderId).stop();
    scheduledJobs.delete(reminderId);
  }
}

function scheduleAllReminders() {
  const reminders = loadReminders();
  reminders.forEach(scheduleReminder);
}

function ensureFixedReminders(currentChatId) {
  if (!currentChatId) return;

  const reminders = loadReminders();
  let changed = false;

  for (const template of fixedRemindersTemplate) {
    const exists = reminders.find(
      (r) =>
        String(r.chatId) === String(currentChatId) &&
        r.fixed === true &&
        r.fixedKey === template.fixedKey
    );

    if (!exists) {
      const newReminder = {
        id: getNextId(reminders),
        chatId: String(currentChatId),
        time: template.time,
        text: template.text,
        fixed: true,
        fixedKey: template.fixedKey,
        createdAt: new Date().toISOString()
      };

      reminders.push(newReminder);
      scheduleReminder(newReminder);
      changed = true;
    }
  }

  if (changed) {
    saveReminders(reminders);
    console.log("Lembretes fixos garantidos com sucesso.");
  }
}

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

bot.on("message", (msg) => {
  chatId = String(msg.chat.id);
  console.log(`Mensagem recebida de ${chatId}: ${msg.text || "[sem texto]"}`);
  ensureFixedReminders(chatId);
});

bot.onText(/\/start/, (msg) => {
  const currentChatId = String(msg.chat.id);
  ensureFixedReminders(currentChatId);

  send(
    currentChatId,
    `Bot ativo 🚀

Comandos:
/help - ajuda
/status - ver status
/teste - testar resposta
/add HH:MM texto - criar lembrete
/list - listar lembretes
/remove ID - remover lembrete

Os lembretes fixos da rotina já são criados automaticamente.`
  );
});

bot.onText(/\/help/, (msg) => {
  send(
    msg.chat.id,
    `Comandos disponíveis:

/start - iniciar
/help - ajuda
/status - ver status
/teste - testar resposta
/add HH:MM texto - adicionar lembrete
/list - listar lembretes
/remove ID - remover lembrete

Exemplo:
/add 21:00 estudar node`
  );
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
    send(currentChatId, "Horário inválido. Use HH:MM. Exemplo: /add 21:00 estudar");
    return;
  }

  const reminders = loadReminders();
  const newReminder = {
    id: getNextId(reminders),
    chatId: currentChatId,
    time,
    text,
    fixed: false,
    createdAt: new Date().toISOString()
  };

  reminders.push(newReminder);
  saveReminders(reminders);
  scheduleReminder(newReminder);

  send(
    currentChatId,
    `Lembrete criado ✅
ID: ${newReminder.id}
Horário: ${newReminder.time}
Texto: ${newReminder.text}`
  );
});

bot.onText(/^\/list$/i, (msg) => {
  const currentChatId = String(msg.chat.id);
  const reminders = loadReminders()
    .filter((r) => String(r.chatId) === currentChatId)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (reminders.length === 0) {
    send(currentChatId, "Você não tem lembretes cadastrados.");
    return;
  }

  const lines = reminders.map((r) => {
    const tag = r.fixed ? "ROTINA" : "LIVRE";
    return `#${r.id} - ${r.time} - [${tag}] ${r.text}`;
  });

  send(currentChatId, `Seus lembretes:\n\n${lines.join("\n")}`);
});

bot.onText(/^\/remove\s+(\d+)$/i, (msg, match) => {
  const currentChatId = String(msg.chat.id);
  const reminderId = Number(match[1]);

  const reminders = loadReminders();
  const reminder = reminders.find(
    (r) => r.id === reminderId && String(r.chatId) === currentChatId
  );

  if (!reminder) {
    send(currentChatId, `Não encontrei um lembrete com ID ${reminderId}.`);
    return;
  }

  if (reminder.fixed) {
    send(currentChatId, "Esse lembrete faz parte da rotina fixa e não pode ser removido.");
    return;
  }

  const updated = reminders.filter(
    (r) => !(r.id === reminderId && String(r.chatId) === currentChatId)
  );

  saveReminders(updated);
  unscheduleReminder(reminderId);

  send(currentChatId, `Lembrete #${reminderId} removido ✅`);
});

// Inicialização
scheduleAllReminders();
ensureFixedReminders(chatId);

console.log("Bot iniciado...");
console.log("CHAT_ID atual:", chatId || "não definido");
console.log("Timezone:", timezone);