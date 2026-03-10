#!/bin/bash
# PyCode-SLM Research Dashboard — Setup Script

set -e

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     PyCode-SLM Research Dashboard — Setup           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+ first."
  exit 1
fi

NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Current: $(node --version)"
  exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for .env
if [ ! -f ".env" ]; then
  echo ""
  echo "⚙️  Creating .env from template..."
  cp .env.example .env
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔑 REQUIRED: Edit .env with your credentials:"
  echo ""
  echo "   DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?sslmode=require"
  echo "   GOOGLE_GEMINI_API_KEY=your_key_from_aistudio.google.com"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  read -p "Press Enter after editing .env to continue..."
fi

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push schema
echo ""
echo "🗄️  Pushing database schema..."
npm run db:push

# Seed
echo ""
echo "🌱 Seeding database with initial data..."
npm run db:seed

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅ Setup Complete!                         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  Run:  npm run dev                                   ║"
echo "║  Open: http://localhost:3000                         ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
