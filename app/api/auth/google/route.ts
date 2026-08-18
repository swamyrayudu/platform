// ============================================================
// app/api/auth/google/route.ts — POST /api/auth/google
// ============================================================
// Full login flow:
// 1. Rate limit check
// 2. Verify Google ID token server-side
// 3. Find/create user
// 4. Get trusted client IP → HMAC hash
// 5. Upsert device
// 6. DB: revoke old session → create new session (atomic)
// 7. Issue access token + refresh token
// 8. Web: set HttpOnly cookies | Mobile: return JSON
// ============================================================

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { verifyGoogleIdToken } from '@/lib/auth/google'
import { findOrCreateUser, upsertDevice, revokeActiveSession, createSession, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { signAccessToken, generateOpaqueToken, hashRefreshToken } from '@/lib/auth/crypto'
import { setAuthCookies } from '@/lib/auth/cookies'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { handleAuthError, AuthError } from '@/lib/auth/errors'
import { toPublicUser } from '@/lib/auth/types'
import type { Platform, DeviceInfo } from '@/lib/auth/types'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Convert a Google numeric ID to a deterministic UUID.
 * Used as fallback when Supabase Google provider is not yet enabled.
 * The same Google ID always produces the same UUID.
 */
function googleIdToUuid(googleId: string): string {
  const h = createHash('sha256').update(`dsc-platform:google:${googleId}`).digest('hex')
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + h.slice(18, 20),
    h.slice(20, 32),
  ].join('-')
}

const ALLOWED_PLATFORMS: Platform[] = ['WEB', 'ANDROID', 'IOS']

export async function POST(request: Request): Promise<Response> {
  try {
    // ---- Parse and validate body ------------------------------------
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { idToken, deviceId, platform, userAgent } = body as Record<string, unknown>

    if (typeof idToken !== 'string' || !idToken) {
      return Response.json({ error: 'idToken is required' }, { status: 400 })
    }
    if (typeof deviceId !== 'string' || !deviceId) {
      return Response.json({ error: 'deviceId is required' }, { status: 400 })
    }
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      return Response.json(
        { error: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}` },
        { status: 400 }
      )
    }

    // ---- Rate limiting -------------------------------------------
    const ipHash = getHashedIp(request)
    const rateKey = `auth:google:${ipHash}`
    const rateResult = await checkRateLimit(rateKey, 'google')
    if (!rateResult.allowed) {
      return Response.json(
        { error: 'RATE_LIMITED', retryAfter: rateResult.retryAfter },
        { status: 429 }
      )
    }

    // ---- Verify Google ID token (server-side) --------------------
    const googleProfile = await verifyGoogleIdToken(idToken)

    // ---- Use Supabase Auth to get/create the Supabase user -------
    // signInWithIdToken handles Google OIDC token verification at the Supabase level
    // We use this to get a stable supabase_uid for the user.
    const { data: supabaseAuthData, error: supabaseAuthError } = await supabaseAdmin.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })

    let supabaseUid: string
    if (supabaseAuthError || !supabaseAuthData.user) {
      // Fallback: Supabase Google provider not yet enabled.
      // Derive a deterministic UUID from the Google ID so it fits the UUID column.
      console.warn('[Auth] Supabase signInWithIdToken failed, deriving UUID from google_id:', supabaseAuthError?.message)
      supabaseUid = googleIdToUuid(googleProfile.googleId)
    } else {
      supabaseUid = supabaseAuthData.user.id
    }

    // ---- Find or create user in our custom users table ----------
    const user = await findOrCreateUser(supabaseUid, googleProfile)

    // ---- Device info -------------------------------------------
    const deviceInfo: DeviceInfo = {
      deviceId: deviceId as string,
      platform: platform as Platform,
      userAgent: typeof userAgent === 'string' ? userAgent : (request.headers.get('user-agent') ?? 'unknown'),
    }

    // ---- Upsert device record ----------------------------------
    await upsertDevice(user.id, deviceInfo, ipHash)

    // ---- Generate tokens BEFORE transaction -------------------------
    // (so we have the hash to store)
    const refreshToken = generateOpaqueToken()
    const refreshTokenHash = hashRefreshToken(refreshToken)

    // ---- Atomic DB transaction: revoke old → create new session ----
    // Supabase JS doesn't support multi-statement transactions directly,
    // so we call our RPC or execute steps sequentially with proper error handling.
    // The partial unique index (sessions_one_active_per_user) at DB level
    // guarantees only one ACTIVE session exists even under concurrent logins.

    await revokeActiveSession(user.id, 'NEW_DEVICE_LOGIN')
    const session = await createSession(
      user.id,
      deviceInfo,
      ipHash,
      refreshTokenHash,
      user.session_version
    )

    // ---- Log security event ------------------------------------
    await logSecurityEvent({
      userId: user.id,
      eventType: 'NEW_DEVICE_LOGIN',
      deviceId: deviceInfo.deviceId,
      ipHash,
      metadata: {
        platform: deviceInfo.platform,
        isNewUser: user.created_at === user.updated_at,
      },
    })

    // ---- Sign access token -------------------------------------
    const accessToken = await signAccessToken({
      sub: user.id,
      sid: session.id,
      sv: user.session_version,
    })

    // ---- Return tokens -----------------------------------------
    const publicUser = toPublicUser(user)

    if ((platform as Platform) === 'WEB') {
      // Web: set HttpOnly cookies, don't return tokens in body
      const response = NextResponse.json({ user: publicUser, sessionId: session.id })
      setAuthCookies(response, { accessToken, refreshToken })
      return response
    } else {
      // Mobile: return tokens in JSON body; client stores in secure storage
      return Response.json({
        accessToken,
        refreshToken,
        user: publicUser,
        sessionId: session.id,
      })
    }
  } catch (err) {
    return handleAuthError(err)
  }
}
