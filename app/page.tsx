'use client'

// ============================================================
// app/page.tsx — Login / Landing Page
// ============================================================
// Uses Google Identity Services (GSI) for One-Tap / button sign-in.
// On success → sends idToken to backend → redirects to /home.
// ============================================================

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateDeviceId } from '@/lib/auth/device-id'
import { useAuth } from './contexts/AuthContext'

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (parent: HTMLElement, options: object) => void
          prompt: () => void
          cancel: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

export default function Home() {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<{ limited: boolean; retryAfter?: number }>({
    limited: false,
  })
  const gsiButtonRef = useRef<HTMLDivElement>(null)
  const gsiLoaded = useRef(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/home')
    }
  }, [user, loading, router])

  // Handle the credential response from Google GSI
  const handleCredentialResponse = async (response: { credential: string }) => {
    setIsSigningIn(true)
    setError(null)
    setRateLimit({ limited: false })

    try {
      const deviceId = getOrCreateDeviceId()

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idToken: response.credential,
          deviceId,
          platform: 'WEB',
          userAgent: navigator.userAgent,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Refresh auth context with the new user data
        await refreshUser()
        router.push('/home')
        return
      }

      if (res.status === 429) {
        setRateLimit({ limited: true, retryAfter: data.retryAfter })
        setError(`Too many login attempts. Please try again in ${data.retryAfter ?? 60} seconds.`)
        return
      }

      if (data.error === 'AUTH_INVALID_TOKEN') {
        setError('Authentication failed. Please try signing in again.')
        return
      }

      setError('Login failed. Please try again.')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  // Load Google Identity Services and initialise GSI
  useEffect(() => {
    if (loading || user || gsiLoaded.current) return

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.')
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      gsiLoaded.current = true
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      // Render the custom Google button
      if (gsiButtonRef.current) {
        window.google.accounts.id.renderButton(gsiButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: gsiButtonRef.current.offsetWidth || 400,
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  // Show nothing while checking auth state (avoid flash)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090d16] text-white">

      {/* Background Glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />

      {/* Header */}
      <header className="relative z-10 flex h-20 items-center justify-between border-b border-slate-800/60 px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 font-bold shadow-lg shadow-indigo-500/20">
            D
          </div>
          <span className="text-lg font-semibold tracking-tight">DSC Preparation</span>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a className="transition-colors hover:text-white cursor-pointer">Features</a>
          <a className="transition-colors hover:text-white cursor-pointer">About</a>
          <a className="transition-colors hover:text-white cursor-pointer">Help</a>
        </nav>
      </header>

      {/* Main */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center px-6 py-12 lg:px-12">
        <div className="grid w-full items-center gap-16 lg:grid-cols-2">

          {/* Left — Hero */}
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs text-slate-300 backdrop-blur">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
              AP DSC SGT Preparation Platform
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Prepare smarter.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Crack DSC with confidence.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Practice syllabus-based questions, take realistic mock tests,
              revise previous papers and understand your performance — all in
              one preparation platform.
            </p>

            <div id="features" className="mt-10 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-3">
              <Feature title="Mock Tests" description="Exam-style practice" />
              <Feature title="PYQs" description="Previous papers" />
              <Feature title="Analytics" description="Track performance" />
              <Feature title="Telugu" description="Telugu & English" />
              <Feature title="Revision" description="Focus on weak areas" />
              <Feature title="AI Support" description="Smart preparation" />
            </div>
          </div>

          {/* Right — Login Card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl backdrop-blur-xl sm:p-9">

                {/* Card Header */}
                <div className="mb-8">
                  <p className="text-sm font-medium text-blue-400">GET STARTED</p>
                  <h2 className="mt-2 text-3xl font-bold">Welcome 👋</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Sign in to continue your DSC preparation journey.
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div
                    id="auth-error-message"
                    className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                  >
                    {error}
                  </div>
                )}

                {/* Rate limit message */}
                {rateLimit.limited && !error && (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    Too many attempts. Please wait before trying again.
                  </div>
                )}

                {/* Signing-in spinner overlay */}
                {isSigningIn ? (
                  <div
                    id="google-signin-loading"
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white/5 text-sm text-slate-300"
                  >
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
                    Signing in…
                  </div>
                ) : (
                  /* Google GSI renders here */
                  <div
                    id="google-signin-button"
                    ref={gsiButtonRef}
                    className="w-full overflow-hidden rounded-xl"
                    style={{ minHeight: '44px' }}
                  />
                )}

                {/* Divider */}
                <div className="my-7 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs text-slate-500">Secure authentication</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Info bullets */}
                <div className="space-y-3 text-sm text-slate-400">
                  <Info text="Your progress is saved automatically across devices." />
                  <Info text="One secure session per account — your data stays safe." />
                  <Info text="Your account is protected with Google authentication." />
                </div>

                {/* Terms */}
                <p className="mt-7 text-center text-[11px] leading-5 text-slate-500">
                  By continuing, you agree to our{' '}
                  <a href="#" className="text-slate-300 underline underline-offset-4 hover:text-white">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-slate-300 underline underline-offset-4 hover:text-white">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 px-6 py-5 text-center text-xs text-slate-500">
        © 2026 DSC Preparation Platform
      </footer>
    </main>
  )
}

/* ---- Sub-components -------------------------------------------- */

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function Info({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] text-green-400">
        ✓
      </div>
      <span>{text}</span>
    </div>
  )
}