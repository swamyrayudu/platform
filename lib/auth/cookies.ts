// ============================================================
// lib/auth/cookies.ts — HttpOnly cookie management (SERVER ONLY)
// ============================================================
// Provides helpers for setting/clearing auth cookies on
// Next.js API Route responses (web clients only).
// ============================================================

import type { NextResponse } from 'next/server'
import type { AuthTokens } from './types'

/**
 * Session cookies are ALWAYS Secure except on a genuine localhost dev server.
 *
 * This was `NODE_ENV === 'production'`, which silently dropped Secure from a
 * 30-day httpOnly session cookie on any deployment where NODE_ENV was
 * something else (a container set to "staging", a custom Node server, a
 * preview runner) — making it interceptable over plaintext HTTP.
 * Defaulting to secure means a misconfiguration fails safe.
 */
const IS_LOCAL_DEV =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
const USE_SECURE_COOKIES = !IS_LOCAL_DEV

// Cookie names
export const ACCESS_TOKEN_COOKIE = 'dsc_access_token'
export const REFRESH_TOKEN_COOKIE = 'dsc_refresh_token'
export const ONBOARDING_COOKIE = 'dsc_onboarding_done'
/** Single-use nonce binding a Google sign-in to THIS browser/session. */
export const AUTH_NONCE_COOKIE = 'dsc_auth_nonce'

// Lifetimes (in seconds)
const ACCESS_TOKEN_MAX_AGE = 30 * 24 * 60 * 60   // 30 days
const REFRESH_TOKEN_MAX_AGE = 60 * 24 * 60 * 60  // 60 days
const AUTH_NONCE_MAX_AGE = 5 * 60                // 5 minutes — one sign-in attempt

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
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })

  // Refresh token cookie — scoped to refresh endpoint only
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
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
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0,
  })

  // Also clear onboarding cookie
  response.cookies.set(ONBOARDING_COOKIE, '', {
    secure: USE_SECURE_COOKIES,
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
    secure: USE_SECURE_COOKIES,
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

// ---- Google sign-in nonce ---------------------------------------

/**
 * Store the expected Google sign-in nonce.
 *
 * The same random value is handed to Google Identity Services by the browser
 * and embedded in the resulting ID token. On callback the server compares the
 * token's `nonce` claim with this cookie, which binds the token to the browser
 * that started the flow. Without it, any valid ID token for this client_id —
 * captured from a log, a proxy, or an intercepted mobile request — could be
 * replayed from anywhere for its ~1h lifetime to mint a full session.
 *
 * HttpOnly so page scripts cannot read or forge it, and short-lived because it
 * only has to survive one sign-in.
 */
export function setAuthNonceCookie(response: NextResponse, nonce: string): void {
  response.cookies.set(AUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: AUTH_NONCE_MAX_AGE,
  })
}

/** Clear the nonce so it can never be used twice. */
export function clearAuthNonceCookie(response: NextResponse): void {
  response.cookies.set(AUTH_NONCE_COOKIE, '', {
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0,
  })
}

export function getAuthNonceFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === AUTH_NONCE_COOKIE) {
      const value = rest.join('=')
      return value ? decodeURIComponent(value) : null
    }
  }
  return null
}
