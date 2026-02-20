# ─── Backend Dockerfile (Production) ───────────────────────────
FROM node:22-bookworm-slim

WORKDIR /app

# Install build dependencies for mediasoup
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    libstdc++6 \
    libatomic1 \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

# mediasoup expects "python"
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install dependencies early (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend + shared
COPY backend/ ./
COPY shared/ /shared

# Extract Piper
RUN rm -rf /app/tts/bin/linux && mkdir -p /app/tts/bin/linux
RUN cd /app/tts/bin/linux && tar -xzf /app/tts/bin/piper_linux_x86_64.tar.gz --strip-components=1

ENV NODE_ENV=production
ENV PORT=5174

EXPOSE 5174

CMD ["node", "api/index.js"]