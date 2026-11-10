'use client'

// Support tool on the admin user page: give a user Pro days, e.g. when they
// paid on Google Play but Pro did not turn on. Server: /api/admin/users/[id]/grant-pro.

import { useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import type { AdminUser } from '@/types/admin-users'
import { userDate } from './UserDataUI'

const PRESETS = [{ days: 30, label: '1 month' }, { days: 92, label: '3 months' }, { days: 366, label: '1 year' }]

export default function GrantProPanel({ user, onGranted }: { user: AdminUser; onGranted: () => void }) {
  const [days, setDays] = useState('30')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const count = Number(days)
  const valid = Number.isInteger(count) && count >= 1 && count <= 400 && reason.trim().length >= 3

  async function grant() {
    if (!valid || busy) return
    if (!window.confirm(`Give ${count} days of Pro to ${user.email}?\n\nReason: ${reason.trim()}`)) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/grant-pro`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: count, reason: reason.trim() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) throw new Error(result.error ?? 'Could not give Pro.')
      setMessage({ ok: true, text: `Done — ${count} days added. Website Pro now runs until ${userDate(result.expiresAt)} (IST).` })
      setReason('')
      onGranted()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not give Pro.' })
    } finally {
      setBusy(false)
    }
  }

  return <section className="mt-5 rounded-2xl border border-border bg-card p-5">
    <div className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-bold">Give Pro</h3></div>
    <p className="mt-1 text-xs text-muted-foreground">
      For support cases such as &ldquo;I paid but did not get Pro&rdquo;. Check the payment first (Google Play tab or Play Console → Order management).
      Days are added on top of any active website Pro. Every grant is recorded in the Activity tab.
    </p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold">Days
        <input type="number" min={1} max={400} value={days} onChange={(e) => setDays(e.target.value)}
          className="mt-1 block w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-1.5">
        {PRESETS.map((preset) => <button key={preset.days} type="button" onClick={() => setDays(String(preset.days))}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${Number(days) === preset.days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{preset.label}</button>)}
      </div>
      <label className="min-w-64 flex-1 text-xs font-semibold">Reason (shown in the Activity log)
        <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Paid GPA.3312-5418-0912-34567, Pro not activated"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="button" disabled={!valid || busy} onClick={() => void grant()}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />} Give Pro
      </button>
    </div>
    {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-3 text-xs ${message.ok ? 'text-emerald-600' : 'text-destructive'}`}>{message.text}</p>}
  </section>
}
