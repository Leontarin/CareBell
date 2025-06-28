// routes/bellaReminders.js
require('dotenv').config();
const express = require('express');
const { HfInference } = require('@huggingface/inference');
const router = express.Router();
const BellaReminder = require('../models/bellaReminder');

const HF_TOKEN = process.env.HF_API_TOKEN;
const hf = new HfInference(HF_TOKEN);

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

const SENSITIVE_KEYWORDS = [
  'password',
  'ssn',
  'social security',
  'bank account',
  'credit card',
  'debit card',
  'cvv',
  'cvc',
  'pin',
  'passport',
  'driver license',
  'social number'
];

function containsSensitive(text) {
  const lower = text.toLowerCase();
  if (/\d{5,}/.test(lower)) return true;
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 3) Analyze incoming text and auto-save if classified as personal info
router.post('/analyze', async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }

  if (containsSensitive(text)) {
    return res.json({ saved: false, reason: 'too sensitive' });
  }

  try {
    const cls = await hf.zeroShotClassification({
      model: 'facebook/bart-large-mnli',
      inputs: text,
      parameters: { candidate_labels: ['personal info', 'question', 'other'] }
    });

    const labels = cls.labels;
    const scores = cls.scores;
    const topLabel = labels[0];
    console.log(`→ topLabel: ${topLabel} (score ${scores[0].toFixed(3)})`);

    if (topLabel === 'personal info') {
      const embeddingResp = await hf.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: text
      });
      const embedding = Array.isArray(embeddingResp[0]) ? embeddingResp[0] : embeddingResp;

      const existing = await BellaReminder.find({ userId });
      const duplicate = existing.some(r =>
        Array.isArray(r.embedding) && cosineSimilarity(r.embedding, embedding) > 0.85
      );
      if (!duplicate) {
        const title = text.split(/,|\./)[0].trim();
        const reminder = await BellaReminder.create({
          userId,
          title,
          description: text,
          reminderTime: new Date(),
          isImportant: true,
          embedding
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
