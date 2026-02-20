// backend/api/index.js

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const { server } = require('./app');

// ─── Load .env only when NOT running inside Docker ─────────────────────────────
if (!process.env.DOCKER_ENV) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });

  const localEnvPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
  }

  console.log('🧩 Loaded local environment (.env / .env.local)');
} else {
  console.log('🐳 Running inside Docker – skipping .env load');
}

// ─── MongoDB Connection with Retry ─────────────────────────────────────────────
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5_000,
  bufferCommands: false,
};

mongoose.set('bufferCommands', false);

async function connectWithRetry() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, MONGO_OPTIONS);
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

// ─── Start server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5174;

  const { createWorker } = require("../rtc/worker");

  async function startServer() {
    try {
      await createWorker();
      server.listen(PORT);
    } catch (err) {
      console.error("🔥 Failed to start mediasoup worker:", err);
      process.exit(1);
    }
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
