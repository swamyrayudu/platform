// ============================================================
// app/api/admin/questions/[uid]/route.ts
// GET   /api/admin/questions/:uid — read one question for editing
// PATCH /api/admin/questions/:uid — edit it
// ============================================================
// `uid` is `table:question_id`, url-encoded by the caller.
//
// WHY ONE EDIT REACHES BOTH PRACTICE AND MOCK TESTS:
// The question bank is the single source of truth. Practice providers read
// those tables live, and a mock module stores only a *mapping* to
// `table:question_id` — never a copy of the text. So writing the source row is
// the whole edit for practice, and for mock tests the only thing standing
// between the edit and the candidate is the Redis cache warmed at publish
// time. This route clears that cache for every module using the question, so
// the next read re-materialises it from the edited row.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invalidateMockTestCache } from '@/lib/mock-tests/cache'
import {
  QUESTION_EDITABLE_COLUMNS,
  QUESTION_READ_COLUMNS,
  parseQuestionUid,
  type QuestionEditableColumn,
} from '@/lib/questions/tables'
import type { EditableQuestion } from '@/types/question-feedback'

const VALID_ANSWERS = ['A', 'B', 'C', 'D']

/** Modules that map this question, with the version their cache is keyed on. */
async function findModulesUsing(uid: string) {
  const { data: mappings } = await supabaseAdmin
    .from('mock_test_questions')
    .select('mock_test_id')
    .eq('question_uid', uid)

  const ids = [...new Set((mappings ?? []).map((m) => m.mock_test_id as string))]
  if (ids.length === 0) return []

  const { data: tests } = await supabaseAdmin
    .from('mock_tests')
    .select('id, title, module_number, version')
    .in('id', ids)

  return (tests ?? []) as { id: string; title: string; module_number: number | null; version: number }[]
}

// ---- GET ---------------------------------------------------------

export const GET = requireAdmin<{ uid: string }>(async (_request, context) => {
  try {
    const { uid } = await context.params
    const decoded = decodeURIComponent(uid)
    const parsed = parseQuestionUid(decoded)
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Unknown question' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from(parsed.questionTable)
      .select(QUESTION_READ_COLUMNS)
      .eq('question_id', parsed.questionId)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 })
    }

    const modules = await findModulesUsing(decoded)

    const question: EditableQuestion = {
      ...(data as unknown as Omit<EditableQuestion, 'question_uid' | 'question_table'>),
      question_uid: decoded,
      question_table: parsed.questionTable,
    }

    return NextResponse.json({
      success: true,
      question,
      used_in_modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        module_number: m.module_number,
      })),
    })
  } catch (err: unknown) {
    console.error('[GET /api/admin/questions/[uid]]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

// ---- PATCH -------------------------------------------------------

export const PATCH = requireAdmin<{ uid: string }>(async (request, context) => {
  try {
    const { uid } = await context.params
    const decoded = decodeURIComponent(uid)
    const parsed = parseQuestionUid(decoded)
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Unknown question' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const patch = body as Record<string, unknown>
    const update: Record<string, string | null> = {}

    // Only the shared editable columns are writable. question_id is identity
    // and is never reassigned — a mock mapping points at it.
    for (const column of QUESTION_EDITABLE_COLUMNS as readonly QuestionEditableColumn[]) {
      if (!(column in patch)) continue
      const value = patch[column]

      if (value === null) {
        update[column] = null
        continue
      }
      if (typeof value !== 'string') {
        return NextResponse.json(
          { success: false, error: `${column} must be text` },
          { status: 400 }
        )
      }
      update[column] = value.trim()
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
    }

    // ---- Guard the fields an exam depends on ---------------------
    for (const required of ['question', 'option_a', 'option_b', 'option_c', 'option_d'] as const) {
      if (required in update && !update[required]) {
        return NextResponse.json(
          { success: false, error: `${required.replace('_', ' ')} cannot be empty` },
          { status: 400 }
        )
      }
    }

    if ('correct_answer' in update) {
      const normalised = String(update.correct_answer ?? '').trim().toUpperCase()
      if (!VALID_ANSWERS.includes(normalised)) {
        return NextResponse.json(
          { success: false, error: 'correct_answer must be A, B, C or D' },
          { status: 400 }
        )
      }
      update.correct_answer = normalised
    }

    const { data, error } = await supabaseAdmin
      .from(parsed.questionTable)
      .update(update)
      .eq('question_id', parsed.questionId)
      .select(QUESTION_READ_COLUMNS)
      .single()

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 })
      }
      throw error ?? new Error('Update returned no row')
    }

    // ---- Make the edit visible to mock candidates ----------------
    // Practice needs nothing: its providers read the table on every request.
    const modules = await findModulesUsing(decoded)
    await Promise.all(modules.map((m) => invalidateMockTestCache(m.id, m.version)))

    const question: EditableQuestion = {
      ...(data as unknown as Omit<EditableQuestion, 'question_uid' | 'question_table'>),
      question_uid: decoded,
      question_table: parsed.questionTable,
    }

    return NextResponse.json({
      success: true,
      question,
      invalidated_modules: modules.length,
    })
  } catch (err: unknown) {
    console.error('[PATCH /api/admin/questions/[uid]]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
