#!/usr/bin/env bash
set -Eeuo pipefail

echo "🔒 Using branch: master"
git fetch --prune origin
git checkout master
git reset --hard origin/master

echo "📦 Installing backend deps…"
( cd backend && npm ci )

echo "🧹 Removing dangling images (cleanup)…"
docker image prune -f

echo "🐳 Rebuilding & restarting CareBell (prod)…"
docker compose --profile prod down --remove-orphans
docker compose --profile prod build --no-cache
docker compose --profile prod up -d

echo "✅ Deployment complete (prod)."
