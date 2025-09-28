# ─── Frontend Dockerfile ───────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (clean & reproducible)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Accept backend URL as build arg and bake into Vite build
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ─── Production Stage ─────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: add SPA fallback so React/Vite routing works on refresh
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
