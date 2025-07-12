# CareBell

CareBell is a voice‑enabled companion app built with a React/Vite frontend, an Express/MongoDB backend, and an optional Deno-based signaling server for peer‑to‑peer video calls.

## Requirements

- **Node.js** (current LTS recommended)
- **MongoDB** instance and connection string
  !`It’s important that MongoDB will have at least one user already defined`
- **Deno** runtime (required for Meet-With-Friends)
- Environment variables:
  - `MONGODB_URI` – MongoDB connection string
  - `OPENAI_KEY` – API key for the Bella reminders route, requires OpenAI public key
  - Optional `PORT` to override the backend port (defaults to `4443`)
  - Frontend Vite variables (`VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_ASSISTANT_ID_EN`, `VITE_VAPI_ASSISTANT_ID_DE`, `VITE_VAPI_ASSISTANT_ID_HE`)
    The VAPI Environment keys refer to VAPI.AI public api key and assistant keys
  - Optional TTS model paths (`TTS_MODEL_EN`, `TTS_MODEL_DE`, …), each one is assigned to a different TTS model in backend/tts/models/

## Setup

### Clone the repository

```bash
git clone <repo-url>
cd CareBell
```

### Backend

```bash
cd backend
npm install
# create .env with MONGODB_URI and OPENAI_KEY
npm run dev
```

The server starts on the specified `PORT` (default `4443`) and connects to MongoDB with retry logic. Socket.IO is available on the same port.

### Frontend

```bash
cd CareBell
npm install
# create .env with your Vapi keys
npm run dev
```

The app is served by Vite on port `5173` by default.

### Deno signaling server (optional)

```bash
cd deno-signaling
deno task dev
```

This WebSocket server routes WebRTC signaling messages. The frontend reads its URL from `src/shared/config.js` (`P2P_SIGNALING_URL`).

### Configuration

Edit `src/shared/config.js` if your backend API or signaling server runs at a different address.

## Project Structure

```
CareBell/
├── CareBell/           # React frontend
├── backend/            # Express/MongoDB API
├── deno-signaling/     # Deno WebSocket server
└── project/            # Additional assets (video, QR codes)
```

## External APIs and Services

- **MongoDB** – persistence via Mongoose
- **OpenAI GPT‑3.5** – used in `/bellaReminders/analyze`
- **Tagesschau API** – news articles
- **OpenWeatherMap API** – weather forecasts
- **Piper TTS** – local text‑to‑speech via `/tts`
- **Vapi** – browser-based voice assistant
