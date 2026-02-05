import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafesByOwner } from '@/lib/safeApi'
import { SUPPORTED_CHAINS } from '@/lib/chains'
import type { WalletBasicInfo } from '@/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const signer = await db.signer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!signer) {
      return NextResponse.json({ error: 'Signer not found' }, { status: 404 })
    }

    // Query ALL supported chains to find every wallet where this signer is an owner
    // This ensures we don't miss wallets just because they're not in our database yet

    // Map DB wallets for enrichment (name, tag, id) but don't filter by them
    const allWallets = await db.wallet.findMany()
    const walletMap = new Map<string, typeof allWallets[number]>()
    for (const w of allWallets) {
      walletMap.set(`${w.address.toLowerCase()}-${w.chainId}`, w)
    }

    const walletsWhereSignerIsOwner: WalletBasicInfo[] = []

    // For each signer address, fetch ALL Safes where it's an owner across ALL chains
    for (const signerAddress of signer.addresses) {
      // Query ALL supported chains (not just chains in DB)
      const safesByChain = await getSafesByOwner(signerAddress.address)

      for (const [chainIdStr, safes] of Object.entries(safesByChain)) {
        const chainId = parseInt(chainIdStr, 10)
        for (const safe of safes) {
          const key = `${safe.address.toLowerCase()}-${chainId}`
          const dbWallet = walletMap.get(key)

          // Return ALL wallets found, not just ones in DB
          // If wallet exists in DB, use DB metadata; otherwise use Safe API data
          walletsWhereSignerIsOwner.push({
            id: dbWallet?.id || `temp-${key}`, // Temporary ID for wallets not in DB
            address: safe.address,
            name: dbWallet?.name || safe.name || null,
            chainId,
            tag: dbWallet?.tag || null,
            threshold: safe.threshold,
            totalSigners: safe.totalOwners,
          })
        }
      }
    }

    // Deduplicate by address + chainId
    const unique = new Map<string, WalletBasicInfo>()
    for (const w of walletsWhereSignerIsOwner) {
      const key = `${w.address.toLowerCase()}-${w.chainId}`
      if (!unique.has(key)) unique.set(key, w)
    }

    const res = NextResponse.json({ wallets: Array.from(unique.values()) })

    // Browser cache: short-lived private cache + SWR.
    // This reduces repeated Safe calls when navigating around internally.
    res.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300')

    return res
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}

