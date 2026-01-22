#!/bin/bash

# Test Setup Script
# Verifies that the application is properly configured

set -e

echo "🔍 Testing Org Multisig Registry Setup..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Create a .env file with DATABASE_URL and SESSION_SECRET"
    exit 1
fi

echo "✅ .env file found"

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL" .env; then
    echo "❌ DATABASE_URL not found in .env"
    exit 1
fi

echo "✅ DATABASE_URL configured"

# Load .env variables
export $(cat .env | grep -v '^#' | xargs)

# Test database connection
echo ""
echo "🔌 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "   Check your DATABASE_URL in .env"
    exit 1
fi

# Check if database exists
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
if psql "$DATABASE_URL" -c "\dt" > /dev/null 2>&1; then
    echo "✅ Database accessible"
else
    echo "⚠️  Database may not have tables yet (this is OK if running migrations)"
fi

# Test Prisma
echo ""
echo "📦 Testing Prisma..."
if npm run db:generate > /dev/null 2>&1; then
    echo "✅ Prisma client generated successfully"
else
    echo "❌ Prisma client generation failed"
    exit 1
fi

# Check if migrations have been run
echo ""
echo "🔄 Checking migrations..."
if npx prisma migrate status > /dev/null 2>&1; then
    echo "✅ Migrations configured"
else
    echo "⚠️  Run 'npm run db:migrate' to create database tables"
fi

# Check if admin user exists
echo ""
echo "👤 Checking admin user..."
if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE username = 'admin';" 2>/dev/null | grep -q "1"; then
    echo "✅ Admin user exists"
else
    echo "⚠️  Admin user not found. Run 'npm run db:seed' to create one"
fi

echo ""
echo "✨ Setup check complete!"
echo ""
echo "Next steps:"
echo "  1. Run migrations: npm run db:migrate"
echo "  2. Seed admin user: npm run db:seed"
echo "  3. Start dev server: npm run dev"
echo "  4. Visit: http://localhost:3000"
