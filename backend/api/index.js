require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

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

app.get('/', (_req, res) => {
  res.send('API is live on Vercel! 🚀');
});

// only start a listener when run directly (not when imported by Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 4443;
  app.listen(PORT, () => {
    console.log(`✅ API started locally on ${PORT}`);
  });
}

// Export the Express app so Vercel can treat it as a serverless handler
module.exports = app;