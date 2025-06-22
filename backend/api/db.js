// root/api/db.js
const mongoose = require('mongoose');

const MONGO_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // fail if we can’t connect in 5s
  serverSelectionTimeoutMS: 5_000,
  // don’t buffer up commands forever while disconnected
  bufferCommands: false,
};

let cachedPromise = null;

function dbConnect() {
  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(process.env.MONGODB_URI, MONGO_OPTIONS)
      .then(() => {
        console.log('✅ MongoDB connected');
      })
      .catch(err => {
        console.error('❌ MongoDB initial connection error:', err);
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

// runtime event logging
mongoose.connection.on('error', err =>
  console.error('MongoDB runtime error:', err)
);
mongoose.connection.on('disconnected', () =>
  console.warn('MongoDB disconnected — retrying…')
);

module.exports = dbConnect;
