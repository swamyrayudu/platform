// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/questions/route.ts
// GET /api/dsc-sgt/mock-tests/[id]/questions?start=1&limit=50
// ============================================================
// Chunked delivery of client-safe questions from Redis cache.
//
// SECURITY: This endpoint NEVER returns correct_answer or explanation.
// Questions are fetched from Redis (warmed at publish time).
// Cache-miss triggers a safe single-flight DB batch fetch.
//
// CHUNKING:
//   ?start=1&limit=50   → Q1  to Q50
//   ?start=51&limit=50  → Q51 to Q100
//   ?start=101&limit=60 → Q101 to Q160
//   ?start=1&limit=160  → All 160 (for clients that prefer it)
// ============================================================

import { NextResponse } from 'next/server'
import { getMockTestById, fetchMockTestQuestionsFromDB } from '@/lib/mock-tests/db'
import { getCachedQuestionChunk, getQuestionsWithFallback } from '@/lib/mock-tests/cache'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const start = Math.max(1, parseInt(url.searchParams.get('start') || '1', 10))
    const limit = Math.min(160, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))

    // Get test metadata for version
    const test = await getMockTestById(id)
    if (!test || test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    // Try to get from cache with safe fallback
    const questions = await getQuestionsWithFallback(test.id, test.version, () =>
      fetchMockTestQuestionsFromDB(test.id)
    )

    if (!questions || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'Questions not available' }, { status: 503 })
    }

    // Return requested chunk
    const sorted = questions.slice().sort((a, b) => a.question_number - b.question_number)
    const fromIdx = Math.max(0, start - 1)
    const chunk = sorted.slice(fromIdx, fromIdx + limit)

    return NextResponse.json({
      success: true,
      start,
      limit,
      count: chunk.length,
      total: questions.length,
      questions: chunk,
      // Explicitly confirm answer key is absent
      _security_note: 'correct_answer and explanation are NOT included in this response',
    })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests/[id]/questions]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
