// ============================================================
// proxy.ts — Next.js 16 Proxy (replaces middleware.ts)
// ============================================================
// Responsibilities (strictly limited):
//   1. Redirect unauthenticated web users from protected routes to login
//   2. Add CORS headers to /api/* routes for React Native
//
// This is NOT the security boundary for API routes.
// Every Route Handler enforces auth independently via requireAuth().
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication for web browsers
const PROTECTED_WEB_ROUTES = ['/home', '/dashboard', '/profile', '/settings', '/dsc-sgt', '/onboarding']

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL ?? '',
].filter(Boolean)

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')

  // ---- Handle CORS preflight for API routes ------------------
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    })
  }

  // ---- Web route protection ----------------------------------
  const isProtectedRoute = PROTECTED_WEB_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtectedRoute) {
    const hasAccessToken = request.cookies.has('dsc_access_token')
    if (!hasAccessToken) {
      const loginUrl = new URL('/', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ---- Add CORS headers to all API responses -----------------
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    const corsHeaders = getCorsHeaders(origin)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (value) response.headers.set(key, value)
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Public static files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
