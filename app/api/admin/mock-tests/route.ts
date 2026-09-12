// ============================================================
// app/api/admin/mock-tests/route.ts
// GET  /api/admin/mock-tests — List all mock tests (all statuses)
// POST /api/admin/mock-tests — Create a new mock test (draft)
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { adminListMockTests, createMockTest } from '@/lib/mock-tests/db'
import { getAllBlueprints } from '@/lib/mock-tests/blueprints'

export const GET = requireAdmin(async (_request: Request, _context: any, { user }: any) => {
  try {
    const tests = await adminListMockTests()
    const blueprints = getAllBlueprints().map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      total_questions: b.total_questions,
      duration_minutes: b.duration_minutes,
      total_marks: b.total_marks,
    }))

    return NextResponse.json({ success: true, tests, blueprints })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = requireAdmin(async (request: Request, _context: any, { user }: any) => {
  try {
    const body = await request.json()
    const { slug, title, description, category, medium, blueprint_id, is_free } = body

    if (!slug || !title || !blueprint_id) {
      return NextResponse.json(
        { success: false, error: 'slug, title, and blueprint_id are required' },
        { status: 400 }
      )
    }

    const test = await createMockTest(user.id, {
      slug,
      title,
      description,
      category: category || 'grand_mock',
      medium: medium || 'bilingual',
      blueprint_id,
      is_free: Boolean(is_free),
    })

    return NextResponse.json({ success: true, test }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create mock test'
    const status = message.includes('duplicate') || message.includes('unique') ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
