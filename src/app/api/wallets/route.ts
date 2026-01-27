import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSafeInfo } from '@/lib/safeApi'
import { getChainById } from '@/lib/chains'
import { syncWalletsToJson } from '@/lib/json-sync'
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
        { tag: { contains: search, mode: 'insensitive' } },
      ]
    }

    const wallets = await db.wallet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Return wallets without fetching threshold/signers from Safe API
    // This avoids rate limiting on the dashboard page
    // Threshold and signers are fetched only on the wallet detail page
    return NextResponse.json(wallets.map(wallet => ({
      ...wallet,
      threshold: 0, // Will be fetched on detail page
      totalSigners: 0, // Will be fetched on detail page
      signers: [], // Will be fetched on detail page
    })))
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

    // Normalize address to lowercase for comparison
    const normalizedAddress = address.toLowerCase()

    // Check for duplicate wallet (address + chainId combination)
    const existingWallet = await db.wallet.findUnique({
      where: {
        address_chainId: {
          address: normalizedAddress,
          chainId,
        },
      },
    })

    if (existingWallet) {
      const chainName = getChainById(chainId)?.name || `chain ${chainId}`
      return NextResponse.json(
        { error: `Wallet with address ${address} already exists` },
        { status: 400 }
      )
    }

    // Validate that the wallet exists on the specified chain via Safe API
    // This is required - we must verify the wallet exists before adding
    const apiKey = process.env.SAFE_API_KEY?.trim()
    if (!apiKey || apiKey === '') {
      return NextResponse.json(
        { error: 'Safe API configuration error. SAFE_API_KEY is not set or is empty. Please contact administrator.' },
        { status: 500 }
      )
    }

    try {
      await getSafeInfo(normalizedAddress, chainId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const chainName = getChainById(chainId)?.name || 'the specified chain'
      
      // If it's a "not a Safe wallet" error (422), reject it
      if (errorMessage.includes('not a Safe wallet') || errorMessage.includes('422')) {
        return NextResponse.json(
          { error: `Address ${address} is not recognized as a Safe wallet on ${chainName}. Please verify the address and chain are correct.` },
          { status: 400 }
        )
      }
      
      // If it's a "not found" error (404), reject it
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return NextResponse.json(
          { error: `Wallet not found on ${chainName}. The address might not be a Safe wallet or may not exist on this chain.` },
          { status: 404 }
        )
      }
      
      // For other errors (rate limit, network issues), reject with error message
      return NextResponse.json(
        { error: `Failed to verify wallet on ${chainName}: ${errorMessage}. Please try again later.` },
        { status: 400 }
      )
    }

    // All validations passed - create the wallet
    const wallet = await db.wallet.create({
      data: {
        address: normalizedAddress,
        name: name || null,
        chainId,
        tag: tag || null,
      },
    })

    // Sync to JSON file
    try {
      await syncWalletsToJson()
    } catch (error) {
      console.error('Failed to sync wallets to JSON:', error)
      // Don't fail the request if JSON sync fails
    }

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
