// ============================================================
// app/components/landing/AuthCard.tsx — Sign-in card
// ============================================================
// "Continue with Email" and "Continue with Google". Email + password is only
// for accounts an admin made (for example the Google Play reviewer's), and the
// email button shows only while the admin switch at /admin/login-accounts is
// on. Both end in the same session (app/page.tsx). Above them, a direct
// download of the Android APK from this site (public/downloads).
// ============================================================
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Check, ArrowLeft, Smartphone, Download } from 'lucide-react'
import { toast } from 'sonner'

/**
 * The Android app, served from this site (public/downloads). To release a new
 * APK, replace that file and update the version and size here.
 */
const ANDROID_APK = { href: '/downloads/rsd-education.apk', version: '1.0.3', size: '30 MB' }

interface AuthCardProps {
  error: string | null
  rateLimit: { limited: boolean; retryAfter?: number }
  isSigningIn: boolean
  gsiButtonRef: React.RefObject<HTMLDivElement | null>
  /** The admin switch; while false there is no email option at all. */
  emailEnabled: boolean
  onEmailSignIn: (email: string, password: string) => Promise<void>
}

const ASSURANCES = [
  'Your progress is saved automatically across devices.',
  'One secure session per account — your data stays safe.',
  'Your account is protected with Google authentication.',
]

const inputClass =
  'h-11 w-full rounded-full border border-border bg-background pl-11 pr-11 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15'
const iconClass = 'absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'

export default function AuthCard({ error, rateLimit, isSigningIn, gsiButtonRef, emailEnabled, onEmailSignIn }: AuthCardProps) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const showEmail = emailOpen && emailEnabled

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Missing fields', { description: 'Please enter both your email and password.' })
      return
    }
    void onEmailSignIn(email.trim(), password)
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

      {/* Android app: a direct APK download, above the sign-in options. */}
      {!showEmail && (
        <a
          href={ANDROID_APK.href}
          download="rsd-education.apk"
          type="application/vnd.android.package-archive"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-secondary/60 px-4 py-3 transition-colors hover:bg-secondary"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Smartphone className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[13px] font-semibold text-foreground">Download the Android app</span>
            <span className="block text-[11px] text-muted-foreground">
              APK · v{ANDROID_APK.version} · {ANDROID_APK.size}
            </span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        </a>
      )}

      {/* Choice: email or Google. The Google button stays mounted (only hidden)
          so Google's rendered button survives opening the email panel. */}
      <div className={showEmail ? 'hidden' : 'mt-4 space-y-3'}>
        {emailEnabled && (
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            disabled={isSigningIn}
            className="bloom-pill bloom-pill-dark flex w-full items-center justify-center gap-2 py-3 text-[13px] disabled:opacity-60"
          >
            <Mail className="h-4 w-4" strokeWidth={1.8} />
            Continue with Email
          </button>
        )}
        <div className="flex w-full justify-center">
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
      </div>

      {/* Email + password */}
      {showEmail && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setEmailOpen(false)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All sign-in options
          </button>
          <h3 className="text-sm font-semibold text-foreground">Sign in with email</h3>

          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="relative">
              <Mail className={iconClass} strokeWidth={1.6} />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={inputClass}
              />
            </div>

            <div className="relative">
              <Lock className={iconClass} strokeWidth={1.6} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
              </button>
            </div>

            <button type="submit" disabled={isSigningIn} className="bloom-pill bloom-pill-dark w-full py-3 text-[13px] disabled:opacity-60">
              {isSigningIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      )}

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
