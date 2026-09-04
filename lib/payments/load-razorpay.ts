// ============================================================
// lib/payments/load-razorpay.ts — Razorpay Checkout loader (CLIENT)
// ============================================================
// Loads https://checkout.razorpay.com/v1/checkout.js on demand,
// exactly once, only when a user actually opens the checkout.
// Nothing else on the site pays the cost of this script.
// ============================================================

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayFailedResponse {
  error: {
    code: string
    description: string
    reason?: string
    source?: string
    step?: string
    metadata?: { order_id?: string; payment_id?: string }
  }
}

export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string
  order_id: string
  handler: (response: RazorpaySuccessResponse) => void
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  modal?: {
    ondismiss?: () => void
    escape?: boolean
    backdropclose?: boolean
    confirm_close?: boolean
  }
  retry?: { enabled?: boolean; max_count?: number }
}

export interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailedResponse) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

let loadPromise: Promise<void> | null = null

/** Resolve once window.Razorpay is available. Rejects if the script cannot load. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout can only load in the browser'))
  }
  if (window.Razorpay) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout')))
      return
    }

    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      script.remove()
      reject(new Error('Failed to load Razorpay Checkout'))
    }
    document.body.appendChild(script)
  })

  return loadPromise
}
