import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

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
