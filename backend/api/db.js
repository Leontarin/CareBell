// root/api/db.js
const mongoose = require('mongoose');

const MONGO_OPTIONS = {
  // driver 4.x+ embeds these behaviors by default
  serverSelectionTimeoutMS: 5_000,
  bufferCommands: false,
};

let cachedPromise = null;
function dbConnect() {
  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(process.env.MONGODB_URI, MONGO_OPTIONS)
      .then(() => console.log('✅ MongoDB connected'))
      .catch(err => {
        console.error('❌ MongoDB initial connection error:', err);
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

mongoose.connection.on('error', err =>
  console.error('MongoDB runtime error:', err)
);
mongoose.connection.on('disconnected', () =>
  console.warn('MongoDB disconnected — retrying…')
);

module.exports = dbConnect;
