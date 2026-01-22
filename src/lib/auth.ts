import { cookies } from 'next/headers'
import { db } from './db'
import bcrypt from 'bcryptjs'

const SESSION_COOKIE_NAME = 'multisig-session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production'

export interface Session {
  userId: string
  username: string
  isAdmin: boolean
}

export async function createSession(userId: string, username: string, isAdmin: boolean): Promise<void> {
  const cookieStore = await cookies()
  const sessionData: Session = { userId, username, isAdmin }
  
  // In a production app, you'd want to encrypt this or use a proper session store
  // For simplicity, we're storing JSON in the cookie (with size limits)
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  
  if (!sessionCookie) {
    return null
  }

  try {
    const session = JSON.parse(sessionCookie.value) as Session
    return session
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (!session.isAdmin) {
    throw new Error('Forbidden: Admin access required')
  }
  return session
}
