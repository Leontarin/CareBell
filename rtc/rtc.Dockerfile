# ─────────────────────────────────────────────
# LiveKit Server - Production Dockerfile
# ─────────────────────────────────────────────
FROM livekit/livekit-server:latest

# Copy LiveKit config file
WORKDIR /app
COPY livekit.yaml /app/livekit.yaml

# LiveKit always runs on 7880 internally
EXPOSE 7880

# Run LiveKit with provided config
CMD ["--config", "/app/livekit.yaml"]