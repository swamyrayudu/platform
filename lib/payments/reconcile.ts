// ============================================================
// lib/payments/reconcile.ts — ask Razorpay the truth about stuck orders
// ============================================================
// SERVER ONLY.
//
// Why this exists
// ---------------
// A subscription is normally activated in one of two places:
//
//   1. /api/payments/verify — the browser reports back after checkout
//   2. /api/payments/webhook — Razorpay reports back server-to-server
//
// (1) needs the candidate's tab to survive the redirect back from their
// bank. On a phone, switching to a UPI app and back kills tabs routinely.
// (2) is the safety net — but only if the webhook URL registered at
// Razorpay is correct. If it is not, a captured payment leaves the order
// stuck at CREATED forever and the candidate has paid for nothing.
//
// This module is the third line: it stops trusting either messenger and
// asks Razorpay directly "is there money against this order?", then
// settles the order accordingly. It is safe to run repeatedly —
// activate_subscription() is idempotent and ledger-guarded, so an order
// that is already PAID is a no-op and a payment can never be redeemed
// twice.
// ============================================================

import { getPlan, isPlanId } from '@/lib/payments/plans'
import { getRazorpay, type RazorpayPaymentEntity } from '@/lib/payments/razorpay'
import { activateSubscription, markPaymentOrderFailed } from '@/lib/payments/db'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type ReconcileOutcome =
  /** Money was found at Razorpay and the subscription is now active. */
  | 'activated'
  /** Money was found, but the order was already settled. Nothing to do. */
  | 'already_paid'
  /** Razorpay has no payment at all — the candidate never paid. Correct as-is. */
  | 'no_payment'
  /** A payment exists but has not resolved yet — a UPI collect request the
   *  candidate has not approved or rejected. Ask again later; do NOT treat
   *  this as a failure, and above all do not mark the order FAILED. */
  | 'pending'
  /** Every attempt against this order was declined. Marked FAILED. */
  | 'failed'
  /** Payment exists but its amount or currency does not match the order. */
  | 'mismatch'
  /** Razorpay could not be reached for this order. */
  | 'error'

export interface ReconcileRow {
  razorpayOrderId: string
  userEmail: string | null
  planId: string
  amount: number
  createdAt: string
  outcome: ReconcileOutcome
  paymentId: string | null
  detail?: string
}

export interface ReconcileReport {
  scanned: number
  activated: number
  rows: ReconcileRow[]
}

interface UnsettledOrderRow {
  razorpay_order_id: string
  plan_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  users: { email: string | null } | null
}

/**
 * Settle every order that is not yet PAID against Razorpay's own records.
 *
 * @param sinceDays how far back to look. Razorpay orders expire, and an
 *   order nobody paid a month ago is not going to sprout a payment now.
 * @param limit a ceiling on Razorpay API calls per run — one per order.
 */
export async function reconcilePayments({
  sinceDays = 30,
  limit = 100,
}: { sinceDays?: number; limit?: number } = {}): Promise<ReconcileReport> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select(
      'razorpay_order_id, plan_id, amount, currency, status, created_at, users!payment_orders_user_id_fkey(email)'
    )
    .neq('status', 'PAID')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Reconcile] could not load unsettled orders:', error)
    throw new Error('Could not load unsettled orders')
  }

  const orders = (data ?? []) as unknown as UnsettledOrderRow[]
  const rows: ReconcileRow[] = []
  let activated = 0

  for (const order of orders) {
    const row = await reconcileOne(order)
    if (row.outcome === 'activated') activated += 1
    rows.push(row)
  }

  return { scanned: orders.length, activated, rows }
}

/**
 * Reconcile ONE order, on behalf of the candidate who owns it.
 *
 * This is the self-service half of the story. The admin sweep above is a
 * safety net somebody has to remember to pull; this runs the moment the
 * candidate reopens the site after a payment, so the common case —
 * "I paid in PhonePe, came back, and the tab was gone" — fixes itself
 * without anyone noticing there was a problem.
 *
 * The ownership check is the whole security story here: a candidate may
 * only ever ask about an order that is theirs, so this cannot be used to
 * settle somebody else's order or to probe which order ids exist.
 */
export async function reconcileOrderForUser(
  razorpayOrderId: string,
  userId: string
): Promise<ReconcileRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select(
      'razorpay_order_id, plan_id, amount, currency, status, created_at, user_id, users!payment_orders_user_id_fkey(email)'
    )
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as UnsettledOrderRow & { user_id: string }
  if (row.user_id !== userId) return null

  if (row.status === 'PAID') {
    return {
      razorpayOrderId: row.razorpay_order_id,
      userEmail: row.users?.email ?? null,
      planId: row.plan_id,
      amount: row.amount,
      createdAt: row.created_at,
      outcome: 'already_paid',
      paymentId: null,
    }
  }

  return reconcileOne(row)
}

async function reconcileOne(order: UnsettledOrderRow): Promise<ReconcileRow> {
  const base = {
    razorpayOrderId: order.razorpay_order_id,
    userEmail: order.users?.email ?? null,
    planId: order.plan_id,
    amount: order.amount,
    createdAt: order.created_at,
    paymentId: null as string | null,
  }

  let payments: RazorpayPaymentEntity[]
  try {
    const res = await getRazorpay().orders.fetchPayments(order.razorpay_order_id)
    payments = (res.items ?? []) as unknown as RazorpayPaymentEntity[]
  } catch (err) {
    console.error(`[Reconcile] ${order.razorpay_order_id}: Razorpay lookup failed:`, err)
    return { ...base, outcome: 'error', detail: 'Razorpay lookup failed' }
  }

  if (payments.length === 0) {
    return { ...base, outcome: 'no_payment' }
  }

  // A payment sitting at "created" has not resolved: that is a UPI collect
  // request waiting in somebody's PhonePe. It is neither a success nor a
  // failure, and calling it a failure here would tell a candidate their
  // payment was declined while their money is still on its way.
  const stillPending = payments.some((p) => p.status === 'created')

  const candidate =
    payments.find((p) => p.status === 'captured') ?? payments.find((p) => p.status === 'authorized')

  if (!candidate) {
    if (stillPending) {
      return { ...base, outcome: 'pending', detail: 'Awaiting approval in the UPI app' }
    }
    // Everything against this order really was declined. Record why, so the
    // admin list can show something better than a silent CREATED row.
    const last = payments[0]
    await markPaymentOrderFailed(
      order.razorpay_order_id,
      last.id,
      last.error_description ?? `status:${last.status}`
    )
    return {
      ...base,
      outcome: 'failed',
      paymentId: last.id,
      detail: last.error_description ?? last.status,
    }
  }

  // Check the amount BEFORE capturing, never after. Capturing first and
  // validating second would take money against an order we then refuse to
  // honour. This is the order verify does it in, and reconcile must match.
  if (Number(candidate.amount) !== order.amount || candidate.currency !== order.currency) {
    return {
      ...base,
      outcome: 'mismatch',
      paymentId: candidate.id,
      detail: `Razorpay says ${candidate.amount} ${candidate.currency}, order says ${order.amount} ${order.currency}`,
    }
  }

  // "authorized" is money held but not yet taken. Capture it, exactly as
  // verify would have, rather than leaving it to be auto-voided.
  const settled = candidate
  if (candidate.status === 'authorized') {
    try {
      await getRazorpay().payments.capture(candidate.id, order.amount, order.currency)
    } catch (err) {
      console.error(`[Reconcile] ${candidate.id}: capture failed:`, err)
      return { ...base, outcome: 'error', paymentId: candidate.id, detail: 'Capture failed' }
    }
  }

  if (!isPlanId(order.plan_id)) {
    return { ...base, outcome: 'mismatch', paymentId: settled.id, detail: `Unknown plan ${order.plan_id}` }
  }

  const plan = getPlan(order.plan_id)
  const result = await activateSubscription({
    razorpayOrderId: order.razorpay_order_id,
    razorpayPaymentId: settled.id,
    durationDays: plan.durationDays,
    confirmedVia: 'reconcile',
  })

  return {
    ...base,
    outcome: result.activated ? 'activated' : 'already_paid',
    paymentId: settled.id,
    detail: result.expiresAt ? `Pro until ${result.expiresAt.slice(0, 10)}` : undefined,
  }
}
