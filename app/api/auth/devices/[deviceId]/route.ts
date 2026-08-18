// ============================================================
// app/api/auth/devices/[deviceId]/route.ts
// DELETE /api/auth/devices/:deviceId
// ============================================================
// Revoke the active session for a specific device.
// Does NOT delete device history.
// ============================================================

import { requireAuth } from '@/lib/auth/session'
import { findActiveSessionByDevice, revokeSession, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { handleAuthError, AuthError } from '@/lib/auth/errors'

export const DELETE = requireAuth(async (request, context, { user }) => {
  try {
    const { deviceId } = await context.params as { deviceId: string }

    if (!deviceId) {
      return Response.json({ error: 'deviceId is required' }, { status: 400 })
    }

    const ipHash = getHashedIp(request)

    // Find the active session for this device
    const session = await findActiveSessionByDevice(user.id, deviceId)
    if (!session) {
      return Response.json({ error: 'DEVICE_NOT_FOUND' }, { status: 404 })
    }

    // Revoke it
    await revokeSession(session.id, 'DEVICE_REVOKED')

    // Log security event
    await logSecurityEvent({
      userId: user.id,
      eventType: 'DEVICE_REVOKED',
      deviceId,
      ipHash,
    })

    return Response.json({ success: true })
  } catch (err) {
    return handleAuthError(err)
  }
})
