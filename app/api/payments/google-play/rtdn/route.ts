// ============================================================
// POST /api/payments/google-play/rtdn — Google Play RTDN (Pub/Sub push)
// ============================================================
// Handles renewals, cancellations, grace period, on hold, pause, expiry,
// revocations and refunds (voided purchases).
//
// Setup (docs/GOOGLE_PLAY_BILLING.md):
//   Pub/Sub topic  → Play Console → Monetization setup → Real-time notifications
//   Push subscription endpoint: https://<domain>/api/payments/google-play/rtdn
//     with authentication: service account = GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT,
//     audience = GOOGLE_PLAY_RTDN_AUDIENCE
//
// Response codes drive Pub/Sub retries:
//   2xx → message is done (processed, ignored, duplicate, or not ours)
//   5xx → Pub/Sub redelivers with backoff (Google / DB temporarily failed)
// Every notification re-reads the token from Google, so duplicates and
// out-of-order delivery are harmless.
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { getPlayPackageName } from '@/lib/payments/google-play/config'
import {
  SUBSCRIPTION_NOTIFICATION_TYPES,
  SUBSCRIPTION_REVOKED,
  decodePushEnvelope,
  parseNotification,
  verifyPushAuth,
  type ParsedNotification,
} from '@/lib/payments/google-play/rtdn'
import { syncPlayPurchase, type SyncOutcome } from '@/lib/payments/google-play/sync'

type EventStatus = 'processed' | 'ignored' | 'unclaimed' | 'failed'
const DONE: ReadonlySet<string> = new Set(['processed', 'ignored', 'unclaimed'])

async function recordEvent(messageId: string, parsed: ParsedNotification, payload: unknown): Promise<'new' | 'done' | 'retry'> {
  const purchaseToken = 'purchaseToken' in parsed ? parsed.purchaseToken : null
  const { error } = await supabaseAdmin.from('play_rtdn_events').insert({
    message_id: messageId,
    kind: parsed.kind,
    notification_type: parsed.kind === 'subscription' ? parsed.notificationType : null,
    purchase_token: purchaseToken,
    event_time: parsed.eventTime,
    payload,
  })
  if (!error) return 'new'
  if (error.code !== '23505') throw new Error(`play_rtdn_events insert failed: ${error.message}`)

  // Duplicate delivery: finish only if the earlier attempt did not.
  const { data } = await supabaseAdmin.from('play_rtdn_events').select('status').eq('message_id', messageId).maybeSingle()
  return data && DONE.has(data.status as string) ? 'done' : 'retry'
}

async function finishEvent(messageId: string, status: EventStatus, error: string | null = null): Promise<void> {
  await supabaseAdmin
    .from('play_rtdn_events')
    .update({ status, error, processed_at: new Date().toISOString() })
    .eq('message_id', messageId)
}

function statusFor(outcome: SyncOutcome): { status: EventStatus; error: string | null } {
  if (outcome.status === 'synced') return { status: 'processed', error: null }
  if (outcome.status === 'unclaimed') return { status: 'unclaimed', error: null }
  // Rejected tokens (not ours / unknown product) will never succeed: stop retries.
  return { status: 'ignored', error: outcome.reason }
}

export async function POST(request: Request) {
  const auth = await verifyPushAuth(request.headers.get('authorization'))
  if (!auth.ok) {
    if (auth.reason === 'NOT_CONFIGURED') {
      console.error('[Play RTDN] GOOGLE_PLAY_RTDN_AUDIENCE / GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT are not set')
      return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
    }
    await logSecurityEvent({ eventType: 'PLAY_RTDN_INVALID', ipHash: getHashedIp(request), metadata: { reason: auth.reason } })
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const decoded = decodePushEnvelope(body)
  // Malformed messages will never parse: acknowledge so Pub/Sub stops retrying.
  if (!decoded) return NextResponse.json({ received: true, ignored: 'MALFORMED' })

  const { messageId, notification } = decoded
  if (notification.packageName !== getPlayPackageName()) {
    return NextResponse.json({ received: true, ignored: 'OTHER_PACKAGE' })
  }

  const parsed = parseNotification(notification)

  try {
    const record = await recordEvent(messageId, parsed, notification)
    if (record === 'done') return NextResponse.json({ received: true, duplicate: true })

    let result: { status: EventStatus; error: string | null }
    switch (parsed.kind) {
      case 'subscription': {
        const revoked = parsed.notificationType === SUBSCRIPTION_REVOKED
        const outcome = await syncPlayPurchase({
          purchaseToken: parsed.purchaseToken,
          via: 'rtdn',
          claimantUserId: null,
          revoked,
          revocationReason: revoked ? 'SUBSCRIPTION_REVOKED' : undefined,
        })
        result = statusFor(outcome)
        console.info('[Play RTDN]', SUBSCRIPTION_NOTIFICATION_TYPES[parsed.notificationType] ?? parsed.notificationType, result.status)
        break
      }
      case 'voided': {
        // productType 1 = subscription. One-time products are not sold.
        if (parsed.productType !== null && parsed.productType !== 1) {
          result = { status: 'ignored', error: 'NOT_A_SUBSCRIPTION' }
          break
        }
        const outcome = await syncPlayPurchase({
          purchaseToken: parsed.purchaseToken,
          via: 'rtdn',
          claimantUserId: null,
          // The voided event (with its order id) is already recorded above;
          // sync revokes access if that order is the one currently paying.
          revocationReason: parsed.refundType === 2 ? 'VOIDED_PARTIAL_REFUND' : 'VOIDED_REFUND',
        })
        // The voided event is already recorded, so even an unclaimed or
        // unreadable token stays revoked when an account claims it later.
        result = outcome.status === 'rejected' ? { status: 'processed', error: outcome.reason } : statusFor(outcome)
        break
      }
      case 'test':
        console.info('[Play RTDN] test notification received')
        result = { status: 'processed', error: null }
        break
      default:
        result = { status: 'ignored', error: parsed.kind }
    }

    await finishEvent(messageId, result.status, result.error)
    return NextResponse.json({ received: true, status: result.status })
  } catch (err) {
    console.error('[Play RTDN] handler error:', (err as Error).message)
    await finishEvent(messageId, 'failed', (err as Error).message.slice(0, 500)).catch(() => {})
    // 500 → Pub/Sub retries. Sync is idempotent.
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
