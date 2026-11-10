// ============================================================
// GET /api/payments/google-play/reconcile — daily safety net (Vercel Cron)
// ============================================================
// Real-time notifications keep Play access current. This catches anything
// they missed (Pub/Sub outage, misconfiguration): once a day it re-reads
// from Google every subscription that renews or ends around now, or that is
// in a temporary state (grace period, on hold, paused, pending), so a renewal
// is never lost just because one notification was.
//
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
// Schedule: vercel.json → crons.
// ============================================================

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isPlayBillingConfigured } from '@/lib/payments/google-play/config'
import { syncPlayPurchase } from '@/lib/payments/google-play/sync'

const TIME_BUDGET_MS = 45_000
const MAX_TOKENS = 300
const TEMPORARY_STATES = [
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_ON_HOLD',
  'SUBSCRIPTION_STATE_PAUSED',
  'SUBSCRIPTION_STATE_PENDING',
]

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || secret.length < 16) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!isPlayBillingConfigured()) return NextResponse.json({ skipped: 'PLAY_NOT_CONFIGURED' })

  const now = Date.now()
  const from = new Date(now - 3 * 86_400_000).toISOString()
  const to = new Date(now + 2 * 86_400_000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('play_subscriptions')
    .select('purchase_token')
    .is('superseded_by', null)
    .or(`and(expiry_time.gte.${from},expiry_time.lte.${to}),state.in.(${TEMPORARY_STATES.join(',')})`)
    .order('expiry_time', { ascending: true })
    .limit(MAX_TOKENS)
  if (error) {
    console.error('[Play reconcile] query failed:', error.message)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  const result = { checked: 0, synced: 0, rejected: 0, failed: 0, remaining: 0 }
  const tokens = (data ?? []).map((row) => row.purchase_token as string)
  for (const purchaseToken of tokens) {
    if (Date.now() - now > TIME_BUDGET_MS) { result.remaining = tokens.length - result.checked; break }
    result.checked++
    try {
      // Owner comes from the stored row; claimant is null like an RTDN.
      const outcome = await syncPlayPurchase({ purchaseToken, via: 'reconcile', claimantUserId: null })
      if (outcome.status === 'synced') result.synced++
      else result.rejected++
    } catch (err) {
      result.failed++
      console.error('[Play reconcile] sync failed:', (err as Error).message)
    }
  }
  console.info('[Play reconcile]', JSON.stringify(result))
  return NextResponse.json(result)
}
