// routes/bellaReminder.js

require('dotenv').config();
const express       = require('express');
const axios         = require('axios');
const router        = express.Router();
const mongoose      = require('mongoose');
const BellaReminder = require('../models/bellaReminder');

console.log(
  '🐘 Mongoose is using collection:',
  mongoose.model('BellaReminder').collection.collectionName
);

const HF_API_URL = 'https://api-inference.huggingface.co/models/joeddav/xlm-roberta-large-xnli';
const HF_TOKEN   = process.env.HF_API_TOKEN;
const DEBUG      = process.env.DEBUG_HF === 'true';

// Create a new reminder manually
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

// List all reminders for a given user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reminders = await BellaReminder.find({ userId });
    if (!reminders.length) {
      return res.status(404).json({ message: 'No reminders found for this user' });
    }
    return res.json(reminders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Analyze incoming text and auto-save if it's a personal fact (or label question)
router.post('/analyze', async (req, res) => {
  const { userId, text } = req.body;
  console.log('🔎 /analyze called with:', { userId, text });
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }

  try {
    // 1) Zero-shot classify with HF (including "question")
    const hfResponse = await axios.post(
      HF_API_URL,
      {
        inputs: text,
        parameters: {
          candidate_labels: [
            'personal fact',
            'not personal fact',
            'question'
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type':  'application/json',
          Accept:          'application/json'
        }
      }
    );

    const { labels, scores } = hfResponse.data;
    if (DEBUG) console.log('🛠️ DEBUG HF response:', JSON.stringify(hfResponse.data, null, 2));

    // 2) Extract top label and score
    const topLabel = labels[0];
    const topScore = scores[0];
    console.log('→ topLabel:', topLabel, 'topScore:', topScore);

    let saved = false;
    let reminder = null;

    // 3) Save only personal-fact
    if (topLabel === 'personal fact' && topScore > 0.70) {
      // a) derive a meaningful title (first two clauses)
      const title = text.split(/,|\./).slice(0, 2).join('.').trim();
      console.log('→ derived title:', title);

      // b) duplicate-check on full description
      const exists = await BellaReminder.findOne({ userId, description: text });
      console.log('→ duplicate exists by description?', !!exists);

      if (!exists) {
        reminder = await BellaReminder.create({
          userId,
          title,
          description: text,
          reminderTime: new Date(),
          isImportant: true
        });
        saved = true;
        if (DEBUG) console.log('🛠️ saved new reminder:', reminder);
      }
    }

    // 4) Return saved, reminder, and label for front-end logic
    return res.json({ saved, reminder, label: topLabel });
  } catch (err) {
    console.error('Analysis error:', err.response?.data || err.message);
    return res.status(500).json({
      error: err.response?.data?.error || err.message
    });
  }
});

module.exports = router;
