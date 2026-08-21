// ============================================================
// app/api/auth/refresh/route.ts — POST /api/auth/refresh
// ============================================================
// Refresh token rotation:
// 1. Read refresh token (cookie for web, body for mobile)
// 2. Hash → find session by hash
// 3. If not found → REFRESH_TOKEN_REUSE_DETECTED
// 4. If found + ACTIVE → rotate: generate new refresh token
// 5. Issue new access token
// 6. Return new tokens
// ============================================================

import { NextResponse } from 'next/server'
import {
  findSessionByRefreshTokenHash,
  rotateRefreshToken,
  revokeSession,
  logSecurityEvent,
} from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { signAccessToken, generateOpaqueToken, hashRefreshToken } from '@/lib/auth/crypto'
import { setAuthCookies, getRefreshTokenFromCookies } from '@/lib/auth/cookies'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { handleAuthError, AuthError } from '@/lib/auth/errors'

export async function POST(request: Request): Promise<Response> {
  try {
    // ---- Rate limiting -----------------------------------------
    const ipHash = getHashedIp(request)
    const rateResult = await checkRateLimit(`auth:refresh:${ipHash}`, 'refresh')
    if (!rateResult.allowed) {
      return Response.json(
        { error: 'RATE_LIMITED', retryAfter: rateResult.retryAfter },
        { status: 429 }
      )
    }

    // ---- Extract refresh token ---------------------------------
    // Web: from HttpOnly cookie (scoped to /api/auth/refresh)
    // Mobile: from JSON request body
    let rawRefreshToken: string | null = getRefreshTokenFromCookies(request)

    if (!rawRefreshToken) {
      // Mobile path
      try {
        const body = await request.json()
        rawRefreshToken = body?.refreshToken ?? null
      } catch {
        // Body parsing failed — token must be in cookie
      }
    }

    if (!rawRefreshToken) {
      throw new AuthError('UNAUTHORIZED', 401, 'No refresh token provided')
    }

    // ---- Hash the presented token and look up session ----------
    const tokenHash = hashRefreshToken(rawRefreshToken)
    const sessionWithUser = await findSessionByRefreshTokenHash(tokenHash)

    if (!sessionWithUser) {
      // Token not found in ANY session (including revoked ones).
      // This means either:
      //   a) Token was already rotated (old token reused) → TOKEN_REUSE
      //   b) Token was never valid
      // We log this as a security event. If we could identify the user,
      // we would also revoke their active session as a precaution.
      await logSecurityEvent({
        userId: null,
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        ipHash,
        metadata: { reason: 'token_not_found' },
      })
      throw new AuthError('REFRESH_TOKEN_REUSE_DETECTED', 401, 'Refresh token not valid')
    }

    // sessionWithUser has shape: DbSession & { user: DbUser }
    const { user: _user, ...session } = sessionWithUser as { user: import('@/lib/auth/types').DbUser } & import('@/lib/auth/types').DbSession
    const user = (sessionWithUser as unknown as { user: import('@/lib/auth/types').DbUser }).user

    // ---- Check session status ----------------------------------
    if (session.status === 'REVOKED') {
      // The token hash matches a REVOKED session — this is a reuse detection case!
      // A legitimate client would never present a token for a revoked session.
      await logSecurityEvent({
        userId: session.user_id,
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        deviceId: session.device_id,
        ipHash,
        metadata: { reason: 'revoked_session_token_reuse' },
      })
      throw new AuthError('REFRESH_TOKEN_REUSE_DETECTED', 401, 'Refresh token reuse detected')
    }

    if (session.status === 'EXPIRED' || new Date(session.expires_at) < new Date()) {
      throw new AuthError('SESSION_EXPIRED', 401, 'Session has expired')
    }

    // ---- Rotate refresh token (mandatory) ----------------------
    const newRefreshToken = generateOpaqueToken()
    const newTokenHash = hashRefreshToken(newRefreshToken)
    await rotateRefreshToken(session.id, newTokenHash)

    // ---- Issue new access token --------------------------------
    const newAccessToken = await signAccessToken({
      sub: session.user_id,
      sid: session.id,
      sv: session.session_version,
    })

    // ---- Log refresh event -------------------------------------
    await logSecurityEvent({
      userId: session.user_id,
      eventType: 'REFRESH',
      deviceId: session.device_id,
      ipHash,
    })

    // ---- Return new tokens -------------------------------------
    const isMobile = !getRefreshTokenFromCookies(request)

    if (!isMobile) {
      // Web: update HttpOnly cookies
      const response = NextResponse.json({ success: true })
      setAuthCookies(response, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      })
      if (user.onboarding_completed) {
        const { setOnboardingCookie } = await import('@/lib/auth/cookies')
        setOnboardingCookie(response)
      }
      return response
    } else {
      // Mobile: return in JSON body
      return Response.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      })
    }
  } catch (err) {
    return handleAuthError(err)
  }
}
