#!/bin/bash

# Script to convert separate DATABASE_* variables to DATABASE_URL
# Reads your current .env and creates proper DATABASE_URL

if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Source the .env file to get variables
set -a
source .env
set +a

# Check if we have the required variables
if [ -z "$DATABASE_PASSWORD" ]; then
    echo "❌ DATABASE_PASSWORD not found in .env"
    echo "Please make sure your .env has:"
    echo "  DATABASE_PASSWORD=your_password"
    exit 1
fi

# Use provided values or defaults
DB_USER=${DATABASE_USER:-postgres}
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-multisig_registry}
DB_PASSWORD=$DATABASE_PASSWORD

# Create DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Backup existing .env
cp .env .env.backup.$(date +%s)

# Create new .env with DATABASE_URL
cat > .env << EOF
DATABASE_URL="${DATABASE_URL}"
SESSION_SECRET="${SESSION_SECRET:-dev-secret-key-$(openssl rand -hex 16)}"
EOF

echo "✅ Updated .env file with DATABASE_URL"
echo ""
echo "DATABASE_URL uses:"
echo "  User: ${DB_USER}"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo ""
echo "Backup saved. You can now run: npm run db:migrate"
