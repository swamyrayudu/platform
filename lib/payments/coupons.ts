// ============================================================
// lib/payments/coupons.ts — Coupon definitions (SERVER ONLY)
// ============================================================
// Coupons are validated on the server only. The client never
// computes a discounted amount itself; it asks /api/payments/coupons
// and the same lookup is repeated when the order is created.
// ============================================================

export interface Coupon {
  code: string
  discountPercent: number
  /** ISO date after which the coupon stops working (optional) */
  expiresAt?: string
}

const COUPONS: Record<string, Coupon> = {
  APDSC50: { code: 'APDSC50', discountPercent: 20 },
  PRO100: { code: 'PRO100', discountPercent: 20 },
}

export function normalizeCouponCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  if (!code || code.length > 32) return null
  return code
}

/** Returns the coupon if it exists and is not expired, otherwise null. */
export function findCoupon(raw: unknown): Coupon | null {
  const code = normalizeCouponCode(raw)
  if (!code) return null
  const coupon = COUPONS[code]
  if (!coupon) return null
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return null
  return coupon
}
