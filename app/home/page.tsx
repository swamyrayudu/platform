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
import { EXAM_HOME, getActiveExam } from '@/lib/active-exam'

export default function Home() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()

  // Once an exam is picked this page is closed until sign-out, so resolve the
  // lock before painting rather than letting the grid flash into view.
  const lockedExam = !loading && user ? getActiveExam(user.id) : null

  // Redirect to login if not authenticated, or to onboarding if not completed
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
      return
    }
    if (!loading && user && !user.onboardingCompleted) {
      router.replace('/onboarding')
      return
    }
    if (lockedExam) {
      router.replace(EXAM_HOME[lockedExam])
    }
  }, [user, loading, router, lockedExam])

  if (loading) {
    return <LoadingScreen message="Loading your dashboard..." />
  }

  if (!user) return null

  if (lockedExam) {
    return <LoadingScreen message="Opening your preparation hub..." />
  }

  return (
    // Same cream canvas + floating white shell as the landing page.
    <div className="min-h-screen bg-background px-0 py-0 text-foreground transition-colors duration-200 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      {/* Same shell width as the landing page, so navigating between them
          does not shift the page frame. */}
      <div className="bloom-shell mx-auto max-w-[84rem] overflow-hidden">

        {/* Sticky Top Navigation */}
        <TopNav user={user} logout={logout} logoutAll={logoutAll} />

        {/* Main Page Content */}
        <main className="px-4 pb-8 sm:px-8 lg:px-12">
          {/* Bloom hero: welcome + Choose your exam */}
          <HeroBanner name={user.name} />

          {/* Categories, Search & Exam Cards Grid */}
          <ExamGrid />

          {/* 4-Column Feature Highlights Bar */}
          <FeatureHighlights />

          {/* Footer */}
          <HomeFooter />
        </main>
      </div>
    </div>
  )
}
