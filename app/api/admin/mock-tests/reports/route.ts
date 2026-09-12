// ============================================================
// app/api/admin/mock-tests/reports/route.ts
// GET /api/admin/mock-tests/reports
// ============================================================
// Coverage / repetition audit for generated module series.
//
// Query parameters:
//   medium  english | telugu  (optional — omit for both)
//   series  e.g. grand_mock_v1
//   limit   how many past reports to return (default 5)
//
// Returns the stored generation reports plus live usage statistics, so the
// claim "repetition was minimised" can actually be verified rather than
// taken on trust.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUsageStats } from '@/lib/mock-tests/usage'
import { isExamMedium, EXAM_MEDIUMS, type ExamMedium } from '@/lib/mock-tests/question-bank'
import { countPublishedByMedium } from '@/lib/mock-tests/modules'

export const GET = requireAdmin(async (request: Request) => {
  try {
    const url = new URL(request.url)
    const rawMedium = (url.searchParams.get('medium') || '').toLowerCase()
    const series = url.searchParams.get('series') || undefined
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10) || 5))

    const mediums: ExamMedium[] = isExamMedium(rawMedium) ? [rawMedium] : EXAM_MEDIUMS

    let reportQuery = supabaseAdmin
      .from('mock_generation_reports')
      .select('*')
      .in('medium', mediums)
      .order('created_at', { ascending: false })
      .limit(limit * mediums.length)

    if (series) reportQuery = reportQuery.eq('series', series)

    const { data: reports, error: reportErr } = await reportQuery

    const usage = await Promise.all(mediums.map((m) => getUsageStats(m)))
    const publishedCounts = await countPublishedByMedium(series)

    return NextResponse.json({
      success: true,
      published_module_counts: publishedCounts,
      usage_stats: usage,
      reports: reports ?? [],
      reports_error: reportErr?.message ?? null,
    })
  } catch (err: unknown) {
    console.error('[GET /api/admin/mock-tests/reports]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
