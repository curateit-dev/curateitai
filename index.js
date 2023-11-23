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
const otpGenerator = require("otp-generator");
const generateOtp = () => {
  const otp = otpGenerator.generate(7, {
    upperCaseAlphabets: true,
    specialChars: false,
  });
  return otp;
};

require("dotenv").config();
const nodeMailer = require("nodemailer");
async function sendMail(username, email) {
  const transporter = nodeMailer.createTransport({
    service: "gmail",
    auth: {
      user: "otptest43@gmail.com",
      pass: "lufaojxprbvftfyk",
    },
  });
  const currOtp = generateOtp();
  const mailOptions = {
    from: "otptest43@gmail.com", // sender address
    to: email,
    subject: "Login into CurateitAI", // Subject line
    text: `Hi ${username}, Please login using this otp - ${currOtp}`, // plain text body
  };
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("mail sent");
    return currOtp;
  } catch (error) {
    console.log("error : ", error);
  }
}
const chatThreads = new Map();
let currUsername = "User";
const specialChars = /[-\\[\]{}()*+?.,^$|#\s]/g;
const youtubeRegex =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;

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
    return;
  }
  await ctx.reply("Please enter your email:");
  const email = await conversation.wait();
  const sentOtp = await sendMail(ctx.from.username, email.message.text);
  if (sentOtp) {
    await ctx.reply("OTP has been sent to your mail");
  }
  await ctx.reply("Please enter the OTP:");
  const password = await conversation.wait();
  console.log(`${password.message.text}<==>${sentOtp}`);
  if (password === sentOtp) {
    await ctx.reply(`Welcome, ${ctx.from.username}`);
  } else {
    await ctx.reply("Incorrect OTP");
  }

  // try {
  //   const response = await axios.post(
  //     `${process.env.CURATEIT_API_URL}/api/auth/local`,
  //     {
  //       identifier: email.message.text,
  //       password: password.message.text,
  //     }
  //   );
  //   sessionToken = response.data.jwt;
  //   sessionId = response.data.user.id;
  //   currUsername = response.data.user.username;
  //   console.log("sessionId : ", sessionId);
  //   console.log("sessionToken : ", sessionToken);
  //   isLoggedIn = true;
  //   await ctx.reply("Login Successful");
  // } catch (error) {
  //   console.log("error : ", error);
  //   if (error.response && error.response.status === 400) {
  //     await ctx.reply("Invalid credentials");
  //   } else {
  //     await ctx.reply("Login failed. Please try again.");
  //   }
  // }

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
  // await ctx.reply(`Searching for: ${query}`);
  delete ctx.session.searchQuery;
  // console.log("Search Gem called with params : ", chatId, " : ", query);
  const authToken = sessionToken;

  const filterBy = "title";
  const url = `${process.env.CURATEIT_API_URL}/api/filter-search?filterby=${filterBy}&queryby=${query}&termtype=contains&page=1&perPage=20`;
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
    if (data && data.totalCount > 0) {
      const res = {
        title: data?.finalRes[0]?.title.replace(specialChars, "\\$&"),
        url: data?.finalRes[0]?.url.replace(specialChars, "\\$&"),
      };
      await ctx.reply(`**Found a Gem** :\\- [${res.title}](${res.url})`, {
        parse_mode: "MarkdownV2",
      });
      return res;
    } else {
      console.log("No gem found.");
      await ctx.reply("No Gem Found");
    }
  } catch (error) {
    console.error("Error fetching gem data:", error);
  }
  return;
}

async function websiteTextHandler(conversation, ctx) {
  // extract text from normal website
  let link = ctx.session.webUrlToRead;
  if (!link.startsWith("http://") && !link.startsWith("https://")) {
    link = "https://" + link;
  }
  delete ctx.session.webUrlToRead;
  const url = `${
    process.env.CURATEIT_AI_API
  }/extract_article/${encodeURIComponent(link)}/0/4095`;

  try {
    console.log("url : ", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("data : ", data);
    await ctx.reply(data.text);
    console.log("data : ", data.text);
    return;
  } catch (error) {
    console.error("Error Extracting text : ", error);
    await ctx.reply("Error Extracting text");
    return;
  }
}

async function youtubeTextHandler(conversation, ctx) {
  // extract text from youtube transcript
  let link = ctx.session.ytUrlToRead;
  if (!link.startsWith("http://") && !link.startsWith("https://")) {
    link = "https://" + link;
  }
  delete ctx.session.ytUrlToRead;
  const videoId = link.match(/v=([a-zA-Z0-9_-]+)/)?.[1];

  if (!videoId) {
    await ctx.reply("Invalid YouTube url");
    return;
  }

  const url = `${process.env.CURATEIT_AI_API}/transcript/${videoId}/0/4095`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    await ctx.reply(data.transcription);
    return;
  } catch (error) {
    console.error("Error fetching transcription:", error);
    await ctx.reply("Error fetching transcription");
    return;
  }
}

bot.use(createConversation(websiteTextHandler));
bot.use(createConversation(youtubeTextHandler));
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

/login
/save <YOUR GEM URL>
/search <YOUR GEM TITLE>
/help
`)
);

// Give Examples of all available Commands
bot.command("help", async (ctx) =>
  ctx.reply(`
/start - Start Command

/login - Login to Curateit

/save <YOUR GEM URL>
e.g. /save https://en.wikipedia.org/wiki/india

/help - Help Window

/search <YOUR GEM TITLE>
e.g. /search India

/check - Checks you login status
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

// Transcript command
bot.command("read", async (ctx) => {
  const messageText = ctx.message.text;
  const args = messageText.split(" ");

  if (args.length < 2) {
    return ctx.reply("Please provide a URL after /read");
  }

  let url = args[1];
  url = url.trim();
  ctx.session.webUrlToRead = url;
  ctx.session.ytUrlToRead = url;
  if (youtubeRegex.test(url)) {
    await ctx.conversation.enter("youtubeTextHandler");
  } else {
    await ctx.conversation.enter("websiteTextHandler");
  }
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

bot.on("message", (ctx) => {
  if (sessionId == 0 && sessionToken == 0) {
    ctx.reply("You are not logged in.");
  } else {
    console.log("Got a message!");
    // ctx.reply("Got a message!");
  }
});

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
