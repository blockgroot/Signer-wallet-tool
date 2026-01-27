import fs from 'fs'
import path from 'path'

/**
 * Regenerate signers.json from scratch using:
 * 1. signer-metadata.txt (address : name format)
 * 2. safe-address-book-2026-01-13.csv (but exclude Safe wallet addresses)
 */

interface SignerEntry {
  name: string
  department: string | null
  addresses: string[]
}

function validateAddress(address: string): string | null {
  const normalized = address.trim().toLowerCase()
  if (normalized.match(/^0x[a-f0-9]{40}$/)) {
    return normalized
  }
  return null
}

function isSafeWallet(address: string, safeWallets: Set<string>): boolean {
  return safeWallets.has(address.toLowerCase())
}

function isWalletName(name: string): boolean {
  if (!name) return false
  const lowerName = name.toLowerCase()
  return lowerName.includes('safe') || lowerName.includes('multisig')
}

async function regenerateSigners() {
  console.log('🔄 Regenerating signers.json from scratch...\n')

  const dataDir = path.join(process.cwd(), 'data')
  
  // Read signer-metadata.txt
  const signerMetadataFile = path.join(dataDir, 'signer-metadata.txt')
  const signerMetadata = fs.readFileSync(signerMetadataFile, 'utf-8')
  
  // Read CSV file
  const csvFile = path.join(dataDir, 'safe-address-book-2026-01-13.csv')
  const csvContent = fs.readFileSync(csvFile, 'utf-8')
  
  // Read safe-wallet-with-metadata.txt to get Safe wallet addresses to exclude
  const safeWalletFile = path.join(dataDir, 'safe-wallet-with-metadata.txt')
  const safeWalletContent = fs.readFileSync(safeWalletFile, 'utf-8')
  
  // Parse Safe wallet addresses (from safe-wallet-with-metadata.txt)
  const safeWallets = new Set<string>()
  const safeWalletLines = safeWalletContent.split('\n')
  for (const line of safeWalletLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('safe address')) continue
    
    const match = trimmed.match(/^(0x[a-fA-F0-9]{40})\s*:/i)
    if (match) {
      safeWallets.add(match[1].toLowerCase())
    }
  }
  
  console.log(`📋 Found ${safeWallets.size} Safe wallet addresses to exclude\n`)

  // Parse signer-metadata.txt
  const signersMap = new Map<string, SignerEntry>()
  
  const metadataLines = signerMetadata.split('\n')
  for (const line of metadataLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    const match = trimmed.match(/^(0x[a-fA-F0-9]{40})\s*:\s*(.+)$/i)
    if (match) {
      const address = validateAddress(match[1])
      const name = match[2].trim()
      
      if (!address) {
        console.warn(`⚠️  Invalid address in signer-metadata.txt: ${match[1]}`)
        continue
      }
      
      if (isSafeWallet(address, safeWallets)) {
        console.log(`⏭️  Skipping ${address} (${name}) - it's a Safe wallet`)
        continue
      }
      
      // Normalize name (remove underscores, use consistent casing)
      const normalizedName = name
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!signersMap.has(normalizedName)) {
        signersMap.set(normalizedName, {
          name: normalizedName,
          department: null,
          addresses: [],
        })
      }
      
      const signer = signersMap.get(normalizedName)!
      if (!signer.addresses.includes(address)) {
        signer.addresses.push(address)
      }
    }
  }
  
  console.log(`✅ Parsed ${signersMap.size} signers from signer-metadata.txt\n`)

  // Parse CSV file
  const csvLines = csvContent.split('\n')
  const csvHeader = csvLines[0]
  
  if (!csvHeader.includes('address') || !csvHeader.includes('name')) {
    throw new Error('CSV file must have address and name columns')
  }
  
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i].trim()
    if (!line) continue
    
    const [address, name, chainId] = line.split(',')
    
    if (!address || !name) continue
    
    const normalizedAddress = validateAddress(address)
    if (!normalizedAddress) {
      console.warn(`⚠️  Invalid address in CSV: ${address}`)
      continue
    }
    
    // Skip if it's a Safe wallet
    if (isSafeWallet(normalizedAddress, safeWallets)) {
      continue
    }
    
    // Skip if name indicates it's a wallet (contains "safe" or "multisig")
    if (isWalletName(name)) {
      continue
    }
    
    // This is a signer address
    const normalizedName = name.trim()
    
    if (!signersMap.has(normalizedName)) {
      signersMap.set(normalizedName, {
        name: normalizedName,
        department: null,
        addresses: [],
      })
    }
    
    const signer = signersMap.get(normalizedName)!
    if (!signer.addresses.includes(normalizedAddress)) {
      signer.addresses.push(normalizedAddress)
    }
  }
  
  console.log(`✅ Parsed CSV and added signers\n`)

  // Merge signers with duplicate addresses (same address, different names)
  // Strategy: For each address, if it appears under multiple names, merge them into one signer
  const addressToSignerNames = new Map<string, Set<string>>()
  
  // Build address -> signer names mapping
  for (const signer of signersMap.values()) {
    for (const address of signer.addresses) {
      if (!addressToSignerNames.has(address)) {
        addressToSignerNames.set(address, new Set())
      }
      addressToSignerNames.get(address)!.add(signer.name)
    }
  }
  
  // Find addresses that belong to multiple signers and merge them
  const mergedSigners = new Map<string, SignerEntry>()
  const processedAddresses = new Set<string>()
  const nameAliases = new Map<string, string>() // Maps shorter names to canonical names
  
  // First pass: identify duplicates and choose canonical names
  for (const [address, signerNames] of addressToSignerNames.entries()) {
    if (signerNames.size > 1) {
      // Multiple names for same address - choose the longest/most complete one
      const namesArray = Array.from(signerNames)
      const canonicalName = namesArray.reduce((a, b) => {
        // Prefer longer name, or if same length, prefer the one with more words
        if (b.length > a.length) return b
        if (b.length === a.length && b.split(' ').length > a.split(' ').length) return b
        return a
      })
      
      // Map all other names to the canonical name
      for (const name of namesArray) {
        if (name !== canonicalName) {
          nameAliases.set(name, canonicalName)
        }
      }
    }
  }
  
  // Second pass: build merged signers
  for (const signer of signersMap.values()) {
    // Check if this name should be merged into another
    const canonicalName = nameAliases.get(signer.name) || signer.name
    
    if (!mergedSigners.has(canonicalName)) {
      mergedSigners.set(canonicalName, {
        name: canonicalName,
        department: signer.department,
        addresses: [],
      })
    }
    
    // Add all addresses from this signer to the canonical signer
    for (const address of signer.addresses) {
      if (!mergedSigners.get(canonicalName)!.addresses.includes(address)) {
        mergedSigners.get(canonicalName)!.addresses.push(address)
      }
      processedAddresses.add(address)
    }
  }
  
  // Add any remaining signers that weren't processed
  for (const signer of signersMap.values()) {
    const canonicalName = nameAliases.get(signer.name) || signer.name
    if (!mergedSigners.has(canonicalName)) {
      mergedSigners.set(canonicalName, {
        name: canonicalName,
        department: signer.department,
        addresses: [],
      })
    }
    
    // Merge addresses
    for (const address of signer.addresses) {
      if (!mergedSigners.get(canonicalName)!.addresses.includes(address)) {
        mergedSigners.get(canonicalName)!.addresses.push(address)
      }
    }
  }

  // Convert to array format
  const signersArray = Array.from(mergedSigners.values())
    .filter(signer => signer.addresses.length > 0) // Only include signers with valid addresses
    .sort((a, b) => a.name.localeCompare(b.name))

  // Write to signers.json
  const outputFile = path.join(dataDir, 'signers.json')
  fs.writeFileSync(outputFile, JSON.stringify(signersArray, null, 2), 'utf-8')

  console.log(`✅ Generated signers.json with ${signersArray.length} signers`)
  console.log(`\n📊 Summary:`)
  console.log(`   Total signers: ${signersArray.length}`)
  
  let totalAddresses = 0
  for (const signer of signersArray) {
    totalAddresses += signer.addresses.length
  }
  console.log(`   Total addresses: ${totalAddresses}`)
  
  console.log(`\n✅ signers.json regenerated successfully!`)
}

regenerateSigners().catch((error) => {
  console.error('❌ Error regenerating signers:', error)
  process.exit(1)
})
