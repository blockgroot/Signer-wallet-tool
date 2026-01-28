import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncSignersToJson } from '@/lib/json-sync'
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
          select: {
            id: true,
            address: true,
            createdAt: true,
            updatedAt: true,
            signerId: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // OPTIMIZATION: Fetch all wallet-signer relationships in ONE query instead of N+1 queries
    const allAddressIds = signers.flatMap(s => s.addresses.map(a => a.id))
    
    // Use groupBy to get counts for all addresses in a single query
    const walletSignerCounts = allAddressIds.length > 0 
      ? await db.walletSigner.groupBy({
          by: ['signerAddressId'],
          where: {
            signerAddressId: { in: allAddressIds },
          },
          _count: {
            signerAddressId: true,
          },
        })
      : []

    // Create a map for O(1) lookup instead of database queries
    const walletCountMap = new Map<string, number>()
    for (const count of walletSignerCounts) {
      walletCountMap.set(count.signerAddressId, count._count.signerAddressId)
    }

    // Transform to address-first structure: one row per address
    // Each address gets its signer's name and department as metadata
    // Use database counts for wallet counts (live data fetched on detail page)
    const addressRows: Array<{
      id: string
      address: string
      signerId: string
      signerName: string
      department: string | null
      walletCount: number
      addressName: string | null
      addressType: string | null
    }> = []

    for (const signer of signers) {
      // Create one row per address
      for (const address of signer.addresses) {
        // Validate address format
        if (!address.address || !/^0x[a-fA-F0-9]{40}$/.test(address.address)) {
          // Skip invalid addresses
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Skipping invalid address: ${address.address} for signer ${signer.name}`)
          }
          continue
        }

        // Get wallet count from map (O(1) lookup instead of database query)
        const walletCount = walletCountMap.get(address.id) || 0

        addressRows.push({
          id: address.id,
          address: address.address.toLowerCase(),
          signerId: signer.id,
          signerName: signer.name,
          department: signer.department,
          walletCount,
          addressName: address.name || null,
          addressType: address.type || null,
        })
      }
    }

    // Sort by address for consistent ordering
    addressRows.sort((a, b) => a.address.localeCompare(b.address))

    return NextResponse.json(addressRows)
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

    // Normalize addresses to lowercase for comparison
    const normalizedAddresses = addresses.map((addr: string) => addr.toLowerCase())

    // Check for duplicate addresses within the same request
    const uniqueAddresses = new Set(normalizedAddresses)
    if (uniqueAddresses.size !== normalizedAddresses.length) {
      const duplicates = normalizedAddresses.filter((addr, index) => normalizedAddresses.indexOf(addr) !== index)
      return NextResponse.json(
        { error: `Duplicate addresses in the request: ${[...new Set(duplicates)].join(', ')}` },
        { status: 400 }
      )
    }

    // Check if any address already exists in the database
    const existingAddresses = await db.signerAddress.findMany({
      where: {
        address: { in: normalizedAddresses },
      },
      include: {
        signer: true,
      },
    })

    if (existingAddresses.length > 0) {
      const duplicateAddresses = existingAddresses.map((sa) => sa.address)
      const signerNames = [...new Set(existingAddresses.map((sa) => sa.signer.name))]
      return NextResponse.json(
        { 
          error: `One or more addresses are already associated with another signer${signerNames.length > 1 ? 's' : ''}: ${signerNames.join(', ')}. Duplicate addresses: ${duplicateAddresses.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // No need to validate signer addresses via Safe API
    // Signers are EOA (Externally Owned Account) addresses, not Safe wallets
    // The duplicate check above is sufficient validation

    const signer = await db.signer.create({
      data: {
        name,
        department: department || null,
        addresses: {
          create: normalizedAddresses.map((address) => ({ address })),
        },
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

    return NextResponse.json(signer, { status: 201 })
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
    console.error('Create signer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
