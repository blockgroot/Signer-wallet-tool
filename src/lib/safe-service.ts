import { getChainById } from './chains'

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

export async function getSafeInfo(
  address: string,
  chainId: number
): Promise<SafeInfo> {
  const chain = getChainById(chainId)
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  const apiUrl = `${chain.safeApiUrl}/api/v1/safes/${address}/`

  try {
    const response = await fetch(apiUrl, {
      next: { revalidate: 0 }, // Always fetch fresh data
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Safe not found: ${address} on chain ${chainId}`)
      }
      throw new Error(`Failed to fetch safe info: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      address: data.address,
      nonce: data.nonce,
      threshold: data.threshold,
      owners: data.owners || [],
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

export async function getSafeOwners(
  address: string,
  chainId: number
): Promise<string[]> {
  const safeInfo = await getSafeInfo(address, chainId)
  return safeInfo.owners
}
