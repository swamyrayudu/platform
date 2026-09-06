// ============================================================
// app/api/payments/plans/route.ts — GET /api/payments/plans
// ============================================================
// Returns the effective subscription plan list for the premium
// modal. Merges admin-editable DB overrides with code defaults.
//
// This is the single source of truth for prices shown to users.
// If an admin changes a price via /api/admin/plans, the next
// call to this endpoint reflects it immediately — no redeploy.
//
// Requires authentication (any logged-in user).
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLAN_LIST, type Plan } from '@/lib/payments/plans'

interface PlanOverrideRow {
  plan_id: string
  amount_paise: number
  original_amount_paise: number
  name: string | null
  period: string | null
  badge: string | null
  features: string[] | null
}

async function getEffectivePlans(): Promise<Plan[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('plan_overrides')
      .select('plan_id, amount_paise, original_amount_paise, name, period, badge, features')

    if (error || !data) return PLAN_LIST

    const overrideMap = new Map<string, PlanOverrideRow>()
    for (const row of data as PlanOverrideRow[]) {
      overrideMap.set(row.plan_id, row)
    }

    return PLAN_LIST.map((plan): Plan => {
      const override = overrideMap.get(plan.id)
      if (!override) return plan
      return {
        ...plan,
        amountPaise: override.amount_paise,
        originalAmountPaise: override.original_amount_paise,
        name: override.name ?? plan.name,
        period: override.period ?? plan.period,
        badge: override.badge ?? plan.badge,
        features: (override.features as string[] | null) ?? plan.features,
      }
    })
  } catch {
    // Never fail the UI due to a DB override lookup error
    return PLAN_LIST
  }
}

export const GET = requireAuth(async (_request, _ctx, _auth) => {
  const plans = await getEffectivePlans()
  return NextResponse.json({ plans })
})
