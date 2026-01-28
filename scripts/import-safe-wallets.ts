import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { getChainById } from '../src/lib/chains'

const prisma = new PrismaClient()

// Map Safe chain identifiers to our chain IDs
const CHAIN_MAP: Record<string, number> = {
  eth: 1, // Ethereum Mainnet
  bnb: 56, // BSC
  arb1: 42161, // Arbitrum
  oeth: 10, // Optimism
  base: 8453, // Base
  avax: 43114, // Avalanche
  matic: 137, // Polygon
  zkevm: 1101, // Polygon zkEVM
  zksync: 324, // zkSync Era
  linea: 59144, // Linea
  blast: 81457, // Blast
  xlayer: 196, // X Layer
  sonic: 146, // Sonic
  berachain: 80094, // Berachain
  ink: 57073, // Ink
  plasma: 9745, // Plasma Mainnet (chainlist.org/chain/9745)
  stable: 17000, // Holesky testnet (if this is what stable refers to)
  mega: 1329, // MegaETH
  mnt: 5000, // Mantle
  scr: 534352, // Scroll
  unichain: 130, // Unichain
  tac: 0, // TAC - need to verify chain ID
  sep: 11155111, // Sepolia testnet
}

interface ParsedWallet {
  address: string
  chainId: number
  chainName: string
  url: string
}

function parseSafeUrl(url: string): ParsedWallet | null {
  try {
    // Remove any whitespace
    url = url.trim()
    
    // Extract safe parameter
    const urlObj = new URL(url)
    const safeParam = urlObj.searchParams.get('safe')
    
    if (!safeParam) {
      console.warn(`No safe parameter found in URL: ${url}`)
      return null
    }

    // Parse chain:address format
    const [chainName, ...addressParts] = safeParam.split(':')
    const fullAddress = addressParts.join(':') // In case address contains colons
    
    if (!chainName || !fullAddress) {
      console.warn(`Invalid safe parameter format: ${safeParam}`)
      return null
    }

    // Extract first 42 characters (0x + 40 hex chars) as the address
    // Some URLs might have additional data after the address
    let address = fullAddress
    if (address.length > 42) {
      // Take first 42 characters
      address = address.substring(0, 42)
    }

    // Validate address format (must be exactly 0x + 40 hex characters)
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.warn(`Invalid address format: ${address} (from ${fullAddress.substring(0, 50)}...)`)
      return null
    }

    const chainId = CHAIN_MAP[chainName.toLowerCase()]
    
    if (!chainId) {
      console.warn(`Unknown chain: ${chainName}. Skipping ${address}`)
      return null
    }

    return {
      address: address.toLowerCase(),
      chainId,
      chainName,
      url,
    }
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error)
    return null
  }
}

async function importWallets() {
  console.log('🚀 Starting Safe wallet import...\n')

  // Read links from file
  const linksFile = path.join(process.cwd(), 'data', 'safe-wallet-links.txt')
  
  if (!fs.existsSync(linksFile)) {
    console.error(`❌ Links file not found: ${linksFile}`)
    process.exit(1)
  }

  const content = fs.readFileSync(linksFile, 'utf-8')
  const urls = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.startsWith('http'))

  console.log(`📋 Found ${urls.length} URLs to process\n`)

  const parsedWallets: ParsedWallet[] = []
  const errors: Array<{ url: string; error: string }> = []

  // Parse all URLs
  for (const url of urls) {
    const parsed = parseSafeUrl(url)
    if (parsed) {
      parsedWallets.push(parsed)
    } else {
      errors.push({ url, error: 'Failed to parse' })
    }
  }

  console.log(`✅ Parsed ${parsedWallets.length} wallets`)
  console.log(`❌ Failed to parse ${errors.length} URLs\n`)

  if (errors.length > 0) {
    console.log('Errors:')
    errors.forEach(({ url, error }) => {
      console.log(`  - ${url}: ${error}`)
    })
    console.log()
  }

  // Group by chain for better logging
  const byChain = parsedWallets.reduce((acc, wallet) => {
    if (!acc[wallet.chainName]) {
      acc[wallet.chainName] = []
    }
    acc[wallet.chainName].push(wallet)
    return acc
  }, {} as Record<string, ParsedWallet[]>)

  console.log('Wallets by chain:')
  Object.entries(byChain).forEach(([chain, wallets]) => {
    console.log(`  ${chain}: ${wallets.length} wallets`)
  })
  console.log()

  // Import wallets
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const wallet of parsedWallets) {
    try {
      // Check if wallet already exists
      const existing = await prisma.wallet.findUnique({
        where: {
          address_chainId: {
            address: wallet.address,
            chainId: wallet.chainId,
          },
        },
      })

      if (existing) {
        console.log(`⏭️  Skipping ${wallet.address} on chain ${wallet.chainId} (already exists)`)
        skipped++
        continue
      }

      // Verify wallet exists on chain by fetching from Safe API (optional)
      // Skip verification for chains that might not have Safe API support yet
      const chain = getChainById(wallet.chainId)
      if (chain) {
        try {
          const apiUrl = `${chain.safeApiUrl}/api/v1/safes/${wallet.address}/`
          const response = await fetch(apiUrl)
          if (!response.ok && response.status === 404) {
            console.warn(`⚠️  Wallet ${wallet.address} not found on chain ${wallet.chainId}, adding anyway...`)
          }
        } catch (error) {
          // Continue even if verification fails - some chains might not have API support
          console.warn(`⚠️  Could not verify ${wallet.address} on chain ${wallet.chainId}, adding anyway...`)
        }
      }

      // Create wallet in database
      await prisma.wallet.create({
        data: {
          address: wallet.address,
          chainId: wallet.chainId,
          name: null,
          tag: null,
        },
      })

      console.log(`✅ Imported ${wallet.address} on chain ${wallet.chainId} (${wallet.chainName})`)
      imported++
    } catch (error) {
      console.error(`❌ Failed to import ${wallet.address} on chain ${wallet.chainId}:`, error)
      failed++
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`  ✅ Imported: ${imported}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  📝 Total: ${parsedWallets.length}`)
}

importWallets()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
