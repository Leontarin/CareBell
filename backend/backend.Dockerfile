# ─── Backend Dockerfile ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy backend source code
COPY . .

# ✅ Explicitly include TTS folder and fix executable bit
COPY tts ./tts
RUN chmod +x ./tts/bin/linux/piper

ENV PORT=5174

EXPOSE 5174
CMD ["npm", "start"]
