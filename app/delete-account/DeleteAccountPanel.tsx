'use client'

// ============================================================
// app/delete-account/DeleteAccountPanel.tsx
// ============================================================
// Signed in: confirm by typing DELETE, then DELETE /api/auth/account.
// Signed out: sign in and come straight back here (/?next=/delete-account).
// ============================================================

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail, Trash2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useAuth } from '@/app/contexts/AuthContext'
import { clearActiveExam } from '@/lib/active-exam'

const SUPPORT_EMAIL = 'rsdeducationplatform@gmail.com'

export default function DeleteAccountPanel() {
  const { user, loading, refreshUser } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not delete your account.')
      clearActiveExam()
      setDeleted(true)
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rsdeducation
        </Link>

        <div className="mt-6 flex items-center gap-2.5">
          <BrandLogo />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Delete your account</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">ఖాతాను తొలగించండి</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-bold sm:text-lg">What is deleted</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Your profile: name, email address, profile picture and preferences.</li>
            <li>Your practice sessions, answers, scores and progress.</li>
            <li>Your mock test attempts, results and leaderboard entries.</li>
            <li>Tests you created in My Tests, with their questions and results.</li>
            <li>Your question reports, sign-in sessions and devices.</li>
            <li>Any remaining Pro access on the account.</li>
          </ul>
          <h2 className="pt-3 text-base font-bold sm:text-lg">What is kept</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For accounting, we keep the Razorpay payment reference and date of any purchase, no
            longer linked to you. Razorpay keeps its own record of the payment under its policy.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Deletion happens immediately and cannot be undone. Signing in again with the same Google
            account later starts a new, empty account.
          </p>
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-base font-bold sm:text-lg">In the app</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Open <strong className="text-foreground">Profile → Account → Delete account</strong>.
          </p>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-base font-bold sm:text-lg">On this page</h2>

          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your sign-in…
            </p>
          ) : deleted ? (
            <p role="status" className="mt-3 text-sm font-semibold text-foreground">
              Your account has been deleted. Thank you for studying with us.
            </p>
          ) : user ? (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as <strong className="text-foreground">{user.email}</strong>.
              </p>
              <label className="block text-sm font-medium" htmlFor="confirm-delete">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deleting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete my account permanently
                </button>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in with the Google account you use for rsdeducation, and you will come back here
                to confirm.
              </p>
              <Link
                href="/?next=/delete-account"
                className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
              >
                Sign in to delete your account
              </Link>
            </div>
          )}
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-base font-bold sm:text-lg">Cannot sign in?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Email us from the address on your account and we will delete it for you and confirm by
            email.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my account')}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Mail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </section>
      </div>
    </main>
  )
}
