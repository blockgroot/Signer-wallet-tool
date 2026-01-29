# Vercel Deployment Guide

Complete step-by-step guide to deploy the Multisig Registry Dashboard to Vercel with PostgreSQL database.

## Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Vercel CLI (optional, for local testing)

## Step 1: Prepare Your Repository

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Verify these files are committed:**
   - `data/wallets.json` - Your wallet data
   - `data/signers.json` - Your signer data
   - `prisma/schema.prisma` - Database schema
   - `prisma/migrations/` - Database migrations
   - `package.json` - Dependencies
   - `vercel.json` - Vercel configuration

## Step 2: Create Vercel Project

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New..." → "Project"**
3. **Import your GitHub repository:**
   - Select your repository
   - Click "Import"

4. **Configure Project Settings:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

5. **Click "Deploy"** (we'll add environment variables next)

## Step 3: Create PostgreSQL Database

1. **In your Vercel project dashboard:**
   - Go to **Storage** tab
   - Click **"Create Database"**
   - Select **"Postgres"**

2. **Configure Database:**
   - **Name:** `multisig-registry` (or your preferred name)
   - **Region:** Choose closest to your users
   - Click **"Create"**

3. **Wait for database to be created** (takes ~1-2 minutes)

## Step 4: Configure Environment Variables

1. **In your Vercel project dashboard:**
   - Go to **Settings** → **Environment Variables**

2. **Add the following variables:**

   **a. Database URLs (automatically added by Vercel Postgres):**
   - `DATABASE_URL` - Already added automatically ✅
   - `PRISMA_DATABASE_URL` - Already added automatically ✅
   
   **b. Session Secret:**
   - **Key:** `SESSION_SECRET`
   - **Value:** Generate with: `openssl rand -hex 32`
   - **Environment:** Production, Preview, Development (all)
   
   **c. Safe API Key (optional but recommended):**
   - **Key:** `SAFE_API_KEY`
   - **Value:** Your Safe Transaction Service API key
   - **Environment:** Production, Preview, Development (all)
   
   **d. Admin Credentials (optional - for custom admin):**
   - **Key:** `ADMIN_USERNAME`
   - **Value:** `******` (or your preferred username)
   - **Environment:** Production only
   
   - **Key:** `ADMIN_PASSWORD`
   - **Value:** `******` (or your preferred password)
   - **Environment:** Production only

3. **Click "Save"** for each variable

## Step 5: Deploy the Application

1. **Trigger a new deployment:**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on the latest deployment
   - Or push a new commit to trigger automatic deployment

2. **Monitor the build:**
   - Watch the build logs
   - The build process will:
     - Install dependencies
     - Generate Prisma client
     - Build Next.js application
     - Run database migrations (postbuild)
     - Create admin user (postbuild)
     - Import data from JSON files (postbuild)

3. **Wait for deployment to complete** (~2-3 minutes)

## Step 6: Verify Deployment

1. **Check deployment status:**
   - Deployment should show "Ready" status
   - Click on the deployment to see the live URL

2. **Test the application:**
   - Visit your deployment URL (e.g., `https://your-project.vercel.app`)
   - You should see the Multisig Wallets dashboard
   - Navigate to `/signers` to see the Signers Directory
   - Try logging in with admin credentials

3. **Verify data:**
   - Check that wallets from `wallets.json` are displayed
   - Check that signers from `signers.json` are displayed
   - Verify no "Unknown" entries appear

## Step 7: Post-Deployment Verification

### Check Database

1. **In Vercel dashboard:**
   - Go to **Storage** → Your Postgres database
   - Click **"Data"** tab
   - Verify tables exist: `wallets`, `signers`, `signer_addresses`, `users`

2. **Check data:**
   - Verify wallets are imported
   - Verify signers are imported
   - Verify admin user exists

### Check Build Logs

1. **In Vercel dashboard:**
   - Go to **Deployments** → Latest deployment
   - Click **"Build Logs"**
   - Look for:
     - ✅ "Migrations completed successfully"
     - ✅ "Admin user created/updated"
     - ✅ "Data import completed successfully"

## Troubleshooting

### Build Fails with "DATABASE_URL not found"

**Solution:**
- Verify `DATABASE_URL` is set in Environment Variables
- Make sure it's set for the correct environment (Production/Preview/Development)
- Redeploy after adding the variable

### Build Fails with "Table does not exist"

**Solution:**
- Check that migrations ran successfully in build logs
- Manually run migrations:
  ```bash
  # Using Vercel CLI
  vercel env pull .env.production
  DATABASE_URL="$(grep PRISMA_DATABASE_URL .env.production | cut -d '=' -f2-)" npx prisma migrate deploy
  ```

### No Data Appears on Dashboard

**Solution:**
- Check build logs for import errors
- Verify `data/wallets.json` and `data/signers.json` are in the repository
- Manually run import:
  ```bash
  vercel env pull .env.production
  DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npm run import:json
  ```

### Can't Login

**Solution:**
- Verify `SESSION_SECRET` is set
- Check that admin user was created (see build logs)
- Manually create admin user:
  ```bash
  vercel env pull .env.production
  DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npm run db:seed
  ```

### Signers Dashboard Shows "Loading..."

**Solution:**
- Check Vercel function logs for API errors
- Verify database connection is working
- Check that signers were imported successfully

## Environment Variables Reference

| Variable | Required | Description | How to Get |
|----------|----------|-------------|------------|
| `DATABASE_URL` | Yes | Runtime database connection | Auto-added by Vercel Postgres |
| `PRISMA_DATABASE_URL` | Yes | Migration database connection | Auto-added by Vercel Postgres |
| `SESSION_SECRET` | Yes | Secret for session cookies | Generate: `openssl rand -hex 32` |
| `SAFE_API_KEY` | Recommended | Safe Transaction Service API key | Get from [Safe API](https://safe.global) |
| `ADMIN_USERNAME` | Optional | Admin username (default: `stader`) | Set custom or use default |
| `ADMIN_PASSWORD` | Optional | Admin password (default: `s2t1`) | Set custom or use default |

## Deployment Checklist

Before deploying, ensure:

- [ ] Code is pushed to GitHub
- [ ] `data/wallets.json` exists and is committed
- [ ] `data/signers.json` exists and is committed
- [ ] `prisma/migrations/` directory exists with migrations
- [ ] Vercel project is created and linked to GitHub repo
- [ ] PostgreSQL database is created in Vercel
- [ ] `DATABASE_URL` environment variable is set (auto-added)
- [ ] `PRISMA_DATABASE_URL` environment variable is set (auto-added)
- [ ] `SESSION_SECRET` environment variable is set
- [ ] `SAFE_API_KEY` environment variable is set (if using Safe API)
- [ ] Build completes successfully
- [ ] Migrations run successfully (check build logs)
- [ ] Admin user is created (check build logs)
- [ ] Data is imported (check build logs)
- [ ] Application is accessible and functional

## Updating Data

To update wallets or signers:

1. **Update JSON files locally:**
   - Edit `data/wallets.json` or `data/signers.json`
   - Commit and push to GitHub

2. **Redeploy:**
   - Vercel will automatically redeploy on push
   - Or manually trigger redeploy in Vercel dashboard

3. **Import script runs automatically:**
   - The postbuild script will:
     - Clean up invalid/orphaned entries
     - Import new/updated data from JSON files
     - Keep production in sync with JSON files

## Manual Data Operations

If you need to manually update data:

```bash
# Pull production environment variables
vercel env pull .env.production

# Import data
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npm run import:json

# Update departments
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npm run update:departments

# Clean up orphaned wallets
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npm run cleanup:wallets -- --confirm
```

## Support

For issues or questions:
- Check Vercel build logs
- Check Vercel function logs
- Review this deployment guide
- Check the main README.md for development setup
