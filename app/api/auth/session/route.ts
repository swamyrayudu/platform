// ============================================================
// app/api/auth/session/route.ts — GET /api/auth/session
// ============================================================

import { requireAuth } from '@/lib/auth/session'
import { toPublicSession } from '@/lib/auth/types'

export const GET = requireAuth(async (_request, _ctx, { session }) => {
  return Response.json(toPublicSession(session))
})
