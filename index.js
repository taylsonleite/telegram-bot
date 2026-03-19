require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");

const bot = new TelegramBot(process.env.TOKEN, { polling: true });

let chatId = process.env.CHAT_ID;

// captura seu chat ID automaticamente
bot.on("message", (msg) => {
  chatId = msg.chat.id;
  console.log("Seu chat ID:", chatId);
});

// comando /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Bot ativo 🚀");
});

bot.onText(/\/teste/, (msg) => {
    bot.sendMessage(msg.chat.id, "Teste funcionando ✅");
  });

// função de envio
function send(msg) {
  if (chatId) {
    bot.sendMessage(chatId, msg);
    console.log("Enviado:", msg);
  }
}

// agendamentos
cron.schedule("30 7 * * *", () => send("Levanta e começa. Foco em você."));
cron.schedule("0 18 * * *", () => send("Treinar independente de vontade."));
cron.schedule("0 20 * * *", () => send("Fez algo pra evoluir hoje?"));
cron.schedule("30 22 * * *", () => send("Controle mental. Sem vacilar."));

setTimeout(() => {
    send("Teste automático em 10 segundos ✅");
  }, 10000);