import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafesByOwner } from '@/lib/safeApi'
import { syncSignersToJson } from '@/lib/json-sync'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import type { SignerWithWallets, WalletBasicInfo } from '@/types'

const updateSignerSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Allow public access to view signer details - no auth required
    const { id } = await params

    const signer = await db.signer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!signer) {
      return NextResponse.json({ error: 'Signer not found' }, { status: 404 })
    }

    // Find all wallets where this signer's addresses are owners using getSafesByOwner
    const walletsWhereSignerIsOwner: WalletBasicInfo[] = []
    
    // Get all wallets from database to match with Safe API results
    const allWallets = await db.wallet.findMany()
    const walletMap = new Map<string, typeof allWallets[0]>()
    allWallets.forEach(w => {
      walletMap.set(`${w.address.toLowerCase()}-${w.chainId}`, w)
    })

    // For each signer address, get all Safes where it's an owner
    for (const signerAddress of signer.addresses) {
      try {
        const safesByChain = await getSafesByOwner(signerAddress.address)
        
        // Match Safe API results with database wallets
        for (const [chainIdStr, safes] of Object.entries(safesByChain)) {
          const chainId = parseInt(chainIdStr, 10)
          
          for (const safe of safes) {
            const walletKey = `${safe.address.toLowerCase()}-${chainId}`
            const dbWallet = walletMap.get(walletKey)
            
            if (dbWallet) {
              walletsWhereSignerIsOwner.push({
                id: dbWallet.id,
                address: safe.address,
                name: dbWallet.name || safe.name,
                chainId: chainId,
                tag: dbWallet.tag,
                threshold: safe.threshold,
                totalSigners: safe.totalOwners,
              })
            }
          }
        }
      } catch (error) {
        // Log error but continue with other addresses
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('SAFE_API_KEY is not set')) {
          console.error('❌ SAFE_API_KEY is not set in environment variables')
          // Don't break - continue with other addresses
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Failed to get safes for owner ${signerAddress.address}: ${errorMessage}`)
          }
        }
      }
    }

    // Remove duplicates (same wallet might appear for multiple addresses of same signer)
    const uniqueWallets = new Map<string, WalletBasicInfo>()
    walletsWhereSignerIsOwner.forEach(w => {
      const key = `${w.address.toLowerCase()}-${w.chainId}`
      if (!uniqueWallets.has(key)) {
        uniqueWallets.set(key, w)
      }
    })

    const signerWithWallets: SignerWithWallets = {
      id: signer.id,
      name: signer.name,
      department: signer.department,
      addresses: signer.addresses.map((addr) => ({
        id: addr.id,
        address: addr.address,
        createdAt: addr.createdAt,
      })),
      wallets: Array.from(uniqueWallets.values()),
      createdAt: signer.createdAt,
      updatedAt: signer.updatedAt,
    }

    return NextResponse.json(signerWithWallets)
  } catch (error) {
    console.error('Get signer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, department } = updateSignerSchema.parse(body)

    const signer = await db.signer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(department !== undefined && { department: department || null }),
      },
      include: {
        addresses: true,
      },
    })

    // Sync to JSON file
    try {
      await syncSignersToJson()
    } catch (error) {
      console.error('Failed to sync signers to JSON:', error)
      // Don't fail the request if JSON sync fails
    }

    return NextResponse.json(signer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Update signer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await db.signer.delete({
      where: { id },
    })

    // Sync to JSON file
    try {
      await syncSignersToJson()
    } catch (error) {
      console.error('Failed to sync signers to JSON:', error)
      // Don't fail the request if JSON sync fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete signer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
