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
RUN rm -rf /app/tts/bin/linux && mkdir -p /app/tts/bin/linux
# Extract into linux folder
RUN cd /app/tts/bin/linux && tar -xzf /app/tts/bin/piper_linux_x86_64.tar.gz --strip-components=1

# Install minimal runtime deps for Piper (Debian-based)
RUN apt-get update && apt-get install -y \
    libstdc++6 libatomic1 libc6 \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 5174
CMD ["npm", "start"]
