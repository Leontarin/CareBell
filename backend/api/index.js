// root/api/index.js
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// ─── Route handlers ───────────────────────────────────────────────────────────
const userRoute          = require('../routes/users');
const contactRoute       = require('../routes/contacts');
const foodRoute          = require('../routes/foods');
const medicationRoute    = require('../routes/medications');
const bellaReminderRoute = require('../routes/bellaReminders');
const newsRoute          = require('../routes/news');
const exercisesRoute     = require('../routes/exercises');
const reminderRoute      = require('../routes/reminders');
const roomsRoute         = require('../routes/rooms');
const ttsRoute           = require('../routes/tts');

// ─── App & Server setup ────────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], credentials: false },
  transports: ['websocket','polling']
});

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// ─── MongoDB Connection with Retry & Initial Promise ──────────────────────────
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5_000,  // fail if we can’t connect in 5s
  bufferCommands: true,            // don’t buffer commands while disconnected
};

// 1) Kick off the very first connection and keep its promise
const initialConnection = mongoose
  .connect(process.env.MONGODB_URI, MONGO_OPTIONS)
  .then(() => console.log('✅ MongoDB initial connection'))
  .catch(err => {
    console.error('❌ MongoDB initial connection failed:', err);
    // let retry loop handle further attempts
  });

// 2) Retry loop for ongoing connectivity
async function connectWithRetry() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, MONGO_OPTIONS);
    console.log('✅ MongoDB reconnected');
  } catch (err) {
    console.error('⚠️ MongoDB connection error, retrying in 5s:', err);
    setTimeout(connectWithRetry, 5_000);
  }
}
connectWithRetry();

// 3) Runtime logging
mongoose.connection.on('error', err =>
  console.error('MongoDB runtime error:', err)
);
mongoose.connection.on('disconnected', () =>
  console.warn('MongoDB disconnected — retrying…')
);

// ─── Middleware to wait for the first connection ───────────────────────────────
app.use(async (req, res, next) => {
  try {
    await initialConnection;
    next();
  } catch (err) {
    console.error('DB not ready, rejecting request:', err);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});

// ─── Socket.IO Integration ────────────────────────────────────────────────────
const setupSockets = require('../sockets');
setupSockets(io);

// ─── Static Resources ─────────────────────────────────────────────────────────
app.use(
  '/resources',
  express.static(path.join(__dirname, '..', 'resources'))
);

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
app.use('/tts',           ttsRoute);

app.get('/', (_req, res) => {
  res.send('API is live! 🚀');
});

// ─── Start server locally ─────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 4443;

  function startServer() {
    server.listen(PORT);
  }

  server
    .on('listening', () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
    })
    .on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${PORT} in use, retrying in 5s…`);
        setTimeout(() => {
          server.close();
          startServer();
        }, 5000);
      } else {
        console.error('🔥 Server error:', err);
        process.exit(1);
      }
    });

  startServer();
}

module.exports = server;
