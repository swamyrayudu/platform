// ============================================================
// app/api/admin/dashboard/route.ts — GET /api/admin/dashboard
// ============================================================
// Admin-only API endpoint. Protected by requireAdmin middleware.
// Normal users receive 403 ADMIN_REQUIRED.
// Returns platform stats + recent payments for the admin UI.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { toPublicUser } from '@/lib/auth/types'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface UserStats {
  total: number
  premium: number
  free: number
  newToday: number
  newThisWeek: number
}

interface RevenueStats {
  totalRevenuePaise: number
  successfulPayments: number
  failedPayments: number
  pendingPayments: number
}

interface RecentPayment {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  planId: string
  amount: number
  currency: string
  status: string
  couponCode: string | null
  discountPercent: number
  paidAt: string | null
  createdAt: string
}

async function getUserStats(): Promise<UserStats> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)

  // Total + premium counts
  const { data: counts, error: countErr } = await supabaseAdmin
    .from('users')
    .select('account_type, subscription_status, subscription_expires_at, created_at')

  if (countErr || !counts) {
    return { total: 0, premium: 0, free: 0, newToday: 0, newThisWeek: 0 }
  }

  let premium = 0
  let newToday = 0
  let newThisWeek = 0

  for (const u of counts) {
    const isActivePremium =
      u.account_type === 'PREMIUM' &&
      u.subscription_status === 'ACTIVE' &&
      u.subscription_expires_at &&
      new Date(u.subscription_expires_at) > now

    if (isActivePremium) premium++

    const created = new Date(u.created_at)
    if (created >= todayStart) newToday++
    if (created >= weekStart) newThisWeek++
  }

  return {
    total: counts.length,
    premium,
    free: counts.length - premium,
    newToday,
    newThisWeek,
  }
}

async function getRevenueStats(): Promise<RevenueStats> {
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('amount, status')

  if (error || !data) {
    return { totalRevenuePaise: 0, successfulPayments: 0, failedPayments: 0, pendingPayments: 0 }
  }

  let totalRevenuePaise = 0
  let successfulPayments = 0
  let failedPayments = 0
  let pendingPayments = 0

  for (const order of data) {
    if (order.status === 'PAID') {
      totalRevenuePaise += order.amount
      successfulPayments++
    } else if (order.status === 'FAILED') {
      failedPayments++
    } else {
      pendingPayments++
    }
  }

  return { totalRevenuePaise, successfulPayments, failedPayments, pendingPayments }
}

async function getRecentPayments(limit = 20): Promise<RecentPayment[]> {
  // Join payment_orders with users for display
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select(`
      id,
      user_id,
      plan_id,
      amount,
      currency,
      status,
      coupon_code,
      discount_percent,
      paid_at,
      created_at,
      users!payment_orders_user_id_fkey (
        email,
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('[AdminDashboard] getRecentPayments error:', error)
    return []
  }

  return (data as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>
    const user = r['users'] as Record<string, unknown> | null
    return {
      id: r['id'] as string,
      userId: r['user_id'] as string,
      userEmail: (user?.['email'] as string | null) ?? null,
      userName: (user?.['name'] as string | null) ?? null,
      planId: r['plan_id'] as string,
      amount: r['amount'] as number,
      currency: r['currency'] as string,
      status: r['status'] as string,
      couponCode: (r['coupon_code'] as string | null) ?? null,
      discountPercent: r['discount_percent'] as number,
      paidAt: (r['paid_at'] as string | null) ?? null,
      createdAt: r['created_at'] as string,
    }
  })
}

export const GET = requireAdmin(async (_request, _ctx, { user }) => {
  const [userStats, revenueStats, recentPayments] = await Promise.all([
    getUserStats(),
    getRevenueStats(),
    getRecentPayments(20),
  ])

  return NextResponse.json({
    admin: toPublicUser(user),
    userStats,
    revenueStats,
    recentPayments,
    timestamp: new Date().toISOString(),
  })
})
