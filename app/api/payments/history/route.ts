// ============================================================
// app/api/payments/history/route.ts — GET /api/payments/history
// ============================================================
// Returns the caller's own payment orders (newest first) plus
// their current subscription summary.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { toPublicUser } from '@/lib/auth/types'
import { listUserPaymentOrders, toPublicPaymentOrder } from '@/lib/payments/db'

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  const orders = await listUserPaymentOrders(user.id)
  return NextResponse.json({
    user: toPublicUser(user),
    orders: orders.map(toPublicPaymentOrder),
  })
})
