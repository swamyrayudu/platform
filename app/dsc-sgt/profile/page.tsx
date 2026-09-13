'use client'

// ============================================================
// app/dsc-sgt/profile/page.tsx — Account & profile
// ============================================================
// Lives inside the DSC hub rather than at the site root so it keeps the exam
// header, and so reaching it never collides with the rule that keeps a
// candidate inside their chosen exam until they sign out.
// ============================================================

import React, { useState } from 'react'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import ProfileIdentityCard from '@/app/components/dsc-sgt/profile/ProfileIdentityCard'
import ProfilePersonalForm from '@/app/components/dsc-sgt/profile/ProfilePersonalForm'
import ProfilePreferencesForm from '@/app/components/dsc-sgt/profile/ProfilePreferencesForm'
import ProfileSubscriptionCard from '@/app/components/dsc-sgt/profile/ProfileSubscriptionCard'
import ProfileDevicesCard from '@/app/components/dsc-sgt/profile/ProfileDevicesCard'
import type { PublicUser, LearningGoal, EducationMedium } from '@/lib/auth/types'

interface ProfilePatch {
  name?: string
  learningGoals?: LearningGoal[]
  educationMedium?: EducationMedium
}

export default function ProfilePage() {
  const { user, loading, updateUser, logout, logoutAll } = useAuth()
  const { isPremium, expiresAt, openModal } = usePremium()

  // Forms are keyed on this so a successful save re-seeds their inputs from
  // the saved user rather than leaving them holding their own local copy.
  const [savedAt, setSavedAt] = useState(0)

  const saveProfile = async (patch: ProfilePatch): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error('Could not save', { description: json.error ?? 'Please try again.' })
        return false
      }

      updateUser(json.user as PublicUser)
      setSavedAt(Date.now())
      toast.success('Profile updated')
      return true
    } catch {
      toast.error('Network error', { description: 'Please check your connection and retry.' })
      return false
    }
  }

  // The layout already redirects an unauthenticated visitor; this only covers
  // the frame before that resolves.
  if (loading) return <LoadingScreen message="Loading your profile…" />
  if (!user) return null

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="bloom-eyebrow">Account</p>
        <h1 className="mt-2 text-3xl font-medium text-foreground sm:text-4xl">Your profile</h1>
        <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
          Update how your name appears, how you want to study, and which devices
          are signed in to your account.
        </p>
      </header>

      <div className="space-y-6">
        <ProfileIdentityCard user={user} isPremium={isPremium} />

        <ProfilePersonalForm
          key={`personal-${savedAt}`}
          user={user}
          onSave={saveProfile}
        />

        <ProfilePreferencesForm
          key={`prefs-${savedAt}`}
          user={user}
          onSave={saveProfile}
        />

        <ProfileSubscriptionCard
          user={user}
          isPremium={isPremium}
          expiresAt={expiresAt}
          onManage={() => openModal('profile_page')}
        />

        <ProfileDevicesCard
          onSignOutAll={() => {
            toast.info('Signing out from all devices…', { duration: 2000 })
            void logoutAll()
          }}
        />

        {/* Plain sign-out, kept apart from the device controls above */}
        <section className="rounded-2xl border border-border/70 bg-card p-6">
          <p className="bloom-eyebrow">Session</p>
          <h3 className="mt-1.5 text-lg font-medium text-foreground">Sign out</h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            Ends this session only. Your progress, attempts and subscription stay
            exactly as they are.
          </p>
          <button
            onClick={() => {
              toast.info('Signing out…', { duration: 1500 })
              void logout()
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
            Sign out
          </button>
        </section>
      </div>
    </main>
  )
}
