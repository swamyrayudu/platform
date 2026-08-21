// ============================================================
// lib/auth/cookies.ts — HttpOnly cookie management (SERVER ONLY)
// ============================================================
// Provides helpers for setting/clearing auth cookies on
// Next.js API Route responses (web clients only).
// ============================================================

import type { NextResponse } from 'next/server'
import type { AuthTokens } from './types'

const IS_PROD = process.env.NODE_ENV === 'production'

// Cookie names
export const ACCESS_TOKEN_COOKIE = 'dsc_access_token'
export const REFRESH_TOKEN_COOKIE = 'dsc_refresh_token'
export const ONBOARDING_COOKIE = 'dsc_onboarding_done'

// Lifetimes (in seconds)
const ACCESS_TOKEN_MAX_AGE = 30 * 24 * 60 * 60   // 30 days
const REFRESH_TOKEN_MAX_AGE = 60 * 24 * 60 * 60  // 60 days

/**
 * Set HttpOnly auth cookies on a Next.js response.
 * - Access token: available to all API routes (/api/*)
 * - Refresh token: scoped to /api/auth/refresh ONLY
 *   This prevents the refresh token from being sent to
 *   any other endpoint, minimizing exposure.
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: AuthTokens
): void {
  // Access token cookie
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })

  // Refresh token cookie — scoped to refresh endpoint only
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })
}

/**
 * Clear auth cookies (logout).
 * Sets maxAge=0 to immediately expire both cookies.
 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0,
  })

  // Also clear onboarding cookie
  response.cookies.set(ONBOARDING_COOKIE, '', {
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/**
 * Set the onboarding-done cookie so the proxy can skip DB checks.
 * This is a lightweight, non-HttpOnly cookie (readable by proxy).
 */
export function setOnboardingCookie(response: NextResponse): void {
  response.cookies.set(ONBOARDING_COOKIE, '1', {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })
}

/**
 * Read the access token from request cookies (web clients).
 * Returns null if not present.
 */
export function getAccessTokenFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`))
  return match ? match.slice(ACCESS_TOKEN_COOKIE.length + 1) : null
}

/**
 * Read the refresh token from request cookies (web clients).
 * Returns null if not present.
 */
export function getRefreshTokenFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
  return match ? match.slice(REFRESH_TOKEN_COOKIE.length + 1) : null
}
