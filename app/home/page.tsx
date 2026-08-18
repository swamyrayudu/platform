'use client'

// ============================================================
// app/home/page.tsx — Protected Dashboard
// ============================================================

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    )
  }

  if (!user) return null

  const isPremium =
    user.accountType === 'PREMIUM' && user.subscriptionStatus === 'ACTIVE'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090d16] text-white">

      {/* Background Glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/8 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-slate-800/60 px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 font-bold text-sm shadow-lg shadow-indigo-500/20">
            D
          </div>
          <span className="text-base font-semibold tracking-tight">DSC Preparation</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Account type badge */}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isPremium
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isPremium ? '⭐ PREMIUM' : 'FREE'}
          </span>

          {/* User avatar */}
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name ?? 'User avatar'}
              className="h-8 w-8 rounded-full ring-2 ring-slate-700"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold">
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 lg:px-12">

        {/* Welcome section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {user.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="mt-2 text-slate-400">
            Continue your DSC preparation journey.
          </p>
          {isPremium && user.subscriptionExpiresAt && (
            <p className="mt-1 text-xs text-amber-400/70">
              Premium expires: {new Date(user.subscriptionExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Upgrade banner for free users */}
        {!isPremium && (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-400">⭐ Unlock Premium</p>
                <p className="mt-1 text-sm text-slate-400">
                  Get access to premium question banks, mock tests, and advanced analytics.
                </p>
              </div>
              <button
                id="upgrade-btn"
                className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-opacity"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Feature grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            id="mock-tests-card"
            emoji="📝"
            title="Mock Tests"
            description="Attempt full-length DSC exam simulations"
            available
          />
          <FeatureCard
            id="pyqs-card"
            emoji="📚"
            title="Previous Year Questions"
            description="Practice with official past exam questions"
            available
          />
          <FeatureCard
            id="analytics-card"
            emoji="📊"
            title="Basic Analytics"
            description="Track your test scores and progress"
            available
          />
          <FeatureCard
            id="premium-questions-card"
            emoji="🏆"
            title="Premium Question Bank"
            description="50,000+ curated questions with detailed explanations"
            available={isPremium}
            locked={!isPremium}
          />
          <FeatureCard
            id="advanced-analytics-card"
            emoji="🎯"
            title="Advanced Analytics"
            description="Deep performance insights and weak area identification"
            available={isPremium}
            locked={!isPremium}
          />
          <FeatureCard
            id="study-material-card"
            emoji="📖"
            title="Premium Study Material"
            description="Comprehensive notes in Telugu & English"
            available={isPremium}
            locked={!isPremium}
          />
        </div>

        {/* Account section */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-4 text-lg font-semibold">Account</h2>
          <div className="mb-4 flex items-center gap-3 text-sm text-slate-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <span>{(user.name ?? user.email)[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-white font-medium">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              id="logout-btn"
              onClick={logout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
            >
              Sign out
            </button>
            <button
              id="logout-all-btn"
              onClick={logoutAll}
              className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:border-red-500/60 hover:text-red-300 transition-colors"
            >
              Sign out all devices
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

/* ---- Sub-components -------------------------------------------- */

function FeatureCard({
  id,
  emoji,
  title,
  description,
  available,
  locked,
}: {
  id: string
  emoji: string
  title: string
  description: string
  available: boolean
  locked?: boolean
}) {
  return (
    <div
      id={id}
      className={`rounded-2xl border p-5 transition-colors ${
        locked
          ? 'border-slate-800/60 bg-slate-900/20 opacity-60'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/70'
      }`}
    >
      <div className="mb-3 text-2xl">{emoji}</div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-200">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {locked && (
          <span className="shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            PRO
          </span>
        )}
      </div>
    </div>
  )
}
