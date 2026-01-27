import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

/**
 * Remove wallets from database that are not in wallets.json
 */
async function cleanupOrphanedWallets() {
  console.log('🧹 Cleaning up orphaned wallets...\n')

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  // Read wallets.json
  const walletsJsonFile = path.join(process.cwd(), 'data', 'wallets.json')
  
  if (!fs.existsSync(walletsJsonFile)) {
    console.error(`❌ wallets.json not found at ${walletsJsonFile}`)
    process.exit(1)
  }

  const wallets = JSON.parse(fs.readFileSync(walletsJsonFile, 'utf-8'))
  console.log(`📋 Found ${wallets.length} wallets in wallets.json\n`)

  // Create a set of valid wallet addresses (address + chainId combination)
  const validWallets = new Set<string>()
  for (const wallet of wallets) {
    if (wallet.address && wallet.chainId) {
      const key = `${wallet.address.toLowerCase()}:${wallet.chainId}`
      validWallets.add(key)
    }
  }

  console.log(`✅ Created set of ${validWallets.size} valid wallets\n`)

  // Get all wallets from database
  const dbWallets = await prisma.wallet.findMany({
    include: {
      walletSigners: true,
    },
  })

  console.log(`📊 Found ${dbWallets.length} wallets in database\n`)

  // Find orphaned wallets
  const orphanedWallets = dbWallets.filter((wallet) => {
    const key = `${wallet.address.toLowerCase()}:${wallet.chainId}`
    return !validWallets.has(key)
  })

  console.log(`🔍 Found ${orphanedWallets.length} orphaned wallets:\n`)

  if (orphanedWallets.length === 0) {
    console.log('✅ No orphaned wallets found. Database is clean!')
    return
  }

  // Show orphaned wallets
  for (const wallet of orphanedWallets) {
    console.log(`  - ${wallet.address} (chainId: ${wallet.chainId})${wallet.name ? ` - "${wallet.name}"` : ''}`)
    if (wallet.walletSigners.length > 0) {
      console.log(`    ⚠️  Has ${wallet.walletSigners.length} signer associations`)
    }
  }

  console.log('\n❓ Do you want to delete these orphaned wallets?')
  console.log('   This will also remove any associated wallet-signer relationships.')
  console.log('   Run with --confirm flag to proceed: npm run cleanup:wallets -- --confirm')
  
  // Check for --confirm flag
  const args = process.argv.slice(2)
  if (!args.includes('--confirm')) {
    console.log('\n⚠️  Skipping deletion. Use --confirm flag to proceed.')
    return
  }

  console.log('\n🗑️  Deleting orphaned wallets...\n')

  let deleted = 0
  let errors = 0

  for (const wallet of orphanedWallets) {
    try {
      // Delete wallet (cascade will handle walletSigners)
      await prisma.wallet.delete({
        where: { id: wallet.id },
      })
      console.log(`✅ Deleted ${wallet.address} (chainId: ${wallet.chainId})`)
      deleted++
    } catch (error) {
      console.error(`❌ Error deleting ${wallet.address}:`, error)
      errors++
    }
  }

  console.log('\n📊 Cleanup Summary:')
  console.log(`  ✅ Deleted: ${deleted}`)
  console.log(`  ❌ Errors: ${errors}`)
  console.log(`  📝 Total orphaned: ${orphanedWallets.length}`)
}

cleanupOrphanedWallets()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
