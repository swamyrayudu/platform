// ============================================================
// app/components/landing/AuthCard.tsx — Sign-in card
// ============================================================
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from 'sonner'

interface AuthCardProps {
  error: string | null
  rateLimit: { limited: boolean; retryAfter?: number }
  isSigningIn: boolean
  gsiButtonRef: React.RefObject<HTMLDivElement | null>
}

const ASSURANCES = [
  'Your progress is saved automatically across devices.',
  'One secure session per account — your data stays safe.',
  'Your account is protected with Google authentication.',
]

export default function AuthCard({
  error,
  rateLimit,
  isSigningIn,
  gsiButtonRef,
}: AuthCardProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Missing fields', {
        description: 'Please enter both your email and password.',
      })
      return
    }
    toast.info('Google Sign-In Recommended', {
      description: 'Please click "Continue with Google" above for instant, secure authentication.',
    })
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">

      {/* Header */}
      <div className="text-left">
        <p className="bloom-eyebrow">Get started</p>
        <h2 className="mt-1.5 text-2xl font-medium text-foreground">Welcome</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Sign in to continue your preparation on rsdeducation.
        </p>
      </div>

      {/* Error / rate-limit alerts */}
      {error && (
        <div
          id="auth-error-message"
          className="mt-5 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-2.5 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      {rateLimit.limited && !error && (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          Too many attempts. Please wait before trying again.
        </div>
      )}

      {/* Google sign-in */}
      <div className="mt-6 flex w-full justify-center">
        {isSigningIn ? (
          <div
            id="google-signin-loading"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-xs font-medium text-foreground"
          >
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span>Signing in to rsdeducation…</span>
          </div>
        ) : (
          <div
            id="google-signin-button"
            ref={gsiButtonRef}
            className="flex w-full justify-center"
            style={{ minHeight: '44px' }}
          />
        )}
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">or continue with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email & password */}
      <form onSubmit={handleEmailSignIn} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="h-11 w-full rounded-full border border-border bg-background pl-11 pr-4 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="h-11 w-full rounded-full border border-border bg-background pl-11 pr-11 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
          </button>
        </div>

        {/* Remember me & forgot password */}
        <div className="flex items-center justify-between px-1 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring"
            />
            <span>Remember me</span>
          </label>

          <button
            type="button"
            onClick={() =>
              toast.info('Password Reset', {
                description: 'Sign in with your Google account for automatic recovery.',
              })
            }
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" className="bloom-pill bloom-pill-dark w-full py-3 text-[13px]">
          Continue
        </button>
      </form>

      {/* Assurances */}
      <div className="mt-6 space-y-2.5 border-t border-border pt-5 text-xs text-muted-foreground">
        {ASSURANCES.map((line) => (
          <div key={line} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
            <span className="leading-relaxed">{line}</span>
          </div>
        ))}
      </div>

      {/* Terms */}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-foreground underline underline-offset-4">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-foreground underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>

    </div>
  )
}
