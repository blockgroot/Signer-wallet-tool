import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { syncSignersToJson } from '@/lib/json-sync'
import { z } from 'zod'

const updateAddressSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, addressId } = await params
    const body = await request.json()
    const { name, type } = updateAddressSchema.parse(body)

    // Verify the address belongs to this signer
    const signerAddress = await db.signerAddress.findUnique({
      where: { id: addressId },
    })

    if (!signerAddress || signerAddress.signerId !== id) {
      return NextResponse.json(
        { error: 'Address not found or does not belong to this signer' },
        { status: 404 }
      )
    }

    const updated = await db.signerAddress.update({
      where: { id: addressId },
      data: {
        ...(name !== undefined && { name: name.trim() || null }),
        ...(type !== undefined && { type: type.trim() || null }),
      },
    })

    // Sync to JSON file
    try {
      await syncSignersToJson()
    } catch (error) {
      console.error('Failed to sync signers to JSON:', error)
      // Don't fail the request if JSON sync fails
    }

    return NextResponse.json(updated)
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
    console.error('Update address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, addressId } = await params

    // Verify the address belongs to this signer
    const signerAddress = await db.signerAddress.findUnique({
      where: { id: addressId },
    })

    if (!signerAddress || signerAddress.signerId !== id) {
      return NextResponse.json(
        { error: 'Address not found or does not belong to this signer' },
        { status: 404 }
      )
    }

    await db.signerAddress.delete({
      where: { id: addressId },
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
    console.error('Delete address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
