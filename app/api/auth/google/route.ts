// ============================================================
// app/api/auth/google/route.ts — POST /api/auth/google
// ============================================================
// Full login flow:
// 1. Rate limit check
// 2. Verify Google ID token server-side
// 3. Get trusted client IP → HMAC hash
// 4. Find/create user
// 5. DB: revoke old session → create new session (atomic)
// 6. Issue access token + refresh token
// 7. Web: set HttpOnly cookies | Mobile: return JSON
// 8. After the response: upsert device, write the audit entry
//
// Everything on the critical path is a network round trip, so the ordering
// above is load-bearing: anything the browser does not need before it is
// signed in has been moved out of it.
// ============================================================

import { NextResponse, after } from 'next/server'
import { createHash } from 'crypto'
import { verifyGoogleIdToken } from '@/lib/auth/google'
import { findOrCreateUser, upsertDevice, revokeActiveSession, createSession, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { signAccessToken, generateOpaqueToken, hashRefreshToken } from '@/lib/auth/crypto'
import { setAuthCookies, setOnboardingCookie, getAuthNonceFromCookies, clearAuthNonceCookie } from '@/lib/auth/cookies'
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

/**
 * Does nothing, on purpose.
 *
 * A cold serverless function costs about a second before a single line of the
 * handler below runs, and the landing page knows a sign-in is coming long
 * before the credential arrives. GET and POST of one route file ship in the
 * same bundle, so touching this boots the instance that POST will land on.
 * It reads nothing, writes nothing, and is not rate limited because there is
 * nothing here to abuse.
 */
export function GET(): Response {
  // A one-byte body rather than a 204: fetch() treats an empty no-content
  // response as aborted, which puts a red line in the network panel for a
  // request that did exactly what it was meant to.
  return new Response('ok', {
    status: 200,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
  })
}

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

    // Single-use nonce issued by GET /api/auth/nonce. Enforced for EVERY
    // platform on purpose: gating it on `platform === 'WEB'` would let an
    // attacker skip the check simply by claiming to be a mobile client.
    const expectedNonce = getAuthNonceFromCookies(request)
    if (!expectedNonce) {
      return Response.json(
        { error: 'AUTH_NONCE_REQUIRED', message: 'Start sign-in again' },
        { status: 400 }
      )
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
    const googleProfile = await verifyGoogleIdToken(idToken, expectedNonce)

    // ---- Find or create user in our custom users table ----------
    // signInWithIdToken gives us a stable supabase_uid, but it is a second
    // full verification of a token this route has already verified itself,
    // and Supabase Auth calls out to Google to do it. Only a first-ever
    // sign-in needs the value, so it is passed as a thunk and never runs for
    // a returning user.
    const user = await findOrCreateUser(googleProfile, async () => {
      const { data, error } = await supabaseAdmin.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error || !data.user) {
        // Fallback: Supabase Google provider not yet enabled.
        // Derive a deterministic UUID from the Google ID so it fits the UUID column.
        console.warn('[Auth] Supabase signInWithIdToken failed, deriving UUID from google_id:', error?.message)
        return googleIdToUuid(googleProfile.googleId)
      }
      return data.user.id
    })

    // ---- Device info -------------------------------------------
    const deviceInfo: DeviceInfo = {
      deviceId: deviceId as string,
      platform: platform as Platform,
      userAgent: typeof userAgent === 'string' ? userAgent : (request.headers.get('user-agent') ?? 'unknown'),
    }

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

    // ---- Bookkeeping, after the response ------------------------
    // Neither the device row nor the audit entry is read back before the user
    // is signed in, and sessions.device_id carries no foreign key to devices,
    // so making the browser wait on two more writes bought nothing. They still
    // run on the same invocation — `after` defers them past the response
    // rather than dropping them.
    after(async () => {
      await upsertDevice(user.id, deviceInfo, ipHash)
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
      // Burn the nonce: one sign-in per issued value.
      clearAuthNonceCookie(response)
      // Set onboarding cookie if already completed (returning user)
      if (user.onboarding_completed) {
        setOnboardingCookie(response)
      }
      return response
    } else {
      // Mobile: return tokens in JSON body; client stores in secure storage
      const response = NextResponse.json({
        accessToken,
        refreshToken,
        user: publicUser,
        sessionId: session.id,
      })
      clearAuthNonceCookie(response)
      return response
    }
  } catch (err) {
    return handleAuthError(err)
  }
}
