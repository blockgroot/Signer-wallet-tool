import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = loginSchema.parse(body)

    // Trim whitespace from username
    const trimmedUsername = username.trim()

    const user = await db.user.findUnique({
      where: { username: trimmedUsername },
    })

    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Login] User not found: ${trimmedUsername}`)
      }
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Login] Invalid password for user: ${trimmedUsername}`)
      }
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    await createSession(user.id, user.username, user.isAdmin)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
