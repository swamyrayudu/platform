// ============================================================
// app/api/admin/payments/reconcile/route.ts
// POST /api/admin/payments/reconcile
// ============================================================
// Settles every unpaid order against Razorpay's own records and
// activates anyone who actually paid. See lib/payments/reconcile.ts
// for why this is needed at all.
//
// Safe to run as often as you like: activation is idempotent and a
// payment can only ever be redeemed once.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { isRazorpayConfigured } from '@/lib/payments/razorpay'
import { reconcilePayments } from '@/lib/payments/reconcile'

export const POST = requireAdmin(async (request, _ctx, { user, session }) => {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: 'PAYMENTS_UNAVAILABLE' }, { status: 503 })
  }

  let sinceDays = 30
  try {
    const body = await request.json()
    if (typeof body?.sinceDays === 'number' && body.sinceDays >= 1 && body.sinceDays <= 365) {
      sinceDays = Math.floor(body.sinceDays)
    }
  } catch {
    // No body is fine — use the default window.
  }

  let report
  try {
    report = await reconcilePayments({ sinceDays })
  } catch (err) {
    console.error('[Reconcile] run failed:', err)
    return NextResponse.json({ error: 'RECONCILE_FAILED' }, { status: 500 })
  }

  await logSecurityEvent({
    userId: user.id,
    eventType: 'PAYMENT_RECONCILE_RUN',
    deviceId: session.device_id,
    ipHash: getHashedIp(request),
    metadata: {
      sinceDays,
      scanned: report.scanned,
      activated: report.activated,
      // Only the orders that changed are worth keeping in the audit log.
      changed: report.rows
        .filter((r) => r.outcome === 'activated' || r.outcome === 'failed')
        .map((r) => ({ order: r.razorpayOrderId, outcome: r.outcome, payment: r.paymentId })),
    },
  })

  return NextResponse.json({ success: true, ...report })
})
