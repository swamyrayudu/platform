// ============================================================
// app/api/dsc-sgt/mock-tests/route.ts
// GET /api/dsc-sgt/mock-tests — List published mock modules
// ============================================================
// Query parameters:
//   medium   english | telugu          (required in practice; defaults to english)
//   series   e.g. grand_mock_v1        (optional)
//   category grand_mock | subject_mock | previous_paper (optional)
//   search   title substring           (optional)
//   page     1-based MODULE page       (default 1)
//   pageSize modules per page          (default 20, max 100)
//
// This is MODULE pagination. Question pagination inside a module is a
// separate concern, served by /api/dsc-sgt/mock-tests/[id]/questions.
//
// The number of modules returned is limited only by the data — there is no
// hard-coded cap on how many modules can exist.
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { listMockTestModules, MODULE_PAGE_SIZE_DEFAULT } from '@/lib/mock-tests/modules'
import { isExamMedium } from '@/lib/mock-tests/question-bank'

export async function GET(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id ?? null

    const url = new URL(request.url)
    const rawMedium = (url.searchParams.get('medium') || 'english').toLowerCase()
    const medium = isExamMedium(rawMedium) ? rawMedium : 'english'

    const series = url.searchParams.get('series') || undefined
    const category = url.searchParams.get('category') || undefined
    const search = url.searchParams.get('search') || undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize =
      parseInt(url.searchParams.get('pageSize') || String(MODULE_PAGE_SIZE_DEFAULT), 10) ||
      MODULE_PAGE_SIZE_DEFAULT

    const result = await listMockTestModules(userId, {
      medium,
      series,
      category,
      search,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
