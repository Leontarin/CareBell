# ─── Backend Dockerfile ────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Install dependencies early (for cache)
COPY package*.json ./
RUN npm ci

# Copy rest of backend
COPY . .

ENV PORT=5174

# Install minimal runtime deps for Piper (Debian-based)
RUN apt-get update && apt-get install -y \
    libstdc++6 libatomic1 libc6 \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 5174
CMD ["npm", "start"]
