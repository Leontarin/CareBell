// root/api/index.js
require('dotenv').config();                 // loads .env
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' }); // overrides for local
}
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
const authRoute = require('../routes/auth');
const cookieParser = require('cookie-parser');

// ─── App & Server setup ────────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_ORIGIN, methods: ["GET","POST"], credentials: true },
  transports: ['websocket','polling']
});
app.set('io', io);


app.use(cors({
  origin: process.env.FRONTEND_ORIGIN, // "https://carebell.vercel.app"
  credentials: true,                   // allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// ─── MongoDB Connection with Retry & Initial Promise ──────────────────────────
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5_000, // fail if we can’t connect in 5s
  bufferCommands: false           // immediately throw if not connected
};

mongoose.set('bufferCommands', false);

let connectionPromise;
async function connectWithRetry() {
  try {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, MONGO_OPTIONS);
    await connectionPromise;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    setTimeout(connectWithRetry, 5_000);
  }
}

mongoose.connection.on('error', err =>
  console.error('MongoDB runtime error:', err)
);
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected — retrying…');
  connectWithRetry();
});

connectWithRetry();

// ─── Middleware to wait for the first connection ───────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectionPromise;
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
app.use('/auth', authRoute);
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
