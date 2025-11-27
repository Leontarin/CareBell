#/rtc/rtc.Dockerfile
# ─────────────────────────────────────────────
# LiveKit Server - Production Dockerfile
# ─────────────────────────────────────────────
FROM livekit/livekit-server:v1.9.1

WORKDIR /app

# Copy LiveKit config
COPY livekit.yaml /app/livekit.yaml

EXPOSE 7880

CMD ["--config", "/app/livekit.yaml"]