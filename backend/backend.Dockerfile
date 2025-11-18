# ─── Backend Dockerfile ────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Install dependencies early (for cache)
COPY package*.json ./
RUN npm ci

# Copy rest of backend
COPY backend/ ./
COPY shared/ /shared

ENV PORT=5174

# Copy tarball from repository
COPY backend/tts/bin/linux/piper_linux_x86_64.tar.gz /app/tts/bin/linux/

# Extract into the same folder (no nested dirs)
RUN cd /app/tts/bin/linux \
    && tar -xzf piper_linux_x86_64.tar.gz --strip-components=2 \
    && rm piper_linux_x86_64.tar.gz

# Install minimal runtime deps for Piper (Debian-based)
RUN apt-get update && apt-get install -y \
    libstdc++6 libatomic1 libc6 \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 5174
CMD ["npm", "start"]
