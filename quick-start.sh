#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Field Review PWA - Quick Start Setup                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js found: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✓ npm found: $NPM_VERSION"

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "✓ .env created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your OpenAI API key"
    echo "   OPENAI_API_KEY=sk-your-api-key-here"
    echo ""
    read -p "Press Enter after you've added your API key..."
fi

echo ""
echo "🚀 Starting Field Review API Server..."
echo ""
echo "   Server will be running at: http://localhost:3000"
echo "   Mobile access: http://YOUR_IP:3000"
echo ""
echo "   To install as PWA:"
echo "   - Desktop: Click the app icon in address bar"
echo "   - Mobile: Use 'Add to Home Screen' from menu"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

npm start
