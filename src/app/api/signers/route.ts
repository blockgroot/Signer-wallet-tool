import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safe-service'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'

const createSignerSchema = z.object({
  name: z.string().min(1),
  department: z.string().optional(),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format')).min(1),
})

export async function GET(request: NextRequest) {
  try {
    // Allow public access to view signers - no auth required
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { addresses: { some: { address: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const signers = await db.signer.findMany({
      where,
      include: {
        addresses: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(signers)
  } catch (error) {
    console.error('Get signers error:', error)
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
    const { name, department, addresses } = createSignerSchema.parse(body)

    // Check if any address already exists
    const existingAddresses = await db.signerAddress.findMany({
      where: {
        address: { in: addresses },
      },
    })

    if (existingAddresses.length > 0) {
      return NextResponse.json(
        { error: 'One or more addresses are already associated with another signer' },
        { status: 400 }
      )
    }

    const signer = await db.signer.create({
      data: {
        name,
        department: department || null,
        addresses: {
          create: addresses.map((address) => ({ address })),
        },
      },
      include: {
        addresses: true,
      },
    })

    return NextResponse.json(signer, { status: 201 })
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
    console.error('Create signer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
