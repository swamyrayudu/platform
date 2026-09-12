// ============================================================
// app/api/admin/mock-tests/[id]/preview/route.ts
// GET /api/admin/mock-tests/[id]/preview
// ============================================================
// Returns question distribution stats and validation result
// before publishing. Does NOT include correct answers.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getMockTestById } from '@/lib/mock-tests/db'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBlueprintById } from '@/lib/mock-tests/blueprints'
import { validateBlueprint } from '@/lib/mock-tests/validator'

export const GET = requireAdmin(async (
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

    // Fetch mappings with question metadata for full validation
    const { data: mappings, error } = await supabaseAdmin
      .from('mock_test_questions')
      .select('id, mock_test_id, question_id, question_table, question_number, section_id, section_name, marks, created_at')
      .eq('mock_test_id', id)
      .order('question_number', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const blueprint = getBlueprintById(test.blueprint_id)
    if (!blueprint) {
      return NextResponse.json({ success: false, error: 'Blueprint not found' }, { status: 500 })
    }

    const validation = validateBlueprint(blueprint, mappings || [])

    // Group by section for preview
    const sectionGroups: Record<string, { section_id: string; section_name: string; count: number; question_ids: string[] }> = {}
    for (const m of (mappings || [])) {
      if (!sectionGroups[m.section_id]) {
        sectionGroups[m.section_id] = { section_id: m.section_id, section_name: m.section_name, count: 0, question_ids: [] }
      }
      sectionGroups[m.section_id].count++
      sectionGroups[m.section_id].question_ids.push(m.question_id)
    }

    return NextResponse.json({
      success: true,
      test_id: id,
      test_title: test.title,
      status: test.status,
      total_mapped: mappings?.length || 0,
      blueprint_expects: blueprint.total_questions,
      validation,
      sections: Object.values(sectionGroups),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
