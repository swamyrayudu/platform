// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/route.ts
// GET /api/dsc-sgt/mock-tests/[id] — Get test metadata & instructions
// ============================================================

import { NextResponse } from 'next/server'
import { getMockTestById } from '@/lib/mock-tests/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const test = await getMockTestById(id)

    if (!test) {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    if (test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not available' }, { status: 404 })
    }

    // Return test metadata — no question content, no answers
    return NextResponse.json({
      success: true,
      test: {
        id: test.id,
        slug: test.slug,
        title: test.title,
        description: test.description,
        category: test.category,
        medium: test.medium,
        duration_minutes: test.duration_minutes,
        total_questions: test.total_questions,
        total_marks: test.total_marks,
        marks_per_question: test.marks_per_question,
        negative_marks: test.negative_marks,
        is_free: test.is_free,
        published_at: test.published_at,
      },
    })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests/[id]]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
