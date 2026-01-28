import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

    // Fast path: return wallets from DB mapping only.
    // Live Safe API lookup is moved to /api/signers/[id]/live-wallets and fetched on-demand from the UI.
    const signerAddressIds = signer.addresses.map((a) => a.id)
    const walletLinks = await db.walletSigner.findMany({
      where: { signerAddressId: { in: signerAddressIds } },
      include: { wallet: true },
    })

    const uniqueWallets = new Map<string, WalletBasicInfo>()
    for (const link of walletLinks) {
      const w = link.wallet
      const key = `${w.address.toLowerCase()}-${w.chainId}`
      if (!uniqueWallets.has(key)) {
        uniqueWallets.set(key, {
          id: w.id,
          address: w.address,
          name: w.name,
          chainId: w.chainId,
          tag: w.tag,
          threshold: 0,
          totalSigners: 0,
        })
      }
    }

    const signerWithWallets: SignerWithWallets = {
      id: signer.id,
      name: signer.name,
      department: signer.department,
      addresses: signer.addresses.map((addr) => ({
        id: addr.id,
        address: addr.address,
        name: addr.name,
        type: addr.type,
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
