// backend/routes/tts.js
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// assumes this file lives at backend/routes/tts.js
const BIN_DIR = path.resolve(__dirname, '../tts/bin');
const MODEL_DIR = path.resolve(__dirname, '../tts/models');

const PIPER_PATH = (() => {
  const platform = os.platform();          // get current platform
  if (platform === 'win32') {
    // on Windows use the .exe
    return path.join(BIN_DIR, 'win32', 'piper.exe');
  } else if (platform === 'linux') {
    // on Linux use the linux binary
    return path.join(BIN_DIR, 'linux', 'piper');
  } else {
    // optional: handle other platforms or throw
    throw new Error(`Unsupported platform: ${platform}`);
  }
})();

const MODEL_PATHS = {
  en: path.join(MODEL_DIR, 'en_US-hfc_female-medium.onnx'),
  de: path.join(MODEL_DIR, 'de_DE-kerstin-low.onnx'),
};

router.post('/', (req, res) => {
  const { text, lang = 'en', speed=1.0 } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" in request body' });
  }

  // Check that piper.exe is there
  if (!fs.existsSync(PIPER_PATH)) {
    console.error('Cannot find piper binary at', PIPER_PATH);
    return res.status(500).json({ error: 'TTS engine not installed on server' });
  }

  // Check that model is there
  const modelPath = MODEL_PATHS[lang];
  if (!modelPath || !fs.existsSync(modelPath)) {
    console.error('Cannot find model for', lang, 'at', modelPath);
    return res.status(400).json({ error: `No model configured for language ${lang}` });
  }

  const outFile = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);

  const piper = spawn(PIPER_PATH, [
    '--model', modelPath,
    '--output_file', outFile
  ]);

  // log stderr in case Piper itself reports missing DLLs or other runtime errors
  piper.stderr.on('data', data => console.error('piper stderr:', data.toString()));

  piper.stdin.write(text);
  piper.stdin.end();

  piper.on('error', err => {
    console.error('Failed to start piper:', err);
    return res.status(500).json({ error: 'Failed to start tts engine' });
  });

  piper.on('close', code => {
    if (code !== 0) {
      console.error(`piper exited with code ${code}`);
      return res.status(500).json({ error: 'TTS engine failed to process your request' });
    }
    res.sendFile(outFile, err => {
      fs.unlink(outFile, () => {});
      if (err) console.error('sendFile error:', err);
    });
  });
});

module.exports = router;
