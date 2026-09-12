// ============================================================
// app/api/admin/mock-tests/generate-series/route.ts
// POST /api/admin/mock-tests/generate-series
// ============================================================
// Generates a whole series of predefined modules for ONE medium:
//
//   Admin → Generate Mock Modules → select medium → select blueprint
//         → generate modules N..M → validate → publish → warm cache
//
// Body:
//   {
//     medium: 'english' | 'telugu',
//     blueprintId?: string,        // default ap_dsc_sgt_official
//     series?: string,             // default grand_mock_v1
//     moduleFrom?: number,         // default 1
//     moduleTo?: number,           // default 100
//     publish?: boolean,           // default true
//     dryRun?: boolean,            // plan + report only, writes nothing
//     replaceExisting?: boolean,   // default true
//     seed?: number
//   }
//
// A dry run is the safe way to inspect the coverage/repetition report before
// committing anything to the database.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getBlueprintById } from '@/lib/mock-tests/blueprints'
import { planModuleSeries } from '@/lib/mock-tests/series-generator'
import { persistModuleSeries, DEFAULT_SERIES } from '@/lib/mock-tests/series-store'
import { loadUsageCounts } from '@/lib/mock-tests/usage'
import { isExamMedium } from '@/lib/mock-tests/question-bank'

/** Generating 100 modules reads the whole question bank; allow headroom. */
export const maxDuration = 300

const MAX_MODULES_PER_RUN = 200

interface AdminAuthContext {
  user?: { id?: string }
}

export const POST = requireAdmin(async (
  request: Request,
  _context: unknown,
  auth: AdminAuthContext
) => {
  try {
    const body = await request.json().catch(() => ({}))

    const rawMedium = String(body.medium ?? '').toLowerCase()
    if (!isExamMedium(rawMedium)) {
      return NextResponse.json(
        { success: false, error: "medium must be 'english' or 'telugu'" },
        { status: 400 }
      )
    }
    const medium = rawMedium

    const blueprintId = String(body.blueprintId ?? 'ap_dsc_sgt_official')
    const blueprint = getBlueprintById(blueprintId)
    if (!blueprint) {
      return NextResponse.json(
        { success: false, error: `Blueprint not found: ${blueprintId}` },
        { status: 400 }
      )
    }

    const series = String(body.series ?? DEFAULT_SERIES)
    const moduleFrom = Math.max(1, Number(body.moduleFrom ?? 1))
    const moduleTo = Math.max(moduleFrom, Number(body.moduleTo ?? 100))
    const dryRun = Boolean(body.dryRun ?? false)
    const publish = Boolean(body.publish ?? true)
    const replaceExisting = Boolean(body.replaceExisting ?? true)
    const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : undefined

    if (moduleTo - moduleFrom + 1 > MAX_MODULES_PER_RUN) {
      return NextResponse.json(
        {
          success: false,
          error: `Refusing to generate more than ${MAX_MODULES_PER_RUN} modules in one request. Split the range.`,
        },
        { status: 400 }
      )
    }

    // Existing global usage seeds the "least used first" ordering so a second
    // run extends coverage instead of re-picking the same questions.
    const existingUsage = await loadUsageCounts(medium)

    const plan = await planModuleSeries({
      blueprint,
      medium,
      moduleFrom,
      moduleTo,
      series,
      existingUsage,
      ...(seed !== undefined ? { seed } : {}),
    })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        medium,
        series,
        blueprint_id: blueprint.id,
        modules_planned: plan.modules.length,
        report: plan.report,
        sample_module: plan.modules[0]
          ? {
              module_number: plan.modules[0].module_number,
              questions: plan.modules[0].questions.length,
              difficulty_counts: plan.modules[0].difficulty_counts,
              section_topic_spread: plan.modules[0].section_topic_spread,
            }
          : null,
      })
    }

    const result = await persistModuleSeries(plan, {
      blueprint,
      series,
      createdBy: auth?.user?.id ?? null,
      publish,
      replaceExisting,
    })

    return NextResponse.json({
      success: result.failed === 0,
      medium,
      series,
      blueprint_id: blueprint.id,
      modules_written: result.modules.filter((m) => m.error === null).length,
      modules_failed: result.failed,
      usage_rows_written: result.usage_rows_written,
      report_id: result.report_id,
      report: result.report,
      failures: result.modules
        .filter((m) => m.error !== null)
        .slice(0, 20)
        .map((m) => ({ module_number: m.module_number, error: m.error })),
    })
  } catch (err: unknown) {
    console.error('[POST generate-series]', err)
    const message = err instanceof Error ? err.message : 'Series generation failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
