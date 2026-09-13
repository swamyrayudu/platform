// ============================================================
// app/components/dsc-sgt/profile/ProfileSubscriptionCard.tsx
// ============================================================
'use client'

import React from 'react'
import { Crown, Sparkles } from 'lucide-react'
import type { PublicUser } from '@/lib/auth/types'

interface ProfileSubscriptionCardProps {
  user: PublicUser
  isPremium: boolean
  expiresAt: string | null
  onManage: () => void
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Whole days remaining, floored at 0. */
function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.max(0, Math.ceil((d - Date.now()) / 86_400_000))
}

export default function ProfileSubscriptionCard({
  user,
  isPremium,
  expiresAt,
  onManage,
}: ProfileSubscriptionCardProps) {
  const renews = formatDate(expiresAt)
  const remaining = daysLeft(expiresAt)

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <p className="bloom-eyebrow">Subscription</p>
      <h3 className="mt-1.5 text-lg font-medium text-foreground">
        {isPremium ? 'DSC Pro Pass' : 'Free plan'}
      </h3>

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-muted-foreground">Status</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-foreground">
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <Crown className="h-3.5 w-3.5 fill-current" />
                Active
              </span>
            ) : (
              user.subscriptionStatus === 'EXPIRED'
                ? 'Expired'
                : 'No active subscription'
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] text-muted-foreground">Plan</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-foreground">
            {user.subscriptionPlan ?? '—'}
          </dd>
        </div>

        {isPremium && renews && (
          <>
            <div>
              <dt className="text-[11px] text-muted-foreground">Valid until</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-foreground">{renews}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Days remaining</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                {remaining != null ? `${remaining} day${remaining === 1 ? '' : 's'}` : '—'}
              </dd>
            </div>
          </>
        )}
      </dl>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        {isPremium
          ? 'Every mock module, practice set and previous paper is unlocked on your account.'
          : 'Free covers the opening modules. Pro unlocks the full series, all practice sets and every previous paper.'}
      </p>

      <div className="mt-5 border-t border-border pt-5">
        <button onClick={onManage} className="bloom-pill bloom-pill-dark px-5 py-2.5 text-[13px]">
          {isPremium ? (
            <>
              <Crown className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span>Manage subscription</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span>Upgrade to Pro</span>
            </>
          )}
        </button>
      </div>
    </section>
  )
}
