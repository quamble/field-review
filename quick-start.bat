@echo off
REM Field Review PWA - Quick Start Setup (Windows)

cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         Field Review PWA - Quick Start Setup                ║
echo ║                    (Windows)                                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✓ Node.js found: %NODE_VERSION%

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✓ npm found: %NPM_VERSION%

echo.
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✓ Dependencies installed
echo.

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env from template...
    copy .env.example .env
    echo ✓ .env created
    echo.
    echo ⚠️  IMPORTANT: Edit .env and add your OpenAI API key
    echo    OPENAI_API_KEY=sk-your-api-key-here
    echo.
    notepad .env
)

echo.
echo 🚀 Starting Field Review API Server...
echo.
echo    Server will be running at: http://localhost:3000
echo    Mobile access: http://YOUR_IP:3000
echo.
echo    To install as PWA:
echo    - Desktop: Click the app icon in address bar
echo    - Mobile: Use 'Add to Home Screen' from menu
echo.
echo    Press Ctrl+C to stop the server
echo.

call npm start
pause
