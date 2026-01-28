import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { getChainById } from '../src/lib/chains'

const prisma = new PrismaClient()

function getNetworkName(chainId: number): string {
  const chain = getChainById(chainId)
  return chain?.name || `Chain ${chainId}`
}

function isWalletName(name: string | null): boolean {
  if (!name) return false
  const lowerName = name.toLowerCase()
  return lowerName.includes('safe') || lowerName.includes('multisig')
}

async function fixAndReimport() {
  console.log('🔧 Fixing JSON files and reimporting to database...\n')

  const walletsJsonFile = path.join(process.cwd(), 'data', 'wallets.json')
  const signersJsonFile = path.join(process.cwd(), 'data', 'signers.json')

  // Step 0: Get correct names from database before clearing
  console.log('📖 Reading current database to get correct names...\n')
  
  const dbWallets = await prisma.wallet.findMany({
    select: {
      address: true,
      chainId: true,
      name: true,
    },
  })

  const dbSigners = await prisma.signer.findMany({
    include: {
      addresses: true,
    },
  })

  // Create a map of address+chainId -> name for wallets
  const walletNameMap = new Map<string, string | null>()
  for (const wallet of dbWallets) {
    const key = `${wallet.address.toLowerCase()}_${wallet.chainId}`
    walletNameMap.set(key, wallet.name)
  }

  console.log(`  Found ${dbWallets.length} wallets in database`)
  console.log(`  Found ${dbSigners.length} signers in database\n`)

  // Read JSON files
  let wallets: any[] = []
  let signers: any[] = []

  if (fs.existsSync(walletsJsonFile)) {
    wallets = JSON.parse(fs.readFileSync(walletsJsonFile, 'utf-8'))
  }

  if (fs.existsSync(signersJsonFile)) {
    signers = JSON.parse(fs.readFileSync(signersJsonFile, 'utf-8'))
  }

  console.log(`📋 Found ${wallets.length} entries in wallets.json`)
  console.log(`📋 Found ${signers.length} entries in signers.json\n`)

  // Step 1: Fix JSON files - update names from database and move wrong entries
  console.log('🔍 Checking for wrong entries in JSON files...\n')

  const walletsToKeep: any[] = []
  const walletsToMove: any[] = []

  // Check wallets.json - entries without "safe" or "multisig" should be moved to signers
  for (const wallet of wallets) {
    // Try to get name from database if JSON has null
    let walletName = wallet.name
    if (!walletName && wallet.chainId) {
      const key = `${wallet.address.toLowerCase()}_${wallet.chainId}`
      walletName = walletNameMap.get(key) || null
    }

    if (isWalletName(walletName)) {
      walletsToKeep.push({
        ...wallet,
        name: walletName,
      })
    } else {
      walletsToMove.push({
        ...wallet,
        name: walletName,
      })
      console.log(`⚠️  Moving from wallets to signers: ${wallet.address} - "${walletName || 'null'}"`)
    }
  }

  const signersToKeep: any[] = []
  const signersToMove: any[] = []

  // Check signers.json - entries with "safe" or "multisig" should be moved to wallets
  for (const signer of signers) {
    if (isWalletName(signer.name)) {
      signersToMove.push(signer)
      console.log(`⚠️  Moving from signers to wallets: "${signer.name}"`)
    } else {
      // Normalize and deduplicate addresses
      const normalizedAddresses = new Set<string>()
      if (signer.addresses && Array.isArray(signer.addresses)) {
        for (const addr of signer.addresses) {
          const normalized = addr.toLowerCase().trim()
          if (normalized.match(/^0x[a-f0-9]{40}$/)) {
            normalizedAddresses.add(normalized)
          }
        }
      }
      signersToKeep.push({
        ...signer,
        addresses: Array.from(normalizedAddresses),
      })
    }
  }

  // Add moved wallets to signers (group by name)
  for (const wallet of walletsToMove) {
    const name = wallet.name || 'Unknown'
    let signer = signersToKeep.find(s => s.name === name)
    
    if (!signer) {
      signer = {
        name,
        department: null,
        addresses: new Set<string>(),
      }
      signersToKeep.push(signer)
    }

    // Normalize and add address
    const normalizedAddr = wallet.address.toLowerCase().trim()
    if (normalizedAddr.match(/^0x[a-f0-9]{40}$/)) {
      if (signer.addresses instanceof Set) {
        signer.addresses.add(normalizedAddr)
      } else {
        if (!signer.addresses.includes(normalizedAddr)) {
          signer.addresses.push(normalizedAddr)
        }
      }
    }
  }

  // Add moved signers to wallets
  for (const signer of signersToMove) {
    // For each address in the signer, create a wallet entry
    // But we need chainId - we'll need to check existing wallets or skip
    console.log(`⚠️  Signer "${signer.name}" has "safe"/"multisig" but needs chainId - skipping for now`)
    // TODO: Could try to find chainId from existing database entries
  }

  // Merge signers with the same name (before writing JSON)
  const mergedSignersForJson = new Map<string, any>()
  for (const signer of signersToKeep) {
    const key = signer.name
    if (!mergedSignersForJson.has(key)) {
      mergedSignersForJson.set(key, {
        name: signer.name,
        department: signer.department || null,
        addresses: new Set<string>(),
      })
    }
    const merged = mergedSignersForJson.get(key)!
    // If we have a department and merged doesn't, update it
    if (signer.department && !merged.department) {
      merged.department = signer.department
    }
    // Add all addresses
    const addresses = signer.addresses instanceof Set 
      ? Array.from(signer.addresses) 
      : (signer.addresses || [])
    for (const addr of addresses) {
      const normalized = addr.toLowerCase().trim()
      if (normalized.match(/^0x[a-f0-9]{40}$/)) {
        merged.addresses.add(normalized)
      }
    }
  }

  // Convert Sets to Arrays for JSON serialization
  const finalSigners = Array.from(mergedSignersForJson.values()).map(s => ({
    name: s.name,
    department: s.department,
    addresses: Array.from(s.addresses),
  }))

  // Write corrected JSON files
  fs.writeFileSync(walletsJsonFile, JSON.stringify(walletsToKeep, null, 2), 'utf-8')
  fs.writeFileSync(signersJsonFile, JSON.stringify(finalSigners, null, 2), 'utf-8')

  console.log(`\n✅ Fixed JSON files:`)
  console.log(`  Wallets: ${walletsToKeep.length} (removed ${walletsToMove.length})`)
  console.log(`  Signers: ${finalSigners.length} (merged from ${signersToKeep.length}, added ${walletsToMove.length} from wallets)\n`)

  // Step 2: Clear database tables
  console.log('🗑️  Clearing database tables...\n')

  await prisma.walletSigner.deleteMany({})
  console.log('  ✅ Cleared wallet_signers table')

  await prisma.signerAddress.deleteMany({})
  console.log('  ✅ Cleared signer_addresses table')

  await prisma.wallet.deleteMany({})
  console.log('  ✅ Cleared wallets table')

  await prisma.signer.deleteMany({})
  console.log('  ✅ Cleared signers table')

  // Step 3: Reimport from corrected JSON files
  console.log('\n📦 Reimporting wallets...\n')

  let walletsAdded = 0
  for (const wallet of walletsToKeep) {
    try {
      if (!wallet.chainId) {
        console.warn(`⚠️  Skipping wallet ${wallet.address} - no chainId`)
        continue
      }

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
      console.error(`❌ Error adding wallet ${wallet.address}:`, error)
    }
  }

  console.log(`\n👤 Reimporting signers...\n`)

  let signersAdded = 0
  let addressesAdded = 0

  // First, merge signers with the same name (regardless of department)
  // Use name as key to merge all addresses
  const mergedSigners = new Map<string, any>()
  for (const signerData of signersToKeep) {
    const key = signerData.name
    if (!mergedSigners.has(key)) {
      // Use the first department found, or null
      mergedSigners.set(key, {
        name: signerData.name,
        department: signerData.department || null,
        addresses: new Set<string>(),
      })
    }
    const merged = mergedSigners.get(key)!
    // If we have a department and merged doesn't, update it
    if (signerData.department && !merged.department) {
      merged.department = signerData.department
    }
    // Add all addresses to the set (automatically deduplicates)
    if (signerData.addresses && Array.isArray(signerData.addresses)) {
      for (const addr of signerData.addresses) {
        const normalized = addr.toLowerCase().trim()
        if (normalized.match(/^0x[a-f0-9]{40}$/)) {
          merged.addresses.add(normalized)
        }
      }
    }
  }

  for (const signerData of Array.from(mergedSigners.values())) {
    try {
      const addressesArray = Array.from(signerData.addresses)
      if (addressesArray.length === 0) {
        console.log(`⏭️  Skipping ${signerData.name} - no valid addresses`)
        continue
      }

      const signer = await prisma.signer.create({
        data: {
          name: signerData.name,
          department: signerData.department || null,
        },
      })
      console.log(`✅ Created signer: ${signerData.name} (${addressesArray.length} addresses)`)
      signersAdded++

      for (const address of addressesArray) {
        try {
          // Ensure address is a string
          const addressStr = String(address)
          
          // Check if address already exists
          const existingAddr = await prisma.signerAddress.findUnique({
            where: { address: addressStr },
            include: { signer: true },
          })

          if (existingAddr) {
            if (existingAddr.signerId === signer.id) {
              // Already linked to this signer, skip
              continue
            } else {
              console.log(`  ⚠️  Address ${address} already linked to ${existingAddr.signer.name}, skipping...`)
              continue
            }
          }

          await prisma.signerAddress.create({
            data: {
              signerId: signer.id,
              address: addressStr,
            },
          })
          console.log(`  ✅ Added address: ${addressStr}`)
          addressesAdded++
        } catch (error) {
          console.error(`  ❌ Error adding address ${address}:`, error)
        }
      }
    } catch (error) {
      console.error(`❌ Error processing signer ${signerData.name}:`, error)
    }
  }

  console.log('\n📊 Reimport Summary:')
  console.log(`  ✅ Wallets added: ${walletsAdded}`)
  console.log(`  ✅ Signers added: ${signersAdded}`)
  console.log(`  ✅ Signer addresses added: ${addressesAdded}`)
  console.log(`\n✅ Database has been cleared and reimported with corrected data!`)
}

fixAndReimport()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
