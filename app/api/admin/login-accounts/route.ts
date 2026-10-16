// ============================================================
// app/api/admin/login-accounts/route.ts — Email + password accounts (admin)
// ============================================================
//   GET              every account that can sign in with a password
//   POST             { email, name?, password, proDays? } create the account,
//                    or set the password of the user with that email
//   DELETE ?id=<id>  stop password sign-in for that account
//   PATCH            { emailLoginEnabled } the on/off switch for email sign-in;
//                    off also signs out the accounts that have no Google login
// Used for accounts such as the Google Play reviewer's; candidates sign up
// with Google. See lib/auth/password-accounts.ts.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { isEmail, listLoginAccounts, normalizeEmail, removePasswordLogin, savePasswordAccount, signOutPasswordOnlyAccounts } from '@/lib/auth/password-accounts'
import { isEmailLoginEnabled, setEmailLoginEnabled } from '@/lib/auth/email-login-setting'
import { passwordProblem } from '@/lib/auth/password'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

export const GET = requireAdmin(async () => {
  try {
    const [accounts, emailLoginEnabled] = await Promise.all([listLoginAccounts(), isEmailLoginEnabled()])
    return NextResponse.json({ success: true, accounts, emailLoginEnabled }, { headers: NO_STORE })
  } catch (error) {
    console.error('[LoginAccounts] list failed:', error)
    return NextResponse.json({ success: false, error: 'Could not load login accounts.' }, { status: 500 })
  }
})

export const POST = requireAdmin(async (request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    if (!isEmail(email)) return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 })
    const problem = passwordProblem(body.password)
    if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })
    const proDays = Number(body.proDays ?? 0)
    if (!Number.isInteger(proDays) || proDays < 0 || proDays > 3650) {
      return NextResponse.json({ success: false, error: 'Pro days must be a whole number from 0 to 3650.' }, { status: 400 })
    }
    const name = typeof body.name === 'string' ? body.name.slice(0, 80) : undefined
    const saved = await savePasswordAccount({ email, name, password: body.password as string, proDays })
    return NextResponse.json({ success: true, ...saved }, { headers: NO_STORE })
  } catch (error) {
    console.error('[LoginAccounts] save failed:', error)
    return NextResponse.json({ success: false, error: 'Could not save the account.' }, { status: 500 })
  }
})

export const DELETE = requireAdmin(async (request) => {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? ''
    if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Unknown account.' }, { status: 400 })
    await removePasswordLogin(id)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error) {
    console.error('[LoginAccounts] remove failed:', error)
    return NextResponse.json({ success: false, error: 'Could not remove password sign-in.' }, { status: 500 })
  }
})

export const PATCH = requireAdmin(async (request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body.emailLoginEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'emailLoginEnabled must be true or false.' }, { status: 400 })
    }
    await setEmailLoginEnabled(body.emailLoginEnabled)
    if (!body.emailLoginEnabled) await signOutPasswordOnlyAccounts()
    return NextResponse.json({ success: true, emailLoginEnabled: body.emailLoginEnabled }, { headers: NO_STORE })
  } catch (error) {
    console.error('[LoginAccounts] switch failed:', error)
    return NextResponse.json({ success: false, error: 'Could not change email sign-in. Has the app_settings migration been run?' }, { status: 500 })
  }
})
