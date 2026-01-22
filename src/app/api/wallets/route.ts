import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safe-service'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'

const createWalletSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format'),
  name: z.string().optional(),
  chainId: z.number().int().positive(),
  tag: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    // Allow public access to view wallets - no auth required
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId')
    const search = searchParams.get('search')

    const where: any = {}
    if (chainId) {
      where.chainId = parseInt(chainId, 10)
    }
    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const wallets = await db.wallet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(wallets)
  } catch (error) {
    console.error('Get wallets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { address, name, chainId, tag } = createWalletSchema.parse(body)

    // Verify the wallet exists on the chain by fetching from Safe API
    try {
      await getSafeInfo(address, chainId)
    } catch (error) {
      return NextResponse.json(
        { error: 'Wallet not found on the specified chain' },
        { status: 404 }
      )
    }

    const wallet = await db.wallet.create({
      data: {
        address,
        name: name || null,
        chainId,
        tag: tag || null,
      },
    })

    return NextResponse.json(wallet, { status: 201 })
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
    console.error('Create wallet error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
