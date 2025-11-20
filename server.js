// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

// ✅ NEW: http + WebSocket
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ NEW: wrap Express in an HTTP server
const server = http.createServer(app);

// ✅ NEW: WebSocket server
const wss = new WebSocket.Server({ server });

// ✅ NEW: track active users
let activeUsers = 0;

function broadcastUserCount() {
  const payload = JSON.stringify({ type: "userCount", count: activeUsers });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", (ws) => {
  activeUsers++;
  console.log("New user connected. Active:", activeUsers);
  broadcastUserCount();

  ws.on("close", () => {
    activeUsers--;
    console.log("User disconnected. Active:", activeUsers);
    broadcastUserCount();
  });
});

// -------------------------------------------
// define file paths and helper functions
// -------------------------------------------
const MESSAGES_JSON = path.join(__dirname, "message_board.json");
const MESSAGES_CSV = path.join(__dirname, "message_board.csv");

function loadMessages() {
  if (!fs.existsSync(MESSAGES_JSON)) return [];
  try {
    const raw = fs.readFileSync(MESSAGES_JSON, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading messages JSON:", e);
    return [];
  }
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_JSON, JSON.stringify(messages, null, 2), "utf8");
}

function appendMessageToCsv(messageObj) {
  const { id, author, message, createdAt } = messageObj;

  const esc = (str = "") => String(str).replace(/"/g, '""');

  const row =
    [id, createdAt, author || "Anonymous", message]
      .map((value) => `"${esc(value)}"`)
      .join(",") + "\n";

  if (!fs.existsSync(MESSAGES_CSV)) {
    const header = ["id", "created_at", "author", "message"].join(",") + "\n";
    fs.writeFileSync(MESSAGES_CSV, header, "utf8");
  }

  fs.appendFile(MESSAGES_CSV, row, (err) => {
    if (err) {
      console.error("Error writing message CSV:", err);
    }
  });
}

// Serve static files (your index.html, CSS, images)
app.use(express.static(path.join(__dirname, "public")));

// Parse form data
app.use(bodyParser.urlencoded({ extended: false }));

// Parse JSON bodies
app.use(bodyParser.json());

// Configure email transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Handle form submission
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  console.log("Form submission:", { name, email, message });

  const mailToYou = {
    from: `"Website Contact" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `New message from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  };

  const mailToSender = {
    from: `"Your Site" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Thanks for reaching out",
    text: `Hi ${name},

Thanks for your message! I’ll get back to you as soon as I can.

— Your Name`,
  };

  try {
    await transporter.sendMail(mailToYou);
    await transporter.sendMail(mailToSender);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Thank you</title>
        <style>
          body { 
            font-family: system-ui, sans-serif; 
            background: #020617; 
            color: #e5e7eb; 
            display:flex; 
            align-items:center; 
            justify-content:center; 
            height:100vh;
          }
          .box {
            background:#0b1020; 
            padding:24px 30px; 
            border-radius:16px;
            border:1px solid rgba(148,163,184,0.4);
            text-align:center;
            max-width:400px;
          }
          a {
            color:#38bdf8;
            text-decoration:none;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Thank you!</h1>
          <p>Your message has been sent. Check your inbox for a confirmation email.</p>
          <p><a href="/">Back to website</a></p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).send("Something went wrong. Please try again later.");
  }
});

app.post("/quiz", (req, res) => {
  const {
    who_caring_for,
    dementia_dx,
    recent_changes,
    biggest_challenge,
    join_cohort_interest,
  } = req.body;

  let stageNumber = 1;
  switch (recent_changes) {
    case "occasional_memory_lapses":
      stageNumber = 1;
      break;
    case "noticeable_confusion_task_difficulty":
      stageNumber = 2;
      break;
    case "frequent_repetition_safety_concerns":
      stageNumber = 3;
      break;
    case "significant_help_daily_care":
      stageNumber = 4;
      break;
    default:
      stageNumber = 1;
  }

  const stageLabel = `Stage ${stageNumber} Cohort`;

  const csvPath = path.join(__dirname, "quiz_responses.csv");
  const timestamp = new Date().toISOString();
  const esc = (str = "") => String(str).replace(/"/g, '""');

  const row = [
    timestamp,
    who_caring_for,
    dementia_dx,
    recent_changes,
    biggest_challenge,
    join_cohort_interest,
    stageLabel,
  ]
    .map((value) => `"${esc(value)}"`)
    .join(",") + "\n";

  if (!fs.existsSync(csvPath)) {
    const header = [
      "timestamp",
      "who_caring_for",
      "dementia_dx",
      "recent_changes",
      "biggest_challenge",
      "join_cohort_interest",
      "stage",
    ].join(",") + "\n";
    fs.writeFileSync(csvPath, header, "utf8");
  }

  fs.appendFile(csvPath, row, (err) => {
    if (err) {
      console.error("Error writing CSV:", err);
      return res
        .status(500)
        .send("Something went wrong saving your response. Please try again.");
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Your Caregiver Cohort Match</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color-scheme: light dark;
            --bg: #020617;
            --bg-alt: #0b1020;
            --accent: #4f46e5;
            --text: #e5e7eb;
            --muted: #9ca3af;
            --border: rgba(148, 163, 184, 0.4);
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: radial-gradient(circle at top, #111827 0, #020617 45%, #000 100%);
            color: var(--text);
            min-height: 100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding: 24px 16px;
          }
          .card {
            max-width: 500px;
            width: 100%;
            background: var(--bg-alt);
            border-radius: 24px;
            border: 1px solid var(--border);
            padding: 20px 20px 22px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.9);
          }
          h1 {
            font-size: 1.5rem;
            margin-bottom: 8px;
          }
          h2 {
            font-size: 1.1rem;
            margin: 10px 0 6px;
          }
          p {
            font-size: 0.92rem;
            color: var(--muted);
            margin-bottom: 8px;
          }
          .stage-pill {
            display:inline-flex;
            align-items:center;
            gap:8px;
            font-size:0.8rem;
            padding:4px 10px;
            border-radius:999px;
            border:1px solid var(--border);
            background: rgba(15, 23, 42, 0.9);
            margin-bottom:8px;
          }
          .stage-dot {
            width:8px;
            height:8px;
            border-radius:999px;
            background:#22c55e;
          }
          a.button-link {
            display:inline-flex;
            margin-top:10px;
            padding:8px 14px;
            border-radius:999px;
            text-decoration:none;
            background: linear-gradient(135deg, #4f46e5, #6366f1);
            color:#f9fafb;
            font-size:0.9rem;
            font-weight:500;
          }
          a.secondary {
            background:none;
            border:1px solid var(--border);
            color:var(--muted);
            margin-left:8px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="stage-pill">
            <span class="stage-dot"></span>
            <span>Your Best Match: ${stageLabel}</span>
          </div>
          <h1>Your caregiver cohort match</h1>
          <p>
            Based on your answers, you’re best aligned with the <strong>${stageLabel}</strong>.
          </p>

          <h2>What caregivers in this stage often experience</h2>
          <p>
            Caregivers in this stage are navigating changes in memory, behavior, and daily routines.
            Many are trying to understand what’s “normal,” prepare for medical visits, and balance
            safety with independence.
          </p>

          <h2>Example cohort activities</h2>
          <p>
            · Weekly small-group check-ins<br/>
            · Stage-specific education and tools<br/>
            · Space to share what’s working (and what isn’t) with peers in a similar spot
          </p>

          <a href="/quiz.html" class="button-link">Retake the quiz</a>
          <a href="/" class="button-link secondary">Back to homepage</a>
        </div>
      </body>
      </html>
    `);
  });
});

// Get all messages
app.get("/api/messages", (req, res) => {
  const messages = loadMessages();
  res.json(messages);
});

// Add a new message
app.post("/api/messages", (req, res) => {
  const { author, message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const msg = {
    id: Date.now().toString(),
    author: (author || "Anonymous").trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  const messages = loadMessages();
  messages.push(msg);
  try {
    saveMessages(messages);
    appendMessageToCsv(msg);
    res.status(201).json({ success: true, message: msg });
  } catch (e) {
    console.error("Error saving message:", e);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// ✅ IMPORTANT: listen on the HTTP server, not app
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
