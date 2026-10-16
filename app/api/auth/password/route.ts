// ============================================================
// app/api/auth/password/route.ts — POST /api/auth/password
// ============================================================
// Email + password sign-in for accounts an admin created
// (lib/auth/password-accounts.ts); there is no sign-up. When the admin has
// switched email sign-in off, every attempt is refused.
// GET answers { enabled } so the web and the app know whether to offer it.
// 1. Rate limit per IP and per email
// 2. Find the account and check the password (a wrong email takes as long
//    as a wrong password, and both get the same answer)
// 3. lib/auth/issue-session.ts: session, tokens, web cookies | app JSON
// ============================================================

import { after } from 'next/server'
import { getHashedIp } from '@/lib/auth/ip'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { handleAuthError, errorResponse } from '@/lib/auth/errors'
import { issueSession } from '@/lib/auth/issue-session'
import { findPasswordLogin, isEmail, normalizeEmail } from '@/lib/auth/password-accounts'
import { dummyHash, verifyPassword, PASSWORD_MAX_LENGTH } from '@/lib/auth/password'
import { logSecurityEvent } from '@/lib/auth/db'
import { isEmailLoginEnabled } from '@/lib/auth/email-login-setting'
import type { Platform, DeviceInfo } from '@/lib/auth/types'

const ALLOWED_PLATFORMS: Platform[] = ['WEB', 'ANDROID', 'IOS']

/** Whether to show "Continue with Email" (web and app). */
export async function GET(): Promise<Response> {
  return Response.json({ enabled: await isEmailLoginEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { email, password, deviceId, platform, userAgent } = body as Record<string, unknown>

    if (typeof email !== 'string' || !isEmail(normalizeEmail(email))) {
      return Response.json({ error: 'INVALID_EMAIL', message: 'Enter a valid email address.' }, { status: 400 })
    }
    if (typeof password !== 'string' || !password || password.length > PASSWORD_MAX_LENGTH) {
      return Response.json({ error: 'INVALID_PASSWORD', message: 'Enter your password.' }, { status: 400 })
    }
    if (typeof deviceId !== 'string' || !deviceId) {
      return Response.json({ error: 'deviceId is required' }, { status: 400 })
    }
    if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
      return Response.json({ error: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}` }, { status: 400 })
    }

    if (!(await isEmailLoginEnabled())) {
      return Response.json({ error: 'EMAIL_LOGIN_DISABLED', message: 'Email sign-in is turned off. Please continue with Google.' }, { status: 403 })
    }

    const ipHash = getHashedIp(request)
    const address = normalizeEmail(email)
    for (const key of [`auth:password:ip:${ipHash}`, `auth:password:email:${address}`]) {
      const limit = await checkRateLimit(key, 'password')
      if (!limit.allowed) return Response.json({ error: 'RATE_LIMITED', retryAfter: limit.retryAfter }, { status: 429 })
    }

    const login = await findPasswordLogin(address)
    const ok = await verifyPassword(password, login?.hash ?? (await dummyHash()))
    if (!login || !ok) {
      if (login) {
        const userId = login.user.id
        after(() => logSecurityEvent({ userId, eventType: 'PASSWORD_LOGIN_FAILED', deviceId, ipHash, metadata: { platform } }))
      }
      return errorResponse('INVALID_CREDENTIALS', 401, { message: 'Wrong email or password.' })
    }

    const deviceInfo: DeviceInfo = {
      deviceId,
      platform: platform as Platform,
      userAgent: typeof userAgent === 'string' ? userAgent : (request.headers.get('user-agent') ?? 'unknown'),
    }
    return await issueSession(login.user, deviceInfo, ipHash, { eventType: 'PASSWORD_LOGIN' })
  } catch (err) {
    return handleAuthError(err)
  }
}
