// ============================================================
// app/api/admin/mock-tests/[id]/generate/route.ts
// POST /api/admin/mock-tests/[id]/generate
// ============================================================
// Generates 160 fixed questions for a draft mock test using the blueprint.
// Can be called multiple times (idempotent — replaces previous mapping).
// ONLY works on draft tests (not published ones).
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getMockTestById, generateAndStoreMockQuestions } from '@/lib/mock-tests/db'

export const POST = requireAdmin(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  _auth: any
) => {
  try {
    const { id } = await params

    const test = await getMockTestById(id)
    if (!test) {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }
    if (test.status === 'published') {
      return NextResponse.json(
        { success: false, error: 'Cannot regenerate questions for a published test. Archive or create a new version.' },
        { status: 400 }
      )
    }

    const { mappings, validation } = await generateAndStoreMockQuestions(test.id, test.blueprint_id)

    return NextResponse.json({
      success: true,
      generated_count: mappings.length,
      validation,
      section_breakdown: Object.entries(validation.section_counts).map(([sectionId, counts]) => ({
        section_id: sectionId,
        expected: counts.expected,
        got: counts.got,
        valid: counts.valid,
      })),
    })
  } catch (err: unknown) {
    console.error('[POST generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
