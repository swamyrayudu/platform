// ============================================================
// lib/payments/db.ts — Payment order persistence (SERVER ONLY)
// ============================================================
// All access goes through the Supabase admin client.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuthError } from '@/lib/auth/errors'
import type { PlanId } from './plans'

export type PaymentOrderStatus = 'CREATED' | 'PAID' | 'FAILED'

export interface DbPaymentOrder {
  id: string
  user_id: string
  plan_id: PlanId
  amount: number
  currency: string
  coupon_code: string | null
  discount_percent: number
  razorpay_order_id: string
  razorpay_payment_id: string | null
  status: PaymentOrderStatus
  failure_reason: string | null
  confirmed_via: 'checkout' | 'webhook' | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

/** Shape returned to the browser — no internal ids beyond what checkout needs. */
export interface PublicPaymentOrder {
  id: string
  planId: PlanId
  amount: number
  currency: string
  couponCode: string | null
  discountPercent: number
  razorpayOrderId: string
  razorpayPaymentId: string | null
  status: PaymentOrderStatus
  paidAt: string | null
  createdAt: string
}

export function toPublicPaymentOrder(order: DbPaymentOrder): PublicPaymentOrder {
  return {
    id: order.id,
    planId: order.plan_id,
    amount: order.amount,
    currency: order.currency,
    couponCode: order.coupon_code,
    discountPercent: order.discount_percent,
    razorpayOrderId: order.razorpay_order_id,
    razorpayPaymentId: order.razorpay_payment_id,
    status: order.status,
    paidAt: order.paid_at,
    createdAt: order.created_at,
  }
}

// ---- Create ----------------------------------------------------

export async function createPaymentOrder(input: {
  userId: string
  planId: PlanId
  amount: number
  currency: string
  couponCode: string | null
  discountPercent: number
  razorpayOrderId: string
}): Promise<DbPaymentOrder> {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .insert({
      user_id: input.userId,
      plan_id: input.planId,
      amount: input.amount,
      currency: input.currency,
      coupon_code: input.couponCode,
      discount_percent: input.discountPercent,
      razorpay_order_id: input.razorpayOrderId,
      status: 'CREATED',
    })
    .select('*')
    .single()

  if (error) {
    console.error('[Payments DB] createPaymentOrder error:', error)
    throw new AuthError('INTERNAL_ERROR', 500, 'Failed to record payment order')
  }
  return data as DbPaymentOrder
}

// ---- Read ------------------------------------------------------

export async function getPaymentOrderByRazorpayId(
  razorpayOrderId: string
): Promise<DbPaymentOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle()

  if (error) {
    console.error('[Payments DB] getPaymentOrderByRazorpayId error:', error)
    return null
  }
  return data as DbPaymentOrder | null
}

export async function listUserPaymentOrders(
  userId: string,
  limit = 20
): Promise<DbPaymentOrder[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Payments DB] listUserPaymentOrders error:', error)
    return []
  }
  return (data ?? []) as DbPaymentOrder[]
}

// ---- Activate --------------------------------------------------

export interface ActivationResult {
  /** false when the order had already been processed (idempotent replay) */
  activated: boolean
  userId: string
  expiresAt: string | null
}

/**
 * Mark the order PAID and extend the user's subscription atomically.
 * Backed by the activate_subscription() SQL function (migration 016).
 * Safe to call from both the checkout callback and the webhook.
 */
export async function activateSubscription(input: {
  razorpayOrderId: string
  razorpayPaymentId: string
  durationDays: number
  confirmedVia: 'checkout' | 'webhook'
}): Promise<ActivationResult> {
  const { data, error } = await supabaseAdmin.rpc('activate_subscription', {
    p_razorpay_order_id: input.razorpayOrderId,
    p_razorpay_payment_id: input.razorpayPaymentId,
    p_duration_days: input.durationDays,
    p_confirmed_via: input.confirmedVia,
  })

  if (error) {
    console.error('[Payments DB] activateSubscription error:', error)
    throw new AuthError('INTERNAL_ERROR', 500, 'Failed to activate subscription')
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { activated: boolean; user_id: string; expires_at: string | null }
    | undefined

  if (!row) {
    throw new AuthError('INTERNAL_ERROR', 500, 'Activation returned no result')
  }

  return { activated: row.activated, userId: row.user_id, expiresAt: row.expires_at }
}

// ---- Fail ------------------------------------------------------

/** Record a failed payment attempt. Never downgrades a PAID order. */
export async function markPaymentOrderFailed(
  razorpayOrderId: string,
  razorpayPaymentId: string | null,
  reason: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('payment_orders')
    .update({
      status: 'FAILED',
      razorpay_payment_id: razorpayPaymentId,
      failure_reason: reason,
    })
    .eq('razorpay_order_id', razorpayOrderId)
    .neq('status', 'PAID')

  if (error) {
    console.error('[Payments DB] markPaymentOrderFailed error:', error)
  }
}
