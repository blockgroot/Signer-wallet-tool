export interface Chain {
  id: number
  name: string
  safeApiUrl: string
  explorerUrl?: string
}

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 1,
    name: 'Ethereum Mainnet',
    safeApiUrl: 'https://safe-transaction-mainnet.safe.global',
    explorerUrl: 'https://etherscan.io',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    safeApiUrl: 'https://safe-transaction-arbitrum.safe.global',
    explorerUrl: 'https://arbiscan.io',
  },
  {
    id: 10,
    name: 'Optimism',
    safeApiUrl: 'https://safe-transaction-optimism.safe.global',
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  {
    id: 8453,
    name: 'Base',
    safeApiUrl: 'https://safe-transaction-base.safe.global',
    explorerUrl: 'https://basescan.org',
  },
  {
    id: 43114,
    name: 'Avalanche',
    safeApiUrl: 'https://safe-transaction-avalanche.safe.global',
    explorerUrl: 'https://snowtrace.io',
  },
  {
    id: 137,
    name: 'Polygon',
    safeApiUrl: 'https://safe-transaction-polygon.safe.global',
    explorerUrl: 'https://polygonscan.com',
  },
  {
    id: 56,
    name: 'BSC',
    safeApiUrl: 'https://safe-transaction-bsc.safe.global',
    explorerUrl: 'https://bscscan.com',
  },
  {
    id: 1101,
    name: 'Polygon zkEVM',
    safeApiUrl: 'https://safe-transaction-zkevm.safe.global',
    explorerUrl: 'https://zkevm.polygonscan.com',
  },
  {
    id: 324,
    name: 'zkSync Era',
    safeApiUrl: 'https://safe-transaction-zksync.safe.global',
    explorerUrl: 'https://explorer.zksync.io',
  },
  {
    id: 59144,
    name: 'Linea',
    safeApiUrl: 'https://safe-transaction-linea.safe.global',
    explorerUrl: 'https://lineascan.build',
  },
  {
    id: 81457,
    name: 'Blast',
    safeApiUrl: 'https://safe-transaction-blast.safe.global',
    explorerUrl: 'https://blastscan.io',
  },
  {
    id: 196,
    name: 'X Layer',
    safeApiUrl: 'https://safe-transaction-xlayer.safe.global',
    explorerUrl: 'https://xlayerscan.io',
  },
  {
    id: 146,
    name: 'Sonic',
    safeApiUrl: 'https://safe-transaction-sonic.safe.global',
    explorerUrl: 'https://sonicscan.org',
  },
  {
    id: 534352,
    name: 'Scroll',
    safeApiUrl: 'https://safe-transaction-scroll.safe.global',
    explorerUrl: 'https://scrollscan.com',
  },
  {
    id: 11155111,
    name: 'Sepolia',
    safeApiUrl: 'https://safe-transaction-sepolia.safe.global',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
]

export function getChainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
}

export function getChainName(chainId: number): string {
  const chain = getChainById(chainId)
  return chain?.name || `Chain ${chainId}`
}
