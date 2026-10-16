// ============================================================
// lib/auth/issue-session.ts — Sign a verified user in (SERVER ONLY)
// ============================================================
// Shared by Google sign-in (app/api/auth/google) and email + password
// sign-in (app/api/auth/password), once each has verified who the user is:
// revoke the old session, create the new one, sign the access token, and
// answer the web with HttpOnly cookies or the app with tokens in JSON. The
// device row and the audit entry are written after the response.
// ============================================================

import { NextResponse, after } from 'next/server'
import { upsertDevice, revokeActiveSession, createSession, logSecurityEvent } from './db'
import { signAccessToken, generateOpaqueToken, hashRefreshToken } from './crypto'
import { setAuthCookies, setOnboardingCookie, clearAuthNonceCookie } from './cookies'
import { toPublicUser } from './types'
import type { DbUser, DeviceInfo, SecurityEventType } from './types'

export async function issueSession(
  user: DbUser,
  deviceInfo: DeviceInfo,
  ipHash: string,
  audit: { eventType: SecurityEventType; metadata?: Record<string, unknown> },
): Promise<Response> {
  const refreshToken = generateOpaqueToken()
  const refreshTokenHash = hashRefreshToken(refreshToken)

  // The partial unique index (sessions_one_active_per_user) guarantees only
  // one ACTIVE session exists even under concurrent logins.
  await revokeActiveSession(user.id, 'NEW_DEVICE_LOGIN')
  const session = await createSession(user.id, deviceInfo, ipHash, refreshTokenHash, user.session_version)

  // Neither the device row nor the audit entry is read back before the user
  // is signed in, so they run after the response rather than delaying it.
  after(async () => {
    await upsertDevice(user.id, deviceInfo, ipHash)
    await logSecurityEvent({
      userId: user.id,
      eventType: audit.eventType,
      deviceId: deviceInfo.deviceId,
      ipHash,
      metadata: { platform: deviceInfo.platform, ...audit.metadata },
    })
  })

  const accessToken = await signAccessToken({ sub: user.id, sid: session.id, sv: user.session_version })
  const publicUser = toPublicUser(user)

  if (deviceInfo.platform === 'WEB') {
    // Web: HttpOnly cookies, no tokens in the body.
    const response = NextResponse.json({ user: publicUser, sessionId: session.id })
    setAuthCookies(response, { accessToken, refreshToken })
    // Burn the nonce: one sign-in per issued value.
    clearAuthNonceCookie(response)
    if (user.onboarding_completed) setOnboardingCookie(response)
    return response
  }
  // Mobile: tokens in the body; the app keeps them in secure storage.
  const response = NextResponse.json({ accessToken, refreshToken, user: publicUser, sessionId: session.id })
  clearAuthNonceCookie(response)
  return response
}
