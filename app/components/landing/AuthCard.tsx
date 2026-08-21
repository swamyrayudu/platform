// ============================================================
// app/components/landing/AuthCard.tsx — Right Authentication Card
// ============================================================
'use client'

import React, { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react'
import { toast } from 'sonner'

interface AuthCardProps {
  error: string | null
  rateLimit: { limited: boolean; retryAfter?: number }
  isSigningIn: boolean
  gsiButtonRef: React.RefObject<HTMLDivElement | null>
}

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
    <div className="lg:col-span-5">
      <div className="rounded-3xl border border-border/90 bg-card p-7 shadow-xl backdrop-blur-sm sm:p-9">
        
        {/* Header */}
        <div className="text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Get Started</p>
          <h2 className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">
            Welcome
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Sign in to continue your preparation journey on rsdeducation.
          </p>
        </div>

        {/* Error / Rate limit alerts */}
        {error && (
          <div
            id="auth-error-message"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive"
          >
            {error}
          </div>
        )}

        {rateLimit.limited && !error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            Too many attempts. Please wait before trying again.
          </div>
        )}

        {/* Google Sign-in */}
        <div className="mt-6 flex w-full justify-center">
          {isSigningIn ? (
            <div
              id="google-signin-loading"
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground shadow-2xs"
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

        {/* Divider: or continue with email */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/80" />
          <span className="text-[11px] text-muted-foreground">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-border/80" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-3.5">
          {/* Email Input */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="h-10.5 w-full rounded-xl border border-border bg-background pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-10.5 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
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
              onClick={() => toast.info('Password Reset', { description: 'Sign in with your Google account for automatic recovery.' })}
              className="text-primary hover:underline underline-offset-4 font-medium"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>
        </form>

        {/* Security Bullets */}
        <div className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
            <span>Your progress is saved automatically across devices.</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
            <span>One secure session per account — your data stays safe.</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
            <span>Your account is protected with Google authentication.</span>
          </div>
        </div>

        {/* Terms of Service & Privacy Policy */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing, you agree to our{' '}
          <a href="#" className="underline underline-offset-4 text-foreground hover:text-primary">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="underline underline-offset-4 text-foreground hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>

      </div>
    </div>
  )
}
