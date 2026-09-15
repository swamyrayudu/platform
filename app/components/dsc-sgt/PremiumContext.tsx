'use client'

// ============================================================
// app/components/dsc-sgt/PremiumContext.tsx — Pro subscription state
// ============================================================
// Premium status is derived from the authenticated user returned by
// /api/auth/me (account_type / subscription_status / expiry), using
// the same rule as the server-side requirePremium() middleware.
// Nothing here is stored in localStorage — the server is the source
// of truth, and payments go through Razorpay.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import type { PublicUser } from '@/lib/auth/types'
import { formatPaise, getPlan, isPlanId, type PlanId } from '@/lib/payments/plans'
import {
  loadRazorpayCheckout,
  type RazorpayFailedResponse,
  type RazorpaySuccessResponse,
} from '@/lib/payments/load-razorpay'

export type PremiumPlan = PlanId | 'free'

export type CheckoutOutcome = 'success' | 'cancelled' | 'failed' | 'error'

interface PremiumContextType {
  isPremium: boolean
  currentPlan: PremiumPlan
  /** ISO timestamp when the current subscription ends (null when free) */
  expiresAt: string | null
  isModalOpen: boolean
  openModal: (source?: string) => void
  closeModal: () => void
  modalSource: string
  /** Opens Razorpay Checkout for a plan and resolves when the flow ends. */
  startCheckout: (planId: PlanId, couponCode?: string, contact?: string) => Promise<CheckoutOutcome>
  isCheckingOut: boolean
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined)

/** Mirror of requirePremium() in lib/auth/session.ts */
export function computeIsPremium(user: PublicUser | null): boolean {
  if (!user) return false
  return (
    user.accountType === 'PREMIUM' &&
    user.subscriptionStatus === 'ACTIVE' &&
    user.subscriptionExpiresAt !== null &&
    new Date(user.subscriptionExpiresAt) > new Date()
  )
}

interface OrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  plan: { id: PlanId; name: string; durationDays: number }
  discountPercent: number
  prefill: { name: string; email: string }
}

const ORDER_ERROR_MESSAGES: Record<string, string> = {
  PAYMENTS_UNAVAILABLE: 'Online payments are not available right now. Please try again later.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
  INVALID_PLAN: 'That plan is no longer available. Please pick another one.',
  GATEWAY_ERROR: 'Could not reach the payment gateway. Please try again.',
  UNAUTHORIZED: 'Please sign in again to continue.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
}

// ---- Surviving a dead tab ----------------------------------------
//
// A candidate paying by UPI leaves the browser entirely: we hand them to
// PhonePe or GPay, and the OS is free to kill the tab while they are gone.
// When that happens Razorpay has their money but our handler never runs,
// so nothing tells us to activate.
//
// So before opening checkout we write the order id down. On the next app
// start we ask the server to settle it against Razorpay's own records.
// The candidate reopens the site and is simply Pro — usually before they
// have noticed anything was wrong.

const PENDING_ORDER_KEY = 'dsc_pending_order'
/** Razorpay orders do not stay payable forever; neither should we keep asking. */
const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000

interface PendingOrder {
  orderId: string
  at: number
}

function rememberPendingOrder(orderId: string) {
  try {
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId, at: Date.now() }))
  } catch {}
}

function forgetPendingOrder() {
  try {
    localStorage.removeItem(PENDING_ORDER_KEY)
  } catch {}
}

function readPendingOrder(): PendingOrder | null {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingOrder
    if (typeof parsed?.orderId !== 'string' || typeof parsed?.at !== 'number') return null
    if (Date.now() - parsed.at > PENDING_ORDER_TTL_MS) {
      forgetPendingOrder()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** The one place that announces a successful activation. Both the normal
 *  handler and the recovery paths go through here, so the wording — and the
 *  renewal-vs-first-purchase distinction — stays consistent. */
function announceActivation(wasPremium: boolean, planName: string, expiresAt: string | null) {
  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null
  toast.success(wasPremium ? '✅ Access extended' : '🎉 Welcome to DSC / SGT Pro!', {
    description: until
      ? `${planName} added. Your Pro access now runs until ${until}.`
      : `${planName} is active. All Mock Tests, Grand Exams and AI Explanations are unlocked.`,
    duration: 7000,
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** How long to keep asking after the checkout window closes.
 *
 *  A UPI collect request is asynchronous: Razorpay pushes a request to the
 *  candidate's PhonePe/GPay, they approve it over there, and only then does
 *  the money move. The checkout window is often closed by that point — they
 *  tap "Done", or the browser is backgrounded while they switch apps — so
 *  the success handler never runs even though the payment is going through.
 *
 *  These delays cover roughly half a minute after the window closes, which
 *  is comfortably longer than a collect request takes to settle. */
const RECOVER_POLL_DELAYS_MS = [0, 3000, 5000, 8000, 14000]

type SettleCheck = 'activated' | 'declined' | 'pending' | 'nothing'

/** Ask the server whether money actually arrived for this order. */
async function checkWithServer(orderId: string): Promise<{
  result: SettleCheck
  user?: PublicUser
  expiresAt?: string
}> {
  let sawPending = false
  for (const delay of RECOVER_POLL_DELAYS_MS) {
    if (delay) await sleep(delay)
    try {
      const res = await fetch('/api/payments/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) continue

      if (data.outcome === 'activated' || data.outcome === 'already_paid') {
        return { result: 'activated', user: data.user, expiresAt: data.user?.subscriptionExpiresAt }
      }
      if (data.outcome === 'failed') return { result: 'declined' }
      if (data.outcome === 'pending') sawPending = true
      // 'no_payment' — nothing yet. Keep asking; a collect request in flight
      // looks exactly like this until the moment it does not.
    } catch {
      // Network blip mid-poll. Try again on the next tick.
    }
  }
  // Out of patience, not out of hope: if Razorpay told us a payment was still
  // in flight, saying "cancelled" here would be the same wrong claim we set
  // out to remove.
  return { result: sawPending ? 'pending' : 'nothing' }
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser, refreshUser } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSource, setModalSource] = useState('header')
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  // The account's own subscription is the only thing that decides this. The
  // admin Free/Pro test switch that used to override it is gone — it lived in
  // localStorage, so a stale 'pro' left there would have kept unlocking Pro
  // with nothing left in the UI to turn it off.
  // On every app start, settle anything left hanging from a checkout the
  // browser did not live long enough to finish. Costs nothing for the
  // overwhelming majority of loads: without a remembered order id this
  // does not touch the network at all.
  const recovering = useRef(false)
  useEffect(() => {
    if (!user || recovering.current) return
    const pending = readPendingOrder()
    if (!pending) return

    recovering.current = true
    void (async () => {
      try {
        const res = await fetch('/api/payments/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderId: pending.orderId }),
        })
        const data = await res.json().catch(() => ({}))

        // 404 means the order is not ours (a different account signed in on
        // this browser) — nothing to recover, and nothing to retry.
        if (res.status === 404 || data.settled) forgetPendingOrder()

        if (res.ok && data.outcome === 'activated') {
          if (data.user) updateUser(data.user as PublicUser)
          toast.success('🎉 Payment confirmed — Pro is active', {
            description:
              'Your payment went through while the app was closed. Everything is unlocked now.',
            duration: 8000,
          })
        } else if (res.ok && data.outcome === 'already_paid' && data.user) {
          updateUser(data.user as PublicUser)
        }
      } catch {
        // Offline or a flaky network: keep the order id and try again on the
        // next start. Being wrong here costs the candidate their money, so
        // this retries rather than gives up.
      } finally {
        recovering.current = false
      }
    })()
  }, [user, updateUser])

  const isPremium = useMemo(() => computeIsPremium(user), [user])

  const currentPlan: PremiumPlan = useMemo(() => {
    if (!isPremium) return 'free'
    return isPlanId(user?.subscriptionPlan) ? user!.subscriptionPlan : 'pro_full'
  }, [isPremium, user])
  const expiresAt = isPremium ? (user?.subscriptionExpiresAt ?? null) : null

  const openModal = useCallback((source = 'header') => {
    setModalSource(source)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    if (isCheckingOut) return // Razorpay overlay owns the screen while checking out
    setIsModalOpen(false)
  }, [isCheckingOut])

  const startCheckout = useCallback(
    async (planId: PlanId, couponCode?: string, contact?: string): Promise<CheckoutOutcome> => {
      if (isCheckingOut) return 'error'
      setIsCheckingOut(true)
      // Read before anything updates the user: it decides whether this is a
      // first purchase or a renewal, and the wording differs.
      const wasPremium = computeIsPremium(user)

      try {
        // 1. Load the checkout script (no-op after first load)
        try {
          await loadRazorpayCheckout()
        } catch {
          toast.error('Could not load the payment window', {
            description: 'Check your internet connection or disable ad blockers and try again.',
          })
          return 'error'
        }

        // 2. Create the order on our server — price is decided server-side
        const res = await fetch('/api/payments/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planId, couponCode: couponCode || undefined }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const code = typeof data.error === 'string' ? data.error : 'UNKNOWN'
          toast.error('Unable to start payment', {
            description: ORDER_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.',
          })
          return 'error'
        }

        const order: OrderResponse = await res.json()
        const plan = getPlan(order.plan.id)

        // Written down BEFORE the window opens: once Razorpay has the screen
        // we may never get another chance to run any code at all.
        rememberPendingOrder(order.orderId)

        // 3. Open Razorpay Checkout and wait for it to finish
        return await new Promise<CheckoutOutcome>((resolve) => {
          let settled = false
          const settle = (outcome: CheckoutOutcome) => {
            if (settled) return
            settled = true
            resolve(outcome)
          }

          const Razorpay = window.Razorpay
          if (!Razorpay) {
            toast.error('Payment window unavailable. Please refresh and try again.')
            settle('error')
            return
          }

          const rzp = new Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'RSD Education',
            description: `${plan.name} — DSC / SGT Pro (${formatPaise(order.amount)})`,
            order_id: order.orderId,
            // A phone number here skips Razorpay's "Enter payer's number"
            // screen — the one that was throwing "Login Failed".
            prefill: contact ? { ...order.prefill, contact } : order.prefill,
            notes: { plan_id: plan.id },
            theme: { color: '#f59e0b' },
            retry: { enabled: true, max_count: 3 },
            // Off deliberately. When this is on, entering a phone number makes
            // Razorpay look the customer up to offer their saved cards and UPI
            // IDs. That lookup is what fails with "Login Failed — Something
            // went wrong", and it is a convenience we do not need: every
            // payment here is a one-off, nothing is ever charged again.
            remember_customer: false,
            modal: {
              // Closing the window is NOT proof that nothing was paid. With
              // UPI the money often moves after this fires, so the old
              // behaviour — announcing "no money was deducted" on the spot —
              // was a claim we had no way to back up, and it was wrong in
              // exactly the case that costs the candidate money.
              ondismiss: () => {
                if (settled) return
                const checking = toast.loading('Checking your payment…', {
                  description:
                    'If you approved a UPI request, this takes a few seconds. Please do not pay again.',
                })

                void (async () => {
                  const check = await checkWithServer(order.orderId)
                  toast.dismiss(checking)
                  if (settled) return

                  if (check.result === 'activated') {
                    forgetPendingOrder()
                    if (check.user) updateUser(check.user)
                    else await refreshUser()
                    setIsModalOpen(false)
                    announceActivation(wasPremium, plan.name, check.expiresAt ?? null)
                    settle('success')
                    return
                  }

                  if (check.result === 'declined') {
                    forgetPendingOrder()
                    toast.error('Payment declined', {
                      description: 'Your bank refused the payment. No money was taken.',
                    })
                    settle('failed')
                    return
                  }

                  if (check.result === 'pending') {
                    toast.warning('Payment still processing', {
                      description:
                        'Your UPI app has not confirmed yet. Do not pay again — reopen the app in a minute and your Pro access will be waiting.',
                      duration: 12000,
                    })
                    settle('failed')
                    return
                  }

                  // Razorpay has no payment against this order. Now we can say
                  // so — and the order id is still remembered, so a late UPI
                  // approval is still picked up on the next app start.
                  toast.info('Payment cancelled', {
                    description: 'No money was deducted. You can upgrade any time.',
                  })
                  settle('cancelled')
                })()
              },
            },
            handler: async (response: RazorpaySuccessResponse) => {
              // 4. Verify on our server (signature + Razorpay lookup) and activate
              try {
                const verifyRes = await fetch('/api/payments/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify(response),
                })
                const data = await verifyRes.json().catch(() => ({}))

                if (verifyRes.ok && data.success) {
                  forgetPendingOrder()
                  if (data.user) updateUser(data.user as PublicUser)
                  else await refreshUser()
                  setIsModalOpen(false)
                  announceActivation(
                    wasPremium,
                    plan.name,
                    typeof data.expiresAt === 'string' ? data.expiresAt : null
                  )
                  settle('success')
                  return
                }

                // Payment went through at Razorpay but our verification did not confirm it.
                // The webhook will still activate the plan; tell the user not to pay again.
                toast.warning('Payment received, activation pending', {
                  description:
                    'We are confirming your payment with Razorpay. Your Pro access will appear within a few minutes — please do not pay again.',
                  duration: 10000,
                })
                console.error('[Payments] verify failed:', data)
                settle('failed')
              } catch (err) {
                console.error('[Payments] verify request error:', err)
                toast.warning('Payment received, activation pending', {
                  description: 'Please refresh in a minute. Do not pay again.',
                  duration: 10000,
                })
                settle('failed')
              }
            },
          })

          rzp.on('payment.failed', (response: RazorpayFailedResponse) => {
            toast.error('Payment failed', {
              description: response.error?.description ?? 'Your bank declined the payment. Please try another method.',
            })
            // Razorpay keeps its window open for retries; outcome settles on dismiss/success
          })

          rzp.open()
        })
      } catch (err) {
        console.error('[Payments] checkout error:', err)
        toast.error('Something went wrong while starting the payment.')
        return 'error'
      } finally {
        setIsCheckingOut(false)
      }
    },
    [isCheckingOut, refreshUser, updateUser, user]
  )

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        currentPlan,
        expiresAt,
        isModalOpen,
        openModal,
        closeModal,
        modalSource,
        startCheckout,
        isCheckingOut,
      }}
    >
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const context = useContext(PremiumContext)
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider')
  }
  return context
}
