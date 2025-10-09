@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo =====================================================
echo 🚀 CareBell Local Dev Environment Setup
echo =====================================================

REM ─── Detect current Git branch ───────────────────────────────
for /f "delims=" %%A in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%A"
if "%CURRENT_BRANCH%"=="" (
    set "CURRENT_BRANCH=unknown"
)
echo 🧠 Active Git branch: %CURRENT_BRANCH%
echo (no changes will be made to your code)

REM ─── Ensure .env files exist ───────────────────────────────
echo.
echo 🧾 Checking .env files...
set "envFiles=.\.env .\frontend\.env .\backend\.env"

for %%F in (%envFiles%) do (
    if not exist "%%F" (
        set "exampleFile=%%~dpnF.example"
        if exist "!exampleFile!" (
            echo ⚠ Missing %%F — creating from template.
            copy "!exampleFile!" "%%F" >nul
        ) else (
            echo ❌ Missing both %%F and !exampleFile! — please add manually.
        )
    ) else (
        echo ✅ %%F already exists.
    )
)

REM ─── Detect Docker architecture ─────────────────────────────
echo.
echo 🧠 Detecting Docker platform...
for /f "delims=" %%A in ('docker version --format "{{.Server.Arch}}" 2^>nul') do set "DOCKER_ARCH=%%A"
if "%DOCKER_ARCH%"=="" set "DOCKER_ARCH=amd64"

if /I "%DOCKER_ARCH%"=="arm64" (
    set "DOCKER_DEFAULT_PLATFORM=linux/arm64"
) else (
    set "DOCKER_DEFAULT_PLATFORM=linux/amd64"
)
echo 🧩 Docker architecture detected: %DOCKER_ARCH% → using %DOCKER_DEFAULT_PLATFORM%
setx DOCKER_DEFAULT_PLATFORM %DOCKER_DEFAULT_PLATFORM% >nul

REM ─── Ensure Docker network exists ──────────────────────────
echo.
echo 🌐 Checking Docker network...
docker network inspect carebell_net >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo 🔧 Creating network carebell_net...
    docker network create carebell_net >nul
) ELSE (
    echo ✅ Network carebell_net already exists
)

REM ─── Install backend dependencies ──────────────────────────
echo.
echo 📦 Installing backend deps…
cd backend
call npm install
cd ..

REM ─── Clean up dangling images and (re)build ────────────────
echo.
echo 🧹 Removing dangling images…
docker image prune -f >nul

echo.
echo 🐳 Building and starting CareBell (dev containers)…
docker compose --profile dev down --remove-orphans
docker compose --profile dev build
docker compose --profile dev up -d

echo.
echo ✅ CareBell dev environment ready!
echo 💡 You are currently on branch: %CURRENT_BRANCH%
echo ⚠ If any .env files were created, fill missing values before running again.
pause
