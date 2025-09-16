# ─── Deno Signaling Server (Production) ────────────────────────
FROM denoland/deno:alpine

WORKDIR /app

# Copy your Deno source code
COPY . .

# Expose Deno server port (compose maps to 5175)
EXPOSE 5175

# Run in production (cached permissions)
CMD ["run", "--allow-net", "server.js"]

