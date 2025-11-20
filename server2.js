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
