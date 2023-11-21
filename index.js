const { Bot, webhookCallback, Context, session } = require("grammy");
const express = require("express");
const axios = require("axios");

const {
  conversations,
  createConversation,
} = require("@grammyjs/conversations");

require("dotenv").config();
const chatThreads = new Map();
let currUsername = "User";

let isLoggedIn = false;
let apiResponse = {};
let sessionToken = 0;
let sessionId = 0;

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

/** Defines the conversation */
async function loginHandler(conversation, ctx) {
  if (sessionId !== 0 && sessionToken !== 0) {
    await ctx.reply("You are already logged in");
  }
  await ctx.reply("Please enter your email:");
  const email = await conversation.wait();

  await ctx.reply("Please enter your password:");
  const password = await conversation.wait();

  try {
    const response = await axios.post(
      `${process.env.CURATEIT_API_URL}/api/auth/local`,
      {
        identifier: email.message.text,
        password: password.message.text,
      }
    );
    sessionToken = response.data.jwt;
    sessionId = response.data.user.id;
    currUsername = response.data.user.username;
    console.log("sessionId : ", sessionId);
    console.log("sessionToken : ", sessionToken);
    isLoggedIn = true;
    await ctx.reply("Login Successful");
  } catch (error) {
    console.log("error : ", error);
    if (error.response && error.response.status === 400) {
      await ctx.reply("Invalid credentials");
    } else {
      await ctx.reply("Login failed. Please try again.");
    }
  }

  return;
}

bot.use(createConversation(loginHandler));

bot.command("login", async (ctx) => {
  await ctx.conversation.enter("loginHandler");
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
/help
`)
);

// Give Examples of all available Commands
bot.command("help", async (ctx) =>
  ctx.reply(`
/save <YOUR GEM URL>
e.g. /save https://en.wikipedia.org/wiki/india

/ask <YOUR URL>
e.g. /ask https://www.youtube.com/watch?v=dQw4w9WgXcQ

/search <YOUR GEM TITLE>
e.g. /search India
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
