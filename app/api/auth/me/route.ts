// ============================================================
// app/api/auth/me/route.ts — GET /api/auth/me
// ============================================================

import { requireAuth } from '@/lib/auth/session'
import { toPublicUser } from '@/lib/auth/types'

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  return Response.json(toPublicUser(user))
})
