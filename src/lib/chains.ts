export interface Chain {
  id: number
  name: string
  safeApiUrl: string
  safeApiCode: string // Network code for Safe API (e.g., "eth", "arb1", "oeth")
  explorerUrl?: string
}

/**
 * Map chain names/codes from wallets.json to Safe API endpoint codes
 */
const CHAIN_NAME_TO_API_CODE: Record<string, string> = {
  // Direct mappings
  eth: 'eth',
  arb1: 'arb1',
  oeth: 'oeth',
  base: 'base',
  avax: 'avax',
  polygon: 'pol',
  matic: 'pol', // Polygon uses "pol" in Safe API
  bnb: 'bnb',
  zkevm: 'zkevm',
  zksync: 'zksync',
  linea: 'linea',
  blast: 'blast',
  xlayer: 'okb', // X Layer uses "okb" in Safe API
  sonic: 'sonic',
  scroll: 'scroll',
  scr: 'scroll', // Alternative name
  sep: 'sep', // Sepolia
  sepolia: 'sep',
  berachain: 'berachain',
  ink: 'ink',
  plasma: 'plasma',
  stable: 'stable',
  'hyper-evm': 'hyper-evm',
  mega: 'mega',
  mnt: 'mantle', // Mantle
  mantle: 'mantle',
  unichain: 'unichain',
  tac: 'tac',
  gno: 'gno', // Gnosis
  gnosis: 'gno',
  celo: 'celo',
  aurora: 'aurora',
}

/**
 * Map chainId to Safe API endpoint code
 */
const CHAIN_ID_TO_API_CODE: Record<number, string> = {
  1: 'eth',
  11155111: 'sep', // Sepolia
  42161: 'arb1',
  10: 'oeth',
  8453: 'base',
  43114: 'avax',
  137: 'pol', // Polygon
  56: 'bnb',
  1101: 'zkevm',
  324: 'zksync',
  59144: 'linea',
  81457: 'blast',
  196: 'okb', // X Layer
  146: 'sonic',
  534352: 'scroll',
  100: 'gno', // Gnosis
  42220: 'celo', // Celo
  1313161554: 'aurora', // Aurora
  5000: 'mantle', // Mantle
  80094: 'berachain',
  57073: 'ink',
  9745: 'plasma',
  2016: 'stable',
  999: 'hyper-evm',
  6342: 'mega',
  130: 'unichain',
  239: 'tac',
}

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 1,
    name: 'Ethereum Mainnet',
    safeApiUrl: 'https://api.safe.global/tx-service/eth',
    safeApiCode: 'eth',
    explorerUrl: 'https://etherscan.io',
  },
  {
    id: 11155111,
    name: 'Sepolia',
    safeApiUrl: 'https://api.safe.global/tx-service/sep',
    safeApiCode: 'sep',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    safeApiUrl: 'https://api.safe.global/tx-service/arb1',
    safeApiCode: 'arb1',
    explorerUrl: 'https://arbiscan.io',
  },
  {
    id: 10,
    name: 'Optimism',
    safeApiUrl: 'https://api.safe.global/tx-service/oeth',
    safeApiCode: 'oeth',
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  {
    id: 8453,
    name: 'Base',
    safeApiUrl: 'https://api.safe.global/tx-service/base',
    safeApiCode: 'base',
    explorerUrl: 'https://basescan.org',
  },
  {
    id: 43114,
    name: 'Avalanche',
    safeApiUrl: 'https://api.safe.global/tx-service/avax',
    safeApiCode: 'avax',
    explorerUrl: 'https://snowtrace.io',
  },
  {
    id: 137,
    name: 'Polygon',
    safeApiUrl: 'https://api.safe.global/tx-service/pol',
    safeApiCode: 'pol',
    explorerUrl: 'https://polygonscan.com',
  },
  {
    id: 56,
    name: 'BSC',
    safeApiUrl: 'https://api.safe.global/tx-service/bnb',
    safeApiCode: 'bnb',
    explorerUrl: 'https://bscscan.com',
  },
  {
    id: 1101,
    name: 'Polygon zkEVM',
    safeApiUrl: 'https://api.safe.global/tx-service/zkevm',
    safeApiCode: 'zkevm',
    explorerUrl: 'https://zkevm.polygonscan.com',
  },
  {
    id: 324,
    name: 'zkSync Era',
    safeApiUrl: 'https://api.safe.global/tx-service/zksync',
    safeApiCode: 'zksync',
    explorerUrl: 'https://explorer.zksync.io',
  },
  {
    id: 59144,
    name: 'Linea',
    safeApiUrl: 'https://api.safe.global/tx-service/linea',
    safeApiCode: 'linea',
    explorerUrl: 'https://lineascan.build',
  },
  {
    id: 81457,
    name: 'Blast',
    safeApiUrl: 'https://api.safe.global/tx-service/blast',
    safeApiCode: 'blast',
    explorerUrl: 'https://blastscan.io',
  },
  {
    id: 196,
    name: 'X Layer',
    safeApiUrl: 'https://api.safe.global/tx-service/okb',
    safeApiCode: 'okb',
    explorerUrl: 'https://xlayerscan.io',
  },
  {
    id: 146,
    name: 'Sonic',
    safeApiUrl: 'https://api.safe.global/tx-service/sonic',
    safeApiCode: 'sonic',
    explorerUrl: 'https://sonicscan.org',
  },
  {
    id: 534352,
    name: 'Scroll',
    safeApiUrl: 'https://api.safe.global/tx-service/scroll',
    safeApiCode: 'scroll',
    explorerUrl: 'https://scrollscan.com',
  },
  {
    id: 100,
    name: 'Gnosis',
    safeApiUrl: 'https://api.safe.global/tx-service/gno',
    safeApiCode: 'gno',
    explorerUrl: 'https://gnosisscan.io',
  },
  {
    id: 42220,
    name: 'Celo',
    safeApiUrl: 'https://api.safe.global/tx-service/celo',
    safeApiCode: 'celo',
    explorerUrl: 'https://celoscan.io',
  },
  {
    id: 5000,
    name: 'Mantle',
    safeApiUrl: 'https://api.safe.global/tx-service/mantle',
    safeApiCode: 'mantle',
    explorerUrl: 'https://mantlescan.info',
  },
  {
    id: 1313161554,
    name: 'Aurora',
    safeApiUrl: 'https://api.safe.global/tx-service/aurora',
    safeApiCode: 'aurora',
    explorerUrl: 'https://aurorascan.dev',
  },
  {
    id: 80094,
    name: 'Berachain',
    safeApiUrl: 'https://api.safe.global/tx-service/berachain',
    safeApiCode: 'berachain',
    explorerUrl: 'https://beratrail.io',
  },
  {
    id: 57073,
    name: 'Ink',
    safeApiUrl: 'https://api.safe.global/tx-service/ink',
    safeApiCode: 'ink',
    explorerUrl: 'https://explorer.inkonchain.com',
  },
  {
    id: 9745,
    name: 'Plasma',
    safeApiUrl: 'https://api.safe.global/tx-service/plasma',
    safeApiCode: 'plasma',
    explorerUrl: 'https://plasmascan.to',
  },
  {
    id: 2016,
    name: 'Stable',
    safeApiUrl: 'https://api.safe.global/tx-service/stable',
    safeApiCode: 'stable',
    explorerUrl: 'https://blockscan.com',
  },
  {
    id: 999,
    name: 'Hyper EVM',
    safeApiUrl: 'https://api.safe.global/tx-service/hyper-evm',
    safeApiCode: 'hyper-evm',
    explorerUrl: 'https://hyperevmscan.io',
  },
  {
    id: 6342,
    name: 'MegaETH',
    safeApiUrl: 'https://api.safe.global/tx-service/mega',
    safeApiCode: 'mega',
    explorerUrl: 'https://megaexplorer.xyz',
  },
  {
    id: 130,
    name: 'Unichain',
    safeApiUrl: 'https://api.safe.global/tx-service/unichain',
    safeApiCode: 'unichain',
    explorerUrl: 'https://unichain.blockscout.com',
  },
  {
    id: 239,
    name: 'TAC',
    safeApiUrl: 'https://api.safe.global/tx-service/tac',
    safeApiCode: 'tac',
    explorerUrl: 'https://explorer.tac.build',
  },
]

/**
 * Get Safe API endpoint code from chain name (e.g., "arb1", "avax")
 */
export function getSafeApiCodeFromChainName(chainName: string | null): string | null {
  if (!chainName) return null
  const normalized = chainName.toLowerCase().trim()
  return CHAIN_NAME_TO_API_CODE[normalized] || null
}

/**
 * Get Safe API endpoint code from chainId
 */
export function getSafeApiCodeFromChainId(chainId: number): string | null {
  return CHAIN_ID_TO_API_CODE[chainId] || null
}

/**
 * Get Safe API URL for a specific network code
 */
export function getSafeApiUrlForNetwork(networkCode: string): string {
  return `https://api.safe.global/tx-service/${networkCode}`
}

export function getChainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
}

export function getChainName(chainId: number): string {
  const chain = getChainById(chainId)
  return chain?.name || `Chain ${chainId}`
}

/**
 * Get chain by Safe API code (e.g., "arb1", "eth")
 */
export function getChainByApiCode(apiCode: string): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.safeApiCode === apiCode)
}
