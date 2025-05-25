// routes/bellaReminders.js
require('dotenv').config();
const express       = require('express');
const axios         = require('axios');
const router        = express.Router();
const BellaReminder = require('../models/bellaReminder');

const HF_API_URL = 'https://api-inference.huggingface.co/models/joeddav/xlm-roberta-large-xnli';
const HF_TOKEN   = process.env.HF_API_TOKEN;

// 1) Manually add a reminder
router.post('/addReminder', async (req, res) => {
  try {
    const { userId, title, description, reminderTime, isImportant } = req.body;
    const newReminder = new BellaReminder({ userId, title, description, reminderTime, isImportant });
    const savedReminder = await newReminder.save();
    return res.status(201).json(savedReminder);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// 2) List all reminders for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const reminders = await BellaReminder.find({ userId: req.params.userId });
    if (!reminders.length) {
      return res.status(404).json({ message: 'No reminders found for this user' });
    }
    return res.json(reminders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 3) Analyze incoming text and auto-save if the model’s top label is 'personal fact'
router.post('/analyze', async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }

  try {
    // Zero-shot classify with HF (includes 'question' but single-label softmax)
    const hfResponse = await axios.post(
      HF_API_URL,
      {
        inputs: text,
        parameters: {
          candidate_labels: ['personal fact', 'question', 'not personal fact']
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { labels, scores } = hfResponse.data;
    const topLabel = labels[0];
    console.log(`→ topLabel: ${topLabel} (score ${scores[0].toFixed(3)})`);

    // Only save if top label is 'personal fact'
    if (topLabel === 'personal fact') {
      const title = text.split(/,|\./)[0].trim();
      const exists = await BellaReminder.findOne({ userId, title });
      if (!exists) {
        const reminder = await BellaReminder.create({
          userId,
          title,
          description: text,
          reminderTime: new Date(),
          isImportant: true
        });
        return res.status(201).json({ saved: true, reminder });
      }
    }

    // Otherwise, nothing to save
    return res.json({ saved: false });
  } catch (err) {
    console.error('Analysis error:', err.response?.data || err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
