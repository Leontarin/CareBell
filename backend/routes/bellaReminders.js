// routes/bellaReminders.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const router = express.Router();
const BellaReminder = require('../models/bellaReminder');

function canonicalize(text) {
  return text
    .toLowerCase()
    .replace(/[.!?]/g, '')
    .replace(/^(hi|hello|hey)[,\s]+/, '')
    .replace(/\bmy name is\b/, 'i am')
    .replace(/\bi'm\b/, 'i am')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeFact(text) {
  const t = text.toLowerCase();
  return /(my name is|i\s+(?:am|m|have|was|was born|live|work))/i.test(t);
}

const HF_API_URL = 'https://api-inference.huggingface.co/models/joeddav/xlm-roberta-large-xnli';
const HF_TOKEN = process.env.HF_API_TOKEN;

// 1) Manually add a reminder
router.post('/addReminder', async (req, res) => {
  try {
    const { userId, title, description, reminderTime, isImportant } = req.body;
    const canonical = canonicalize(description || title);
    const exists = await BellaReminder.findOne({ userId, canonical });
    if (exists) return res.status(409).json({ error: 'Duplicate reminder' });

    const newReminder = new BellaReminder({
      userId,
      title,
      description,
      reminderTime,
      isImportant,
      canonical
    });
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

// 3) Analyze incoming text and auto-save if the model's top label is 'personal fact'
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
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const data = hfResponse.data;
    if (!data.labels || !data.scores) {
      throw new Error('Invalid response from HF inference');
    }

    const labels = data.labels;
    const scores = data.scores;
    const topLabel = labels[0];
    console.log(`→ topLabel: ${topLabel} (score ${scores[0].toFixed(3)})`);

    const canonical = canonicalize(text);

    // If the top label is 'personal fact' or our heuristics match, save it
    if (topLabel === 'personal fact' || looksLikeFact(text)) {
      const title = text.split(/,|\./)[0].trim();
      const exists = await BellaReminder.findOne({ userId, canonical });
      if (!exists) {
        const reminder = await BellaReminder.create({
          userId,
          title,
          description: text,
          reminderTime: new Date(),
          isImportant: true,
          canonical
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
