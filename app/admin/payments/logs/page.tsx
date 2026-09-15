'use client'

// ============================================================
// app/admin/payments/logs/page.tsx — the payment log
// ============================================================
// The transactions list on /admin/payments answers "who paid?". This
// answers "what actually happened?", and it does not take the status
// column's word for anything — see the route for why that matters.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  CircleSlash,
  FileClock,
} from 'lucide-react'
import { formatDateTime, formatPaise } from '@/app/components/admin/shared'

interface PaymentLogEvent {
  at: string
  type: string
  detail: Record<string, unknown>
}

interface PaymentLogEntry {
  razorpayOrderId: string
  userEmail: string | null
  userName: string | null
  planId: string
  amount: number
  currency: string
  createdAt: string
  recordedStatus: string
  ledger: { paymentId: string; activatedAt: string; durationDays: number } | null
  disagreement: string | null
  events: PaymentLogEvent[]
}

/** Plain English for each event type. The raw names mean nothing to anyone
 *  who has not read the routes. */
const EVENT_LABELS: Record<string, string> = {
  PAYMENT_ORDER_CREATED: 'Checkout opened',
  PAYMENT_VERIFIED: 'Payment confirmed with Razorpay',
  PAYMENT_SIGNATURE_INVALID: 'Signature check failed',
  PAYMENT_FAILED: 'Payment declined',
  PAYMENT_WEBHOOK_INVALID: 'Webhook rejected (bad signature)',
  SUBSCRIPTION_ACTIVATED: 'Pro activated',
}

const EVENT_TONES: Record<string, string> = {
  PAYMENT_VERIFIED: 'text-emerald-600 dark:text-emerald-400',
  SUBSCRIPTION_ACTIVATED: 'text-emerald-600 dark:text-emerald-400',
  PAYMENT_SIGNATURE_INVALID: 'text-red-600 dark:text-red-400',
  PAYMENT_FAILED: 'text-red-600 dark:text-red-400',
  PAYMENT_WEBHOOK_INVALID: 'text-red-600 dark:text-red-400',
}

function howActivated(detail: Record<string, unknown>): string | null {
  const via = detail['via']
  if (via === 'checkout') return 'browser reported back'
  if (via === 'webhook') return 'Razorpay webhook'
  if (via === 'recover') return 'recovered on app restart'
  if (via === 'reconcile') return 'admin check with Razorpay'
  return null
}

export default function AdminPaymentLogsPage() {
  const [entries, setEntries] = useState<PaymentLogEntry[]>([])
  const [disagreements, setDisagreements] = useState(0)
  const [unattached, setUnattached] = useState<PaymentLogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payments/logs?limit=40', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError('Could not load the payment log.')
        return
      }
      setEntries(json.entries ?? [])
      setDisagreements(json.disagreements ?? 0)
      setUnattached(json.unattached ?? [])
    } catch {
      setError('Network error while loading the payment log.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/payments"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Payments
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Payment log</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            What actually happened to each order, from the activation ledger and the
            server&apos;s own event trail. The status column is shown last and only for
            comparison — if money was redeemed, the ledger says so whether or not the
            status ever caught up.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Activity className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {disagreements > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-[13px]">
            <p className="font-bold text-red-600 dark:text-red-400">
              {disagreements} order{disagreements > 1 ? 's' : ''} where the records disagree
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Open them below. If the ledger has a payment, that candidate has paid —
              use <strong>Check with Razorpay</strong> on the payments page to settle it.
            </p>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
          {loading ? 'Loading…' : 'No payment activity yet.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const isOpen = open === entry.razorpayOrderId
            return (
              <article
                key={entry.razorpayOrderId}
                className={`overflow-hidden rounded-2xl border bg-card ${
                  entry.disagreement ? 'border-red-500/40' : 'border-border'
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : entry.razorpayOrderId)}
                  className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/40"
                >
                  <span className="mt-0.5 shrink-0">
                    {entry.ledger ? (
                      <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleSlash className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {entry.userName ?? entry.userEmail ?? 'Unknown'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{entry.planId}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {entry.userEmail}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {/* The ledger first, because it is the record that cannot lie. */}
                      {entry.ledger
                        ? `Money redeemed ${formatDateTime(entry.ledger.activatedAt)}`
                        : 'No money redeemed'}
                      {' · '}
                      {entry.events.length} event{entry.events.length === 1 ? '' : 's'}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold text-foreground">
                      {formatPaise(entry.amount)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </span>

                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4">
                    {entry.disagreement && (
                      <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-[12px] font-semibold text-red-600 dark:text-red-400">
                        {entry.disagreement}
                      </p>
                    )}

                    <dl className="mb-4 grid gap-1.5 text-[11px] sm:grid-cols-2">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Order</dt>
                        <dd className="break-all font-mono text-foreground">
                          {entry.razorpayOrderId}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Payment</dt>
                        <dd className="break-all font-mono text-foreground">
                          {entry.ledger?.paymentId ?? '—'}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Ledger</dt>
                        <dd className="text-foreground">
                          {entry.ledger
                            ? `${entry.ledger.durationDays} days, ${formatDateTime(entry.ledger.activatedAt)}`
                            : 'no entry — this money was never redeemed'}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Status column</dt>
                        <dd className="text-foreground">{entry.recordedStatus}</dd>
                      </div>
                    </dl>

                    <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <FileClock className="h-3.5 w-3.5" />
                      Timeline
                    </h4>

                    {entry.events.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground">
                        No events recorded against this order.
                      </p>
                    ) : (
                      <ol className="space-y-2.5 border-l border-border pl-4">
                        {entry.events.map((ev, i) => {
                          const via = howActivated(ev.detail)
                          return (
                            <li key={`${ev.at}-${i}`} className="relative">
                              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border" />
                              <p
                                className={`text-[12px] font-semibold ${
                                  EVENT_TONES[ev.type] ?? 'text-foreground'
                                }`}
                              >
                                {EVENT_LABELS[ev.type] ?? ev.type}
                                {via && (
                                  <span className="font-normal text-muted-foreground"> — {via}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDateTime(ev.at)}
                              </p>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Events that belong to no order. A webhook rejected for a bad
          signature never gets far enough for us to know which order it was
          about — so it would be invisible in the per-order timelines above,
          and it is precisely the thing worth noticing. */}
      {unattached.length > 0 && (
        <section className="mt-9">
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Events with no order
          </h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Rejected webhooks and older activations recorded before the order id
            was logged. Repeated <strong>Webhook rejected</strong> lines mean the
            secret at Razorpay does not match the one on the server.
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {unattached.map((ev, i) => (
              <div
                key={`${ev.at}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3 last:border-0"
              >
                <span
                  className={`text-[12px] font-semibold ${
                    EVENT_TONES[ev.type] ?? 'text-foreground'
                  }`}
                >
                  {EVENT_LABELS[ev.type] ?? ev.type}
                  {typeof ev.detail['reason'] === 'string' && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      — {String(ev.detail['reason'])}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">{formatDateTime(ev.at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
