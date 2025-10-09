#!/usr/bin/env bash
set -Eeuo pipefail

echo "====================================================="
echo "🔒 Using branch: dev"
echo "====================================================="
git fetch --prune origin
git checkout dev
git reset --hard origin/dev

echo
echo "🧾 Checking .env files..."
for file in ".env" "frontend/.env" "backend/.env"; do
  if [[ ! -f "$file" ]]; then
    example="${file}.example"
    if [[ -f "$example" ]]; then
      echo "⚠ Missing $file — creating from template."
      cp "$example" "$file"
    else
      echo "❌ Missing both $file and $example — please add manually."
    fi
  else
    echo "✅ $file already exists."
  fi
done

echo
echo "📦 Installing backend deps…"
( cd backend && npm install )

echo
echo "🌐 Checking Docker network..."
if ! docker network inspect carebell_net >/dev/null 2>&1; then
    echo "🔧 Creating network carebell_net..."
    docker network create carebell_net >/dev/null
else
    echo "✅ Network carebell_net already exists"
fi

echo
echo "🧹 Removing dangling images (cleanup)…"
docker image prune -f >/dev/null

echo
echo "🐳 Rebuilding & restarting CareBell (dev)…"
docker compose --profile dev down --remove-orphans
docker compose --profile dev build
docker compose --profile dev up -d

echo
echo "✅ Deployment complete (dev)."
echo "⚠ If any .env files were newly create
