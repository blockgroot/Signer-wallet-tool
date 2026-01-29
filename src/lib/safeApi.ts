/**
 * Centralized Safe Transaction Service API client
 * Handles API key authentication, retries, and rate limiting
 */

import { getAddress } from 'ethers'
import { 
  getChainById, 
  SUPPORTED_CHAINS, 
  getSafeApiCodeFromChainId,
  getSafeApiCodeFromChainName,
  getSafeApiUrlForNetwork 
} from './chains'

export interface SafeInfo {
  address: string
  nonce: number
  threshold: number
  owners: string[]
  masterCopy?: string
  fallbackHandler?: string
  guard?: string
  version?: string
}

export interface SafeWithThreshold {
  address: string
  threshold: number
  totalOwners: number
  name: string | null
}

interface OwnerSafesResponse {
  results: Array<{
    address: string
    threshold: number
    owners: string[]
  }>
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry<T>(
  url: string,
  headers: Record<string, string>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 }, // Always fetch fresh data
      })

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('Retry-After')
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay * (attempt + 1)
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        throw new Error(`Rate limited: Too many requests for ${url}`)
      }

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = ''
        try {
          const errorBody = await response.json().catch(() => ({}))
          if (errorBody.message) {
            errorDetails = errorBody.message
          } else if (errorBody.detail) {
            errorDetails = errorBody.detail
          } else if (typeof errorBody === 'object') {
            errorDetails = JSON.stringify(errorBody)
          } else {
            errorDetails = response.statusText
          }
        } catch {
          errorDetails = response.statusText
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.error(`[Safe API] Error response (${response.status}):`, {
            url,
            status: response.status,
            statusText: response.statusText,
            errorDetails,
          })
        }
        
        if (response.status === 404) {
          throw new Error(`Safe not found: ${errorDetails || url}`)
        }
        if (response.status === 422) {
          throw new Error(`Address is not a Safe wallet: ${errorDetails || url}`)
        }
        if (response.status === 400) {
          throw new Error(`Bad request: ${errorDetails || response.statusText}`)
        }
        throw new Error(`Failed to fetch (${response.status}): ${errorDetails || response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on 404 or 422 (these are expected)
      if (lastError.message.includes('not found') || lastError.message.includes('not a Safe wallet')) {
        throw lastError
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries')
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.SAFE_API_KEY?.trim()
  if (!apiKey || apiKey === '') {
    throw new Error('SAFE_API_KEY is not set in environment variables')
  }
  return apiKey
}

/**
 * Get Safe info for a specific address on a chain
 * Uses network-specific endpoint when chainId is known, otherwise tries all networks
 */
export async function getSafeInfo(
  address: string,
  chainId: number | null = null,
  chainName: string | null = null
): Promise<SafeInfo> {
  // Checksum the address before making API calls
  const checksummedAddress = getAddress(address)
  const apiKey = getApiKey()
  
  // TAC chain (239) does not expose a public Safe API - skip it
  if (chainId === 239 || chainName?.toLowerCase() === 'tac') {
    throw new Error('TAC chain does not support Safe API. Safe wallet data is not available via API.')
  }
  
  // Try to get the API code from chainId or chainName
  let apiCode: string | null = null
  if (chainId) {
    apiCode = getSafeApiCodeFromChainId(chainId)
  }
  if (!apiCode && chainName) {
    apiCode = getSafeApiCodeFromChainName(chainName)
  }
  
  // If we have a specific network, try that first
  if (apiCode) {
    // Skip TAC from API calls (it doesn't expose public Safe API)
    if (apiCode === 'tac') {
      throw new Error('TAC chain does not support Safe API. Safe wallet data is not available via API.')
    }
    
    try {
      return await getSafeInfoForNetwork(checksummedAddress, apiCode, apiKey)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // If it's a "not found" or "not a Safe" error, continue to try all networks
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('not a Safe wallet') ||
        errorMessage.includes('422')
      ) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Wallet not found on ${apiCode}, trying all networks...`)
        }
      } else {
        // For other errors (rate limit, network error), throw immediately
        throw error
      }
    }
  }
  
  // If no network specified or network-specific call failed, try all networks
  return await getSafeInfoFromAllNetworks(checksummedAddress, apiKey)
}

/**
 * Get Safe info for a specific network
 */
async function getSafeInfoForNetwork(
  address: string,
  apiCode: string,
  apiKey: string
): Promise<SafeInfo> {
  const apiUrl = `${getSafeApiUrlForNetwork(apiCode)}/api/v1/safes/${address}/`
  
  // Log the API call for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Safe API] Calling: ${apiUrl}`)
    console.log(`[Safe API] Address (checksummed): ${address}`)
    console.log(`[Safe API] Network code: ${apiCode}`)
  }
  
  const data = await fetchWithRetry<{
    address: string
    nonce: number
    threshold: number
    owners: string[]
    masterCopy?: string
    fallbackHandler?: string
    guard?: string
    version?: string
  }>(apiUrl, {
    Authorization: `Bearer ${apiKey}`,
  })

  // Validate and log threshold data
  const threshold = data.threshold ?? 0
  const owners = data.owners || []
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`Safe API response for ${address} on ${apiCode}:`, {
      threshold,
      ownersCount: owners.length,
      hasThreshold: data.threshold !== undefined,
    })
  }

  return {
    address: data.address ? getAddress(data.address) : address,
    nonce: data.nonce ?? 0,
    threshold: threshold,
    owners: owners.map(owner => getAddress(owner)), // Checksum all owner addresses
    masterCopy: data.masterCopy ? getAddress(data.masterCopy) : undefined,
    fallbackHandler: data.fallbackHandler ? getAddress(data.fallbackHandler) : undefined,
    guard: data.guard ? getAddress(data.guard) : undefined,
    version: data.version,
  }
}

/**
 * Try to get Safe info by searching across all supported networks
 */
async function getSafeInfoFromAllNetworks(
  address: string,
  apiKey: string
): Promise<SafeInfo> {
  const errors: string[] = []
  
  // Try each network sequentially (skip TAC as it doesn't have a public Safe API)
  for (const chain of SUPPORTED_CHAINS) {
    // Skip TAC chain - it doesn't expose a public Safe API
    if (chain.safeApiCode === 'tac' || chain.id === 239) {
      continue
    }
    
    try {
      const result = await getSafeInfoForNetwork(address, chain.safeApiCode, apiKey)
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Found Safe on ${chain.name} (${chain.safeApiCode})`)
      }
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Only collect non-404/422 errors (404/422 means not found on this network, which is expected)
      if (
        !errorMessage.includes('not found') &&
        !errorMessage.includes('404') &&
        !errorMessage.includes('not a Safe wallet') &&
        !errorMessage.includes('422')
      ) {
        errors.push(`${chain.name}: ${errorMessage}`)
      }
      // Small delay between networks
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // If we tried all networks and none worked, throw an error
  if (errors.length > 0) {
    throw new Error(`Failed to fetch Safe info: ${errors.join('; ')}`)
  }
  throw new Error(`Address is not a Safe wallet on any supported network`)
}

/**
 * Get all Safes owned by a specific address across all supported chains
 */
export async function getSafesByOwner(owner: string): Promise<Record<number, SafeWithThreshold[]>> {
  // Checksum the owner address before making API calls
  const checksummedOwner = getAddress(owner)
  const apiKey = getApiKey()
  const result: Record<number, SafeWithThreshold[]> = {}

  // Process chains sequentially with small delays to avoid rate limiting
  // Skip TAC chain as it doesn't expose a public Safe API
  for (const chain of SUPPORTED_CHAINS) {
    // Skip TAC chain - it doesn't expose a public Safe API
    if (chain.safeApiCode === 'tac' || chain.id === 239) {
      continue
    }
    
    try {
      const url = `${chain.safeApiUrl}/api/v2/owners/${checksummedOwner}/safes/`
      const data = await fetchWithRetry<OwnerSafesResponse>(url, {
        Authorization: `Bearer ${apiKey}`,
      }, 2, 500) // 2 retries, 500ms delay

      if (data.results && data.results.length > 0) {
        result[chain.id] = data.results.map((safe) => ({
          address: getAddress(safe.address), // Checksum the address
          threshold: safe.threshold,
          totalOwners: safe.owners.length,
          name: null, // Will be populated from database if available
        }))
      }
    } catch (error: any) {
      // Only log non-404 errors (404 means no safes found, which is normal)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('not found') && !errorMessage.includes('404')) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ ${chain.name} (${chain.id}): ${errorMessage}`)
        }
      }
    }
    
    // Small delay between chains to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return result
}

/**
 * Get all Safes owned by a specific address, but only on a subset of chainIds.
 * This is useful to avoid fanning out across every SUPPORTED_CHAINS entry.
 */
export async function getSafesByOwnerOnChains(
  owner: string,
  chainIds: number[]
): Promise<Record<number, SafeWithThreshold[]>> {
  const checksummedOwner = getAddress(owner)
  const apiKey = getApiKey()
  const result: Record<number, SafeWithThreshold[]> = {}

  const uniqueChainIds = Array.from(new Set(chainIds)).filter((id) => Number.isFinite(id))

  for (const chainId of uniqueChainIds) {
    // Skip TAC chain - it doesn't expose a public Safe API
    if (chainId === 239) {
      continue
    }
    
    const chain = getChainById(chainId)
    if (!chain) continue
    
    // Double-check: skip TAC by API code as well
    if (chain.safeApiCode === 'tac') {
      continue
    }

    try {
      const url = `${chain.safeApiUrl}/api/v2/owners/${checksummedOwner}/safes/`
      const data = await fetchWithRetry<OwnerSafesResponse>(
        url,
        { Authorization: `Bearer ${apiKey}` },
        2,
        500
      )

      if (data.results && data.results.length > 0) {
        result[chain.id] = data.results.map((safe) => ({
          address: getAddress(safe.address),
          threshold: safe.threshold,
          totalOwners: safe.owners.length,
          name: null,
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('not found') && !errorMessage.includes('404')) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ ${chain.name} (${chain.id}): ${errorMessage}`)
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return result
}

/**
 * Get Safe owners for a specific address on a chain
 */
export async function getSafeOwners(
  address: string,
  chainId: number
): Promise<string[]> {
  const safeInfo = await getSafeInfo(address, chainId)
  return safeInfo.owners
}
