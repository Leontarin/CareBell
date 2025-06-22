# Backend

This folder contains the ExpressJS backend used by CareBell. Run with `npm start` from this directory during development.

## Text-to-Speech API

A `/tts` endpoint is provided for generating speech using local [piper](https://github.com/rhasspy/piper) models. It expects the `piper` binary to be available on the server. Example request:

```bash
curl -X POST http://localhost:4443/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello", "lang":"en"}' --output speech.wav
```

Environment variables configure the model for each language:

- `TTS_MODEL_EN` – path to the English model
- `TTS_MODEL_DE` – path to the German model
- `TTS_MODEL_DU` – path to the Dutch/German model

The request returns a WAV file which can be played directly in the client. More languages can be added by adjusting `MODEL_PATHS` in `routes/tts.js` and setting the corresponding environment variable.
