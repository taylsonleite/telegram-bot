require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");

const token = process.env.TOKEN;
let chatId = process.env.CHAT_ID;

if (!token) {
  console.error("TOKEN não definido.");
  process.exit(1);
}

if (!chatId) {
  console.warn("CHAT_ID não definido. O bot ainda pode capturar ao receber mensagem.");
}

const bot = new TelegramBot(token, { polling: true });

console.log("Bot iniciado...");
console.log("CHAT_ID atual:", chatId || "não definido");

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

bot.on("message", (msg) => {
  chatId = msg.chat.id.toString();
  console.log(`Mensagem recebida de ${chatId}: ${msg.text || "[sem texto]"}`);
});

function send(msg) {
  if (!chatId) {
    console.warn("CHAT_ID não definido. Mensagem não enviada:", msg);
    return;
  }

  bot.sendMessage(chatId, msg)
    .then(() => console.log("Enviado:", msg))
    .catch((err) => console.error("Erro ao enviar mensagem:", err.message));
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Bot ativo 🚀

Comandos disponíveis:
/help - ver comandos
/status - verificar se estou online
/teste - testar envio

Rotina atual:
07:30 - acordar com foco
09:00 - prioridade do dia
18:00 - treino
21:00 - evolução
22:30 - controle mental`
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Comandos disponíveis:

/start - iniciar o bot
/help - mostrar ajuda
/status - verificar se estou online
/teste - testar resposta do bot`
  );
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, "Online e funcionando ✅");
});

bot.onText(/\/teste/, (msg) => {
  bot.sendMessage(msg.chat.id, "Teste funcionando ✅");
});

// 07:30 - manhã
cron.schedule("30 7 * * *", () => {
  send("Bom dia. Levanta e começa. Nada de entrar no automático.");
});

// 09:00 - prioridade do dia
cron.schedule("0 9 * * *", () => {
  send("Define agora a prioridade principal do dia e executa sem enrolar.");
});

// 18:00 - treino
cron.schedule("0 18 * * *", () => {
  send("Hora do treino. Sem negociar com a preguiça.");
});

// 21:00 - evolução
cron.schedule("0 21 * * *", () => {
  send("Checa o dia: alimentação, estudo e evolução. O que falta, faz agora.");
});

// 22:30 - controle mental
cron.schedule("30 22 * * *", () => {
  send("Fecha o dia com postura. Não stalkeia, não manda mensagem, respeita o processo.");
});