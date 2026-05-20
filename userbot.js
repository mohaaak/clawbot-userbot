const express = require("express");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  API_ID:             parseInt(process.env.TELEGRAM_API_ID),
  API_HASH:           process.env.TELEGRAM_API_HASH,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID,
  SIGNAL_CHANNEL_ID:  process.env.SIGNAL_CHANNEL_ID,
  SESSION_STRING:     process.env.TELEGRAM_SESSION || "",
  PORT:               process.env.PORT || 3000,
};

// ─── STORE CLIENT ─────────────────────────────────────────────────────────────
let telegramClient = null;
let pendingClient  = null;
let sessionString  = CONFIG.SESSION_STRING;

// ─── SEND TO BOT ──────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
app.get("/login", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ClawBot Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 32px 24px;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p  { color: #888; font-size: 14px; margin-bottom: 24px; }
    label { font-size: 13px; color: #aaa; display: block; margin-bottom: 6px; }
    input {
      width: 100%;
      background: #111;
      border: 1px solid #444;
      border-radius: 10px;
      color: #fff;
      font-size: 16px;
      padding: 14px;
      margin-bottom: 16px;
      outline: none;
    }
    input:focus { border-color: #00c896; }
    button {
      width: 100%;
      background: #00c896;
      border: none;
      border-radius: 10px;
      color: #000;
      font-size: 16px;
      font-weight: 700;
      padding: 16px;
      cursor: pointer;
      margin-top: 8px;
    }
    button:active { opacity: 0.8; }
    .status {
      margin-top: 20px;
      padding: 14px;
      border-radius: 10px;
      font-size: 14px;
      display: none;
    }
    .success { background: #0d2e1f; border: 1px solid #00c896; color: #00c896; }
    .error   { background: #2e0d0d; border: 1px solid #ff4444; color: #ff4444; }
    .step { display: none; }
    .step.active { display: block; }
    .logo { font-size: 40px; margin-bottom: 16px; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">🤖</div>
  <h1>ClawBot Login</h1>
  <p>Connect your Telegram account to monitor signal groups automatically.</p>

  <!-- Step 1: Phone -->
  <div class="step active" id="step1">
    <label>Your Telegram Phone Number</label>
    <input type="tel" id="phone" placeholder="+32 ..." />
    <button onclick="sendPhone()">Send Code →</button>
    <div class="status" id="status1"></div>
  </div>

  <!-- Step 2: Code -->
  <div class="step" id="step2">
    <label>Code sent to your Telegram</label>
    <input type="number" id="code" placeholder="12345" />
    <label style="margin-top:8px">2FA Password (leave empty if none)</label>
    <input type="password" id="password" placeholder="Optional" />
    <button onclick="sendCode()">Verify & Connect →</button>
    <div class="status" id="status2"></div>
  </div>

  <!-- Step 3: Success -->
  <div class="step" id="step3">
    <div class="status success" style="display:block">
      ✅ Successfully connected! ClawBot is now monitoring your signal groups 24/7. You can close this page.
    </div>
  </div>
</div>

<script>
async function sendPhone() {
  const phone = document.getElementById('phone').value.trim();
  const status = document.getElementById('status1');
  status.style.display = 'block';
  status.className = 'status';
  status.textContent = '⏳ Sending code...';

  try {
    const res = await fetch('/send-code', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (data.success) {
      status.className = 'status success';
      status.textContent = '✅ Code sent to your Telegram!';
      setTimeout(() => {
        document.getElementById('step1').classList.remove('active');
        document.getElementById('step2').classList.add('active');
      }, 1000);
    } else {
      status.className = 'status error';
      status.textContent = '❌ ' + (data.error || 'Failed to send code');
    }
  } catch(e) {
    status.className = 'status error';
    status.textContent = '❌ Network error. Try again.';
  }
}

async function sendCode() {
  const code     = document.getElementById('code').value.trim();
  const password = document.getElementById('password').value.trim();
  const status   = document.getElementById('status2');
  status.style.display = 'block';
  status.className = 'status';
  status.textContent = '⏳ Verifying...';

  try {
    const res = await fetch('/verify-code', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ code, password })
    });
    const data = await res.json();
    if (data.success) {
      status.className = 'status success';
      status.textContent = '✅ Connected!';
      document.getElementById('step2').classList.remove('active');
      document.getElementById('step3').classList.add('active');
    } else {
      status.className = 'status error';
      status.textContent = '❌ ' + (data.error || 'Wrong code');
    }
  } catch(e) {
    status.className = 'status error';
    status.textContent = '❌ Network error. Try again.';
  }
}
</script>
</body>
</html>
  `);
});

// ─── SEND CODE ENDPOINT ───────────────────────────────────────────────────────
app.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    pendingClient = new TelegramClient(
      new StringSession(""),
      CONFIG.API_ID,
      CONFIG.API_HASH,
      { connectionRetries: 5 }
    );
    await pendingClient.connect();
    await pendingClient.sendCode({ apiId: CONFIG.API_ID, apiHash: CONFIG.API_HASH }, phone);
    global.pendingPhone = phone;
    console.log("Code sent to:", phone);
    res.json({ success: true });
  } catch (err) {
    console.error("Send code error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

// ─── VERIFY CODE ENDPOINT ─────────────────────────────────────────────────────
app.post("/verify-code", async (req, res) => {
  try {
    const { code, password } = req.body;
    await pendingClient.start({
      phoneNumber:   async () => global.pendingPhone,
      phoneCode:     async () => code,
      password:      async () => password || "",
      onError:       (err) => { throw err; },
    });

    sessionString  = pendingClient.session.save();
    telegramClient = pendingClient;
    pendingClient  = null;

    console.log("✅ Session generated successfully");
    console.log("SESSION:", sessionString);

    // Notify via Telegram
    await sendTelegram(
      "✅ <b>ClawBot Userbot Connected!</b>\n\nNow monitoring signal groups 24/7 automatically."
    );

    // Start monitoring
    startMonitoring();

    res.json({ success: true });
  } catch (err) {
    console.error("Verify error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

// ─── SIGNAL DETECTION ─────────────────────────────────────────────────────────
function isSignal(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("buy")    || lower.includes("sell")   ||
    lower.includes("entry")  || lower.includes("sl")     ||
    lower.includes("tp")     || lower.includes("xauusd") ||
    lower.includes("gold")   || lower.includes("eurusd") ||
    lower.includes("gbpusd") || lower.includes("long")   ||
    lower.includes("short")  || lower.includes("pips")   ||
    lower.includes("target")
  );
}

function formatSignal(text, groupName) {
  return `
📡 <b>SIGNAL RECEIVED</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>From:</b> ${groupName}
⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London" })} London

📋 <b>Signal:</b>
<code>${text}</code>
━━━━━━━━━━━━━━━━━━━━
🤖 ClawBot — Signal Monitor`.trim();
}

// ─── MONITOR SIGNAL GROUPS ────────────────────────────────────────────────────
const { NewMessage } = require("telegram/events");

async function startMonitoring() {
  if (!telegramClient) return;

  const SIGNAL_GROUPS = [
    "GHP",
    "MirFX",
    "XAUUSD",
  ];

  telegramClient.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.text) return;

      const text = message.text.trim();
      if (!isSignal(text)) return;

      let groupName = "Signal Group";
      try {
        const chat = await message.getChat();
        groupName = chat.title || chat.username || "Signal Group";
      } catch (e) {}

      const isMonitored = SIGNAL_GROUPS.some(g =>
        groupName.toLowerCase().includes(g.toLowerCase())
      );
      if (!isMonitored) return;

      console.log(`📡 Signal from ${groupName}`);
      await sendTelegram(formatSignal(text, groupName));

    } catch (err) {
      console.error("Monitor error:", err.message);
    }
  }, new NewMessage({}));

  console.log("👁 Monitoring signal groups...");
  await sendTelegram("👁 <b>Signal Monitor Active</b>\nWatching all 3 groups 24/7.");
}

// ─── AUTO START IF SESSION EXISTS ────────────────────────────────────────────
async function autoStart() {
  if (!sessionString) {
    console.log("No session yet. Go to /login to connect.");
    return;
  }
  try {
    telegramClient = new TelegramClient(
      new StringSession(sessionString),
      CONFIG.API_ID,
      CONFIG.API_HASH,
      { connectionRetries: 5 }
    );
    await telegramClient.connect();
    console.log("✅ Auto-connected with saved session");
    startMonitoring();
  } catch (err) {
    console.error("Auto-connect failed:", err.message);
  }
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "🟢 ClawBot Userbot running",
    connected: !!telegramClient,
    login_url: "/login",
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Server running on port ${CONFIG.PORT}`);
  autoStart();
});
