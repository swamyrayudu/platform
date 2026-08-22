// ============================================================
// lib/auth/session.ts — requireAuth / requirePremium middleware
// ============================================================
// Wraps Next.js Route Handlers with auth + authorization checks.
// This is the real API security boundary — not proxy.ts.
// ============================================================

import { NextResponse } from 'next/server'
import { verifyAccessToken } from './crypto'
import { getUserById, findSessionById, updateSessionActivity, logSecurityEvent } from './db'
import { getAccessTokenFromCookies } from './cookies'
import { getHashedIp } from './ip'
import { AuthError, handleAuthError } from './errors'
import type { AuthContext, DbUser, DbSession } from './types'

// ---- Token extraction -------------------------------------------

/**
 * Read the access token from:
 * 1. Authorization: Bearer <token>  (mobile apps)
 * 2. dsc_access_token cookie        (web browsers)
 *
 * Authorization header takes precedence.
 */
function extractAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  return getAccessTokenFromCookies(request)
}

// ---- Core session validation ------------------------------------

/**
 * Validate the access token and associated session.
 * Returns AuthContext ({ user, session }) or throws AuthError.
 *
 * Checks in order:
 * 1. Token present
 * 2. JWT signature + expiry valid
 * 3. Session exists in DB
 * 4. Session status === ACTIVE
 * 5. session.session_version === user.session_version
 */
async function validateSession(request: Request): Promise<AuthContext> {
  const token = extractAccessToken(request)
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 401, 'No access token provided')
  }

  // Verify JWT — throws SESSION_EXPIRED or UNAUTHORIZED on failure
  const payload = await verifyAccessToken(token)

  // Fetch session from DB (source of truth)
  const session = await findSessionById(payload.sid)
  if (!session) {
    throw new AuthError('SESSION_REVOKED', 401, 'Session not found')
  }

  // Check session status
  if (session.status === 'REVOKED') {
    throw new AuthError('SESSION_REVOKED', 401, 'Session has been revoked')
  }
  if (session.status === 'EXPIRED') {
    throw new AuthError('SESSION_EXPIRED', 401, 'Session has expired')
  }

  // Check session expiry timestamp
  if (new Date(session.expires_at) < new Date()) {
    throw new AuthError('SESSION_EXPIRED', 401, 'Session has expired')
  }

  // Fetch user
  const user = await getUserById(session.user_id)
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 401, 'User not found')
  }

  // Check session version — if user.session_version changed, all old sessions are invalid
  if (session.session_version !== user.session_version) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'SESSION_VERSION_MISMATCH',
      deviceId: session.device_id,
      ipHash: getHashedIp(request),
      metadata: {
        sessionVersion: session.session_version,
        userVersion: user.session_version,
      },
    })
    throw new AuthError('SESSION_EXPIRED', 401, 'Session invalidated by security reset')
  }

  // Update last activity (non-blocking, fire-and-forget)
  updateSessionActivity(session.id).catch(() => {})

  return { user, session }
}

/**
 * Safely extract AuthContext without throwing if user is unauthenticated
 */
export async function getOptionalAuth(request: Request): Promise<AuthContext | null> {
  try {
    return await validateSession(request)
  } catch {
    return null
  }
}

// ---- Route Handler types ----------------------------------------

type RouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: { params: Promise<TParams> },
  auth: AuthContext
) => Promise<Response> | Response

// ---- requireAuth ------------------------------------------------

/**
 * Middleware that validates the session and injects AuthContext.
 *
 * Usage:
 * ```ts
 * export const GET = requireAuth(async (request, context, { user, session }) => {
 *   return Response.json({ id: user.id })
 * })
 * ```
 */
export function requireAuth<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>
) {
  return async (
    request: Request,
    context: { params: Promise<TParams> }
  ): Promise<Response> => {
    try {
      const auth = await validateSession(request)
      return await handler(request, context, auth)
    } catch (err) {
      return handleAuthError(err)
    }
  }
}

// ---- requirePremium ---------------------------------------------

/**
 * Middleware that validates session AND checks PREMIUM subscription.
 *
 * Checks:
 * - account_type === 'PREMIUM'
 * - subscription_status === 'ACTIVE'
 * - subscription_expires_at is in the future
 *
 * Returns 403 PREMIUM_REQUIRED if any check fails.
 *
 * Usage:
 * ```ts
 * export const GET = requirePremium(async (request, context, { user, session }) => {
 *   return Response.json({ premiumData: '...' })
 * })
 * ```
 */
export function requirePremium<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>
) {
  return async (
    request: Request,
    context: { params: Promise<TParams> }
  ): Promise<Response> => {
    try {
      const auth = await validateSession(request)
      const { user } = auth

      // Check premium authorization — never trust the frontend
      const isPremium = user.account_type === 'PREMIUM'
      const isActive = user.subscription_status === 'ACTIVE'
      const notExpired =
        user.subscription_expires_at !== null &&
        new Date(user.subscription_expires_at) > new Date()

      if (!isPremium || !isActive || !notExpired) {
        // Log the denied access attempt
        await logSecurityEvent({
          userId: user.id,
          eventType: 'PREMIUM_ACCESS_DENIED',
          deviceId: auth.session.device_id,
          ipHash: getHashedIp(request),
          metadata: {
            accountType: user.account_type,
            subscriptionStatus: user.subscription_status,
          },
        })
        throw new AuthError('PREMIUM_REQUIRED', 403, 'Premium subscription required')
      }

      return await handler(request, context, auth)
    } catch (err) {
      return handleAuthError(err)
    }
  }
}

// ---- requireAdmin -----------------------------------------------

/**
 * Middleware that validates session AND checks admin role.
 *
 * Checks:
 * - Valid authenticated session
 * - user.role === 'admin'
 *
 * Returns 403 ADMIN_REQUIRED if role check fails.
 *
 * Usage:
 * ```ts
 * export const GET = requireAdmin(async (request, context, { user, session }) => {
 *   return Response.json({ adminData: '...' })
 * })
 * ```
 */
export function requireAdmin<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>
) {
  return async (
    request: Request,
    context: { params: Promise<TParams> }
  ): Promise<Response> => {
    try {
      const auth = await validateSession(request)
      const { user } = auth

      // Check admin role — never trust the frontend
      if (user.role !== 'admin') {
        // Log the denied access attempt
        await logSecurityEvent({
          userId: user.id,
          eventType: 'ADMIN_ACCESS_DENIED',
          deviceId: auth.session.device_id,
          ipHash: getHashedIp(request),
          metadata: {
            role: user.role,
            attemptedUrl: request.url,
          },
        })
        throw new AuthError('ADMIN_REQUIRED', 403, 'Admin access required')
      }

      return await handler(request, context, auth)
    } catch (err) {
      return handleAuthError(err)
    }
  }
}
