// ============================================================
// app/api/admin/plans/route.ts — GET + PATCH /api/admin/plans
// ============================================================
// Admin-only endpoint to view and update subscription plan prices.
// Protected by requireAdmin (server-side role check via JWT + DB).
// Non-admin users always receive 403 ADMIN_REQUIRED.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLANS, PLAN_LIST, isPlanId, type Plan, type PlanId } from '@/lib/payments/plans'

// ---- Types -------------------------------------------------------

interface PlanOverrideRow {
  plan_id: string
  amount_paise: number
  original_amount_paise: number
  name: string | null
  period: string | null
  badge: string | null
  features: string[] | null
  updated_by: string | null
  updated_at: string
}

/** Merged plan: code defaults + DB overrides */
export interface AdminPlanView extends Plan {
  hasOverride: boolean
  updatedAt: string | null
}

// ---- Helpers -----------------------------------------------------

async function fetchOverrides(): Promise<Map<string, PlanOverrideRow>> {
  const { data, error } = await supabaseAdmin
    .from('plan_overrides')
    .select('*')

  if (error) {
    console.error('[AdminPlans] fetchOverrides error:', error)
    return new Map()
  }

  const map = new Map<string, PlanOverrideRow>()
  for (const row of (data ?? []) as PlanOverrideRow[]) {
    map.set(row.plan_id, row)
  }
  return map
}

function mergePlan(plan: Plan, override: PlanOverrideRow | undefined): AdminPlanView {
  if (!override) {
    return { ...plan, hasOverride: false, updatedAt: null }
  }
  return {
    ...plan,
    amountPaise: override.amount_paise,
    originalAmountPaise: override.original_amount_paise,
    name: override.name ?? plan.name,
    period: override.period ?? plan.period,
    badge: override.badge ?? plan.badge,
    features: (override.features as string[] | null) ?? plan.features,
    hasOverride: true,
    updatedAt: override.updated_at,
  }
}

// ---- GET /api/admin/plans ----------------------------------------
// Returns the merged plan list (defaults + any DB overrides).

export const GET = requireAdmin(async (_request, _ctx, _auth) => {
  const overrides = await fetchOverrides()

  const plans: AdminPlanView[] = PLAN_LIST.map((plan) =>
    mergePlan(plan, overrides.get(plan.id))
  )

  return NextResponse.json({ plans })
})

// ---- PATCH /api/admin/plans --------------------------------------
// Body: { planId, amountPaise, originalAmountPaise, name?, period?, badge?, features? }
// Upserts a row in plan_overrides.

export const PATCH = requireAdmin(async (request, _ctx, { user }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const { planId, amountPaise, originalAmountPaise, name, period, badge, features } = body

  if (!isPlanId(planId)) {
    return NextResponse.json({ error: 'INVALID_PLAN_ID' }, { status: 400 })
  }

  if (typeof amountPaise !== 'number' || amountPaise < 100) {
    return NextResponse.json(
      { error: 'INVALID_AMOUNT', message: 'amountPaise must be an integer ≥ 100 (₹1)' },
      { status: 400 }
    )
  }

  if (typeof originalAmountPaise !== 'number' || originalAmountPaise < 100) {
    return NextResponse.json(
      { error: 'INVALID_ORIGINAL_AMOUNT', message: 'originalAmountPaise must be an integer ≥ 100' },
      { status: 400 }
    )
  }

  if (amountPaise > originalAmountPaise) {
    return NextResponse.json(
      { error: 'PRICE_EXCEEDS_ORIGINAL', message: 'Selling price cannot exceed original price' },
      { status: 400 }
    )
  }

  // Validate features if provided
  if (features !== undefined && features !== null) {
    if (
      !Array.isArray(features) ||
      (features as unknown[]).some((f) => typeof f !== 'string')
    ) {
      return NextResponse.json(
        { error: 'INVALID_FEATURES', message: 'features must be an array of strings' },
        { status: 400 }
      )
    }
  }

  const upsertData: Record<string, unknown> = {
    plan_id: planId,
    amount_paise: amountPaise,
    original_amount_paise: originalAmountPaise,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (typeof name === 'string' && name.trim()) upsertData.name = name.trim()
  if (typeof period === 'string' && period.trim()) upsertData.period = period.trim()
  if (typeof badge === 'string') upsertData.badge = badge.trim() || null
  if (Array.isArray(features)) upsertData.features = features

  const { data, error } = await supabaseAdmin
    .from('plan_overrides')
    .upsert(upsertData, { onConflict: 'plan_id' })
    .select('*')
    .single()

  if (error) {
    console.error('[AdminPlans] upsert error:', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  const planDefault = PLANS[planId as PlanId]
  const merged = mergePlan(planDefault, data as PlanOverrideRow)

  console.info('[AdminPlans] Plan override saved:', { planId, amountPaise, by: user.id })

  return NextResponse.json({ success: true, plan: merged })
})

// ---- DELETE /api/admin/plans -------------------------------------
// Resets a plan back to code defaults by removing its override row.

export const DELETE = requireAdmin(async (request, _ctx, _auth) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const { planId } = body

  if (!isPlanId(planId)) {
    return NextResponse.json({ error: 'INVALID_PLAN_ID' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('plan_overrides')
    .delete()
    .eq('plan_id', planId)

  if (error) {
    console.error('[AdminPlans] delete error:', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true, planId, resetToDefault: true })
})
