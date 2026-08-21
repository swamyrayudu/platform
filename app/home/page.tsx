'use client'

// ============================================================
// app/home/page.tsx — Protected Dashboard
// ============================================================

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import TopNav from '@/app/components/home/TopNav'
import HeroBanner from '@/app/components/home/HeroBanner'
import ExamGrid from '@/app/components/home/ExamGrid'
import FeatureHighlights from '@/app/components/home/FeatureHighlights'
import HomeFooter from '@/app/components/home/HomeFooter'
import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Home() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()

  // Redirect to login if not authenticated, or to onboarding if not completed
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
    if (!loading && user && !user.onboardingCompleted) {
      router.replace('/onboarding')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingScreen message="Loading your dashboard..." />
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Sticky Top Navigation */}
      <TopNav user={user} logout={logout} logoutAll={logoutAll} />

      {/* Main Page Content */}
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        {/* Top Hero Banner: Choose Your Exam + Illustration */}
        <HeroBanner />

        {/* Categories, Search & Exam Cards Grid */}
        <ExamGrid />

        {/* 4-Column Feature Highlights Bar */}
        <FeatureHighlights />

        {/* Footer */}
        <HomeFooter />
      </main>
    </div>
  )
}
