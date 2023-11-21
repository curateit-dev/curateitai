const { Bot, webhookCallback, Context, session } = require("grammy");
const express = require("express");
const {
  conversations,
  createConversation,
} = require("@grammyjs/conversations");

require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

/** Defines the conversation */
async function greeting(conversation, ctx) {
  // console.log("conversation : ", conversation);
  // console.log("ctx : ", ctx);
  // TODO: code the conversation
  await ctx.reply("Hi! And Bye!");
  await ctx.reply("Bye! And Hi!");
  // Leave the conversation:
  return;
}

bot.use(createConversation(greeting));

bot.command("login", async (ctx) => {
  // enter the function "greeting" you declared
  await ctx.conversation.enter("greeting");
});

bot.command("start", (ctx) =>
  ctx.reply(`
CurateitAI - AI Productivity Assistance Bot
🌟 Ask Questions about any Youtube Video or Web page
🌟 Bookmark your gems to CurateIT
🌟 Search your CurateIT Gems

👉Basic Commands👈

/ask <YOUR URL>
/save <YOUR GEM URL>
/search <YOUR GEM TITLE>
`)
);

bot.on("message", (ctx) => ctx.reply("Got a message!"));

if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(express.json());
  app.use(webhookCallback(bot, "express"));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
} else {
  bot.start();
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
