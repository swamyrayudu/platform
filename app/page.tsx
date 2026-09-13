'use client'

// ============================================================
// app/page.tsx — Modular Landing & Login Page (Clean Architecture)
// ============================================================

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getOrCreateDeviceId } from '@/lib/auth/device-id'
import { useAuth } from './contexts/AuthContext'
import LandingHeader from './components/landing/LandingHeader'
import HeroContent from './components/landing/HeroContent'
import AuthCard from './components/landing/AuthCard'
import FeatureHighlights from './components/landing/FeatureHighlights'
import LandingFooter from './components/landing/LandingFooter'
import { LoadingScreen } from '@/components/ui/loading-screen'

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
  const { user, loading, updateUser } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<{ limited: boolean; retryAfter?: number }>({
    limited: false,
  })
  const gsiButtonRef = useRef<HTMLDivElement>(null)
  const navGsiButtonRef = useRef<HTMLDivElement>(null)
  const navGsiCompactRef = useRef<HTMLDivElement>(null)
  const gsiLoaded = useRef(false)

  // Inlined at build time, so the header can decide up front whether to show
  // a Google button or fall back to a plain link.
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Must agree with the destination chosen right after sign-in below,
      // or the two send the same user to two different places at once.
      router.replace(user.onboardingCompleted === false ? '/onboarding' : '/home')
    }
  }, [user, loading, router])

  // Handle Google Identity Services (GSI) credential
  const handleCredentialResponse = async (response: { credential: string }) => {
    // Dismiss the One Tap card so it does not hang around over the redirect.
    window.google?.accounts?.id?.cancel()
    setIsSigningIn(true)
    setError(null)
    setRateLimit({ limited: false })

    let navigating = false

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
        toast.success('Signed in successfully!', {
          description: 'Welcome to rsdeducation.',
        })
        // This response already carries the freshly signed-in user, so the
        // refetch that used to sit here was a second round trip to a server
        // in another region for something we were holding. Adopt it directly
        // and navigate in the same tick.
        if (data.user) updateUser(data.user)
        // Route based on onboarding status
        navigating = true
        if (data.user && data.user.onboardingCompleted === false) {
          router.replace('/onboarding')
        } else {
          router.replace('/home')
        }
        return
      }

      if (res.status === 429) {
        const errorMsg = `Too many login attempts. Please try again in ${data.retryAfter ?? 60} seconds.`
        setRateLimit({ limited: true, retryAfter: data.retryAfter })
        setError(errorMsg)
        toast.error('Rate limited', { description: errorMsg })
        return
      }

      if (data.error === 'AUTH_NONCE_REQUIRED') {
        const errorMsg = 'Your sign-in session expired. Please try again.'
        setError(errorMsg)
        toast.error('Sign-in expired', { description: errorMsg })
        return
      }

      if (data.error === 'AUTH_INVALID_TOKEN') {
        const errorMsg = 'Authentication failed. Please try signing in again.'
        setError(errorMsg)
        toast.error('Authentication Error', { description: errorMsg })
        return
      }

      setError('Login failed. Please try again.')
      toast.error('Login Failed', { description: 'Please try signing in again.' })
    } catch {
      const errorMsg = 'Network error. Please check your connection and try again.'
      setError(errorMsg)
      toast.error('Connection Error', { description: errorMsg })
    } finally {
      // Leaving it set on the success path keeps the button in its pending
      // state until the new page paints, instead of flashing back to idle.
      if (!navigating) setIsSigningIn(false)
    }
  }

  // Initialise Google GSI
  useEffect(() => {
    if (loading || user || gsiLoaded.current) return

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.')
      return
    }

    // Claim the slot synchronously. StrictMode double-invokes effects and Fast
    // Refresh re-runs them, and a second initialize() discards the first —
    // which silently breaks the One Tap prompt.
    gsiLoaded.current = true

    let cancelled = false

    const setup = async () => {
      if (cancelled) return

      // Fetch a single-use nonce and hand it to Google. It is embedded in the
      // returned ID token, and /api/auth/google requires it to match the
      // HttpOnly cookie the server set — which binds the token to this browser
      // so a captured token cannot be replayed from elsewhere.
      //
      // Kicked off alongside, never awaited: this only boots the sign-in
      // function so the click that follows does not pay for its cold start.
      fetch('/api/auth/google', { method: 'GET' }).catch(() => {})

      let nonce: string | undefined
      try {
        const res = await fetch('/api/auth/nonce', { credentials: 'include' })
        if (res.ok) nonce = (await res.json()).nonce
      } catch {
        // Fall through: without a nonce the server rejects the sign-in, and
        // the user sees the normal "try again" error rather than a silent fail.
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        // One Tap runs on FedCM in current Chrome; without this the prompt is
        // simply never shown.
        use_fedcm_for_prompt: true,
        ...(nonce ? { nonce } : {}),
      })

      // Google's own button is the only compliant way to offer Google sign-in,
      // so we render it in three places and let CSS pick the right one.
      // `shape: 'pill'` is the closest official option to our button language.
      const base = { theme: 'outline', size: 'large', logo_alignment: 'left' } as const

      if (gsiButtonRef.current) {
        const btnWidth = Math.max(280, Math.min(gsiButtonRef.current.offsetWidth || 340, 380))
        window.google.accounts.id.renderButton(gsiButtonRef.current, {
          ...base,
          type: 'standard',
          shape: 'pill',
          text: 'continue_with',
          width: btnWidth,
        })
      }

      // Header, wide: "Sign in with Google" reads shorter than "Continue with".
      if (navGsiButtonRef.current) {
        window.google.accounts.id.renderButton(navGsiButtonRef.current, {
          ...base,
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          width: 200,
        })
      }

      // Header, narrow: a compact "Sign in" so the bar stays uncluttered.
      // Not `type: 'icon'` — that variant ships its logo as an <svg> with no
      // width/height, which collapses to 0x0 under Tailwind's preflight.
      if (navGsiCompactRef.current) {
        window.google.accounts.id.renderButton(navGsiCompactRef.current, {
          ...base,
          type: 'standard',
          shape: 'pill',
          text: 'signin',
          width: 110,
        })
      }

      // One Tap (the automatic "continue as <name>" card) is opt-in via
      // NEXT_PUBLIC_GOOGLE_ONE_TAP, and off by default.
      //
      // It runs on FedCM, which needs three things lined up: a Google session
      // in the browser, third-party sign-in allowed for the site, and this
      // exact origin listed under the OAuth client's Authorized JavaScript
      // origins. When any is missing, Google's library logs
      // "FedCM get() rejects with NetworkError" — an error we cannot catch,
      // because it is thrown inside their code, and which trips the Next dev
      // overlay on every load.
      //
      // The rendered buttons below already show an account picker when
      // clicked, so the sign-in flow loses nothing by leaving this off until
      // the OAuth client is configured for the origin being served.
      if (process.env.NEXT_PUBLIC_GOOGLE_ONE_TAP === 'true') {
        window.google.accounts.id.prompt()
      }
    }

    // Already loaded (a remount, or Fast Refresh) — reuse it rather than
    // fetching the library a second time.
    if (window.google?.accounts?.id) {
      void setup()
      return () => {
        cancelled = true
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => void setup()
    document.head.appendChild(script)

    // The tag is left in place deliberately: removing it does not unload the
    // library, and tearing it down mid-flight breaks an in-progress sign-in.
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  // Avoid flash during auth check
  if (loading) {
    return <LoadingScreen message="Checking authentication..." />
  }

  return (
    // Warm cream canvas; the page itself floats on it as a white shell,
    // exactly the way the reference design is framed.
    <div className="min-h-screen bg-background px-0 py-0 text-foreground transition-colors duration-200 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <div className="bloom-shell mx-auto max-w-[84rem] overflow-hidden">

        {/* 1. Sticky Navigation Header — signs in with Google directly */}
        <LandingHeader
          googleEnabled={googleEnabled}
          gsiButtonRef={navGsiButtonRef}
          gsiCompactRef={navGsiCompactRef}
        />

        {/* 2. Main Page Layout */}
        <main className="px-4 pb-8 sm:px-8 lg:px-12">

          {/* Hero, intro, bento, use cases */}
          <HeroContent />

          {/* 3. Sign-in — copy on the left, the auth card on the right */}
          <section
            id="sign-in"
            className="mt-14 grid scroll-mt-24 items-start gap-8 lg:mt-20 lg:grid-cols-2 lg:gap-16"
          >
            <div>
              <p className="bloom-eyebrow">Join rsdeducation</p>
              <h2 className="mt-2 text-3xl font-medium leading-tight text-foreground sm:text-[2.5rem]">
                Start where you
                <br />
                left off
              </h2>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Sign in with Google and your practice history, mock test scores
                and topic map follow you to every device you study on.
              </p>
            </div>

            <AuthCard
              error={error}
              rateLimit={rateLimit}
              isSigningIn={isSigningIn}
              gsiButtonRef={gsiButtonRef}
            />
          </section>

          {/* 4. Closing value-prop band */}
          <FeatureHighlights />

          {/* 5. Footer */}
          <LandingFooter />

        </main>
      </div>
    </div>
  )
}