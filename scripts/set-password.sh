#!/bin/bash

# Set PostgreSQL password for current user
# This will prompt you to enter a password

echo "Setting PostgreSQL password for user: $(whoami)"
echo "You'll be prompted to enter a password twice"
echo ""

# Try to connect and set password
psql postgres << EOF
ALTER USER $(whoami) WITH PASSWORD 'postgres';
\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ Password set successfully!"
    echo ""
    echo "Your .env file should have:"
    echo "DATABASE_URL=\"postgresql://$(whoami):postgres@localhost:5432/multisig_registry\""
else
    echo "❌ Failed to set password. You may need to:"
    echo "1. Connect as postgres user first"
    echo "2. Or create the user first"
fi
