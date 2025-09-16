# ─── Backend Dockerfile ────────────────────────────────────────
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for build caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the backend source
COPY . .

# Default environment variable (can be overridden by docker-compose)
ENV PORT=5174

# Expose backend port inside container
EXPOSE 5174

# Start backend in production mode
CMD ["npm", "start"]

