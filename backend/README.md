# Backend API

## Local TTS Support

This backend exposes a `/tts` endpoint that uses [piper-tts](https://github.com/rhasspy/piper) to generate audio files locally. The endpoint expects JSON with `text` and an optional `lang` field (`en` or `de`). It returns a WAV file that can be played on most platforms.

Example using `curl`:

```bash
curl -X POST http://localhost:4443/tts \
     -H "Content-Type: application/json" \
     -d '{"text":"Hello world","lang":"en"}' \
     --output speech.wav
```

`piper` must be installed and accessible in the server environment (`pip install piper-tts`). Voice models are downloaded automatically by `piper` on first use. Adjust the language to use a different model.
