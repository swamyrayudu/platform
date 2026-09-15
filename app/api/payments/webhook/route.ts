// ============================================================
// app/api/payments/webhook/route.ts — POST /api/payments/webhook
// ============================================================
// Razorpay → server notifications. No user session here; the
// request is authenticated purely by the X-Razorpay-Signature
// HMAC over the RAW body using RAZORPAY_WEBHOOK_SECRET.
//
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<your-domain>/api/payments/webhook
//   Secret: the value of RAZORPAY_WEBHOOK_SECRET
//   Events: payment.captured, payment.failed, order.paid
//
// Activation is idempotent, so this can safely fire before or
// after /api/payments/verify, and Razorpay's retries are harmless.
// ============================================================

import { NextResponse } from 'next/server'
import { logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { getPlan } from '@/lib/payments/plans'
import { verifyWebhookSignature, type RazorpayPaymentEntity } from '@/lib/payments/razorpay'
import { activateSubscription, getPaymentOrderByRazorpayId, markPaymentOrderFailed } from '@/lib/payments/db'

interface WebhookBody {
  event?: string
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity }
    order?: { entity?: { id?: string } }
  }
}

export async function POST(request: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('[Payments Webhook] RAZORPAY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  }

  // Raw body is required — any re-serialisation would break the HMAC
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    await logSecurityEvent({
      eventType: 'PAYMENT_WEBHOOK_INVALID',
      ipHash: getHashedIp(request),
      metadata: { reason: signature ? 'HMAC_MISMATCH' : 'MISSING_SIGNATURE' },
    })
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  let body: WebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const event = body.event ?? ''
  const payment = body.payload?.payment?.entity

  try {
    switch (event) {
      case 'payment.captured':
      case 'order.paid': {
        const orderId = payment?.order_id ?? body.payload?.order?.entity?.id
        if (!orderId || !payment?.id) break

        const order = await getPaymentOrderByRazorpayId(orderId)
        // Not one of ours (or another environment's order) — acknowledge and ignore
        if (!order) break
        if (order.status === 'PAID') break

        const amountMatches =
          Number(payment.amount) === order.amount && payment.currency === order.currency
        if (!amountMatches) {
          await logSecurityEvent({
            userId: order.user_id,
            eventType: 'PAYMENT_WEBHOOK_INVALID',
            metadata: {
              reason: 'AMOUNT_MISMATCH',
              orderId,
              expectedAmount: order.amount,
              actualAmount: payment.amount,
            },
          })
          break
        }

        const plan = getPlan(order.plan_id)
        const result = await activateSubscription({
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          durationDays: plan.durationDays,
          confirmedVia: 'webhook',
        })

        if (result.activated) {
          await logSecurityEvent({
            userId: order.user_id,
            eventType: 'SUBSCRIPTION_ACTIVATED',
            metadata: {
              planId: plan.id,
              expiresAt: result.expiresAt,
              via: 'webhook',
              event,
              orderId: payment.order_id,
              paymentId: payment.id,
            },
          })
        }
        break
      }

      case 'payment.failed': {
        if (!payment?.order_id) break
        const order = await getPaymentOrderByRazorpayId(payment.order_id)
        if (!order || order.status === 'PAID') break

        await markPaymentOrderFailed(
          payment.order_id,
          payment.id ?? null,
          payment.error_description ?? payment.error_reason ?? 'payment.failed'
        )
        await logSecurityEvent({
          userId: order.user_id,
          eventType: 'PAYMENT_FAILED',
          metadata: { orderId: payment.order_id, paymentId: payment.id, reason: payment.error_reason ?? null },
        })
        break
      }

      default:
        // Unhandled event types are acknowledged so Razorpay stops retrying
        break
    }
  } catch (err) {
    // Return 500 so Razorpay retries — activation is idempotent
    console.error('[Payments Webhook] handler error:', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
