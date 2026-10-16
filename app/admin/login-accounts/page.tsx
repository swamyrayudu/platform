'use client'

// ============================================================
// app/admin/login-accounts/page.tsx — Email + password accounts
// ============================================================
// Candidates sign in with Google. Here the admin creates accounts that sign
// in with an email and a password instead — for example the account the
// Google Play reviewer uses ("App access" in Play Console) — or adds a
// password to an existing user. There is no public sign-up. The "Email
// sign-in" switch turns all of it off (and on again) for everyone.
// Data: /api/admin/login-accounts.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Crown, KeyRound, Loader2, Mail, RefreshCw, Trash2, Wand2 } from 'lucide-react'

interface LoginAccount {
  id: string
  email: string
  name: string | null
  pro: boolean
  proUntil: string | null
  passwordSetAt: string
  createdAt: string
}

/** 12 characters from letters and digits, with at least one of each. */
function makePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = letters + digits
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chars = [pick(letters), pick(digits), ...Array.from({ length: 10 }, () => pick(all))]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function LoginAccountsPage() {
  const [accounts, setAccounts] = useState<LoginAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [pro, setPro] = useState(true)
  const [proDays, setProDays] = useState(90)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [emailLogin, setEmailLogin] = useState<boolean | null>(null)
  const [switching, setSwitching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login-accounts', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load login accounts.')
      setAccounts(data.accounts)
      setEmailLogin(data.emailLoginEnabled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load login accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/login-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, proDays: pro ? proDays : 0 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save the account.')
      toast.success(data.created ? 'Account created' : 'Password updated', {
        description: `${email} can now sign in with this password on the website and the app.`,
      })
      setEmail('')
      setName('')
      setPassword('')
      void load()
    } catch (err) {
      toast.error('Not saved', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (account: LoginAccount) => {
    if (!window.confirm(`Stop password sign-in for ${account.email}? They are signed out. (If they also use Google, that still works.)`)) return
    setRemoving(account.id)
    try {
      const res = await fetch(`/api/admin/login-accounts?id=${encodeURIComponent(account.id)}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not remove it.')
      toast.success('Password sign-in removed', { description: account.email })
      void load()
    } catch (err) {
      toast.error('Not removed', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setRemoving(null)
    }
  }

  const toggleEmailLogin = async () => {
    const next = !emailLogin
    if (!next && !window.confirm('Turn email sign-in off? "Continue with Email" disappears from the website and the app, no email + password works, and accounts without Google are signed out now.')) return
    setSwitching(true)
    try {
      const res = await fetch('/api/admin/login-accounts', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailLoginEnabled: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not change it.')
      setEmailLogin(next)
      toast.success(next ? 'Email sign-in is on' : 'Email sign-in is off')
    } catch (err) {
      toast.error('Not changed', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSwitching(false)
    }
  }

  const input = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none'

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Login accounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Accounts that sign in with an email and a password instead of Google — for example the Google Play
            reviewer account. Students cannot sign up this way; only accounts made here can.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Mail className="h-4 w-4 text-primary" /> Email sign-in</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {emailLogin === null
              ? 'Loading…'
              : emailLogin
                ? 'On: the website and the app show “Continue with Email”, and the accounts below can sign in.'
                : 'Off: “Continue with Email” is hidden everywhere and no email + password works. Accounts are kept for when you turn it back on.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={!!emailLogin} aria-label="Email sign-in" disabled={emailLogin === null || switching}
          onClick={() => void toggleEmailLogin()}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 cursor-pointer ${emailLogin ? 'bg-emerald-600' : 'bg-muted-foreground/30'}`}>
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${emailLogin ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </section>

      <form onSubmit={save} className="mb-8 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground"><KeyRound className="h-4 w-4 text-primary" /> Create an account or set a password</h2>
        <p className="mb-4 text-xs text-muted-foreground">If the email already has an account (for example a Google user), this sets its password and signs it out.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">Email
            <input className={`${input} mt-1`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reviewer@example.com" autoComplete="off" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">Name (optional)
            <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Play Store reviewer" maxLength={80} />
          </label>
          <label className="text-xs font-medium text-muted-foreground sm:col-span-2">Password (8+ characters, letters and numbers)
            <div className="mt-1 flex gap-2">
              <input className={`${input} font-mono`} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" onClick={() => setPassword(makePassword())}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer">
                <Wand2 className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} className="h-4 w-4" />
              <Crown className="h-4 w-4 text-amber-600" /> Give Pro access for
            </label>
            <input type="number" min={1} max={3650} value={proDays} disabled={!pro} onChange={(e) => setProDays(Number(e.target.value))}
              className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-50" />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Copy the password before saving: it is stored only as a hash and cannot be shown again.</p>
        <button type="submit" disabled={saving}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save account
        </button>
      </form>

      {error && <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card">
        <div className="border-b border-border px-5 py-3 text-sm font-bold text-foreground">Accounts with a password{accounts ? ` · ${accounts.length}` : ''}</div>
        {!accounts && !error && <div className="h-24 animate-pulse bg-muted/40" />}
        {accounts && accounts.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">None yet. Create one above.</p>}
        {accounts && accounts.length > 0 && (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{a.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.name ?? '—'} · password set {date(a.passwordSetAt)} · {a.pro ? `Pro until ${date(a.proUntil)}` : 'Free'}
                  </p>
                </div>
                <button type="button" onClick={() => void remove(a)} disabled={removing === a.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 cursor-pointer">
                  {removing === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove password
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
