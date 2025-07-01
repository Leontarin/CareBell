require('dotenv').config();
const express = require('express');
const OpenAI = require('openai').default;
const router = express.Router();
const BellaReminder = require('../models/bellaReminder');

// initialize OpenAI SDK
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// same sensitive-text guard as before
const SENSITIVE_KEYWORDS = [
  'password','ssn','social security','bank account','credit card',
  'debit card','cvv','cvc','pin','passport','driver license','social number'
];
function containsSensitive(text) {
  const lower = text.toLowerCase();
  if (/\d{5,}/.test(lower)) return true;
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
}

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

// 3) Analyze incoming text, classify via OpenAI, and auto-save personal info
router.post('/analyze', async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }

  // quick-check for ultra-sensitive content
  if (containsSensitive(text)) {
    return res.json({ saved: false, reason: 'too sensitive' });
  }

  try {
    console.log('Received /analyze payload', { userId, text });

    // prompt to enforce strict JSON classification
    const systemPrompt = `
You are Bella, an AI companion for seniors. You read one user-supplied string and output valid JSON:
• "category": one of personal_information, private_information, question, other  
• If category == personal_information, extract only those details a caretaker must know 
  (e.g. dementia status, eating_habits, family_names, medical_history, routines, etc.) 
  into an "entities" object, mapping keys to brief descriptions.
Example:
{"category":"personal_information","entities":{"dementia":"mild","eating_habits":"one meal per day","family_names":"Alice, Bob"}}
For any other category omit "entities". Always return JSON only.
`.trim();

    // call the Chat API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: text }
      ],
      temperature: 0
    });

    // parse the JSON reply
    const raw = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(raw);
    } catch (err) {
      console.error('Invalid JSON from OpenAI:', raw);
      return res.status(500).json({ error: 'Invalid JSON from classification model' });
    }

    const { category, entities } = result;
    console.log('→ classification:', category, entities || '');

    // only auto-save personal_information
    if (category === 'personal_information') {
      // avoid duplicates by matching user + category + entities
      const existing = await BellaReminder.findOne({ userId, category, entities });
      if (!existing) {
        // title = extracted name if available, otherwise the category label
        const title = entities?.name || category;
        const reminder = await BellaReminder.create({
          userId,
          title,
          category,
          entities,
          reminderTime: new Date(),
          isImportant: true
        });
        return res.status(201).json({ saved: true, reminder });
      }
      return res.json({ saved: false, reason: 'duplicate' });
    }

    // for all other categories, do not save
    return res.json({ saved: false, category });
  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
