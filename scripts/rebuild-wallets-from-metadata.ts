#!/usr/bin/env tsx

/**
 * Rebuild wallets.json from safe-wallet-with-metadata.txt
 * This file contains addresses with names and network information
 */

import fs from 'fs'
import path from 'path'

// Chain name to chainId mapping
const CHAIN_ID_MAP: Record<string, number> = {
  eth: 1,
  sep: 11155111,
  bnb: 56,
  matic: 137,
  avax: 43114,
  arb1: 42161,
  oeth: 10,
  base: 8453,
  zkevm: 1101,
  zksync: 324,
  linea: 59144,
  blast: 81457,
  scroll: 534352,
  scr: 534352,
  tac: 239,
  xlayer: 196,
  unichain: 130,
  sonic: 146,
  berachain: 80094,
  ink: 57073,
  plasma: 9745,
  stable: 2016,
  'hyper-evm': 999,
  mega: 6342,
  mnt: 5000,
}

interface WalletEntry {
  address: string
  chain: string
  chainId: number
  name: string | null
  source: string
}

function normalizeAddress(address: string): string | null {
  if (!address) return null
  address = address.trim()
  
  // Extract address if it's in a longer string
  const match = address.match(/0x[a-fA-F0-9]{40}/i)
  if (match) {
    address = match[0]
  }
  
  // Validate
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return null
  }
  
  return address.toLowerCase()
}

async function rebuildWallets() {
  console.log('🔄 Rebuilding wallets.json from safe-wallet-with-metadata.txt...\n')
  
  const metadataPath = path.join(process.cwd(), 'data', 'safe-wallet-with-metadata.txt')
  const content = fs.readFileSync(metadataPath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  
  const wallets = new Map<string, WalletEntry>() // key: address-chainId
  const nameMap = new Map<string, string>() // address -> name (from first section)
  
  let section = 'names' // 'names' or 'networks'
  
  for (const line of lines) {
    // Detect section headers
    if (line.toLowerCase().includes('safe address with associated names')) {
      section = 'names'
      continue
    }
    if (line.toLowerCase().includes('safe address with network name')) {
      section = 'networks'
      continue
    }
    
    // Parse line: address : value
    const match = line.match(/^(0x[a-fA-F0-9]{40})\s*:\s*(.+)$/i)
    if (!match) continue
    
    const address = normalizeAddress(match[1])
    if (!address) continue
    
    const value = match[2].trim()
    
    if (section === 'names') {
      // Store name for this address
      nameMap.set(address, value)
    } else if (section === 'networks') {
      // value is the network name
      const network = value.toLowerCase()
      const chainId = CHAIN_ID_MAP[network]
      
      if (!chainId) {
        console.warn(`⚠️  Unknown network: ${network} for address ${address}`)
        continue
      }
      
      const key = `${address}-${chainId}`
      const name = nameMap.get(address) || null
      
      wallets.set(key, {
        address,
        chain: network,
        chainId,
        name,
        source: 'metadata',
      })
    }
  }
  
  // Convert to array and sort
  const walletsArray = Array.from(wallets.values()).sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    return a.address.localeCompare(b.address)
  })
  
  // Write output
  const outputPath = path.join(process.cwd(), 'data', 'wallets.json')
  fs.writeFileSync(outputPath, JSON.stringify(walletsArray, null, 2))
  
  console.log(`✅ wallets.json regenerated`)
  console.log(`   Total wallets: ${walletsArray.length}`)
  console.log(`   Named wallets: ${walletsArray.filter(w => w.name).length}`)
  console.log(`   Networks: ${[...new Set(walletsArray.map(w => w.chain))].sort().join(', ')}`)
  console.log(`\n   Written to: ${outputPath}`)
}

rebuildWallets().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
