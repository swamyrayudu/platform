// ============================================================
// app/api/auth/devices/route.ts — GET /api/auth/devices
// ============================================================

import { requireAuth } from '@/lib/auth/session'
import { getUserDevices } from '@/lib/auth/db'

export const GET = requireAuth(async (_request, _ctx, { user, session }) => {
  const devices = await getUserDevices(user.id)

  // The caller cannot reliably identify itself: its localStorage device id can
  // drift from the session it is actually authenticated with. The session on
  // this request is the authority, so name the current device here.
  return Response.json({ devices, currentDeviceId: session.device_id })
})
