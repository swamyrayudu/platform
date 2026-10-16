// ============================================================
// lib/auth/password-accounts.ts — Email + password accounts (SERVER ONLY)
// ============================================================
// There is no public sign-up: an admin creates these accounts (for example the
// Google Play reviewer's) at /admin/login-accounts, and can switch email
// sign-in off there for everyone (lib/auth/email-login-setting.ts). Hashes
// live in public.user_passwords (migration 20261017120000);
// lib/auth/password.ts makes and checks them.
// ============================================================

import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuthError } from './errors'
import { hashPassword } from './password'
import { revokeActiveSession } from './db'
import type { DbUser } from './types'

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254

/** Plan id stored for Pro access granted by an admin (not bought). */
const COMPLIMENTARY_PLAN = 'complimentary'

/** The user with this email and their password hash, if they have a password. */
export async function findPasswordLogin(email: string): Promise<{ user: DbUser; hash: string } | null> {
  const { data: user, error } = await supabaseAdmin.from('users').select('*').eq('email', normalizeEmail(email)).maybeSingle()
  if (error) throw new AuthError('INTERNAL_ERROR', 500)
  if (!user) return null
  const { data: row, error: rowError } = await supabaseAdmin.from('user_passwords').select('password_hash').eq('user_id', user.id).maybeSingle()
  if (rowError) throw new AuthError('INTERNAL_ERROR', 500)
  return row ? { user: user as DbUser, hash: row.password_hash as string } : null
}

export interface LoginAccount {
  id: string
  email: string
  name: string | null
  pro: boolean
  proUntil: string | null
  passwordSetAt: string
  createdAt: string
}

/** Every account that can sign in with a password, newest first. */
export async function listLoginAccounts(): Promise<LoginAccount[]> {
  const { data, error } = await supabaseAdmin.from('user_passwords')
    .select('user_id, updated_at, users(id, email, name, account_type, subscription_status, subscription_expires_at, created_at)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  type Row = { user_id: string; updated_at: string; users: { id: string; email: string; name: string | null; account_type: string; subscription_status: string; subscription_expires_at: string | null; created_at: string } | null }
  return ((data ?? []) as unknown as Row[]).filter((r) => r.users).map((r) => ({
    id: r.users!.id,
    email: r.users!.email,
    name: r.users!.name,
    pro: r.users!.account_type === 'PREMIUM' && r.users!.subscription_status === 'ACTIVE'
      && !!r.users!.subscription_expires_at && new Date(r.users!.subscription_expires_at) > new Date(),
    proUntil: r.users!.subscription_expires_at,
    passwordSetAt: r.updated_at,
    createdAt: r.users!.created_at,
  }))
}

/**
 * Create an account with this email and password, or set the password of the
 * account that already has the email (a Google user can then use either).
 * With proDays, Pro access runs that many days from now.
 */
export async function savePasswordAccount(input: { email: string; name?: string; password: string; proDays?: number }): Promise<{ id: string; created: boolean }> {
  const email = normalizeEmail(input.email)
  const { data: existing, error } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
  if (error) throw error

  const pro = input.proDays && input.proDays > 0 ? {
    account_type: 'PREMIUM',
    subscription_status: 'ACTIVE',
    subscription_plan: COMPLIMENTARY_PLAN,
    subscription_started_at: new Date().toISOString(),
    subscription_expires_at: new Date(Date.now() + input.proDays * 86_400_000).toISOString(),
  } : {}

  let id = existing?.id as string | undefined
  const created = !id
  if (!id) {
    const uid = randomUUID()
    const { data: row, error: insertError } = await supabaseAdmin.from('users').insert({
      supabase_uid: uid,
      // google_id is required and unique; Google ids are all digits, so this never collides.
      google_id: `local:${uid}`,
      email,
      name: input.name?.trim() || email.split('@')[0],
      account_type: 'FREE',
      subscription_status: 'NONE',
      session_version: 1,
      ...pro,
    }).select('id').single()
    if (insertError) throw insertError
    id = row.id as string
  } else if (Object.keys(pro).length) {
    const { error: updateError } = await supabaseAdmin.from('users').update(pro).eq('id', id)
    if (updateError) throw updateError
  }

  const { error: passwordError } = await supabaseAdmin.from('user_passwords')
    .upsert({ user_id: id, password_hash: await hashPassword(input.password), updated_at: new Date().toISOString() })
  if (passwordError) throw passwordError
  // A new password signs out the old session.
  if (!created) await revokeActiveSession(id, 'PASSWORD_CHANGED')
  return { id, created }
}

/**
 * Sign out every account that has no Google sign-in (made here, google_id
 * 'local:…'), used when email sign-in is switched off so those accounts stop
 * completely, not just at their next sign-in.
 */
export async function signOutPasswordOnlyAccounts(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('users').select('id').like('google_id', 'local:%')
  if (error) throw error
  for (const row of data ?? []) await revokeActiveSession(row.id as string, 'EMAIL_LOGIN_DISABLED')
}

/** Stop password sign-in for this account and sign it out. Google sign-in, if any, still works. */
export async function removePasswordLogin(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('user_passwords').delete().eq('user_id', userId)
  if (error) throw error
  await revokeActiveSession(userId, 'PASSWORD_REMOVED')
}
