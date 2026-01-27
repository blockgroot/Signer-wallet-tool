import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safeApi'
import { getChainById } from '@/lib/chains'
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
        },
      },
      orderBy: { createdAt: 'desc' },
    })

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

        // Get wallet count from database (live data fetched on detail page only)
        const walletCount = await db.walletSigner.count({
          where: {
            signerAddressId: address.id,
          },
        })

        addressRows.push({
          id: address.id,
          address: address.address.toLowerCase(),
          signerId: signer.id,
          signerName: signer.name,
          department: signer.department,
          walletCount,
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

    // Validate that addresses are not Safe wallets (they should be EOA addresses)
    // We can't fully validate EOA addresses exist, but we can check they're not Safe wallets
    if (process.env.SAFE_API_KEY) {
      for (const address of normalizedAddresses) {
        // Try to find if this address is a Safe wallet on any chain
        // If it is, warn the user
        try {
          // Try a few common chains to see if it's a Safe wallet
          const commonChains = [1, 56, 137, 42161, 10, 8453] // ETH, BNB, Polygon, Arbitrum, Optimism, Base
          for (const chainId of commonChains) {
            try {
              await getSafeInfo(address, chainId)
              // If we get here, it's a Safe wallet
              const chainName = getChainById(chainId)?.name || `chain ${chainId}`
              return NextResponse.json(
                { error: `Address ${address} appears to be a Safe wallet on ${chainName}, not an EOA (Externally Owned Account). Signers should be EOA addresses, not Safe wallets.` },
                { status: 400 }
              )
            } catch (error) {
              // Not a Safe wallet on this chain, continue checking
              continue
            }
          }
        } catch (error) {
          // If validation fails, we'll allow it (might be a new address or API issue)
          console.warn(`[Add Signer] Could not validate address ${address}:`, error)
        }
      }
    }

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
