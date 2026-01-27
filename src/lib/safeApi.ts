/**
 * Centralized Safe Transaction Service API client
 * Handles API key authentication, retries, and rate limiting
 */

import { getChainById, SUPPORTED_CHAINS } from './chains'

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
        if (response.status === 404) {
          throw new Error(`Safe not found: ${url}`)
        }
        if (response.status === 422) {
          throw new Error(`Address is not a Safe wallet: ${url}`)
        }
        throw new Error(`Failed to fetch: ${response.statusText} (${response.status})`)
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
  const apiKey = process.env.SAFE_API_KEY
  if (!apiKey) {
    throw new Error('SAFE_API_KEY is not set in environment variables')
  }
  return apiKey
}

/**
 * Get Safe info for a specific address on a chain
 */
export async function getSafeInfo(
  address: string,
  chainId: number
): Promise<SafeInfo> {
  const chain = getChainById(chainId)
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  const apiKey = getApiKey()
  const apiUrl = `${chain.safeApiUrl}/api/v1/safes/${address}/`

  try {
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
      console.log(`Safe API response for ${address} on chain ${chainId}:`, {
        threshold,
        ownersCount: owners.length,
        hasThreshold: data.threshold !== undefined,
      })
    }

    return {
      address: data.address || address,
      nonce: data.nonce ?? 0,
      threshold: threshold,
      owners: owners,
      masterCopy: data.masterCopy,
      fallbackHandler: data.fallbackHandler,
      guard: data.guard,
      version: data.version,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch safe info: ${String(error)}`)
  }
}

/**
 * Get all Safes owned by a specific address across all supported chains
 */
export async function getSafesByOwner(owner: string): Promise<Record<number, SafeWithThreshold[]>> {
  const normalizedOwner = owner.toLowerCase()
  const apiKey = getApiKey()
  const result: Record<number, SafeWithThreshold[]> = {}

  // Process chains sequentially with small delays to avoid rate limiting
  for (const chain of SUPPORTED_CHAINS) {
    try {
      const url = `${chain.safeApiUrl}/api/v2/owners/${normalizedOwner}/safes/`
      const data = await fetchWithRetry<OwnerSafesResponse>(url, {
        Authorization: `Bearer ${apiKey}`,
      }, 2, 500) // 2 retries, 500ms delay

      if (data.results && data.results.length > 0) {
        result[chain.id] = data.results.map((safe) => ({
          address: safe.address,
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
 * Get Safe owners for a specific address on a chain
 */
export async function getSafeOwners(
  address: string,
  chainId: number
): Promise<string[]> {
  const safeInfo = await getSafeInfo(address, chainId)
  return safeInfo.owners
}
