/**
 * Utility functions for the application
 */

import { getChainById } from './chains'

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
  // First, try to get explorer URL from SUPPORTED_CHAINS
  const chain = getChainById(chainId)
  if (chain?.explorerUrl) {
    return `${chain.explorerUrl}/address/${address}`
  }

  // Fallback to hardcoded list for backward compatibility
  // (in case some chains don't have explorerUrl in chains.ts)
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

/**
 * Extract account type from a name string and return both cleaned name and type
 * Examples: 
 *   "Timo_ledger" -> { name: "Timo", type: "Ledger" }
 *   "Mihailo_hot_wallet" -> { name: "Mihailo", type: "Hot Wallet" }
 *   "Timo hot wallet" -> { name: "Timo", type: "Hot Wallet" }
 */
export function extractNameAndType(fullName: string | null): { name: string; type: string | null } {
  if (!fullName) return { name: '', type: null }
  
  const lower = fullName.toLowerCase().trim()
  let type: string | null = null
  let cleanName = fullName.trim()
  
  // Check for type indicators (order matters - check longer patterns first)
  // Match patterns like "account 1", "account_1", "hot wallet", etc.
  const account1Match = lower.match(/\baccount\s*[_\s]?1\b/i) || lower.includes('account 1') || lower.includes('account_1')
  const account2Match = lower.match(/\baccount\s*[_\s]?2\b/i) || lower.includes('account 2') || lower.includes('account_2')
  const account3Match = lower.match(/\baccount\s*[_\s]?3\b/i) || lower.includes('account 3') || lower.includes('account_3')
  const account4Match = lower.match(/\baccount\s*[_\s]?4\b/i) || lower.includes('account 4') || lower.includes('account_4')
  
  if (lower.includes('hot') && lower.includes('wallet')) {
    type = 'Hot Wallet'
    cleanName = cleanName.replace(/\s*[_\s]?hot\s*[_\s]?wallet\s*/i, '').trim()
  } else if (lower.includes('hardware') && lower.includes('wallet')) {
    type = 'Hardware Wallet'
    cleanName = cleanName.replace(/\s*[_\s]?hardware\s*[_\s]?wallet\s*/i, '').trim()
  } else if (lower.includes('ledger')) {
    type = 'Ledger'
    cleanName = cleanName.replace(/\s*[_\s]?ledger\s*/i, '').trim()
  } else if (account1Match) {
    type = 'Account 1'
    cleanName = cleanName.replace(/\s*[_\s]?account\s*[_\s]?1\s*/i, '').trim()
  } else if (account2Match) {
    type = 'Account 2'
    cleanName = cleanName.replace(/\s*[_\s]?account\s*[_\s]?2\s*/i, '').trim()
  } else if (account3Match) {
    type = 'Account 3'
    cleanName = cleanName.replace(/\s*[_\s]?account\s*[_\s]?3\s*/i, '').trim()
  } else if (account4Match) {
    type = 'Account 4'
    cleanName = cleanName.replace(/\s*[_\s]?account\s*[_\s]?4\s*/i, '').trim()
  } else if (lower.includes('operator')) {
    type = 'Operator'
    cleanName = cleanName.replace(/\s*[_\s]?operator\s*/i, '').trim()
  } else if (lower.includes('proposer')) {
    type = 'Proposer'
    cleanName = cleanName.replace(/\s*[_\s]?proposer\s*/i, '').trim()
  }
  
  // Clean up any remaining underscores or extra spaces
  cleanName = cleanName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  
  return { name: cleanName, type }
}

/**
 * Extract account type from a name string (legacy function for backward compatibility)
 */
export function extractAccountType(name: string | null): string | null {
  if (!name) return null
  return extractNameAndType(name).type
}

/**
 * Auto-generate address name and type for a signer's addresses
 * Returns an array with name and type for each address, sorted alphabetically
 * Name column should NOT include type (e.g., "Manoj Account1" -> Name: "Manoj", Type: "Account 1")
 * For addresses with no explicit metadata, assigns Account 1, Account 2, etc. incrementally
 * If a type like "Hot Wallet" is already extracted, don't add Account number
 * Ensures no two addresses have the same name+type combination
 */
export function generateAddressLabels(
  signerName: string,
  addresses: Array<{ id: string; address: string; name: string | null; type: string | null }>
): Array<{ id: string; address: string; displayName: string; displayType: string }> {
  // Sort addresses alphabetically by address
  const sorted = [...addresses].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()))
  
  // Track used name+type combinations to ensure uniqueness
  const usedCombinations = new Set<string>()
  
  // First, extract base signer name (in case signer name contains type)
  const signerNameExtracted = extractNameAndType(signerName)
  const baseSignerName = signerNameExtracted.name || signerName
  
  // Separate addresses into two groups:
  // 1. Addresses that need Account numbering (no explicit type)
  // 2. Addresses with explicit types
  const addressesNeedingAccountNumbers: typeof sorted = []
  const addressesWithTypes: Array<{ addr: typeof sorted[0]; displayName: string; displayType: string }> = []
  
  // First pass: process addresses and categorize them
  sorted.forEach((addr) => {
    let displayName = baseSignerName
    let displayType: string | null = null
    
    // If explicit name exists, extract name and type
    if (addr.name) {
      const { name, type } = extractNameAndType(addr.name)
      displayName = name && name.length > 0 ? name : baseSignerName
      displayType = type || addr.type
    } else if (addr.type) {
      // Only explicit type, use base signer name
      displayName = baseSignerName
      displayType = addr.type
    } else if (signerNameExtracted.type && !signerNameExtracted.type.startsWith('Account ')) {
      // Signer name contains type (but NOT Account number), use base name and extracted type
      // If signer name has "Account 1", ignore it - we'll assign Account numbers sequentially
      displayName = baseSignerName
      displayType = signerNameExtracted.type
    }
    
    // Only use the type if it's not an Account number (Account numbers should be assigned sequentially)
    if (displayType && !displayType.startsWith('Account ')) {
      addressesWithTypes.push({ addr, displayName, displayType })
    } else {
      addressesNeedingAccountNumbers.push(addr)
    }
  })
  
  // Second pass: assign Account numbers sequentially (1, 2, 3, 4...)
  let accountCounter = 0
  const result: Array<{ id: string; address: string; displayName: string; displayType: string }> = []
  
  // Process addresses with explicit types first
  addressesWithTypes.forEach(({ addr, displayName, displayType }) => {
    const combinationKey = `${displayName.toLowerCase()}|${displayType.toLowerCase()}`
    let finalDisplayType = displayType
    
    // Check for uniqueness conflict
    if (usedCombinations.has(combinationKey)) {
      // Conflict detected - append Account number to make it unique
      accountCounter++
      finalDisplayType = `${displayType} Account ${accountCounter}`
    }
    
    const finalKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
    usedCombinations.add(finalKey)
    
    result.push({
      id: addr.id,
      address: addr.address,
      displayName,
      displayType: finalDisplayType,
    })
  })
  
  // Process addresses needing Account numbers - assign sequentially
  addressesNeedingAccountNumbers.forEach((addr) => {
    accountCounter++
    const displayName = baseSignerName
    const displayType = `Account ${accountCounter}`
    
    const combinationKey = `${displayName.toLowerCase()}|${displayType.toLowerCase()}`
    
    // If somehow there's still a conflict (shouldn't happen for sequential), increment
    let finalDisplayType = displayType
    let conflictCounter = 0
    while (usedCombinations.has(combinationKey)) {
      conflictCounter++
      finalDisplayType = `Account ${accountCounter + conflictCounter}`
      const newKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
      if (!usedCombinations.has(newKey)) {
        break
      }
    }
    
    const finalKey = `${displayName.toLowerCase()}|${finalDisplayType.toLowerCase()}`
    usedCombinations.add(finalKey)
    
    result.push({
      id: addr.id,
      address: addr.address,
      displayName,
      displayType: finalDisplayType,
    })
  })
  
  // Sort result by address to maintain alphabetical order
  result.sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()))
  
  return result
}
