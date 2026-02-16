require('dotenv').config();
const express = require('express');
const OpenAI = require('openai').default;
const crypto = require('crypto'); // Built-in Node.js crypto for encryption
const router = express.Router();
const BellaReminder = require('../models/bellaReminder'); // Ensure filename matches your model file

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// --- GDPR & Encryption Helpers ---

// A simple encryption key (In production, store this in .env as ENCRYPTION_KEY)
// For now, we generate a consistent key based on your OpenAI key just to make it work locally.
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(process.env.OPENAI_KEY || 'secret', 'salt', 32); 

function encryptText(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptText(encryptedText) {
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedData = textParts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Sensitive keywords guard (Keep existing logic)
const SENSITIVE_KEYWORDS = [
  'password','ssn','social security','bank account','credit card',
  'debit card','cvv','cvc','pin','passport','driver license','social number'
];
function containsSensitive(text) {
  const lower = text.toLowerCase();
  if (/\d{5,}/.test(lower)) return true; // generic 5+ digit number check
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
}

// --- ROUTES ---

// 1) List all reminders (Updated to decrypt Health data on the fly)
router.get('/user/:userId', async (req, res) => {
  try {
    const reminders = await BellaReminder.find({ userId: req.params.userId });
    
    // Decrypt "Health" data before sending to frontend
    const cleanReminders = reminders.map(r => {
      const doc = r.toObject();
      if (doc.category === 'Health' && doc.isEncrypted && doc.content) {
        try {
          doc.content = decryptText(doc.content);
        } catch (e) {
          doc.content = "[Encrypted Data - Decryption Failed]";
        }
      }
      return doc;
    });

    return res.json(cleanReminders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 2) Analyze & Auto-Save (The Core Logic)
router.post('/analyze', async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'userId and text required' });

  // 1. Guard check
  if (containsSensitive(text)) {
    return res.json({ saved: false, reason: 'too sensitive' });
  }

  try {
    console.log('Received /analyze:', text);

    // ✅ NEW: Get current date in a clear, human-readable format (e.g., "Saturday, February 7, 2026")
    const todayStr = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    // 2. The "Smart Librarian" Prompt (Updated with Time Context)
    const systemPrompt = `
    You are Bella, a memory manager for seniors. Analyze the user's text.
    
    CONTEXT: Today is ${todayStr}.
    
    Classify it into EXACTLY ONE of these categories: 
    [Places, Experiences, Hobbies, Appointments, Health, Relationships, Wishes].
    
    STRICT RULES FOR EXTRACTION:
    - Places: Extract City/Region only. NEVER street addresses.
    - Relationships: Extract First Names and relation (e.g., "Grandson Tom"). NO full names.
    - Health: Extract the medical fact.
    - Appointments: Extract the event and the time. IF relative time is used (e.g. "next Friday", "tomorrow"), CALCULATE the exact ISO Date based on "Today is ${todayStr}".
    - Hobbies/Experiences/Wishes: Summarize the fact clearly.
    
    If the text contains NO long-term useful memory, return "category": "null".
    
    Output strictly valid JSON:
    {
      "category": "The Category",
      "content": "A clear, concise sentence summarizing the fact.",
      "entities": { "key": "value" }, 
      "reminderTime": "ISO Date String (only if Appointment with specific time, else null)"
    }
    `.trim();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0
    });

    const raw = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.error('JSON Parse Error:', raw);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    const { category, content, entities, reminderTime } = result;

    // 3. Filter: If AI says it's not worth saving
    if (!category || category === 'null' || category === 'other') {
      return res.json({ saved: false, reason: 'irrelevant' });
    }

    // 4. Encrypt if Health
    let finalContent = content;
    let isEncrypted = false;
    
    if (category === 'Health') {
      finalContent = encryptText(content);
      isEncrypted = true;
    }

    // 5. Avoid Exact Duplicates
    const existing = await BellaReminder.findOne({ userId, category, content: finalContent });
    if (existing) {
      return res.json({ saved: false, reason: 'duplicate' });
    }

    // 6. Save to DB using New Schema
    const newMemory = await BellaReminder.create({
      userId,
      category,
      content: finalContent,
      entities: entities || {},
      reminderTime: reminderTime || null,
      isEncrypted
    });

    console.log(`✅ Saved Memory [${category}]: ${isEncrypted ? '(Encrypted)' : content}`);
    return res.status(201).json({ saved: true, memory: newMemory });

  } catch (err) {
    console.error('Analysis Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3) Manual Add (Updated for new Schema)
router.post('/addReminder', async (req, res) => {
  try {
    const { userId, category, content, entities, reminderTime } = req.body;
    
    // Default fallback if category missing
    const cat = category || 'Appointments'; 
    
    const newReminder = new BellaReminder({
      userId,
      category: cat,
      content,
      entities,
      reminderTime,
      isEncrypted: false
    });
    
    await newReminder.save();
    return res.status(201).json(newReminder);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;


// require('dotenv').config();
// const express = require('express');
// const OpenAI = require('openai').default;
// const router = express.Router();
// const BellaReminder = require('../models/bellaReminder');

// // initialize OpenAI SDK
// const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// // same sensitive-text guard as before
// const SENSITIVE_KEYWORDS = [
//   'password','ssn','social security','bank account','credit card',
//   'debit card','cvv','cvc','pin','passport','driver license','social number'
// ];
// function containsSensitive(text) {
//   const lower = text.toLowerCase();
//   if (/\d{5,}/.test(lower)) return true;
//   return SENSITIVE_KEYWORDS.some(k => lower.includes(k));
// }

// // 1) Manually add a reminder
// router.post('/addReminder', async (req, res) => {
//   try {
//     const { userId, title, description, reminderTime, isImportant } = req.body;
//     const newReminder = new BellaReminder({ userId, title, description, reminderTime, isImportant });
//     const savedReminder = await newReminder.save();
//     return res.status(201).json(savedReminder);
//   } catch (error) {
//     return res.status(400).json({ error: error.message });
//   }
// });

// // 2) List all reminders for a user
// router.get('/user/:userId', async (req, res) => {
//   try {
//     const reminders = await BellaReminder.find({ userId: req.params.userId });
//     if (!reminders.length) {
//       return res.status(404).json({ message: 'No reminders found for this user' });
//     }
//     return res.json(reminders);
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// });

// // 3) Analyze incoming text, classify via OpenAI, and auto-save personal info
// router.post('/analyze', async (req, res) => {
//   const { userId, text } = req.body;
//   if (!userId || !text) {
//     return res.status(400).json({ error: 'userId and text are required' });
//   }

//   // quick-check for ultra-sensitive content
//   if (containsSensitive(text)) {
//     return res.json({ saved: false, reason: 'too sensitive' });
//   }

//   try {
//     console.log('Received /analyze payload', { userId, text });

//     // prompt to enforce strict JSON classification
//     const systemPrompt = `
// You are Bella, an AI companion for seniors. You read one user-supplied string and output valid JSON:
// • "category": one of personal_information, private_information, question, other  
// • If category == personal_information, extract only those details a caretaker must know 
//   (e.g. dementia status, eating_habits, family_names, medical_history, routines, etc.) 
//   into an "entities" object, mapping keys to brief descriptions.
// Example:
// {"category":"personal_information","entities":{"dementia":"mild","eating_habits":"one meal per day","family_names":"Alice, Bob"}}
// For any other category omit "entities". Always return JSON only.
// `.trim();

//     // call the Chat API
//     const completion = await openai.chat.completions.create({
//       model: 'gpt-3.5-turbo',
//       messages: [
//         { role: 'system', content: systemPrompt },
//         { role: 'user',   content: text }
//       ],
//       temperature: 0
//     });

//     // parse the JSON reply
//     const raw = completion.choices[0].message.content;
//     let result;
//     try {
//       result = JSON.parse(raw);
//     } catch (err) {
//       console.error('Invalid JSON from OpenAI:', raw);
//       return res.status(500).json({ error: 'Invalid JSON from classification model' });
//     }

//     const { category, entities } = result;
//     console.log('→ classification:', category, entities || '');

//     // only auto-save personal_information
//     if (category === 'personal_information') {
//       // avoid duplicates by matching user + category + entities
//       const existing = await BellaReminder.findOne({ userId, category, entities });
//       if (!existing) {
//         // title = extracted name if available, otherwise the category label
//         const title = entities?.name || category;
//         const reminder = await BellaReminder.create({
//           userId,
//           title,
//           category,
//           entities,
//           reminderTime: new Date(),
//           isImportant: true
//         });
//         return res.status(201).json({ saved: true, reminder });
//       }
//       return res.json({ saved: false, reason: 'duplicate' });
//     }

//     // for all other categories, do not save
//     return res.json({ saved: false, category });
//   } catch (err) {
//     console.error('Analysis error:', err);
//     return res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
