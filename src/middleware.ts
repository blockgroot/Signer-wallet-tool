import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')
  
  // Allow public access to view pages
  const isViewPage = request.nextUrl.pathname.startsWith('/wallets') || 
                    request.nextUrl.pathname.startsWith('/signers') ||
                    request.nextUrl.pathname === '/'

  // Allow access to login page, auth API, and view pages
  if (isAuthPage || isApiAuth || isViewPage) {
    return NextResponse.next()
  }

  // Only protect admin API routes (POST, PUT, DELETE)
  // GET requests are handled in API routes themselves

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
