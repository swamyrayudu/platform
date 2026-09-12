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
  findSessionByPreviousRefreshTokenHash,
  revokeSessionFamily,
} from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { signAccessToken, generateOpaqueToken, hashRefreshToken } from '@/lib/auth/crypto'
import { setAuthCookies, getRefreshTokenFromCookies } from '@/lib/auth/cookies'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { handleAuthError, AuthError } from '@/lib/auth/errors'

/**
 * How long after a rotation the replaced token is still accepted.
 *
 * A client that retries after a network timeout legitimately re-sends the token
 * it already used. Without a leeway window that looks identical to token theft,
 * and the containment response (revoke everything) would log real users out on
 * a flaky connection. Theft is almost always attempted long after the victim's
 * last rotation, so a short window costs very little detection.
 */
const REFRESH_REUSE_LEEWAY_MS = 10_000

/**
 * Build the token response. Web gets HttpOnly cookies; mobile gets JSON,
 * distinguished by whether the refresh token arrived in a cookie.
 */
async function buildRefreshResponse(
  request: Request,
  session: { user_id: string; user?: { onboarding_completed?: boolean } },
  accessToken: string,
  refreshToken: string
): Promise<Response> {
  const isMobile = !getRefreshTokenFromCookies(request)

  if (isMobile) {
    return Response.json({ accessToken, refreshToken })
  }

  const response = NextResponse.json({ success: true })
  setAuthCookies(response, { accessToken, refreshToken })
  if (session.user?.onboarding_completed) {
    const { setOnboardingCookie } = await import('@/lib/auth/cookies')
    setOnboardingCookie(response)
  }
  return response
}

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
      // The token matches no CURRENT session hash. Before giving up, check the
      // previous-generation hash: a hit means this token was already rotated
      // away, which is the signature of refresh-token theft (two parties hold
      // tokens from the same chain, and the slower one arrives stale).
      const rotatedAway = await findSessionByPreviousRefreshTokenHash(tokenHash)

      if (rotatedAway) {
        // LEEWAY: a client that retries after a network timeout legitimately
        // re-sends the token it already used. Treating that as theft would log
        // real users out. Anything within the window is accepted as a benign
        // retry of the rotation that just happened; anything older is theft.
        const rotatedAt = rotatedAway.rotated_at ? new Date(rotatedAway.rotated_at).getTime() : 0
        const withinLeeway =
          rotatedAt > 0 && Date.now() - rotatedAt <= REFRESH_REUSE_LEEWAY_MS

        if (withinLeeway && rotatedAway.status === 'ACTIVE') {
          const retryToken = generateOpaqueToken()
          const retryHash = hashRefreshToken(retryToken)
          await rotateRefreshToken(rotatedAway.id, retryHash, tokenHash)

          const retryAccessToken = await signAccessToken({
            sub: rotatedAway.user_id,
            sid: rotatedAway.id,
            sv: rotatedAway.session_version,
          })

          await logSecurityEvent({
            userId: rotatedAway.user_id,
            eventType: 'REFRESH',
            deviceId: rotatedAway.device_id,
            ipHash,
            metadata: { reason: 'rotation_retry_within_leeway' },
          })

          return buildRefreshResponse(request, rotatedAway, retryAccessToken, retryToken)
        }

        // Outside the leeway window: we cannot tell whether the victim or the
        // attacker is calling, so revoke the whole family and invalidate
        // outstanding access tokens. Both are forced to re-authenticate; the
        // thief loses the access they gained.
        await revokeSessionFamily(rotatedAway.user_id, 'refresh_token_reuse_detected')
        await logSecurityEvent({
          userId: rotatedAway.user_id,
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
          deviceId: rotatedAway.device_id,
          ipHash,
          metadata: { reason: 'rotated_token_reuse', action: 'session_family_revoked' },
        })
        throw new AuthError('REFRESH_TOKEN_REUSE_DETECTED', 401, 'Refresh token reuse detected')
      }

      // Genuinely unknown token (never valid, or older than one rotation).
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
      // Revoke the family again and bump session_version, so any access token
      // still outstanding for this user dies too.
      await revokeSessionFamily(session.user_id, 'revoked_session_token_reuse')
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
    await rotateRefreshToken(session.id, newTokenHash, tokenHash)

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
    return buildRefreshResponse(
      request,
      { user_id: session.user_id, user },
      newAccessToken,
      newRefreshToken
    )
  } catch (err) {
    return handleAuthError(err)
  }
}
