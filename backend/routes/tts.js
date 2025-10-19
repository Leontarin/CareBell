// backend/routes/tts.js
const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const router = express.Router();

const BIN_DIR = path.resolve(__dirname, "../tts/bin");
const MODEL_DIR = path.resolve(__dirname, "../tts/models");

const PIPER_PATH = (() => {
  const platform = os.platform();
  if (platform === "win32") return path.join(BIN_DIR, "win32", "piper.exe");
  if (platform === "linux") return path.join(BIN_DIR, "linux", "piper");
  throw new Error(`Unsupported platform: ${platform}`);
})();

const MODEL_PATHS = {
  en: path.join(MODEL_DIR, "en_US-hfc_female-medium.onnx"),
  de: path.join(MODEL_DIR, "de_DE-kerstin-low.onnx"),
};

// ──────────────────────────────────────────────
// 1️⃣ Regular endpoint (non-streaming, legacy)
// ──────────────────────────────────────────────
router.post("/", (req, res) => {
  const { text, lang = "en" } = req.body || {};
  if (!text || typeof text !== "string")
    return res.status(400).json({ error: "Missing or invalid text" });

  const modelPath = MODEL_PATHS[lang];
  if (!modelPath || !fs.existsSync(modelPath))
    return res.status(400).json({ error: `No model for language ${lang}` });

  const outFile = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);
  const piper = spawn(PIPER_PATH, ["--model", modelPath, "--output_file", outFile]);
  piper.stderr.on("data", (d) => console.error("piper:", d.toString()));
  piper.stdin.end(text);

  piper.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "Piper failed" });
    res.sendFile(outFile, (err) => fs.unlink(outFile, () => {}));
  });
});

// ──────────────────────────────────────────────
// 2️⃣ Streaming endpoint for real-time playback
// ──────────────────────────────────────────────
router.post("/stream", (req, res) => {
  const { text, lang = "en" } = req.body || {};
  if (!text || typeof text !== "string")
    return res.status(400).json({ error: "Missing or invalid text" });

  const modelPath = MODEL_PATHS[lang];
  if (!modelPath || !fs.existsSync(modelPath))
    return res.status(400).json({ error: `No model for language ${lang}` });

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Transfer-Encoding", "chunked");

  const piper = spawn(PIPER_PATH, ["--model", modelPath, "--output_raw", "-"]);
  piper.stderr.on("data", (d) => console.error("piper:", d.toString()));

  // forward Piper’s binary stdout directly to the response stream
  piper.stdout.pipe(res);

  piper.stdin.end(text);

  piper.on("error", (err) => {
    console.error("Piper spawn error:", err);
    if (!res.headersSent) res.status(500).end();
  });

  piper.on("close", () => {
    if (!res.writableEnded) res.end();
  });
});

module.exports = router;
