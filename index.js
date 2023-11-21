const { Bot, webhookCallback, Context, session } = require("grammy");
const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
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

function isValidURL(str) {
  var pattern = new RegExp(
    "^(https?:\\/\\/)?" +
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
      "((\\d{1,3}\\.){3}\\d{1,3}))" +
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
      "(\\?[;&a-z\\d%_.~+=-]*)?" +
      "(\\#[-a-z\\d_]*)?$",
    "i"
  );
  return !!pattern.test(str);
}

async function fetchOpenGraphData(url) {
  const response = await fetch(url);
  const html = await response.text();

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const ogData = {};

  const metaTags = doc.querySelectorAll('meta[property^="og:"]');
  metaTags.forEach((tag) => {
    ogData[tag.getAttribute("property")] = tag.getAttribute("content");
  });
  console.log("ogData from fetchogdata : ", ogData);
  return ogData;
}

async function unfilteredCollectionId() {
  const authToken = sessionToken;
  console.log("authtoken from unfilteredCollectionId ", authToken);

  const url = `${process.env.CURATEIT_API_URL}/api/get-user-collections`;
  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.length > 0) {
      console.log("ID of the first collection:", data[0].id);
      return data[0].id;
    } else {
      console.log("No collections found.");
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

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

async function saveGemHandler(conversation, ctx) {
  if (sessionId == 0 && sessionToken == 0) {
    await ctx.reply("User not logged in");
    return;
  }
  console.log("sessionId in saveGemHandler : ", sessionId);

  let link = ctx.session.urlToSave;

  if (!link.startsWith("http://") && !link.startsWith("https://")) {
    link = "https://" + link;
  }
  let ogData = await fetchOpenGraphData(link);
  delete ctx.session.urlToSave;
  console.log("ogData : ", ogData);
  let title = ogData["og:title"];
  let desc = ogData["og:description"];
  let url = link;
  let imgUrl = ogData["og:image"];
  let collectionId = await unfilteredCollectionId();
  console.log("collectionId : ", collectionId);

  const baseUrl = `${process.env.CURATEIT_API_URL}/api/gems?populate=tags`;
  const authToken = sessionToken;

  console.log("authToken from saveLink : ", authToken);
  const body = {
    data: {
      title: title,
      description: desc,
      expander: [],
      media_type: "Link",
      author: sessionId,
      url: url,
      media: {
        covers: [imgUrl],
      },
      metaData: {
        type: "Link",
        title: title,
        icon: "",
        url: url,
        covers: [imgUrl],
        isYoutube: false,
      },
      collection_gems: collectionId,
      remarks: "",
      tags: [],
      is_favourite: false,
      showThumbnail: true,
    },
  };

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("Successfully saved link:", link);
    await ctx.reply("Successfully saved the link");
    return;
  } catch (error) {
    console.error("Error saving link:", error);
    await ctx.reply("Could not save the link, please try again");
    return;
  }
  return;
}

async function searchGemHandler(conversation, ctx) {
  if (sessionId == 0 && sessionToken == 0) {
    await ctx.reply("User not logged in");
    return;
  }
  const query = ctx.session.searchQuery;
  await ctx.reply(`Searching for: ${query}`);
  delete ctx.session.searchQuery;
  return;
}

bot.use(createConversation(searchGemHandler));
bot.use(createConversation(saveGemHandler));
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
/save <YOUR GEM URL (http or https)>
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

bot.command("save", async (ctx) => {
  const messageText = ctx.message.text;
  const args = messageText.split(" ");

  if (args.length < 2) {
    return ctx.reply("Please provide a URL after /save");
  }

  const url = args[1];

  if (isValidURL(url)) {
    ctx.session.urlToSave = url;
    await ctx.conversation.enter("saveGemHandler");
  } else {
    return ctx.reply(
      "Invalid URL provided. Please enter a valid URL after /save"
    );
  }
});

// Search command
bot.command("search", async (ctx) => {
  const query = ctx.message.text.split(" ").slice(1).join(" ");
  if (!query) {
    return ctx.reply("Please provide a search query after /search");
  }
  ctx.session.searchQuery = query;
  await ctx.conversation.enter("searchGemHandler");
});

// Always exit any conversation upon /cancel
bot.command("cancel", async (ctx) => {
  await ctx.conversation.exit();
  await ctx.reply("Leaving the conversation.");
});

// check login status
bot.command("check", async (ctx) => {
  console.log("sessionId : ", sessionId);
  console.log("sessionToken : ", sessionToken);
  if (sessionId == 0 && sessionToken == 0) {
    await ctx.reply("You are not logged in.");
  } else {
    await ctx.reply("You are logged in.");
  }
});

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
