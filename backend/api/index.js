const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// ─── Load .env only when NOT running inside Docker ─────────────────────────────
if (!process.env.DOCKER_ENV) {
  // Load base .env (used for local dev on Windows)
  dotenv.config({ path: path.join(__dirname, '..', '.env') });

  // Load .env.local if it exists (for overrides)
  const localEnvPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
  }

  console.log('🧩 Loaded local environment (.env / .env.local)');
} else {
  console.log('🐳 Running inside Docker – skipping .env load');
}

const express      = require('express');
const mongoose     = require('mongoose');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const { URL }      = require('url');

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
//const adminMealsRoute    = require("../routes/admin/meals");
//const adminAllergiesRoute = require("../routes/admin/allergies");

// ─── App & Server setup ───────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);

app.set('trust proxy', 1); // if behind a proxy (nginx)

// ─── CORS ────────────────────────────────────────────────────────────────────
const FRONTEND_PORT = process.env.FRONTEND_PORT || "5173";

app.use(cors({
  origin: true,              // ✅ automatically reflect any origin (works for all IPs/domains)
  credentials: true,         // ✅ allow cookies / sessions
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Body/cookies
app.use(express.json());
app.use(cookieParser());

// ─── MongoDB Connection with Retry & Initial Promise ──────────────────────────
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5_000,
  bufferCommands: false,
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

// ─── Middleware to wait for the first connection ──────────────────────────────
app.use(async (_req, res, next) => {
  try {
    await connectionPromise;
    next();
  } catch (err) {
    console.error('DB not ready, rejecting request:', err);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});

// ─── Socket.IO with permissive SPA-origin logic (no hard-coded IP) ───────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      // Allow:
      //  - no origin (same-origin / non-browser)
      //  - http(s) origins on port 5173 (the SPA port), including localhost
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

// Wire your socket handlers
const setupSockets = require('../sockets');
setupSockets(io);

// ─── Static Resources ────────────────────────────────────────────────────────
app.use('/resources', express.static(path.join(__dirname, '..', 'resources')));

// ─── Health (handy for curl checks & uptime monitors) ────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',          authRoute);
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
app.use("/admin/users", adminUsersRoute);
//app.use("/admin/meals", adminMealsRoute);
//app.use("/admin/allergies", adminAllergiesRoute);

app.get('/', (_req, res) => {
  res.send('API is live! 🚀');
});

// ─── Start server locally / in container ─────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5174;

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

