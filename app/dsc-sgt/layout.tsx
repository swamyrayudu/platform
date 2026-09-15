'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { PremiumProvider } from '@/app/components/dsc-sgt/PremiumContext'
import DscHeader from '@/app/components/dsc-sgt/DscHeader'
import { BottomNavProvider } from '@/app/components/dsc-sgt/DscBottomNav'
import PremiumModal from '@/app/components/dsc-sgt/PremiumModal'
import { setActiveExam } from '@/lib/active-exam'

export default function DscLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
      return
    }
    if (!loading && user && !user.onboardingCompleted) {
      router.replace('/onboarding')
      return
    }
    // Re-assert the lock on every entry, so a direct link or a page refresh
    // keeps the candidate inside this hub rather than dropping the lock.
    if (!loading && user) {
      setActiveExam(user.id, 'dsc-sgt')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingScreen message="Loading DSC / SGT Preparation Hub..." />
  }

  if (!user) return null

  return (
    <PremiumProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
        {/* Sticky DSC/SGT Dedicated Header */}
        <DscHeader />

        {/* Global Pro Modal Dialog */}
        <PremiumModal />

        {/* Page Content.
            The bottom padding on phones is the height of the tab bar plus the
            safe-area inset — without it the bar covers whatever the page ends
            with, which on most screens is a button. */}
        {/* Phone navigation. Replaces the hamburger sheet; the provider renders
            the bar after the page so a full-screen view can hide it. */}
        <BottomNavProvider>{children}</BottomNavProvider>
      </div>
    </PremiumProvider>
  )
}
