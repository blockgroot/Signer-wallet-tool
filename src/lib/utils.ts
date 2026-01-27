/**
 * Utility functions for the application
 */

/**
 * Parse comma-separated tags string into array
 */
export function parseTags(tags: string | null): string[] {
  if (!tags) return []
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/**
 * Format tags array into comma-separated string
 */
export function formatTags(tags: string[]): string | null {
  if (tags.length === 0) return null
  return tags.join(', ')
}

/**
 * Get explorer URL for an address on a given chain
 */
export function getExplorerUrl(address: string, chainId: number): string | null {
  const explorerUrls: Record<number, string> = {
    1: `https://etherscan.io/address/${address}`,
    42161: `https://arbiscan.io/address/${address}`,
    10: `https://optimistic.etherscan.io/address/${address}`,
    8453: `https://basescan.org/address/${address}`,
    43114: `https://snowtrace.io/address/${address}`,
    137: `https://polygonscan.com/address/${address}`,
    56: `https://bscscan.com/address/${address}`,
    1101: `https://zkevm.polygonscan.com/address/${address}`,
    324: `https://explorer.zksync.io/address/${address}`,
    59144: `https://lineascan.build/address/${address}`,
    81457: `https://blastscan.io/address/${address}`,
    196: `https://xlayerscan.io/address/${address}`,
    146: `https://sonicscan.org/address/${address}`,
    534352: `https://scrollscan.com/address/${address}`,
    11155111: `https://sepolia.etherscan.io/address/${address}`,
  }

  return explorerUrls[chainId] || null
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
