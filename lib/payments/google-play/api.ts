// ============================================================
// lib/payments/google-play/api.ts — Google Play Developer API (SERVER ONLY)
// ============================================================
// The ONLY source of truth for a Play purchase. Nothing the app sends
// (price, plan, expiry, state) is trusted: the server reads it here.
//
// Auth: a service account with the androidpublisher scope. In Play
// Console → Users and permissions, invite its email with
// "View financial data" + "Manage orders and subscriptions".
// ============================================================

import { JWT } from 'google-auth-library'
import { getPlayPackageName, getPlayServiceAccount } from './config'

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'

// ---- Response shape (subset of SubscriptionPurchaseV2 we read) ----

export type SubscriptionState =
  | 'SUBSCRIPTION_STATE_UNSPECIFIED'
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'

export interface SubscriptionLineItem {
  productId: string
  expiryTime?: string
  autoRenewingPlan?: { autoRenewEnabled?: boolean }
  prepaidPlan?: Record<string, unknown>
  offerDetails?: { basePlanId?: string; offerId?: string; offerTags?: string[] }
  latestSuccessfulOrderId?: string
}

export interface SubscriptionPurchaseV2 {
  kind?: string
  regionCode?: string
  startTime?: string
  subscriptionState?: SubscriptionState
  latestOrderId?: string
  linkedPurchaseToken?: string
  acknowledgementState?: 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED' | 'ACKNOWLEDGEMENT_STATE_PENDING' | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string; obfuscatedExternalProfileId?: string }
  testPurchase?: Record<string, unknown>
  canceledStateContext?: Record<string, unknown>
  lineItems?: SubscriptionLineItem[]
}

// ---- Errors -------------------------------------------------------

export class PlayApiError extends Error {
  constructor(
    /** 'NOT_FOUND' = Google does not know this token (invalid / other app / deleted) */
    public readonly kind: 'NOT_CONFIGURED' | 'NOT_FOUND' | 'UPSTREAM',
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'PlayApiError'
  }
}

function httpStatus(err: unknown): number | undefined {
  const e = err as { status?: number; response?: { status?: number } }
  return e?.response?.status ?? (typeof e?.status === 'number' ? e.status : undefined)
}

// ---- Client -------------------------------------------------------

let jwt: JWT | null = null

function client(): JWT {
  if (jwt) return jwt
  const key = getPlayServiceAccount()
  if (!key) throw new PlayApiError('NOT_CONFIGURED', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set')
  jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: [SCOPE] })
  return jwt
}

async function call<T>(method: 'GET' | 'POST', url: string, data?: unknown): Promise<T> {
  try {
    const res = await client().request<T>({ method, url, data, timeout: 10_000, retry: true })
    return res.data
  } catch (err) {
    if (err instanceof PlayApiError) throw err
    const status = httpStatus(err)
    // 400 "Invalid Value" and 404/410 all mean: this is not a real token for this app.
    if (status === 400 || status === 404 || status === 410) {
      throw new PlayApiError('NOT_FOUND', 'Purchase token not recognised by Google Play', status)
    }
    console.error('[Google Play] API call failed:', status, (err as Error).message)
    throw new PlayApiError('UPSTREAM', 'Google Play API request failed', status)
  }
}

/** purchases.subscriptionsv2.get — current state of a subscription purchase token. */
export function getSubscriptionV2(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
  const pkg = encodeURIComponent(getPlayPackageName())
  return call<SubscriptionPurchaseV2>('GET', `${BASE}/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`)
}

/**
 * purchases.subscriptions.acknowledge — must happen within 3 days of purchase
 * or Google refunds and revokes it. Done server-side, after access is saved.
 */
export async function acknowledgeSubscription(productId: string, purchaseToken: string): Promise<void> {
  const pkg = encodeURIComponent(getPlayPackageName())
  await call<unknown>(
    'POST',
    `${BASE}/${pkg}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    {}
  )
}
