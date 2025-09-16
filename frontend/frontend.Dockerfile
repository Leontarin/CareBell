# ─── Frontend Dockerfile ───────────────────────────────────────
# 1) Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (clean & reproducible)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the Vite project
RUN npm run build

# 2) Production stage (tiny Nginx image)
FROM nginx:alpine

# Copy the build output to Nginx's HTML folder
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 inside the container (compose maps this to 5173)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

