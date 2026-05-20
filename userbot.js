const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const readline = require("readline");
const fs = require("fs");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  API_ID:             parseInt(process.env.TELEGRAM_API_ID),
  API_HASH:           process.env.TELEGRAM_API_HASH,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID,
  SESSION_FILE:       "./session.txt",
};

// ─── SIGNAL GROUPS TO MONITOR ─────────────────────────────────────────────────
const SIGNAL_GROUPS = [
  "GHP 🦁 VIP-JACKPOT 🇳🇱 FX",
  "MirFX Trading",
  "🇯🇵XAUUSD🇯🇵",
];

// ─── SEND TO YOUR PERSONAL BOT ────────────────────────────────────────────────
async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("Telegram send error:", err.message);
  }
}

// ─── DETECT IF MESSAGE IS A TRADING SIGNAL ───────────────────────────────────
function isSignal(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("buy") ||
    lower.includes("sell") ||
    lower.includes("entry") ||
    lower.includes("sl") ||
    lower.includes("tp") ||
    lower.includes("xauusd") ||
    lower.includes("gold") ||
    lower.includes("eurusd") ||
    lower.includes("gbpusd") ||
    lower.includes("long") ||
    lower.includes("short")
  );
}

// ─── FORMAT FORWARDED SIGNAL ──────────────────────────────────────────────────
function formatSignal(groupName, message) {
  return `
📡 <b>SIGNAL RECEIVED</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>Group:</b> ${groupName}
⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London" })} London

📋 <b>Signal:</b>
<code>${message}</code>
━━━━━━━━━━━━━━━━━━━━
🤖 ClawBot — Signal Monitor`.trim();
}

// ─── LOAD OR CREATE SESSION ───────────────────────────────────────────────────
function loadSession() {
  try {
    if (fs.existsSync(CONFIG.SESSION_FILE)) {
      const session = fs.readFileSync(CONFIG.SESSION_FILE, "utf8").trim();
      console.log("✅ Session loaded from file");
      return session;
    }
  } catch (err) {
    console.log("No session file found, starting fresh");
  }
  return "";
}

function saveSession(session) {
  fs.writeFileSync(CONFIG.SESSION_FILE, session);
  console.log("✅ Session saved");
}

// ─── MAIN USERBOT ─────────────────────────────────────────────────────────────
async function startUserbot() {
  const sessionString = loadSession();
  const session = new StringSession(sessionString);

  const client = new TelegramClient(session, CONFIG.API_ID, CONFIG.API_HASH, {
    connectionRetries: 5,
  });

  // Input handler for login (only needed first time)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (text) => new Promise((res) => rl.question(text, res));

  await client.start({
    phoneNumber: async () => {
      const phone = await question("📱 Enter your Telegram phone number (with country code, e.g. +32...): ");
      return phone.trim();
    },
    password: async () => {
      const pass = await question("🔐 Enter your 2FA password (or press Enter if none): ");
      return pass.trim();
    },
    phoneCode: async () => {
      const code = await question("📩 Enter the code Telegram sent you: ");
      return code.trim();
    },
    onError: (err) => console.error("Login error:", err),
  });

  // Save session so we don't need to login again
  saveSession(client.session.save());
  rl.close();

  console.log("✅ Userbot logged in successfully!");
  await sendTelegram("👁 <b>ClawBot Signal Monitor is now LIVE</b>\n\nMonitoring groups:\n" + SIGNAL_GROUPS.map(g => `• ${g}`).join("\n"));

  // ─── LISTEN FOR NEW MESSAGES ───────────────────────────────────────────────
  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.text) return;

      const text = message.text.trim();
      if (!isSignal(text)) return;

      // Get group name
      let groupName = "Unknown Group";
      try {
        const chat = await message.getChat();
        groupName = chat.title || chat.username || "Unknown Group";
      } catch (e) {}

      // Only forward from monitored groups
      const isMonitored = SIGNAL_GROUPS.some(g =>
        groupName.toLowerCase().includes(g.toLowerCase().slice(0, 10))
      );

      if (!isMonitored) return;

      console.log(`📡 Signal from ${groupName}: ${text.slice(0, 50)}...`);
      await sendTelegram(formatSignal(groupName, text));

    } catch (err) {
      console.error("Event handler error:", err.message);
    }
  }, new NewMessage({}));

  console.log("👁 Monitoring signal groups 24/7...");

  // Keep alive
  setInterval(() => {
    console.log(`💓 Userbot alive — ${new Date().toISOString()}`);
  }, 5 * 60 * 1000);
}

startUserbot().catch(console.error);
