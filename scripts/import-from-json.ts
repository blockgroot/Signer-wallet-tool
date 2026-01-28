import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

function isWalletName(name: string | null): boolean {
  if (!name) return false
  const lowerName = name.toLowerCase()
  return lowerName.includes('safe') || lowerName.includes('multisig')
}

function validateAddress(address: string): string | null {
  address = address.trim().toLowerCase()
  if (address.match(/^0x[a-f0-9]{40}$/)) {
    return address
  }
  return null
}

async function importFromJson() {
  console.log('📦 Importing data from JSON files...\n')

  // Check if DATABASE_URL is set (skip if not available, e.g., during build)
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set, skipping import (likely in build environment)')
    return
  }

  // Verify database tables exist by checking if we can query a table
  try {
    // Try to query the signers table to verify it exists
    await prisma.signer.findFirst({ take: 1 })
  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.log('⚠️  Database tables do not exist yet. Migrations should run automatically in postbuild.')
      console.log('⚠️  If this persists, run migrations manually: DATABASE_URL=$PRISMA_DATABASE_URL npm run db:migrate:deploy')
      return
    }
    // If it's a connection error, that's different - let it fail
    throw error
  }

  // Step 0: Clean up invalid signer addresses before importing
  // This ensures we start with a clean slate
  console.log('🧹 Step 0: Cleaning up invalid signer addresses...\n')
  try {
    // Get all wallet addresses (these should NOT be signer addresses)
    const walletAddresses = await prisma.wallet.findMany({
      select: { address: true },
    })
    const walletAddressSet = new Set(
      walletAddresses.map((w) => w.address.toLowerCase())
    )

    // Find signer addresses that are Safe wallets
    const invalidSignerAddresses = await prisma.signerAddress.findMany({
      where: {
        address: {
          in: Array.from(walletAddressSet),
        },
      },
      include: {
        signer: {
          select: { id: true, name: true },
        },
      },
    })

    if (invalidSignerAddresses.length > 0) {
      console.log(`  🗑️  Found ${invalidSignerAddresses.length} signer addresses that are Safe wallets`)
      for (const addr of invalidSignerAddresses) {
        await prisma.signerAddress.delete({ where: { id: addr.id } })
        console.log(`    ✅ Removed: ${addr.address} (was linked to "${addr.signer.name}")`)
      }
    }

    // Find signers with problematic names
    // Get all signers and filter in memory to avoid Prisma type issues with null
    const allSigners = await prisma.signer.findMany({
      include: {
        addresses: true,
      },
    })

    // Filter for problematic signers in memory
    const allProblematicSigners = allSigners.filter((signer) => {
      const name = signer.name || ''
      const trimmedName = name.trim().toLowerCase()

      return (
        !signer.name || // null or undefined
        name.length === 0 || // empty string
        trimmedName === '' || // trimmed is empty
        trimmedName === 'unknown' || // explicitly "unknown"
        trimmedName.length < 2 || // too short to be meaningful
        // Check if name is just whitespace, dashes, or special characters
        /^[\s\-_\.]+$/.test(name)
      )
    })

    if (allProblematicSigners.length > 0) {
      console.log(`  🗑️  Found ${allProblematicSigners.length} signers with problematic names`)
      for (const signer of allProblematicSigners) {
        // Delete all addresses first
        if (signer.addresses.length > 0) {
          await prisma.signerAddress.deleteMany({
            where: { signerId: signer.id },
          })
          console.log(`    ✅ Removed ${signer.addresses.length} addresses from signer "${signer.name || '(null)'}"`)
        }
        // Delete the signer
        await prisma.signer.delete({ where: { id: signer.id } })
        console.log(`    ✅ Removed signer: "${signer.name || '(null)'}"`)
      }
    }

    // Clean up orphaned signers (signers with no addresses)
    const orphanedSigners = await prisma.signer.findMany({
      include: {
        _count: {
          select: { addresses: true },
        },
      },
    })

    const toDelete = orphanedSigners.filter((s) => s._count.addresses === 0)
    if (toDelete.length > 0) {
      console.log(`  🗑️  Found ${toDelete.length} orphaned signers (no addresses)`)
      for (const signer of toDelete) {
        await prisma.signer.delete({ where: { id: signer.id } })
        console.log(`    ✅ Removed orphaned signer: "${signer.name}"`)
      }
    }

    if (
      invalidSignerAddresses.length === 0 &&
      allProblematicSigners.length === 0 &&
      toDelete.length === 0
    ) {
      console.log('  ✅ No invalid entries found, database is clean\n')
    } else {
      console.log('  ✅ Cleanup completed\n')
    }

    // Step 0.5: Clean up orphaned wallets (wallets not in wallets.json)
    console.log('🧹 Step 0.5: Cleaning up orphaned wallets...\n')
    try {
      const walletsJsonPath = path.join(process.cwd(), 'data', 'wallets.json')
      if (fs.existsSync(walletsJsonPath)) {
        const walletsJson = JSON.parse(fs.readFileSync(walletsJsonPath, 'utf-8'))
        const validWallets = new Set<string>()
        for (const wallet of walletsJson) {
          if (wallet.address && wallet.chainId) {
            const key = `${wallet.address.toLowerCase()}:${wallet.chainId}`
            validWallets.add(key)
          }
        }

        const dbWallets = await prisma.wallet.findMany({
          include: {
            walletSigners: true,
          },
        })

        const orphanedWallets = dbWallets.filter((wallet) => {
          const key = `${wallet.address.toLowerCase()}:${wallet.chainId}`
          return !validWallets.has(key)
        })

        if (orphanedWallets.length > 0) {
          console.log(`  🗑️  Found ${orphanedWallets.length} orphaned wallets (not in wallets.json)`)
          for (const wallet of orphanedWallets) {
            // Delete wallet (cascade will handle walletSigners)
            await prisma.wallet.delete({ where: { id: wallet.id } })
            console.log(
              `    ✅ Removed: ${wallet.address} (Chain: ${wallet.chainId})${wallet.name ? ` - "${wallet.name}"` : ''}`
            )
          }
          console.log('')
        } else {
          console.log('  ✅ No orphaned wallets found\n')
        }
      } else {
        console.log('  ⚠️  wallets.json not found, skipping orphaned wallet cleanup\n')
      }
    } catch (error) {
      console.error('  ⚠️  Orphaned wallet cleanup failed (non-fatal):', error)
      console.log('  ⚠️  Continuing with import...\n')
    }
  } catch (error) {
    console.error('  ⚠️  Cleanup failed (non-fatal):', error)
    console.log('  ⚠️  Continuing with import...\n')
  }

  const walletsJsonFile = path.join(process.cwd(), 'data', 'wallets.json')
  const signersJsonFile = path.join(process.cwd(), 'data', 'signers.json')

  // Read JSON files
  let wallets: any[] = []
  let signers: any[] = []

  if (fs.existsSync(walletsJsonFile)) {
    wallets = JSON.parse(fs.readFileSync(walletsJsonFile, 'utf-8'))
  } else {
    console.log('⚠️  wallets.json not found, skipping wallets import')
  }

  if (fs.existsSync(signersJsonFile)) {
    signers = JSON.parse(fs.readFileSync(signersJsonFile, 'utf-8'))
  } else {
    console.log('⚠️  signers.json not found, skipping signers import')
  }

  console.log(`📋 Found ${wallets.length} wallets in JSON`)
  console.log(`📋 Found ${signers.length} signers in JSON\n`)

  // Import wallets
  console.log('📦 Importing wallets...\n')
  let walletsAdded = 0
  let walletsSkipped = 0

  for (const wallet of wallets) {
    try {
      if (!wallet.chainId) {
        console.warn(`⚠️  Skipping wallet ${wallet.address} - no chainId`)
        walletsSkipped++
        continue
      }

      // Check if wallet already exists
      const existing = await prisma.wallet.findUnique({
        where: {
          address_chainId: {
            address: wallet.address.toLowerCase(),
            chainId: wallet.chainId,
          },
        },
      })

      if (existing) {
        // Update name if JSON has it and DB doesn't
        if (wallet.name && !existing.name) {
          await prisma.wallet.update({
            where: { id: existing.id },
            data: { name: wallet.name },
          })
          console.log(`🔄 Updated wallet name: ${wallet.address} -> "${wallet.name}"`)
        } else {
          walletsSkipped++
        }
        continue
      }

      // Create new wallet
      await prisma.wallet.create({
        data: {
          address: wallet.address.toLowerCase(),
          chainId: wallet.chainId,
          name: wallet.name || null,
          tag: null,
        },
      })
      console.log(`✅ Added wallet: ${wallet.address} (${wallet.chainId})${wallet.name ? ` - "${wallet.name}"` : ''}`)
      walletsAdded++
    } catch (error) {
      console.error(`❌ Error importing wallet ${wallet.address}:`, error)
    }
  }

  // Import signers
  console.log('\n👤 Importing signers...\n')
  let signersAdded = 0
  let addressesAdded = 0
  let signersSkipped = 0
  let addressesSkipped = 0

  // Merge signers with the same name
  const mergedSigners = new Map<string, any>()
  for (const signerData of signers) {
    const key = signerData.name
    if (!mergedSigners.has(key)) {
      mergedSigners.set(key, {
        name: signerData.name,
        department: signerData.department || null,
        addresses: new Set<string>(),
      })
    }
    const merged = mergedSigners.get(key)!
    if (signerData.department && !merged.department) {
      merged.department = signerData.department
    }
    if (signerData.addresses && Array.isArray(signerData.addresses)) {
      for (const addr of signerData.addresses) {
        const normalized = validateAddress(addr)
        if (normalized) {
          merged.addresses.add(normalized)
        }
      }
    }
  }

  for (const signerData of Array.from(mergedSigners.values())) {
    try {
      const addressesArray = Array.from(signerData.addresses) as string[]
      if (addressesArray.length === 0) {
        console.log(`⏭️  Skipping ${signerData.name} - no valid addresses`)
        signersSkipped++
        continue
      }

      // Find or create signer
      // Try exact match first
      let signer = await prisma.signer.findFirst({
        where: { name: signerData.name },
        include: { addresses: true },
      })

      // If not found, try to find by base name (e.g., "Dheeraj" matches "Dheeraj account 1")
      // This handles cases where the signer name in DB might be different from JSON
      if (!signer) {
        // Extract base name (remove "account 1", "account 2", etc.)
        const baseName = signerData.name
          .replace(/\s*account\s*[0-9]+\s*/i, '')
          .trim()
        
        if (baseName !== signerData.name && baseName.length > 0) {
          // Try to find by base name
          const allSigners = await prisma.signer.findMany({
            where: {
              name: {
                startsWith: baseName,
                mode: 'insensitive',
              },
            },
            include: { addresses: true },
          })
          
          // Find the best match (exact base name or starts with base name)
          signer = allSigners.find(s => 
            s.name.toLowerCase().trim() === baseName.toLowerCase().trim() ||
            s.name.toLowerCase().trim().startsWith(baseName.toLowerCase().trim())
          ) || null
        }
      }

      if (!signer) {
        signer = await prisma.signer.create({
          data: {
            name: signerData.name,
            department: signerData.department || null,
          },
          include: { addresses: true },
        })
        console.log(`✅ Created signer: ${signerData.name}`)
        signersAdded++
      } else {
        // Update existing signer if department has changed
        const currentDept = signer.department || null
        const newDept = signerData.department || null
        const needsUpdate = currentDept !== newDept
        
        if (needsUpdate) {
          signer = await prisma.signer.update({
            where: { id: signer.id },
            data: {
              department: newDept,
            },
            include: { addresses: true },
          })
          console.log(
            `🔄 Updated signer: ${signer.name} (department: ${currentDept || 'null'} → ${newDept || 'null'})`
          )
        } else {
          signersSkipped++
        }
      }

      // Add addresses
      for (const address of addressesArray) {
        try {
          const existingAddr = signer.addresses.find(a => a.address === address)
          
          if (existingAddr) {
            addressesSkipped++
            continue
          }

          // Check if address exists for another signer
          const existingSignerAddr = await prisma.signerAddress.findUnique({
            where: { address },
            include: { signer: true },
          })

          if (existingSignerAddr) {
            if (existingSignerAddr.signerId === signer.id) {
              addressesSkipped++
              continue
            } else {
              console.log(`  ⚠️  Address ${address} already linked to ${existingSignerAddr.signer.name}, skipping...`)
              addressesSkipped++
              continue
            }
          }

          await prisma.signerAddress.create({
            data: {
              signerId: signer.id,
              address: address,
            },
          })
          console.log(`  ✅ Added address: ${address}`)
          addressesAdded++
        } catch (error) {
          console.error(`  ❌ Error adding address ${address}:`, error)
        }
      }
    } catch (error) {
      console.error(`❌ Error importing signer ${signerData.name}:`, error)
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`\n  Wallets:`)
  console.log(`    ✅ Added: ${walletsAdded}`)
  console.log(`    ⏭️  Skipped: ${walletsSkipped}`)
  console.log(`\n  Signers:`)
  console.log(`    ✅ Added: ${signersAdded}`)
  console.log(`    ⏭️  Skipped: ${signersSkipped}`)
  console.log(`\n  Signer Addresses:`)
  console.log(`    ✅ Added: ${addressesAdded}`)
  console.log(`    ⏭️  Skipped: ${addressesSkipped}`)
  console.log(`\n✅ Import complete!`)
}

importFromJson()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
