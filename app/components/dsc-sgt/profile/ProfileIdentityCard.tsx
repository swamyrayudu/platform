// ============================================================
// app/components/dsc-sgt/profile/ProfileIdentityCard.tsx
// ============================================================
'use client'

import React from 'react'
import { Crown, ShieldCheck } from 'lucide-react'
import type { PublicUser } from '@/lib/auth/types'

interface ProfileIdentityCardProps {
  user: PublicUser
  isPremium: boolean
}

export default function ProfileIdentityCard({ user, isPremium }: ProfileIdentityCardProps) {
  const initials = (user.name ?? user.email)[0].toUpperCase()

  return (
    <section className="bloom-tint overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {/* Avatar — supplied by Google, so it is shown but not editable */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-white/60">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name ?? 'Profile photo'}
              className="h-16 w-16 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center bg-bloom-indigo text-xl font-semibold text-[color:var(--primary-foreground)]">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-medium text-bloom-ink sm:text-2xl">
            {user.name ?? 'Candidate'}
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-bloom-ink/65">{user.email}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <Crown className="h-3 w-3 fill-current" />
                Pro member
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-medium text-bloom-ink/70 dark:bg-white/10">
                Free plan
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-medium text-bloom-ink/70 dark:bg-white/10">
              AP DSC · SGT
            </span>

            {user.role === 'admin' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[11px] font-medium text-bloom-ink/70 dark:bg-white/10">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
