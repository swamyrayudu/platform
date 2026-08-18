// ============================================================
// app/api/auth/devices/route.ts — GET /api/auth/devices
// ============================================================

import { requireAuth } from '@/lib/auth/session'
import { getUserDevices } from '@/lib/auth/db'

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  const devices = await getUserDevices(user.id)
  return Response.json({ devices })
})
