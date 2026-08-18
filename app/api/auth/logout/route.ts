// ============================================================
// app/api/auth/logout/route.ts — POST /api/auth/logout
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { revokeSession, logSecurityEvent } from '@/lib/auth/db'
import { clearAuthCookies } from '@/lib/auth/cookies'
import { getHashedIp } from '@/lib/auth/ip'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { handleAuthError } from '@/lib/auth/errors'

export const POST = async (request: Request): Promise<Response> => {
  try {
    // Rate limit
    const ipHash = getHashedIp(request)
    const rateResult = await checkRateLimit(`auth:logout:${ipHash}`, 'logout')
    if (!rateResult.allowed) {
      return Response.json(
        { error: 'RATE_LIMITED', retryAfter: rateResult.retryAfter },
        { status: 429 }
      )
    }

    return await requireAuth(async (_req, _ctx, { user, session }) => {
      // Revoke current session
      await revokeSession(session.id, 'MANUAL_LOGOUT')

      // Log event
      await logSecurityEvent({
        userId: user.id,
        eventType: 'MANUAL_LOGOUT',
        deviceId: session.device_id,
        ipHash,
      })

      // Clear cookies for web clients
      const response = NextResponse.json({ success: true })
      clearAuthCookies(response)
      return response
    })(request, { params: Promise.resolve({}) })
  } catch (err) {
    return handleAuthError(err)
  }
}
