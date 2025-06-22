require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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
const resourcesPath = express.static(path.join(__dirname, '..', 'resources'));

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
const server = createServer(app); // Create HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// ─── Socket.IO Integration ───────────────────────────────────────────────────
const setupSockets = require('../sockets');
setupSockets(io);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/users',        userRoute);
app.use('/contacts',     contactRoute);
app.use('/foods',        foodRoute);
app.use('/medications',  medicationRoute);
app.use('/bellaReminders', bellaReminderRoute);
app.use('/news',         newsRoute);
app.use('/exercises',    exercisesRoute);
app.use('/reminders',    reminderRoute);
app.use('/rooms',        roomsRoute);
app.use('/tts',          ttsRoute);
app.use('/resources',    resourcesPath);

app.get('/', (_req, res) => {
  res.send('API is live on Vercel! 🚀');
});

// only start a listener when run directly (not when imported by Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 4443;
  server.listen(PORT, () => { // Use server.listen instead of app.listen
    console.log(`✅ API with Socket.IO started locally on ${PORT}`);
  });
}

// Export the server for Vercel
module.exports = server;