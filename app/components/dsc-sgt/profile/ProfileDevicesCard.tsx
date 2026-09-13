// ============================================================
// app/components/dsc-sgt/profile/ProfileDevicesCard.tsx
// ============================================================
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Monitor, RefreshCw, Smartphone, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { PublicDevice } from '@/lib/auth/types'

interface ProfileDevicesCardProps {
  onSignOutAll: () => void
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'unknown'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ProfileDevicesCard({ onSignOutAll }: ProfileDevicesCardProps) {
  const [devices, setDevices] = useState<PublicDevice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  // Which device this request is authenticated as — reported by the server,
  // which knows the session, rather than guessed from local storage.
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/devices', { credentials: 'include' })
      if (!res.ok) {
        setError('Could not load your devices.')
        return
      }
      const json = await res.json()
      setError(null)
      setCurrentDeviceId(json.currentDeviceId ?? null)
      setDevices(json.devices ?? [])
    } catch {
      setError('Network error — please try again.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (deviceId: string) => {
    setRevoking(deviceId)
    try {
      const res = await fetch(`/api/auth/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error('Could not sign that device out', { description: json.error })
        return
      }
      toast.success('Device signed out')
      await load()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setRevoking(null)
    }
  }

  const active = (devices ?? []).filter((d) => d.currentSessionStatus === 'ACTIVE')

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="bloom-eyebrow">Security</p>
          <h3 className="mt-1.5 text-lg font-medium text-foreground">Signed-in devices</h3>
        </div>
        <button
          onClick={() => void load()}
          aria-label="Refresh device list"
          className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {devices === null && !error && (
        <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading devices…
        </div>
      )}

      {error && (
        <div className="py-6">
          <p className="text-xs text-destructive">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {devices !== null && !error && (
        <>
          {devices.length === 0 ? (
            <p className="py-6 text-xs text-muted-foreground">No devices recorded yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {devices.map((d) => {
                const isThis = currentDeviceId != null && d.deviceId === currentDeviceId
                const isActive = d.currentSessionStatus === 'ACTIVE'
                const Icon = d.platform === 'WEB' ? Monitor : Smartphone

                return (
                  <li key={d.deviceId} className="flex items-center gap-3 py-3.5">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                        <span>{d.platform === 'WEB' ? 'Web browser' : d.platform}</span>
                        {isThis && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                            This device
                          </span>
                        )}
                        {!isActive && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Signed out
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        Last active {formatWhen(d.lastActivityAt ?? d.lastLoginAt)} ·{' '}
                        {d.loginCount} sign-in{d.loginCount === 1 ? '' : 's'}
                      </p>
                    </div>

                    {isActive && !isThis && (
                      <button
                        onClick={() => void revoke(d.deviceId)}
                        disabled={revoking === d.deviceId}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        {revoking === d.deviceId ? 'Signing out…' : 'Sign out'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              {active.length} active session{active.length === 1 ? '' : 's'}. Signing out
              everywhere ends this one too.
            </p>
            <button
              onClick={onSignOutAll}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.7} />
              Sign out all devices
            </button>
          </div>
        </>
      )}
    </section>
  )
}
