// ============================================================
// app/api/admin/dashboard/route.ts — GET /api/admin/dashboard
// ============================================================
// Admin-only API endpoint. Protected by requireAdmin middleware.
// Normal users receive 403 ADMIN_REQUIRED.
// ============================================================

import { requireAdmin } from '@/lib/auth/session'
import { toPublicUser } from '@/lib/auth/types'

export const GET = requireAdmin(async (_request, _ctx, { user }) => {
  return Response.json({
    message: 'Welcome to the admin dashboard',
    admin: toPublicUser(user),
    timestamp: new Date().toISOString(),
  })
})
