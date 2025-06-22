const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MODEL_MAP = {
  en: 'en_US-lessac-medium',
  de: 'de_DE-thorsten-low',
  du: 'de_DE-thorsten-low',
};

const ttsDir = path.join(__dirname, '..', 'resources', 'tts');
fs.mkdirSync(ttsDir, { recursive: true });

function runPiper(text, lang) {
  return new Promise((resolve, reject) => {
    const model = MODEL_MAP[lang] || MODEL_MAP.en;
    const fileName = `tts-${Date.now()}.wav`;
    const outPath = path.join(ttsDir, fileName);

    const proc = spawn('piper', [
      '--model', model,
      '--output_file', outPath,
    ]);

    proc.stdin.write(text);
    proc.stdin.end();

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`piper exited with code ${code}`));
    });
  });
}

router.post('/', async (req, res) => {
  const { text = '', lang = 'en' } = req.body;
  if (!text.trim()) return res.status(400).json({ error: 'text is required' });

  try {
    const outPath = await runPiper(text, lang);
    res.sendFile(outPath, (err) => {
      fs.unlink(outPath, () => {});
      if (err) res.status(500).json({ error: err.message });
    });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
