# Quick Start Guide

Get the application running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Database

### Option A: Local PostgreSQL

```bash
# Create database
createdb multisig_registry

# Create .env file
cat > .env << EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/multisig_registry"
SESSION_SECRET="dev-secret-key-$(openssl rand -hex 16)"
EOF
```

### Option B: Vercel Postgres (Recommended for Vercel Deployment)

1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Create Postgres database: `vercel postgres create`
4. The `DATABASE_URL` will be automatically added to your environment variables
5. For local development, pull the connection string:

```bash
# Pull environment variables (includes DATABASE_URL)
vercel env pull .env.local

# Or manually add to .env:
# DATABASE_URL will be provided by Vercel
# Format: postgres://default:[PASSWORD]@[HOST]:[PORT]/verceldb
```

**Note**: Vercel Postgres automatically handles connection pooling, so no additional configuration is needed.

### Option C: Supabase (Free, Cloud)

1. Go to https://supabase.com and create account
2. Create new project
3. Go to Settings > Database
4. Copy the connection string
5. Create `.env` file:

```bash
cat > .env << EOF
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
SESSION_SECRET="dev-secret-key-$(openssl rand -hex 16)"
EOF
```

## 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Create admin user
npm run db:seed
```

**Default admin credentials:**
- Username: `****`
- Password: `****`

## 4. Start the Server

```bash
npm run dev
```

## 5. Test the Application

1. Open browser: http://localhost:3000
2. Login with: your custom credentials
3. You should see the Multisig Wallets dashboard

## Quick Test Checklist

- [ ] Can login with admin credentials
- [ ] See empty wallets list (or existing wallets)
- [ ] Can navigate to Signers page
- [ ] Can see "Add Wallet" button (admin only)
- [ ] Can see "Add User" button (admin only)

## Troubleshooting

**Database connection error?**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# If fails, check:
# - PostgreSQL is running
# - DATABASE_URL is correct in .env
# - Database exists
```

**Migration errors?**
```bash
# Reset and retry
npx prisma migrate reset
npm run db:migrate
```

**Can't login?**
```bash
# Re-seed admin user
npm run db:seed

```

## Next: Add Test Data

Once basic setup works, you can:

1. Add a test wallet (must be a real Safe wallet address)
2. Add test signers
3. Map signers to wallets

See `TESTING.md` for detailed testing instructions.
