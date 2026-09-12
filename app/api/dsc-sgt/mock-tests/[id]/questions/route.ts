// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/questions/route.ts
// GET /api/dsc-sgt/mock-tests/[id]/questions?start=1&limit=50
// ============================================================
// Chunked delivery of client-safe questions.
//
// SECURITY: authentication is REQUIRED, and a Pro-only module is refused to
// non-premium users. This endpoint NEVER returns correct_answer or explanation.
// The answer key lives under a separate, server-only cache key and is read
// only during grading.
//
// CHUNKING:
//   ?start=1&limit=50    -> Q1   to Q50
//   ?start=51&limit=50   -> Q51  to Q100
//   ?start=101&limit=60  -> Q101 to Q160
//
// Chunking does NOT mean one request per question. Each request is served
// from a SINGLE Redis read of the whole fixed module (or, on a cache miss,
// ONE batched DB fetch that then re-warms the cache under a single-flight
// lock so concurrent misses cannot stampede PostgreSQL).
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth, isUserPremium } from '@/lib/auth/session'
import {
  getMockTestById,
  fetchMockTestQuestionsFromDB,
  userHasAttemptForTest,
} from '@/lib/mock-tests/db'
import { getQuestionsWithFallback } from '@/lib/mock-tests/cache'

const DEFAULT_CHUNK = 50
const MAX_CHUNK = 160

export const GET = requireAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const start = Math.max(1, parseInt(url.searchParams.get('start') || '1', 10) || 1)
    const limit = Math.min(
      MAX_CHUNK,
      Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_CHUNK), 10) || DEFAULT_CHUNK)
    )

    const test = await getMockTestById(id)
    if (!test || test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    // Paywall. /start already enforces this, but the questions themselves ARE
    // the paid product: without this check a request could pull all 160
    // questions of a Pro-only module and never call /start.
    if (!test.is_free && !isUserPremium(user)) {
      return NextResponse.json(
        { success: false, error: 'PREMIUM_REQUIRED', message: 'This module requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Require an attempt. /start is the single place that creates one, and it
    // is where the premium check and any quota live — so gating on an attempt
    // stops a logged-in user from enumerating module papers they never opened.
    if (!(await userHasAttemptForTest(user.id, test.id))) {
      return NextResponse.json(
        {
          success: false,
          error: 'ATTEMPT_REQUIRED',
          message: 'Start this module before loading its questions',
        },
        { status: 403 }
      )
    }

    // Redis first; on a miss, one batched DB read that re-warms the cache.
    const questions = await getQuestionsWithFallback(test.id, test.version, () =>
      fetchMockTestQuestionsFromDB(test.id)
    )

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Questions not available for this module' },
        { status: 503 }
      )
    }

    const sorted = questions.slice().sort((a, b) => a.question_number - b.question_number)
    const fromIdx = Math.max(0, start - 1)
    const chunk = sorted.slice(fromIdx, fromIdx + limit)
    const nextStart = fromIdx + chunk.length + 1

    return NextResponse.json({
      success: true,
      start,
      limit,
      count: chunk.length,
      total: sorted.length,
      has_more: nextStart <= sorted.length,
      next_start: nextStart <= sorted.length ? nextStart : null,
      questions: chunk,
      // correct_answer and explanation are intentionally absent.
    })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests/[id]/questions]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
