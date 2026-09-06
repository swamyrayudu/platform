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

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
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

export type DevTierOverride = 'auto' | 'free' | 'pro'

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
  startCheckout: (planId: PlanId, couponCode?: string) => Promise<CheckoutOutcome>
  isCheckingOut: boolean
  devTierOverride: DevTierOverride
  setDevTierOverride: (tier: DevTierOverride) => void
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

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser, refreshUser } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSource, setModalSource] = useState('header')
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const [devTierOverride, setDevTierOverrideState] = useState<DevTierOverride>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dsc_dev_tier_override')
        if (saved === 'free' || saved === 'pro') return saved
      } catch {}
    }
    return 'auto'
  })

  const setDevTierOverride = useCallback((tier: DevTierOverride) => {
    setDevTierOverrideState(tier)
    try {
      if (tier === 'auto') {
        localStorage.removeItem('dsc_dev_tier_override')
      } else {
        localStorage.setItem('dsc_dev_tier_override', tier)
      }
    } catch {}
    toast.success(
      tier === 'auto'
        ? 'Switched to live account subscription status'
        : tier === 'free'
        ? 'Testing as Free User (locks & limits active)'
        : 'Testing as Pro User (all features unlocked)'
    )
  }, [])

  const isPremium = useMemo(() => {
    if (devTierOverride === 'free') return false
    if (devTierOverride === 'pro') return true
    return computeIsPremium(user)
  }, [user, devTierOverride])

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
    async (planId: PlanId, couponCode?: string): Promise<CheckoutOutcome> => {
      if (isCheckingOut) return 'error'
      setIsCheckingOut(true)

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
            prefill: order.prefill,
            notes: { plan_id: plan.id },
            theme: { color: '#f59e0b' },
            retry: { enabled: true, max_count: 3 },
            modal: {
              ondismiss: () => {
                if (settled) return
                toast.info('Payment cancelled', {
                  description: 'No money was deducted. You can upgrade any time.',
                })
                settle('cancelled')
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
                  if (data.user) updateUser(data.user as PublicUser)
                  else await refreshUser()
                  setIsModalOpen(false)
                  toast.success('🎉 Welcome to DSC / SGT Pro!', {
                    description: `${plan.name} is active. All Mock Tests, Grand Exams and AI Explanations are unlocked.`,
                    duration: 6000,
                  })
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
    [isCheckingOut, refreshUser, updateUser]
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
        devTierOverride,
        setDevTierOverride,
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
