@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo =====================================================
echo 🔒 Using branch: master
echo =====================================================
git fetch --prune origin
git checkout master
git reset --hard origin/master

echo.
echo 📦 Installing backend deps…
cd backend
call npm ci
cd ..

echo.
echo 🌐 Checking Docker network...
docker network inspect carebell_net >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo 🔧 Creating network carebell_net...
    docker network create carebell_net >nul
) ELSE (
    echo ✅ Network carebell_net already exists
)

echo.
echo 🧹 Removing dangling images (cleanup)…
docker image prune -f >nul

echo.
echo 🐳 Rebuilding & restarting CareBell (prod)…
docker compose --profile prod down --remove-orphans
docker compose --profile prod build --no-cache
docker compose --profile prod up -d

echo.
echo ✅ Deployment complete (prod).
pause
