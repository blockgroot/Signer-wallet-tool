import fs from 'fs'
import path from 'path'

// Map Safe chain identifiers to chain IDs and network names
const CHAIN_MAP: Record<string, { chainId: number; network: string }> = {
  eth: { chainId: 1, network: 'Ethereum Mainnet' },
  bnb: { chainId: 56, network: 'BSC' },
  arb1: { chainId: 42161, network: 'Arbitrum' },
  oeth: { chainId: 10, network: 'Optimism' },
  base: { chainId: 8453, network: 'Base' },
  avax: { chainId: 43114, network: 'Avalanche' },
  matic: { chainId: 137, network: 'Polygon' },
  zkevm: { chainId: 1101, network: 'Polygon zkEVM' },
  zksync: { chainId: 324, network: 'zkSync Era' },
  linea: { chainId: 59144, network: 'Linea' },
  blast: { chainId: 81457, network: 'Blast' },
  xlayer: { chainId: 196, network: 'X Layer' },
  sonic: { chainId: 146, network: 'Sonic' },
  berachain: { chainId: 80094, network: 'Berachain' },
  ink: { chainId: 57073, network: 'Ink' },
  plasma: { chainId: 1666600000, network: 'Plasma' },
  stable: { chainId: 17000, network: 'Holesky' },
  mega: { chainId: 1329, network: 'MegaETH' },
  mnt: { chainId: 5000, network: 'Mantle' },
  scr: { chainId: 534352, network: 'Scroll' },
  unichain: { chainId: 130, network: 'Unichain' },
  tac: { chainId: 0, network: 'TAC' }, // Unknown chain ID
  sep: { chainId: 11155111, network: 'Sepolia' },
  'hyper-evm': { chainId: 0, network: 'Hyper EVM' }, // Unknown chain ID
}

interface WalletData {
  address: string
  name: string | null
  chainId: number
  network: string
}

function parseSafeUrl(url: string): WalletData | null {
  try {
    url = url.trim()
    
    // Skip comments and empty lines
    if (!url || url.startsWith('#') || !url.startsWith('http')) {
      return null
    }

    const urlObj = new URL(url)
    const safeParam = urlObj.searchParams.get('safe')
    
    if (!safeParam) {
      return null
    }

    // Parse chain:address format
    const [chainName, ...addressParts] = safeParam.split(':')
    const fullAddress = addressParts.join(':')
    
    if (!chainName || !fullAddress) {
      return null
    }

    // Extract first 42 characters (0x + 40 hex chars) as the address
    let address = fullAddress
    if (address.length > 42) {
      address = address.substring(0, 42)
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return null
    }

    const chainInfo = CHAIN_MAP[chainName.toLowerCase()]
    if (!chainInfo) {
      console.warn(`Unknown chain: ${chainName}`)
      return null
    }

    return {
      address: address.toLowerCase(),
      name: null, // No names provided in the links file
      chainId: chainInfo.chainId,
      network: chainInfo.network,
    }
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error)
    return null
  }
}

function convertLinksToJson() {
  console.log('🔄 Converting Safe wallet links to JSON...\n')

  const linksFile = path.join(process.cwd(), 'data', 'safe-wallet-links.txt')
  const outputFile = path.join(process.cwd(), 'data', 'wallets.json')

  if (!fs.existsSync(linksFile)) {
    console.error(`❌ Links file not found: ${linksFile}`)
    process.exit(1)
  }

  const content = fs.readFileSync(linksFile, 'utf-8')
  const urls = content.split('\n').map(line => line.trim())

  const wallets: WalletData[] = []
  const errors: string[] = []

  for (const url of urls) {
    const wallet = parseSafeUrl(url)
    if (wallet) {
      wallets.push(wallet)
    } else if (url && !url.startsWith('#') && url.startsWith('http')) {
      errors.push(url)
    }
  }

  // Write JSON file
  fs.writeFileSync(outputFile, JSON.stringify(wallets, null, 2), 'utf-8')

  console.log(`✅ Converted ${wallets.length} wallets to JSON`)
  console.log(`📝 Output file: ${outputFile}`)
  
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} URLs could not be parsed:`)
    errors.forEach(url => console.log(`  - ${url.substring(0, 80)}...`))
  }

  // Group by network for summary
  const byNetwork = wallets.reduce((acc, wallet) => {
    if (!acc[wallet.network]) {
      acc[wallet.network] = 0
    }
    acc[wallet.network]++
    return acc
  }, {} as Record<string, number>)

  console.log('\n📊 Wallets by network:')
  Object.entries(byNetwork)
    .sort((a, b) => b[1] - a[1])
    .forEach(([network, count]) => {
      console.log(`  ${network}: ${count}`)
    })
}

convertLinksToJson()
