// backend/api/app.js

const express      = require('express');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const { URL }      = require('url');
const path         = require('path');

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
const authRoute          = require('../routes/auth');
const adminUsersRoute    = require("../routes/admin/users");
const adminFoodsRoute    = require("../routes/admin/foods");
const bellaRoutes        = require('../routes/bella');

// ─── App & Server setup ───────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);

app.set('trust proxy', 1);

// ─── CORS ────────────────────────────────────────────────────────────────────
const FRONTEND_PORT = process.env.FRONTEND_PORT || "5173";

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const u = new URL(origin);
        const isHttp = u.protocol === 'http:' || u.protocol === 'https:';
        const isSpaPort = (u.port === FRONTEND_PORT || u.port === '');
        if (isHttp && isSpaPort) return cb(null, true);
      } catch {}
      return cb(new Error(`Socket.IO CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET','POST'],
  },
  transports: ['websocket','polling'],
});

app.set('io', io);

const setupSockets = require('../sockets');
setupSockets(io);

// ─── Static Resources ────────────────────────────────────────────────────────
app.use('/resources', express.static(path.join(__dirname, '..', 'resources')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoute);
app.use('/users', userRoute);
app.use('/contacts', contactRoute);
app.use('/foods', foodRoute);
app.use('/medications', medicationRoute);
app.use('/bellaReminders', bellaReminderRoute);
app.use('/news', newsRoute);
app.use('/exercises', exercisesRoute);
app.use('/reminders', reminderRoute);
app.use('/rooms', roomsRoute);
app.use('/tts', ttsRoute);
app.use('/admin/users', adminUsersRoute);
app.use('/admin/foods', adminFoodsRoute);
app.use('/bella', bellaRoutes);

app.get('/', (_req, res) => {
  res.send('API is live! 🚀');
});

module.exports = { app, server };
