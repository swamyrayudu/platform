// ============================================================
// lib/payments/google-play/rtdn.ts — Real-time developer notifications
// ============================================================
// Google Play → Cloud Pub/Sub topic → PUSH subscription → our endpoint.
//
// Authentication: the push subscription must have "Enable authentication"
// on, with a service account. Pub/Sub then sends
//   Authorization: Bearer <Google-signed OIDC JWT>
// which is verified here (signature, audience, issuer, service-account email).
// An unauthenticated push endpoint would let anyone trigger re-syncs; it
// still could not mint access (state is always re-read from Google), but
// it is rejected anyway.
// ============================================================

import { OAuth2Client } from 'google-auth-library'
import { getRtdnAuthConfig } from './config'

// ---- Notification shapes (DeveloperNotification) --------------------

/** subscriptionNotification.notificationType */
export const SUBSCRIPTION_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  17: 'SUBSCRIPTION_ITEMS_CHANGED',
  18: 'SUBSCRIPTION_CANCELLATION_SCHEDULED',
  19: 'SUBSCRIPTION_PRICE_CHANGE_UPDATED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
  22: 'SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED',
}

export const SUBSCRIPTION_REVOKED = 12

export interface DeveloperNotification {
  version?: string
  packageName?: string
  eventTimeMillis?: string
  subscriptionNotification?: { version?: string; notificationType?: number; purchaseToken?: string }
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string; productType?: number; refundType?: number }
  oneTimeProductNotification?: { purchaseToken?: string; notificationType?: number; sku?: string }
  testNotification?: { version?: string }
}

export type ParsedNotification =
  | { kind: 'subscription'; purchaseToken: string; notificationType: number; eventTime: string | null }
  /** productType 1 = subscription, 2 = one-time product */
  | { kind: 'voided'; purchaseToken: string; productType: number | null; refundType: number | null; orderId: string | null; eventTime: string | null }
  | { kind: 'test'; eventTime: string | null }
  | { kind: 'one_time'; purchaseToken: string | null; eventTime: string | null }
  | { kind: 'unknown'; eventTime: string | null }

export interface PushEnvelope {
  message?: { data?: string; messageId?: string; message_id?: string; publishTime?: string; attributes?: Record<string, string> }
  subscription?: string
}

/** Decode the Pub/Sub push body. Returns null when it is not a Pub/Sub message. */
export function decodePushEnvelope(body: unknown): { messageId: string; notification: DeveloperNotification } | null {
  const env = body as PushEnvelope
  const messageId = env?.message?.messageId ?? env?.message?.message_id
  const data = env?.message?.data
  if (typeof messageId !== 'string' || !messageId || typeof data !== 'string' || data.length > 64_000) return null
  try {
    const notification = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as DeveloperNotification
    if (!notification || typeof notification !== 'object') return null
    return { messageId, notification }
  } catch {
    return null
  }
}

function eventTime(n: DeveloperNotification): string | null {
  const ms = Number(n.eventTimeMillis)
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null
}

export function parseNotification(n: DeveloperNotification): ParsedNotification {
  const time = eventTime(n)
  const s = n.subscriptionNotification
  if (s && typeof s.purchaseToken === 'string' && typeof s.notificationType === 'number') {
    return { kind: 'subscription', purchaseToken: s.purchaseToken, notificationType: s.notificationType, eventTime: time }
  }
  const v = n.voidedPurchaseNotification
  if (v && typeof v.purchaseToken === 'string') {
    return {
      kind: 'voided',
      purchaseToken: v.purchaseToken,
      productType: typeof v.productType === 'number' ? v.productType : null,
      refundType: typeof v.refundType === 'number' ? v.refundType : null,
      orderId: typeof v.orderId === 'string' ? v.orderId : null,
      eventTime: time,
    }
  }
  if (n.testNotification) return { kind: 'test', eventTime: time }
  if (n.oneTimeProductNotification) {
    return { kind: 'one_time', purchaseToken: n.oneTimeProductNotification.purchaseToken ?? null, eventTime: time }
  }
  return { kind: 'unknown', eventTime: time }
}

// ---- Push authentication -------------------------------------------

const oidc = new OAuth2Client()

export type PushAuthResult = { ok: true } | { ok: false; reason: 'NOT_CONFIGURED' | 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'WRONG_ACCOUNT' }

export async function verifyPushAuth(authorization: string | null): Promise<PushAuthResult> {
  const config = getRtdnAuthConfig()
  if (!config) return { ok: false, reason: 'NOT_CONFIGURED' }
  if (!authorization?.startsWith('Bearer ')) return { ok: false, reason: 'MISSING_TOKEN' }

  try {
    const ticket = await oidc.verifyIdToken({ idToken: authorization.slice(7).trim(), audience: config.audience })
    const payload = ticket.getPayload()
    const issuerOk = payload?.iss === 'https://accounts.google.com' || payload?.iss === 'accounts.google.com'
    if (!payload || !issuerOk) return { ok: false, reason: 'INVALID_TOKEN' }
    if (payload.email !== config.serviceAccount || payload.email_verified !== true) {
      return { ok: false, reason: 'WRONG_ACCOUNT' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'INVALID_TOKEN' }
  }
}
