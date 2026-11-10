// ============================================================
// POST /api/admin/users/[id]/grant-pro — support: give a user Pro days
// ============================================================
// For "I paid but did not get Pro" and similar support cases. Admin only.
//
// Body: { days: 1..400, reason: string (3..200 chars) }
//
// Adds the days to the user's web Pro time (users.subscription_*):
//   - active web Pro  → on top of the current expiry (nothing they paid for is lost)
//   - otherwise       → starting now
// Google Play time (users.play_expires_at) is separate and untouched.
//
// Safe against double clicks / two admins: the update only applies if the
// expiry is still the value read a moment ago; otherwise 409 and nothing changes.
// Every grant is written to security_events (ADMIN_PRO_GRANTED) with the
// admin, days and reason, and shows in the user's Activity tab.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getUserById, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { isUserId } from '@/lib/admin/users'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_DAYS = 400 // same ceiling as activate_subscription()

export const POST = requireAdmin<{ id: string }>(async (request, context, { user: admin, session }) => {
  const { id } = await context.params
  if (!isUserId(id)) return NextResponse.json({ success: false, error: 'Invalid user ID.' }, { status: 400 })

  let body: { days?: unknown; reason?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 }) }
  const days = Number(body.days)
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ success: false, error: `Days must be a whole number from 1 to ${MAX_DAYS}.` }, { status: 400 })
  }
  if (reason.length < 3 || reason.length > 200) {
    return NextResponse.json({ success: false, error: 'Write a short reason (3–200 characters), e.g. the Google Play order ID.' }, { status: 400 })
  }

  const target = await getUserById(id)
  if (!target) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 })

  const now = Date.now()
  const previous = target.subscription_expires_at
  const webActive = target.account_type === 'PREMIUM' && target.subscription_status === 'ACTIVE' &&
    previous !== null && Date.parse(previous) > now
  const base = webActive ? Date.parse(previous!) : now
  const expiresAt = new Date(base + days * 86_400_000).toISOString()

  let update = supabaseAdmin.from('users').update({
    account_type: 'PREMIUM',
    subscription_status: 'ACTIVE',
    subscription_plan: webActive ? target.subscription_plan ?? 'admin_grant' : 'admin_grant',
    subscription_started_at: webActive ? target.subscription_started_at ?? new Date(now).toISOString() : new Date(now).toISOString(),
    subscription_expires_at: expiresAt,
  }).eq('id', id)
  update = previous === null ? update.is('subscription_expires_at', null) : update.eq('subscription_expires_at', previous)
  const { data, error } = await update.select('id')
  if (error) {
    console.error('[Admin grant-pro] update failed:', error.message)
    return NextResponse.json({ success: false, error: 'Could not give Pro. Please retry.' }, { status: 500 })
  }
  if (!data?.length) {
    return NextResponse.json({ success: false, error: 'This user\'s Pro changed a moment ago. Refresh and try again.' }, { status: 409 })
  }

  await logSecurityEvent({
    userId: id,
    eventType: 'ADMIN_PRO_GRANTED',
    deviceId: session.device_id,
    ipHash: getHashedIp(request),
    metadata: { adminId: admin.id, adminEmail: admin.email, days, reason, previousExpiresAt: previous, expiresAt },
  })

  return NextResponse.json({ success: true, days, expiresAt })
})
