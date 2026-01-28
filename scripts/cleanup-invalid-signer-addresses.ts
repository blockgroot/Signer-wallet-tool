import { PrismaClient } from '@prisma/client'

// Prisma will automatically use DATABASE_URL from environment
const prisma = new PrismaClient()

/**
 * Script to remove invalid signer addresses from the database.
 * Invalid addresses are:
 * 1. Addresses that belong to signers with name "Unknown" (or similar)
 * 2. Addresses that exist in the wallets table (these are Safe wallets, not signer addresses)
 */
async function main() {
  console.log('🔍 Starting cleanup of invalid signer addresses...\n')

  try {
    // Step 1: Get all wallet addresses (case-insensitive comparison)
    const wallets = await prisma.wallet.findMany({
      select: {
        address: true,
      },
    })

    const walletAddresses = new Set(
      wallets.map((w) => w.address.toLowerCase())
    )
    console.log(`📋 Found ${walletAddresses.size} wallet addresses in database\n`)

    // Step 2: Get all signer addresses with their signer info
    const signerAddresses = await prisma.signerAddress.findMany({
      include: {
        signer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    console.log(`📋 Found ${signerAddresses.length} signer addresses in database\n`)

    // Step 3: Identify invalid addresses
    const invalidAddresses: Array<{
      id: string
      address: string
      signerId: string
      signerName: string
      reason: string
    }> = []

    for (const signerAddr of signerAddresses) {
      const addrLower = signerAddr.address.toLowerCase()
      const signerName = signerAddr.signer.name.toLowerCase().trim()

      // Check if address is a Safe wallet
      if (walletAddresses.has(addrLower)) {
        invalidAddresses.push({
          id: signerAddr.id,
          address: signerAddr.address,
          signerId: signerAddr.signerId,
          signerName: signerAddr.signer.name,
          reason: 'Address is a Safe wallet (exists in wallets table)',
        })
        continue
      }

      // Check if signer name is "Unknown" or similar (case-insensitive, trimmed)
      // Also check if the name would result in "Unknown" or "-" being displayed
      const originalSignerName = signerAddr.signer.name || ''
      const normalizedSignerName = originalSignerName.trim().toLowerCase()
      
      // More aggressive check for problematic names
      const isProblematicName =
        !originalSignerName || // null or undefined
        originalSignerName.length === 0 || // empty string
        normalizedSignerName === '' || // trimmed is empty
        normalizedSignerName === 'unknown' || // explicitly "unknown"
        normalizedSignerName.length < 2 || // too short to be meaningful
        // Check if name is just whitespace, dashes, or special characters
        /^[\s\-_\.]+$/.test(originalSignerName) ||
        // Check if name would result in empty display name after processing
        (normalizedSignerName.length > 0 && normalizedSignerName.length < 3 && !/[a-zA-Z0-9]{2,}/.test(normalizedSignerName))

      if (isProblematicName) {
        invalidAddresses.push({
          id: signerAddr.id,
          address: signerAddr.address,
          signerId: signerAddr.signerId,
          signerName: originalSignerName || '(null/empty)',
          reason: `Signer name is problematic: ${JSON.stringify(originalSignerName)}`,
        })
        continue
      }
    }

    console.log(`❌ Found ${invalidAddresses.length} invalid signer addresses:\n`)
    if (invalidAddresses.length > 0) {
      invalidAddresses.forEach((addr, index) => {
        console.log(
          `${index + 1}. ${addr.address} (Signer: "${addr.signerName}") - ${addr.reason}`
        )
      })
      console.log('')

      // Step 4: Ask for confirmation (in production, we'll proceed)
      console.log('🗑️  Proceeding to delete invalid addresses...\n')

      // Group by signer ID to track which signers will be orphaned
      const signerAddressCounts = new Map<string, number>()
      for (const addr of invalidAddresses) {
        signerAddressCounts.set(
          addr.signerId,
          (signerAddressCounts.get(addr.signerId) || 0) + 1
        )
      }

      // Step 5: Delete invalid addresses
      let deletedCount = 0
      for (const invalidAddr of invalidAddresses) {
        try {
          await prisma.signerAddress.delete({
            where: { id: invalidAddr.id },
          })
          deletedCount++
        } catch (error) {
          console.error(
            `❌ Failed to delete ${invalidAddr.address}:`,
            error instanceof Error ? error.message : error
          )
        }
      }

      console.log(`✅ Deleted ${deletedCount} invalid signer addresses\n`)

      // Step 6: Check for orphaned signers (signers with no addresses left)
      const orphanedSigners: string[] = []
      for (const [signerId, deletedCount] of signerAddressCounts.entries()) {
        const remainingAddresses = await prisma.signerAddress.count({
          where: { signerId },
        })

        if (remainingAddresses === 0) {
          orphanedSigners.push(signerId)
        }
      }

      if (orphanedSigners.length > 0) {
        console.log(
          `⚠️  Found ${orphanedSigners.length} orphaned signers (no addresses left):\n`
        )

        for (const signerId of orphanedSigners) {
          const signer = await prisma.signer.findUnique({
            where: { id: signerId },
            select: { name: true },
          })
          console.log(`  - ${signer?.name || signerId}`)
        }

        console.log('\n🗑️  Deleting orphaned signers...\n')

        let deletedSignersCount = 0
        for (const signerId of orphanedSigners) {
          try {
            await prisma.signer.delete({
              where: { id: signerId },
            })
            deletedSignersCount++
          } catch (error) {
            console.error(
              `❌ Failed to delete signer ${signerId}:`,
              error instanceof Error ? error.message : error
            )
          }
        }

        console.log(`✅ Deleted ${deletedSignersCount} orphaned signers\n`)
      }

      // Step 7: Sync to JSON files
      console.log('📝 Syncing to JSON files...\n')
      try {
        const { syncSignersToJson } = await import('../src/lib/json-sync')
        await syncSignersToJson()
        console.log('✅ Synced signers to signers.json\n')
      } catch (error) {
        console.error('⚠️  Failed to sync to JSON:', error)
      }
    } else {
      console.log('✅ No invalid signer addresses found. Database is clean!\n')
    }

    console.log('✨ Cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
