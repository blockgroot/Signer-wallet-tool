import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { getChainById } from '../src/lib/chains'

const prisma = new PrismaClient()

// Map chain IDs to network names
function getNetworkName(chainId: number): string {
  const chain = getChainById(chainId)
  return chain?.name || `Chain ${chainId}`
}

interface CSVRow {
  address: string
  name: string | null
  chainId: number | null
  network: string | null
  type: 'wallet' | 'signer'
}


function validateAddress(address: string): string | null {
  address = address.trim().toLowerCase()
  if (address.match(/^0x[a-f0-9]{40}$/)) {
    return address
  }
  return null
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line)
  if (lines.length === 0) return []

  // Parse header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const addressIdx = header.findIndex(h => h.includes('address') || h.includes('wallet'))
  const nameIdx = header.findIndex(h => h.includes('name') || h.includes('label'))
  const chainIdx = header.findIndex(h => h.includes('chain') || h.includes('network'))
  const typeIdx = header.findIndex(h => h.includes('type') || h.includes('category'))

  if (addressIdx === -1) {
    throw new Error('Could not find address column in CSV')
  }

  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    
    const address = addressIdx >= 0 ? values[addressIdx] : null
    const name = nameIdx >= 0 ? (values[nameIdx] || null) : null
    const chainStr = chainIdx >= 0 ? values[chainIdx] : null
    const typeStr = typeIdx >= 0 ? values[typeIdx]?.toLowerCase() : null

    if (!address) continue

    const validatedAddress = validateAddress(address)
    if (!validatedAddress) {
      console.warn(`Invalid address format: ${address}`)
      continue
    }

    const chainId = chainStr ? parseInt(chainStr, 10) : null
    const finalChainId = chainId && !isNaN(chainId) ? chainId : null
    
    // Determine type: if chainId exists, it's likely a wallet; otherwise might be signer
    let type: 'wallet' | 'signer' = 'wallet'
    if (typeStr) {
      type = typeStr.includes('signer') || typeStr.includes('owner') ? 'signer' : 'wallet'
    } else if (!finalChainId) {
      type = 'signer' // No chain ID suggests it's a signer address
    }

    rows.push({
      address: validatedAddress,
      name: name || null,
      chainId: finalChainId,
      network: finalChainId ? getNetworkName(finalChainId) : null,
      type,
    })
  }

  return rows
}

async function syncFromCSV() {
  console.log('🔄 Syncing addresses from CSV...\n')

  const csvFile = path.join(process.cwd(), 'data', 'safe-address-book-2026-01-13.csv')
  const walletsJsonFile = path.join(process.cwd(), 'data', 'wallets.json')
  const signersJsonFile = path.join(process.cwd(), 'data', 'signer.json')

  if (!fs.existsSync(csvFile)) {
    console.error(`❌ CSV file not found: ${csvFile}`)
    process.exit(1)
  }

  // Read CSV
  const csvContent = fs.readFileSync(csvFile, 'utf-8')
  const csvRows = parseCSV(csvContent)

  console.log(`📋 Found ${csvRows.length} addresses in CSV\n`)

  // Separate wallets and signers based on name
  // Only addresses with names containing "safe" or "multisig" are wallets
  // All others are signer addresses
  const wallets = csvRows.filter(r => {
    if (!r.chainId) return false // Must have chainId to be a wallet
    const name = (r.name || '').toLowerCase()
    return name.includes('safe') || name.includes('multisig')
  })
  
  const signers = csvRows.filter(r => {
    if (!r.chainId) return true // No chainId = signer
    const name = (r.name || '').toLowerCase()
    return !name.includes('safe') && !name.includes('multisig')
  })

  console.log(`  Wallets (name contains "safe" or "multisig"): ${wallets.length}`)
  console.log(`  Signers (all other addresses): ${signers.length}\n`)

  // Read existing JSON files
  let existingWallets: any[] = []
  if (fs.existsSync(walletsJsonFile)) {
    existingWallets = JSON.parse(fs.readFileSync(walletsJsonFile, 'utf-8'))
  }

  let existingSigners: any[] = []
  if (fs.existsSync(signersJsonFile)) {
    existingSigners = JSON.parse(fs.readFileSync(signersJsonFile, 'utf-8'))
  }

  // Process wallets
  console.log('📦 Processing wallets...\n')
  let walletsAdded = 0
  let walletsUpdated = 0
  let walletsSkipped = 0

  for (const wallet of wallets) {
    try {
      if (!wallet.chainId) {
        console.warn(`⚠️  Skipping wallet ${wallet.address} - no chain ID`)
        walletsSkipped++
        continue
      }

      // Check if wallet exists in DB
      const existingWallet = await prisma.wallet.findUnique({
        where: {
          address_chainId: {
            address: wallet.address,
            chainId: wallet.chainId,
          },
        },
      })

      // Check if wallet exists in JSON
      const jsonWallet = existingWallets.find(
        w => w.address === wallet.address && w.chainId === wallet.chainId
      )

      // Update or create in database
      if (existingWallet) {
        // Update name if CSV has it and DB doesn't
        if (wallet.name && !existingWallet.name) {
          await prisma.wallet.update({
            where: { id: existingWallet.id },
            data: { name: wallet.name },
          })
          console.log(`✅ Updated wallet name: ${wallet.address} -> "${wallet.name}"`)
          walletsUpdated++
        }
      } else {
        // Create new wallet in DB
        await prisma.wallet.create({
          data: {
            address: wallet.address,
            chainId: wallet.chainId,
            name: wallet.name || null,
            tag: null,
          },
        })
        console.log(`✅ Added wallet: ${wallet.address} (${wallet.chainId})${wallet.name ? ` - "${wallet.name}"` : ''}`)
        walletsAdded++
      }

      // Update or add to JSON
      if (jsonWallet) {
        // Update name if CSV has it and JSON doesn't
        if (wallet.name && !jsonWallet.name) {
          jsonWallet.name = wallet.name
          walletsUpdated++
        }
      } else {
        // Add to JSON
        existingWallets.push({
          address: wallet.address,
          name: wallet.name || null,
          chainId: wallet.chainId,
          network: wallet.network || null,
        })
        walletsAdded++
      }
    } catch (error) {
      console.error(`❌ Error processing wallet ${wallet.address}:`, error)
    }
  }

  // Process signers - all addresses that are NOT wallets (don't have "safe" or "multisig" in name)
  console.log('\n👤 Processing signers...\n')
  let signersAdded = 0
  let signersUpdated = 0

  // Group signers by name
  const signersByName = new Map<string, string[]>() // name -> addresses[]
  
  for (const row of signers) {
    const name = row.name || 'Unknown'
    if (!signersByName.has(name)) {
      signersByName.set(name, [])
    }
    signersByName.get(name)!.push(row.address)
  }

  for (const [name, addresses] of signersByName.entries()) {
    try {
      // Find or create signer
      let signer = await prisma.signer.findFirst({
        where: { name },
        include: { addresses: true },
      })

      if (!signer) {
        signer = await prisma.signer.create({
          data: { name, department: null },
          include: { addresses: true },
        })
        console.log(`✅ Created signer: ${name}`)
        signersAdded++
      }

      // Add addresses
      for (const address of addresses) {
        const existingAddr = signer.addresses.find(a => a.address === address)
        
        if (!existingAddr) {
          // Check if address already exists for another signer
          const existingSignerAddr = await prisma.signerAddress.findUnique({
            where: { address },
            include: { signer: true },
          })
          
          if (existingSignerAddr) {
            if (existingSignerAddr.signerId === signer.id) {
              // Already linked to this signer, skip
              continue
            } else {
              console.log(`  ⚠️  Address ${address} already linked to ${existingSignerAddr.signer.name}, skipping...`)
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
          signersAdded++
        }
      }

      // Update JSON
      const jsonSigner = existingSigners.find(s => s.name === name)
      if (jsonSigner) {
        // Add missing addresses
        for (const address of addresses) {
          if (!jsonSigner.addresses.includes(address)) {
            jsonSigner.addresses.push(address)
            signersUpdated++
          }
        }
      } else {
        // Add new signer to JSON
        existingSigners.push({
          name,
          department: null,
          addresses: addresses,
        })
        signersAdded++
      }
    } catch (error) {
      console.error(`❌ Error processing signer ${name}:`, error)
    }
  }

  // Write updated JSON files
  fs.writeFileSync(walletsJsonFile, JSON.stringify(existingWallets, null, 2), 'utf-8')
  fs.writeFileSync(signersJsonFile, JSON.stringify(existingSigners, null, 2), 'utf-8')

  console.log('\n📊 Sync Summary:')
  console.log(`\n  Wallets:`)
  console.log(`    ✅ Added: ${walletsAdded}`)
  console.log(`    🔄 Updated: ${walletsUpdated}`)
  console.log(`    ⏭️  Skipped: ${walletsSkipped}`)
  console.log(`\n  Signers:`)
  console.log(`    ✅ Added: ${signersAdded}`)
  console.log(`    🔄 Updated: ${signersUpdated}`)
  console.log(`\n  JSON files updated: wallets.json, signer.json`)
}

syncFromCSV()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
