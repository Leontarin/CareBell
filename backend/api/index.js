// root/api/index.js
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// ─── Route handlers ───────────────────────────────────────────────────────────
const userRoute         = require('../routes/users');
const contactRoute      = require('../routes/contacts');
const foodRoute         = require('../routes/foods');
const medicationRoute   = require('../routes/medications');
const bellaReminderRoute= require('../routes/bellaReminders');
const newsRoute         = require('../routes/news');
const exercisesRoute    = require('../routes/exercises');
const reminderRoute     = require('../routes/reminders');
const roomsRoute        = require('../routes/rooms');
const ttsRoute          = require('../routes/tts');
const resourcesPath     = express.static(path.join(__dirname, '..', 'resources'));

// ─── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], credentials: false },
  transports: ['websocket','polling']
});

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// ─── Database with retry ───────────────────────────────────────────────────────
const MONGO_OPTIONS = {
  // these behaviors are default in driver 4.x+  
  serverSelectionTimeoutMS: 5_000,  // fail if we can’t connect in 5s
  bufferCommands: false,            // don’t buffer commands while disconnected
};

async function connectWithRetry() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, MONGO_OPTIONS);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    setTimeout(connectWithRetry, 5_000);
  }
}
connectWithRetry();

// log runtime errors/disconnects
mongoose.connection.on('error', err =>
  console.error('MongoDB runtime error:', err)
);
mongoose.connection.on('disconnected', () =>
  console.warn('MongoDB disconnected — retrying…')
);

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

// ─── Start server locally ─────────────────────────────────────────────────────
// Only when run directly (e.g. `node index.js`), not when imported by Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 4443;
  server.listen(PORT, () => {
    console.log(`✅ Server listening on http://localhost:${PORT}`);
  });
}

module.exports = server;
