// ============================================================
// app/components/dsc-sgt/profile/ProfilePersonalForm.tsx
// ============================================================
'use client'

import React, { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import type { PublicUser } from '@/lib/auth/types'

const NAME_MAX = 60

interface ProfilePersonalFormProps {
  user: PublicUser
  onSave: (patch: { name: string }) => Promise<boolean>
}

export default function ProfilePersonalForm({ user, onSave }: ProfilePersonalFormProps) {
  const [name, setName] = useState(user.name ?? '')
  const [saving, setSaving] = useState(false)

  const trimmed = name.trim()
  const dirty = trimmed !== (user.name ?? '').trim()
  const tooLong = trimmed.length > NAME_MAX
  const canSave = dirty && trimmed.length > 0 && !tooLong && !saving

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    const ok = await onSave({ name: trimmed })
    setSaving(false)
    // On failure the parent has already surfaced the reason; keep the edit so
    // the candidate does not have to retype it.
    if (ok) setName(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border/70 bg-card p-6">
      <p className="bloom-eyebrow">Personal details</p>
      <h3 className="mt-1.5 text-lg font-medium text-foreground">How your name appears</h3>

      <div className="mt-5 space-y-4">
        {/* Display name — editable */}
        <div>
          <label htmlFor="profile-name" className="text-xs font-medium text-foreground">
            Display name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            maxLength={NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-1.5 h-11 w-full rounded-full border border-border bg-background px-4 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
          <p
            className={`mt-1.5 text-[11px] ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {tooLong
              ? `Names are limited to ${NAME_MAX} characters.`
              : 'Shown on leaderboards and in your result reports.'}
          </p>
        </div>

        {/* Email — comes from Google, so it is shown read-only */}
        <div>
          <label htmlFor="profile-email" className="text-xs font-medium text-foreground">
            Email
          </label>
          <div className="relative mt-1.5">
            <input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              disabled
              className="h-11 w-full cursor-not-allowed rounded-full border border-border bg-muted/50 px-4 pr-10 text-xs text-muted-foreground"
            />
            <Lock className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Managed by your Google account — change it there and sign in again.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-5">
        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setName(user.name ?? '')}
            className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Discard
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="bloom-pill bloom-pill-dark px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{saving ? 'Saving…' : 'Save changes'}</span>
        </button>
      </div>
    </form>
  )
}
