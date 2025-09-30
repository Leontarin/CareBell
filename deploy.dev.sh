#!/usr/bin/env bash
set -Eeuo pipefail

echo "🔒 Using branch: dev"
git fetch --prune origin
git checkout dev
git reset --hard origin/dev

echo "📦 Installing backend deps…"
( cd backend && npm install )

echo "🧹 Removing dangling images (cleanup)…"
docker image prune -f

echo "🐳 Rebuilding & restarting CareBell (dev)…"
docker compose --profile dev down --remove-orphans
docker compose --profile dev build
docker compose --profile dev up -d

echo "✅ Deployment complete (dev)."
