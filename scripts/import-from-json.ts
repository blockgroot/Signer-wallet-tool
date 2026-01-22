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

  const walletsJsonFile = path.join(process.cwd(), 'data', 'wallets.json')
  const signersJsonFile = path.join(process.cwd(), 'data', 'signer.json')

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
    console.log('⚠️  signer.json not found, skipping signers import')
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
      let signer = await prisma.signer.findFirst({
        where: { name: signerData.name },
        include: { addresses: true },
      })

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
        signersSkipped++
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
