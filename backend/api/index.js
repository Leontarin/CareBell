// root/api/index.js
require('dotenv').config();
const express = require('express');
const dbConnect = require('./db');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// ─── Route handlers ───────────────────────────────────────────────────────────
const userRoute         = require('../routes/users');
const contactRoute      = require('../routes/contacts');
const foodRoute         = require('../routes/foods');
const medicationRoute   = require('../routes/medications');
const bellaReminderRoute = require('../routes/bellaReminders');
const newsRoute         = require('../routes/news');
const exercisesRoute    = require('../routes/exercises');
const reminderRoute     = require('../routes/reminders');
const roomsRoute        = require('../routes/rooms');
const ttsRoute          = require('../routes/tts');
const resourcesPath     = express.static(path.join(__dirname, '..', 'resources'));

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────
dbConnect().catch(err => {
  // already logged in db.js; you could process.exit(1) if you prefer
});

// ─── Socket.IO Integration ───────────────────────────────────────────────────
const setupSockets = require('../sockets');
setupSockets(io);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/users',         userRoute);
app.use('/contacts',      contactRoute);
app.use('/foods',         foodRoute);
app.use('/medications',   medicationRoute);
app.use('/bellaReminders', bellaReminderRoute);
app.use('/news',          newsRoute);
app.use('/exercises',     exercisesRoute);
app.use('/reminders',     reminderRoute);
app.use('/rooms',         roomsRoute);
app.use('/resources',     resourcesPath);
app.use('/tts',           ttsRoute);

app.get('/', (_req, res) => {
  res.send('API is live! 🚀');
});

// only start a listener when run directly (not when imported by Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 4443;
  server.listen(PORT, () => {
    console.log(`✅ API started on ${PORT}`);
  });
}

// for Vercel serverless
module.exports = server;