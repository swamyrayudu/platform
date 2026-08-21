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

  // Handle Google Identity Services (GSI) credential
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
        toast.success('Signed in successfully!', {
          description: 'Welcome to rsdeducation.',
        })
        await refreshUser()
        // Route based on onboarding status
        if (data.user && data.user.onboardingCompleted === false) {
          router.push('/onboarding')
        } else {
          router.push('/home')
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
      setIsSigningIn(false)
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

      if (gsiButtonRef.current) {
        const btnWidth = Math.max(280, Math.min(gsiButtonRef.current.offsetWidth || 340, 380))
        window.google.accounts.id.renderButton(gsiButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: btnWidth,
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

  // Avoid flash during auth check
  if (loading) {
    return <LoadingScreen message="Checking authentication..." />
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      
      {/* 1. Sticky Navigation Header */}
      <LandingHeader />

      {/* 2. Main Page Layout */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hero & Auth Card Section */}
        <div className="grid items-start gap-12 lg:grid-cols-12">
          {/* Left Column: Hero, Laptop Mockup, Features, Stats */}
          <HeroContent />

          {/* Right Column: Google Sign-in Card */}
          <AuthCard
            error={error}
            rateLimit={rateLimit}
            isSigningIn={isSigningIn}
            gsiButtonRef={gsiButtonRef}
          />
        </div>

        {/* 3. Bottom 4-Column Feature Highlights */}
        <FeatureHighlights />

        {/* 4. Footer */}
        <LandingFooter />

      </main>
    </div>
  )
}