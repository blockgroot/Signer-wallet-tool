import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafesByOwnerOnChains } from '@/lib/safeApi'
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

    // Limit chain fan-out: only hit chains that exist in our DB wallets.
    const chainIdsInDb = await db.wallet.findMany({
      select: { chainId: true },
      distinct: ['chainId'],
    })
    const allowedChainIds = chainIdsInDb.map((c) => c.chainId)

    // Map DB wallets for fast matching.
    const allWallets = await db.wallet.findMany()
    const walletMap = new Map<string, typeof allWallets[number]>()
    for (const w of allWallets) {
      walletMap.set(`${w.address.toLowerCase()}-${w.chainId}`, w)
    }

    const walletsWhereSignerIsOwner: WalletBasicInfo[] = []

    // For each signer address, fetch Safes where it's an owner (limited chains).
    for (const signerAddress of signer.addresses) {
      const safesByChain = await getSafesByOwnerOnChains(signerAddress.address, allowedChainIds)

      for (const [chainIdStr, safes] of Object.entries(safesByChain)) {
        const chainId = parseInt(chainIdStr, 10)
        for (const safe of safes) {
          const key = `${safe.address.toLowerCase()}-${chainId}`
          const dbWallet = walletMap.get(key)
          if (!dbWallet) continue

          walletsWhereSignerIsOwner.push({
            id: dbWallet.id,
            address: safe.address,
            name: dbWallet.name || safe.name,
            chainId,
            tag: dbWallet.tag,
            threshold: safe.threshold,
            totalSigners: safe.totalOwners,
          })
        }
      }
    }

    // Deduplicate.
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

