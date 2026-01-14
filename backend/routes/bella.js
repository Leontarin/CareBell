require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const LOG_DIR =
  process.env.BELLA_LOG_DIR ||
  path.join(process.cwd(), 'logs', 'bella');

// ─────────────────────────────────────────────
// POST /bella/log/start
// ─────────────────────────────────────────────
router.post('/log/start', (req, res) => {
  try {
    const { username, sessionId, startedAt } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    fs.mkdirSync(LOG_DIR, { recursive: true });

    const filePath = path.join(LOG_DIR, `${sessionId}.txt`);

    // Only create once (idempotent)
    if (!fs.existsSync(filePath)) {
      const header = [
        'Bella Call Log',
        `User: ${username || 'unknown'}`,
        `Started: ${startedAt || new Date().toISOString()}`,
        '---',
        ''
      ].join('\n');

      fs.writeFileSync(filePath, header, 'utf8');
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Bella log start error:', err);
    res.status(500).json({ error: 'Failed to start log' });
  }
});

// ─────────────────────────────────────────────
// POST /bella/log/line
// ─────────────────────────────────────────────
router.post('/log/line', (req, res) => {
  try {
    const { sessionId, ts, speaker, text } = req.body;

    if (!sessionId || !speaker || !text) {
      return res.status(400).json({ error: 'Invalid log line payload' });
    }

    const filePath = path.join(LOG_DIR, `${sessionId}.txt`);

    const line = `[${ts || new Date().toISOString()}] ${speaker}: ${text}\n`;

    fs.appendFileSync(filePath, line, 'utf8');

    res.json({ ok: true });
  } catch (err) {
    console.error('Bella log append error:', err);
    res.status(500).json({ error: 'Failed to append log line' });
  }
});

module.exports = router;
