import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safe-service'
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

    // Find all wallets where this signer's addresses are owners
    const allWallets = await db.wallet.findMany()
    const walletsWhereSignerIsOwner: WalletBasicInfo[] = []

    for (const wallet of allWallets) {
      try {
        const safeInfo = await getSafeInfo(wallet.address, wallet.chainId)
        const signerAddresses = signer.addresses.map((a) => a.address.toLowerCase())
        const ownerAddresses = safeInfo.owners.map((o) => o.toLowerCase())

        // Check if any of the signer's addresses are in the owner list
        const isOwner = signerAddresses.some((addr) => ownerAddresses.includes(addr))

        if (isOwner) {
          walletsWhereSignerIsOwner.push({
            id: wallet.id,
            address: wallet.address,
            name: wallet.name,
            chainId: wallet.chainId,
            tag: wallet.tag,
            threshold: safeInfo.threshold,
            totalSigners: safeInfo.owners.length,
          })
        }
      } catch (error) {
        console.error(`Failed to fetch safe info for wallet ${wallet.address}:`, error)
        // Skip this wallet if we can't fetch its info
      }
    }

    const signerWithWallets: SignerWithWallets = {
      id: signer.id,
      name: signer.name,
      department: signer.department,
      addresses: signer.addresses.map((addr) => ({
        id: addr.id,
        address: addr.address,
        createdAt: addr.createdAt,
      })),
      wallets: walletsWhereSignerIsOwner,
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

    return NextResponse.json(signer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
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
