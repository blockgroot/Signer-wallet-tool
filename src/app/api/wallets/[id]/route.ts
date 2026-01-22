import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safe-service'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import type { WalletWithDetails } from '@/types'

const updateWalletSchema = z.object({
  name: z.string().optional(),
  tag: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Allow public access to view wallet details - no auth required
    const { id } = await params

    const wallet = await db.wallet.findUnique({
      where: { id },
      include: {
        walletSigners: {
          include: {
            signerAddress: {
              include: {
                signer: true,
              },
            },
          },
        },
      },
    })

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Fetch fresh data from Safe API
    let safeInfo
    try {
      safeInfo = await getSafeInfo(wallet.address, wallet.chainId)
    } catch (error) {
      console.error('Failed to fetch safe info:', error)
      // Continue with stored data if API fails
      safeInfo = {
        address: wallet.address,
        threshold: 0,
        nonce: 0,
        owners: [],
      }
    }

    // Map owner addresses to signer names
    const signerMap = new Map<string, { name: string | null; id: string | null; department: string | null }>()
    
    for (const walletSigner of wallet.walletSigners) {
      const address = walletSigner.signerAddress.address
      signerMap.set(address.toLowerCase(), {
        name: walletSigner.signerAddress.signer.name,
        id: walletSigner.signerAddress.signer.id,
        department: walletSigner.signerAddress.signer.department,
      })
    }

    // Also check all signer addresses in DB to find matches
    const allSignerAddresses = await db.signerAddress.findMany({
      include: {
        signer: true,
      },
    })

    for (const signerAddr of allSignerAddresses) {
      const addrLower = signerAddr.address.toLowerCase()
      if (!signerMap.has(addrLower) && safeInfo.owners.some(o => o.toLowerCase() === addrLower)) {
        signerMap.set(addrLower, {
          name: signerAddr.signer.name,
          id: signerAddr.signer.id,
          department: signerAddr.signer.department,
        })
      }
    }

    const signers: Array<{ address: string; signerName: string | null; signerId: string | null; department: string | null }> = 
      safeInfo.owners.map((owner) => {
        const mapped = signerMap.get(owner.toLowerCase())
        return {
          address: owner,
          signerName: mapped?.name || null,
          signerId: mapped?.id || null,
          department: mapped?.department || null,
        }
      })

    const walletWithDetails: WalletWithDetails = {
      id: wallet.id,
      address: wallet.address,
      name: wallet.name,
      chainId: wallet.chainId,
      tag: wallet.tag,
      threshold: safeInfo.threshold,
      nonce: safeInfo.nonce,
      totalSigners: safeInfo.owners.length,
      signers,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }

    return NextResponse.json(walletWithDetails)
  } catch (error) {
    console.error('Get wallet error:', error)
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
    const { name, tag } = updateWalletSchema.parse(body)

    const wallet = await db.wallet.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name || null }),
        ...(tag !== undefined && { tag: tag || null }),
      },
    })

    return NextResponse.json(wallet)
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
    console.error('Update wallet error:', error)
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

    await db.wallet.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete wallet error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
