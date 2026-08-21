// ============================================================
// proxy.ts — Next.js 16 Proxy (replaces middleware.ts)
// ============================================================
// Responsibilities (strictly limited):
//   1. Redirect unauthenticated web users from protected routes
//   2. Redirect authenticated-but-not-onboarded users to /onboarding
//   3. Add CORS headers to /api/* routes for React Native
//
// This is NOT the security boundary for API routes.
// Every Route Handler enforces auth independently via requireAuth().
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication for web browsers
const PROTECTED_WEB_ROUTES = ['/home', '/dashboard', '/profile', '/settings', '/dsc-sgt']

// Routes that require authentication AND completed onboarding
// (same as protected routes, minus /onboarding itself)
const ONBOARDING_REQUIRED_ROUTES = ['/home', '/dashboard', '/profile', '/settings', '/dsc-sgt']

// Allowed origins for CORS (add your production domain here)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL ?? '',
  // Add your React Native dev server / production origin if needed
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
  // Note: this only checks cookie presence for redirect purposes.
  // The actual JWT validation and session DB check happens inside
  // each Route Handler via requireAuth().
  const isProtectedRoute = PROTECTED_WEB_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtectedRoute) {
    const hasAccessToken = request.cookies.has('dsc_access_token')
    if (!hasAccessToken) {
      const loginUrl = new URL('/', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // ---- Onboarding enforcement --------------------------------
    // If the user is authenticated but has NOT completed onboarding,
    // redirect them to /onboarding. We check via a lightweight cookie
    // (dsc_onboarding_done) to avoid a DB round-trip on every request.
    const isOnboardingRequired = ONBOARDING_REQUIRED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )
    const hasOnboardingCookie = request.cookies.has('dsc_onboarding_done')

    if (isOnboardingRequired && !hasOnboardingCookie) {
      const onboardingUrl = new URL('/onboarding', request.url)
      return NextResponse.redirect(onboardingUrl)
    }
  }

  // ---- Onboarding page: redirect completed users to /home ----
  if (pathname === '/onboarding') {
    const hasAccessToken = request.cookies.has('dsc_access_token')
    if (!hasAccessToken) {
      // Not logged in → go to login
      const loginUrl = new URL('/', request.url)
      return NextResponse.redirect(loginUrl)
    }
    const hasOnboardingCookie = request.cookies.has('dsc_onboarding_done')
    if (hasOnboardingCookie) {
      // Already onboarded → go to home
      const homeUrl = new URL('/home', request.url)
      return NextResponse.redirect(homeUrl)
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
