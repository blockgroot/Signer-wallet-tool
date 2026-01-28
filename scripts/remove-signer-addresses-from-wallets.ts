#!/usr/bin/env tsx
/**
 * Script to remove signer addresses that were incorrectly imported as wallets
 * These addresses should only exist in the signers table, not in wallets table
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Addresses that are signers (EOAs) but were incorrectly added as wallets
const SIGNER_ADDRESSES_TO_REMOVE = [
  '0x5ae348bb75bc9587290a28636187b83b9f42e4e5',
  '0x26d60a69f3c9ac4c9a405a5d3d54548978528d32',
]

async function removeSignerAddressesFromWallets() {
  console.log('🔍 Removing signer addresses from wallets table...\n')

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  let removedCount = 0
  let errorCount = 0

  for (const address of SIGNER_ADDRESSES_TO_REMOVE) {
    try {
      // Find all wallets with this address (could be on multiple chains)
      const wallets = await prisma.wallet.findMany({
        where: {
          address: address.toLowerCase(),
        },
        include: {
          walletSigners: true,
        },
      })

      if (wallets.length === 0) {
        console.log(`⏭️  No wallets found for address: ${address}`)
        continue
      }

      for (const wallet of wallets) {
        // Delete wallet signer relationships first
        if (wallet.walletSigners.length > 0) {
          await prisma.walletSigner.deleteMany({
            where: {
              walletId: wallet.id,
            },
          })
          console.log(`  🗑️  Deleted ${wallet.walletSigners.length} wallet-signer relationships for wallet ${wallet.id}`)
        }

        // Delete the wallet
        await prisma.wallet.delete({
          where: {
            id: wallet.id,
          },
        })

        console.log(`✅ Removed wallet: ${address} (chainId: ${wallet.chainId})`)
        removedCount++
      }
    } catch (error) {
      console.error(`❌ Error removing wallet ${address}:`, error)
      errorCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  ✅ Removed: ${removedCount} wallet(s)`)
  console.log(`  ❌ Errors: ${errorCount}`)
  console.log('\n✅ Cleanup complete!')
}

removeSignerAddressesFromWallets()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
