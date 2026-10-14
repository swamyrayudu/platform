// ============================================================
// scripts/grant-pro.mjs — Give one account Pro without a payment
// ============================================================
// For the Google Play reviewer account (Play Console → App access): reviewers
// must reach every paid feature, and the store build sells nothing.
//
// Usage (the reviewer must have signed in once so the account exists):
//   node --env-file=.env scripts/grant-pro.mjs reviewer@gmail.com          # preview only
//   node --env-file=.env scripts/grant-pro.mjs reviewer@gmail.com 365 --apply
//
// Days default to 365. Nothing is written without --apply.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const [email, daysArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const apply = process.argv.includes('--apply')
const days = Number(daysArg ?? 365)
if (!email || !Number.isInteger(days) || days < 1) {
  console.error('Usage: node --env-file=.env scripts/grant-pro.mjs <email> [days] [--apply]')
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })

const COLUMNS = 'id, email, account_type, subscription_status, subscription_plan, subscription_expires_at'
const { data: user, error } = await db.from('users').select(COLUMNS).ilike('email', email.trim()).maybeSingle()
if (error) throw error
if (!user) {
  console.error(`No account for ${email}. Sign in to the app with it once, then run this again.`)
  process.exit(1)
}
console.log('Current:', user)

const now = new Date()
const update = {
  account_type: 'PREMIUM',
  subscription_status: 'ACTIVE',
  subscription_plan: 'reviewer',
  subscription_started_at: now.toISOString(),
  subscription_expires_at: new Date(now.getTime() + days * 86_400_000).toISOString(),
}
if (!apply) {
  console.log('Would set:', update, '\nPreview only — add --apply to write.')
  process.exit(0)
}

const { data: saved, error: saveError } = await db.from('users').update(update).eq('id', user.id).select(COLUMNS).single()
if (saveError) throw saveError
console.log('Saved:', saved)
