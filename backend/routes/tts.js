const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

const MODEL_PATHS = {
  en: process.env.TTS_MODEL_EN,
  de: process.env.TTS_MODEL_DE,
  du: process.env.TTS_MODEL_DU, // german (du)
};

router.post('/', (req, res) => {
  const { text, lang = 'en' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text' });
  }
  const modelPath = MODEL_PATHS[lang];
  if (!modelPath) {
    return res.status(400).json({ error: `No model configured for language ${lang}` });
  }

  const outFile = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);
  const piper = spawn('piper', ['--model', modelPath, '--output_file', outFile]);

  piper.stdin.write(text);
  piper.stdin.end();

  piper.on('error', err => {
    console.error('piper error:', err);
    return res.status(500).json({ error: 'Failed to start tts engine' });
  });

  piper.on('close', code => {
    if (code !== 0) {
      console.error(`piper exited with code ${code}`);
      return res.status(500).json({ error: 'tts engine failed' });
    }
    res.sendFile(outFile, err => {
      fs.unlink(outFile, () => {});
      if (err) console.error('sendFile error:', err);
    });
  });
});

module.exports = router;
