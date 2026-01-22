# Org Multisig Registry Dashboard

Internal dashboard for tracking organization multisig wallets across multiple chains, mapping signer addresses to human identities, and providing real-time visibility into wallet thresholds and signer assignments.

## Features

- **Multi-Chain Support**: Track wallets on Ethereum Mainnet, Arbitrum, Optimism, Base, Avalanche, and more
- **Real-time Data**: Fetches fresh wallet data from Safe Transaction Service on every request
- **Signer Identity Mapping**: Map cryptographic addresses to human identities (people, ledgers, etc.)
- **Reverse Lookup**: See all wallets where a specific signer has signing rights
- **Admin Controls**: Admin-only editing capabilities for wallet and signer management

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Simple session-based auth (username/password)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/multisig_registry"
SESSION_SECRET="your-secret-key-for-cookies"
```

3. Set up the database:

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial admin user (optional)
npm run db:seed
```

The default admin credentials are:
- Username: `admin`
- Password: `admin123`

You can change these by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables before running the seed script.

4. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### Adding a Wallet

1. Log in as an admin user
2. Navigate to the Multisig Wallets dashboard
3. Click "Add Wallet"
4. Enter the wallet address, select the network, and optionally add a name and tag

### Mapping a Signer

1. Log in as an admin user
2. Navigate to the Signers dashboard
3. Click "Add User"
4. Enter the signer's name, department, and associated addresses

### Viewing Wallet Details

- Click on any wallet address in the dashboard to see:
  - Current threshold and signer count (fetched fresh from Safe API)
  - List of all signers with mapped names
  - Click on a signer address to see their profile

### Viewing Signer Details

- Click on any signer address to see:
  - All addresses associated with the signer
  - All multisig wallets where the signer is an owner
  - Click on a wallet to navigate to its detail page

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Wallets
- `GET /api/wallets` - List all wallets (with optional filters)
- `POST /api/wallets` - Create new wallet (admin only)
- `GET /api/wallets/[id]` - Get wallet details with fresh Safe API data
- `PUT /api/wallets/[id]` - Update wallet (admin only)
- `DELETE /api/wallets/[id]` - Delete wallet (admin only)

### Signers
- `GET /api/signers` - List all signers
- `POST /api/signers` - Create signer profile (admin only)
- `GET /api/signers/[id]` - Get signer with all associated wallets
- `PUT /api/signers/[id]` - Update signer (admin only)
- `POST /api/signers/[id]/addresses` - Add address to signer (admin only)
- `DELETE /api/signers/[id]/addresses/[addressId]` - Remove address (admin only)

## Deployment

### Vercel with Vercel Postgres (Recommended)

1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Create Database**: In Vercel project → Storage → Create Postgres database
3. **Environment Variables**: Vercel automatically adds:
   - `POSTGRES_URL` (use for `DATABASE_URL` in runtime)
   - `POSTGRES_PRISMA_URL` (use for migrations)
   - `POSTGRES_URL_NON_POOLING` (alternative for migrations)
4. **Add SESSION_SECRET**: Generate with `openssl rand -hex 32`
5. **Run Migrations**: 
   ```bash
   DATABASE_URL=$POSTGRES_URL_NON_POOLING npx prisma migrate deploy
   ```
6. **Seed Admin User**: `npm run db:seed`

**Note**: Vercel Postgres handles connection pooling automatically - no additional configuration needed!

See `VERCEL_DEPLOYMENT.md` for detailed deployment instructions.

## Database Schema

- **wallets**: Stores wallet addresses, names, chains, and tags
- **signers**: Stores signer names and departments
- **signer_addresses**: Maps multiple addresses to a signer
- **wallet_signers**: Junction table for wallet-signer relationships
- **users**: User accounts for authentication

## Notes

- Wallet threshold, nonce, and owner lists are fetched fresh from Safe Transaction Service on each request (not cached)
- The system automatically maps owner addresses to signer names based on the `signer_addresses` table
- All admin operations require authentication and admin privileges
