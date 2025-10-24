FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./

# Always install build deps for native modules
RUN apk add --no-cache python3 make g++

# Auto-heal lockfile mismatch
RUN if ! npm ci; then \
      echo "Lockfile mismatch detected — running npm install to sync..."; \
      rm -rf node_modules package-lock.json; \
      npm install; \
    fi

COPY ./frontend .
COPY ./shared /shared

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]