// ============================================================
// app/api/auth/logout-all/route.ts — POST /api/auth/logout-all
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { revokeAllUserSessions, logSecurityEvent } from '@/lib/auth/db'
import { clearAuthCookies } from '@/lib/auth/cookies'
import { getHashedIp } from '@/lib/auth/ip'
import { handleAuthError } from '@/lib/auth/errors'

export const POST = requireAuth(async (request, _ctx, { user, session }) => {
  try {
    const ipHash = getHashedIp(request)

    // Revoke ALL active sessions for this user
    await revokeAllUserSessions(user.id, 'LOGOUT_ALL')

    // Log event
    await logSecurityEvent({
      userId: user.id,
      eventType: 'LOGOUT_ALL',
      deviceId: session.device_id,
      ipHash,
    })

    // Clear current device's cookies
    const response = NextResponse.json({ success: true })
    clearAuthCookies(response)
    return response
  } catch (err) {
    return handleAuthError(err)
  }
})
