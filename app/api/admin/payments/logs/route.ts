// ============================================================
// app/api/admin/payments/logs/route.ts — GET /api/admin/payments/logs
// ============================================================
// The payment log, built WITHOUT trusting payment_orders.status.
//
// That column is a summary somebody has to remember to write. If the
// browser dies and the webhook is misrouted, it says CREATED while the
// candidate's money sits at Razorpay — which is exactly the failure that
// is impossible to see from a list of statuses.
//
// So this endpoint reports three independent records side by side:
//
//   1. payment_activations — the ledger. One row per payment ever
//      redeemed, written inside the same transaction that grants the
//      subscription. If a row is here, that money bought something.
//   2. security_events — what the server observed and when: order
//      created, signature checked, webhook rejected, plan activated.
//   3. payment_orders.status — the summary, reported LAST and clearly
//      labelled, so it can be compared against the two above rather
//      than believed.
//
// Where they disagree, the response says so. Disagreement is the
// interesting part: a ledger entry with a non-PAID status means money
// was taken and the row never caught up.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Event types that belong to a payment's story. */
const PAYMENT_EVENTS = [
  'PAYMENT_ORDER_CREATED',
  'PAYMENT_VERIFIED',
  'PAYMENT_SIGNATURE_INVALID',
  'PAYMENT_FAILED',
  'PAYMENT_WEBHOOK_INVALID',
  'SUBSCRIPTION_ACTIVATED',
] as const

export interface PaymentLogEvent {
  at: string
  type: string
  detail: Record<string, unknown>
}

export interface PaymentLogEntry {
  razorpayOrderId: string
  userEmail: string | null
  userName: string | null
  planId: string
  amount: number
  currency: string
  createdAt: string
  /** The summary column. Reported, not trusted. */
  recordedStatus: string
  /** The ledger: present means this money was definitely redeemed. */
  ledger: { paymentId: string; activatedAt: string; durationDays: number } | null
  /** Set when the ledger and the status column tell different stories. */
  disagreement: string | null
  events: PaymentLogEvent[]
}

interface OrderRow {
  razorpay_order_id: string
  razorpay_payment_id: string | null
  plan_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  users: { email: string | null; name: string | null } | null
}

export const GET = requireAdmin(async (request) => {
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 40), 1), 100)

  const { data: orderData, error: orderError } = await supabaseAdmin
    .from('payment_orders')
    .select(
      'razorpay_order_id, razorpay_payment_id, plan_id, amount, currency, status, created_at, users!payment_orders_user_id_fkey(email, name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (orderError) {
    console.error('[PaymentLogs] orders:', orderError)
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })
  }

  const orders = (orderData ?? []) as unknown as OrderRow[]
  const orderIds = orders.map((o) => o.razorpay_order_id)

  if (orderIds.length === 0) {
    return NextResponse.json({ success: true, entries: [] })
  }

  // ---- The ledger -------------------------------------------------
  const { data: ledgerData } = await supabaseAdmin
    .from('payment_activations')
    .select('razorpay_order_id, razorpay_payment_id, activated_at, duration_days')
    .in('razorpay_order_id', orderIds)

  const ledgerByOrder = new Map<
    string,
    { paymentId: string; activatedAt: string; durationDays: number }
  >()
  for (const row of (ledgerData ?? []) as unknown as {
    razorpay_order_id: string
    razorpay_payment_id: string
    activated_at: string
    duration_days: number
  }[]) {
    ledgerByOrder.set(row.razorpay_order_id, {
      paymentId: row.razorpay_payment_id,
      activatedAt: row.activated_at,
      durationDays: row.duration_days,
    })
  }

  // ---- The observed timeline --------------------------------------
  // Fetched by type rather than by order id: PostgREST cannot filter a
  // jsonb field against a list, and these are cheap, recent rows.
  const { data: eventData } = await supabaseAdmin
    .from('security_events')
    .select('event_type, metadata, created_at')
    .in('event_type', PAYMENT_EVENTS as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(1000)

  const eventsByOrder = new Map<string, PaymentLogEvent[]>()
  // Some events cannot belong to an order: a webhook rejected for a bad
  // signature is thrown out before we ever learn which order it was about.
  // Those are the ones worth seeing on their own — a run of them means the
  // webhook secret is wrong, or someone is poking at the endpoint.
  const unattached: PaymentLogEvent[] = []

  for (const row of (eventData ?? []) as unknown as {
    event_type: string
    metadata: Record<string, unknown> | null
    created_at: string
  }[]) {
    const event = { at: row.created_at, type: row.event_type, detail: row.metadata ?? {} }
    const orderId = row.metadata?.['orderId']
    if (typeof orderId !== 'string') {
      unattached.push(event)
      continue
    }
    const list = eventsByOrder.get(orderId) ?? []
    list.push(event)
    eventsByOrder.set(orderId, list)
  }

  // ---- Merge ------------------------------------------------------
  const entries: PaymentLogEntry[] = orders.map((order) => {
    const ledger = ledgerByOrder.get(order.razorpay_order_id) ?? null
    const paid = order.status === 'PAID'

    let disagreement: string | null = null
    if (ledger && !paid) {
      disagreement = `Money was redeemed (${ledger.paymentId}) but the order still reads ${order.status}. The candidate has paid.`
    } else if (paid && !ledger) {
      disagreement = 'Marked PAID with no ledger entry. Activation did not go through the normal path.'
    }

    return {
      razorpayOrderId: order.razorpay_order_id,
      userEmail: order.users?.email ?? null,
      userName: order.users?.name ?? null,
      planId: order.plan_id,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.created_at,
      recordedStatus: order.status,
      ledger,
      disagreement,
      events: (eventsByOrder.get(order.razorpay_order_id) ?? []).sort((a, b) =>
        a.at.localeCompare(b.at)
      ),
    }
  })

  return NextResponse.json({
    success: true,
    entries,
    disagreements: entries.filter((e) => e.disagreement).length,
    unattached: unattached.slice(0, 25),
  })
})
