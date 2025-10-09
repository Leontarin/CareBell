#!/usr/bin/env bash
set -Eeuo pipefail

echo "====================================================="
echo "🚀 CareBell Local Dev Environment Setup"
echo "====================================================="

# ─── Detect current Git branch ───────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "🧠 Active Git branch: $CURRENT_BRANCH"
echo "(no changes will be made to your code)"

# ─── Ensure .env files exist ───────────────────────────────
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

# ─── Detect Docker architecture ─────────────────────────────
echo
echo "🧠 Detecting Docker platform..."
ARCH=$(docker version --format '{{.Server.Arch}}' 2>/dev/null || echo amd64)
case "$ARCH" in
  arm64)  export DOCKER_DEFAULT_PLATFORM=linux/arm64 ;;
  *)      export DOCKER_DEFAULT_PLATFORM=linux/amd64 ;;
esac
echo "🧩 Docker architecture detected: $ARCH → using $DOCKER_DEFAULT_PLATFORM"

# ─── Ensure Docker network exists ──────────────────────────
echo
echo "🌐 Checking Docker network..."
if ! docker network inspect carebell_net >/dev/null 2>&1; then
  echo "🔧 Creating network carebell_net..."
  docker network create carebell_net >/dev/null
else
  echo "✅ Network carebell_net already exists"
fi

# ─── Install backend dependencies ──────────────────────────
echo
echo "📦 Installing backend deps…"
( cd backend && npm install )

# ─── Docker cleanup / build / up ───────────────────────────
echo
echo "🧹 Removing dangling images…"
docker image prune -f >/dev/null

echo
echo "🐳 Building and starting CareBell (dev containers)…"
docker compose --profile dev down --remove-orphans
docker compose --profile dev build
docker compose --profile dev up -d

echo
echo "✅ CareBell dev environment ready!"
echo "💡 You are currently on branch: $CURRENT_BRANCH"
echo "⚠ If any .env files were created, fill missing values before running again."
