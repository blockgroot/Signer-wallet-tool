import fs from 'fs'
import path from 'path'
import { db } from './db'

const DATA_DIR = path.join(process.cwd(), 'data')

/**
 * Sync wallets from database to wallets.json
 */
export async function syncWalletsToJson() {
  try {
    const wallets = await db.wallet.findMany({
      orderBy: { createdAt: 'asc' },
    })

    const walletsJson = wallets.map((wallet) => ({
      address: wallet.address.toLowerCase(),
      name: wallet.name || null,
      chainId: wallet.chainId,
      network: getNetworkNameFromChainId(wallet.chainId),
    }))

    const jsonPath = path.join(DATA_DIR, 'wallets.json')
    fs.writeFileSync(jsonPath, JSON.stringify(walletsJson, null, 2), 'utf-8')
    
    console.log(`✅ Synced ${wallets.length} wallets to wallets.json`)
  } catch (error) {
    console.error('❌ Error syncing wallets to JSON:', error)
    throw error
  }
}

/**
 * Sync signers from database to signers.json
 */
export async function syncSignersToJson() {
  try {
    const signers = await db.signer.findMany({
      include: {
        addresses: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const signersJson = signers.map((signer) => ({
      name: signer.name,
      department: signer.department,
      addresses: signer.addresses.map((addr) => addr.address.toLowerCase()),
    }))

    const jsonPath = path.join(DATA_DIR, 'signers.json')
    fs.writeFileSync(jsonPath, JSON.stringify(signersJson, null, 2), 'utf-8')
    
    console.log(`✅ Synced ${signers.length} signers to signers.json`)
  } catch (error) {
    console.error('❌ Error syncing signers to JSON:', error)
    throw error
  }
}

/**
 * Helper to get network name from chain ID
 */
function getNetworkNameFromChainId(chainId: number): string {
  const chainIdToName: Record<number, string> = {
    1: 'eth',
    10: 'oeth',
    56: 'bnb',
    100: 'gno',
    137: 'matic',
    196: 'xdc',
    1101: 'zkevm',
    324: 'zksync',
    8453: 'base',
    43114: 'avax',
    42161: 'arb1',
    11155111: 'sep',
    534352: 'scroll',
    59144: 'linea',
    81457: 'blast',
    195: 'xlayer',
    20200: 'sonic',
    80094: 'berachain',
    57073: 'ink',
    16507: 'plasma',
    3776: 'stable',
    998: 'hyper-evm',
    28122024: 'mega',
    5000: 'mnt',
    17000: 'holesky',
    311: 'tac',
  }
  
  return chainIdToName[chainId] || `chain-${chainId}`
}
