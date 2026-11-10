'use client'

// ============================================================
// app/admin/app-updates/page.tsx — Google Play app update rules
// ============================================================
// Two controls for the Google Play app (mobile/components/play-app-update.tsx):
//   Required minimum version code: older installs must update first
//                                  (Play's full-screen "immediate" update).
//   Small updates:                 offer newer versions as a background
//                                  download ("flexible" update).
// Data: /api/admin/app-updates (lib/app-update-setting.ts).
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react'

export default function AppUpdatesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minVersionCode, setMinVersionCode] = useState('0')
  const [flexible, setFlexible] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/app-updates', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load the update settings.')
      setMinVersionCode(String(data.minVersionCode))
      setFlexible(data.flexible)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the update settings.')
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
    const min = Number(minVersionCode || 0)
    if (!Number.isInteger(min) || min < 0) { toast.error('Minimum version code must be a whole number, 0 or more.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/app-updates', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minVersionCode: min, flexible }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save the update settings.')
      toast.success(min > 0 ? `Saved. Installs below version code ${min} must update.` : 'Saved. No update is required.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the update settings.')
    } finally {
      setSaving(false)
    }
  }

  const input = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">App updates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How the Google Play app asks students to update. Changes reach phones within about a minute.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error ? <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      <form onSubmit={save} className="space-y-6">
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><ShieldAlert className="h-4 w-4 text-primary" /> Required update</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Installs with a lower Android version code must update before they can use the app: Google Play shows its
            full-screen update, and the app stays locked until it is done. Use it for serious bugs, payment changes or
            server changes old versions cannot handle. 0 means nothing is required.
          </p>
          <label className="mt-4 block max-w-xs text-xs font-medium text-muted-foreground">Minimum version code
            <input className={`${input} mt-1 font-mono`} inputMode="numeric" value={minVersionCode} disabled={loading}
              onChange={(e) => setMinVersionCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Find version codes in Play Console → Test and release → App bundle explorer. Set this only after that
            version is live on Google Play, or students will be asked to update to a version they cannot get yet.
          </p>
        </section>

        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Smartphone className="h-4 w-4 text-primary" /> Small updates</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              When Google Play has a newer version, ask students to update. It downloads in the background while they keep
              studying, then asks to restart. They can choose Later.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={flexible} aria-label="Small updates" disabled={loading}
            onClick={() => setFlexible((v) => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 cursor-pointer ${flexible ? 'bg-emerald-600' : 'bg-muted-foreground/30'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${flexible ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </section>

        <p className="text-xs text-muted-foreground">
          A release given update priority 4 or 5 through the Google Play Developer API is also treated as required. Most releases need
          neither: leave the minimum at its current value and small updates on.
        </p>

        <button type="submit" disabled={saving || loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
      </form>
    </main>
  )
}
