// ============================================================
// lib/payments/google-play/config.ts — Play Billing env (SERVER ONLY)
// ============================================================
// Env vars (see .env.example, section 7):
//   GOOGLE_PLAY_PACKAGE_NAME              com.rsdeducation.student
//   GOOGLE_PLAY_SUBSCRIPTION_ID           rsd_pro
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON      service-account key JSON (raw or base64)
//   GOOGLE_PLAY_RTDN_AUDIENCE             audience set on the Pub/Sub push subscription
//   GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT      email of the push subscription's service account
// ============================================================

import { DEFAULT_PLAY_SUBSCRIPTION_ID } from './catalog'

export const DEFAULT_PLAY_PACKAGE_NAME = 'com.rsdeducation.student'

export function getPlayPackageName(): string {
  return process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || DEFAULT_PLAY_PACKAGE_NAME
}

export function getPlaySubscriptionId(): string {
  return process.env.GOOGLE_PLAY_SUBSCRIPTION_ID?.trim() || DEFAULT_PLAY_SUBSCRIPTION_ID
}

export interface ServiceAccountKey {
  client_email: string
  private_key: string
}

let cachedKey: ServiceAccountKey | null | undefined

/** Parse the service-account key once. Accepts raw JSON or base64-encoded JSON. */
export function getPlayServiceAccount(): ServiceAccountKey | null {
  if (cachedKey !== undefined) return cachedKey
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return (cachedKey = null)
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const parsed = JSON.parse(text) as Partial<ServiceAccountKey>
    if (!parsed.client_email || !parsed.private_key) throw new Error('missing client_email/private_key')
    cachedKey = {
      client_email: parsed.client_email,
      // Env editors often store the PEM with literal "\n"
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    }
  } catch (err) {
    console.error('[Google Play] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not a valid service-account key:', (err as Error).message)
    cachedKey = null
  }
  return cachedKey
}

export function isPlayBillingConfigured(): boolean {
  return getPlayServiceAccount() !== null
}

export function getRtdnAuthConfig(): { audience: string; serviceAccount: string } | null {
  const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE?.trim()
  const serviceAccount = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT?.trim()
  if (!audience || !serviceAccount) return null
  return { audience, serviceAccount }
}
