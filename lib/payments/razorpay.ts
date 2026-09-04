// ============================================================
// lib/payments/razorpay.ts — Razorpay SDK + signature checks
// ============================================================
// SERVER ONLY. Never import from client components.
//
// Env vars:
//   RAZORPAY_KEY_ID          public key id (also returned to the browser)
//   RAZORPAY_KEY_SECRET      secret — signs orders, verifies checkout
//   RAZORPAY_WEBHOOK_SECRET  secret configured on the Razorpay webhook
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto'
import Razorpay from 'razorpay'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example)`)
  }
  return value
}

export function getRazorpayKeyId(): string {
  return requireEnv('RAZORPAY_KEY_ID')
}

let client: Razorpay | null = null

/** Lazily construct the SDK so the app boots even if payments are unconfigured. */
export function getRazorpay(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: requireEnv('RAZORPAY_KEY_ID'),
      key_secret: requireEnv('RAZORPAY_KEY_SECRET'),
    })
  }
  return client
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// ---- Signature verification ------------------------------------

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Verify the signature Razorpay Checkout hands back to the browser.
 * expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = createHmac('sha256', requireEnv('RAZORPAY_KEY_SECRET'))
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeEqualHex(expected, signature)
}

/**
 * Verify the X-Razorpay-Signature header on a webhook.
 * expected = HMAC_SHA256(raw_body, webhook_secret)
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', requireEnv('RAZORPAY_WEBHOOK_SECRET'))
    .update(rawBody)
    .digest('hex')
  return safeEqualHex(expected, signature)
}

// ---- Minimal shapes for the parts of the API we read -------------

export interface RazorpayPaymentEntity {
  id: string
  order_id: string | null
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  method?: string
  email?: string
  contact?: string
  error_description?: string | null
  error_reason?: string | null
}

/** Fetch a payment from Razorpay to confirm status/amount server-side. */
export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
  const payment = await getRazorpay().payments.fetch(paymentId)
  return payment as unknown as RazorpayPaymentEntity
}
