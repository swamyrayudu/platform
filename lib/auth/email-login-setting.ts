// ============================================================
// lib/auth/email-login-setting.ts — Email sign-in on/off (SERVER ONLY)
// ============================================================
// The admin switch at /admin/login-accounts, stored in public.app_settings
// (migration 20261017130000) under 'email_login'. Off means no email +
// password sign-in for anyone: the button is hidden on the web and in the
// app, and /api/auth/password refuses. Accounts and passwords are kept, so
// switching it back on restores them.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

const KEY = 'email_login'

/** Off only when the admin switched it off; a missing row counts as on. */
export async function isEmailLoginEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  if (error) {
    // Before the migration runs the table is missing: keep sign-in working.
    // Any other failure keeps it closed.
    return error.code === 'PGRST205' || error.code === '42P01'
  }
  if (!data) return true
  return (data.value as { enabled?: boolean } | null)?.enabled !== false
}

export async function setEmailLoginEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('app_settings')
    .upsert({ key: KEY, value: { enabled }, updated_at: new Date().toISOString() })
  if (error) throw error
}
