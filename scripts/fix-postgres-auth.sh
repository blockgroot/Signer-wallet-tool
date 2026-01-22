#!/bin/bash

# Fix PostgreSQL Authentication for Local Development
# This configures trust authentication so you don't need a password locally

PG_HBA="/opt/homebrew/var/postgresql@14/pg_hba.conf"

if [ ! -f "$PG_HBA" ]; then
    echo "❌ Could not find pg_hba.conf at $PG_HBA"
    exit 1
fi

echo "📋 Backing up pg_hba.conf..."
cp "$PG_HBA" "$PG_HBA.backup.$(date +%s)"

echo "🔧 Configuring trust authentication for local connections..."

# Replace md5 with trust for local connections
sed -i '' 's/^local.*all.*all.*md5/local   all             all                                     trust/' "$PG_HBA"
sed -i '' 's/^host.*127.0.0.1.*md5/host    all             all             127.0.0.1\/32            trust/' "$PG_HBA"
sed -i '' 's/^host.*localhost.*md5/host    all             all             ::1\/128                 trust/' "$PG_HBA"

echo "🔄 Restarting PostgreSQL..."
brew services restart postgresql@14

sleep 3

echo "✅ PostgreSQL configured for trust authentication"
echo ""
echo "Now try creating the database:"
echo "  createdb multisig_registry"
echo ""
echo "Or with postgres user:"
echo "  createdb -U postgres multisig_registry"
