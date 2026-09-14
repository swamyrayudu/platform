// ============================================================
// app/api/admin/mock-tests/[id]/questions/route.ts
// GET /api/admin/mock-tests/[id]/questions
// ============================================================
// A module's 160 slots with the question text currently filling each one, so
// an admin can read a module the way a candidate would and pick out the one
// worth replacing.
//
// The existing preview route returns distribution stats and validation; this
// returns content. Answers are included because this is the admin side and
// judging whether a question is worth keeping needs its key.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildQuestionUid } from '@/lib/questions/tables'
import { findLiveAttempts } from '@/lib/mock-tests/live-attempts'

interface Slot {
  mappingId: string
  questionNumber: number
  sectionId: string
  sectionName: string
  questionTable: string
  questionId: string
  uid: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: string
  topic: string | null
  difficulty: string | null
  /** True when the row the mapping points at no longer exists. */
  missing: boolean
}

export const GET = requireAdmin<{ id: string }>(async (_request, context) => {
  try {
    const { id } = await context.params

    const { data: test } = await supabaseAdmin
      .from('mock_tests')
      .select('id, title, module_number, medium, status, version')
      .eq('id', id)
      .maybeSingle()

    if (!test) {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    const { data: mappings, error } = await supabaseAdmin
      .from('mock_test_questions')
      .select('id, question_uid, question_id, question_table, question_number, section_id, section_name')
      .eq('mock_test_id', id)
      .order('question_number', { ascending: true })

    if (error) throw error

    // One query per source table rather than per question — a module draws
    // from up to twelve tables, not a hundred and sixty.
    const byTable = new Map<string, string[]>()
    for (const m of mappings ?? []) {
      const table = m.question_table as string
      byTable.set(table, [...(byTable.get(table) ?? []), m.question_id as string])
    }

    const content = new Map<string, Record<string, string | null>>()
    await Promise.all(
      [...byTable.entries()].map(async ([table, ids]) => {
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await supabaseAdmin
            .from(table)
            .select('question_id, question, option_a, option_b, option_c, option_d, correct_answer, topic, difficulty')
            .in('question_id', ids.slice(i, i + 200))
          for (const row of (data ?? []) as Record<string, string | null>[]) {
            content.set(buildQuestionUid(table, String(row.question_id)), row)
          }
        }
      })
    )

    const slots: Slot[] = (mappings ?? []).map((m) => {
      const uid = (m.question_uid as string) ?? buildQuestionUid(m.question_table as string, m.question_id as string)
      const row = content.get(uid)
      return {
        mappingId: m.id as string,
        questionNumber: m.question_number as number,
        sectionId: m.section_id as string,
        sectionName: m.section_name as string,
        questionTable: m.question_table as string,
        questionId: m.question_id as string,
        uid,
        question: row?.question ?? '',
        optionA: row?.option_a ?? '',
        optionB: row?.option_b ?? '',
        optionC: row?.option_c ?? '',
        optionD: row?.option_d ?? '',
        correctAnswer: row?.correct_answer ?? '',
        topic: row?.topic ?? null,
        difficulty: row?.difficulty ?? null,
        missing: !row,
      }
    })

    // Only attempts still inside their exam window count. An abandoned tab
    // leaves a row at in_progress for ever, and treating those as live blocks
    // the module from ever being edited again.
    const liveCount = (await findLiveAttempts([id])).length

    return NextResponse.json({
      success: true,
      test,
      slots,
      liveAttempts: liveCount,
      // A module that is not 160 long, or has a slot pointing at a row that no
      // longer exists, is broken today — worth saying so rather than leaving
      // it to be noticed during an exam.
      missingCount: slots.filter((s) => s.missing).length,
    })
  } catch (err) {
    console.error('[AdminModuleQuestions] failed:', err)
    return NextResponse.json({ success: false, error: 'Could not load that module' }, { status: 500 })
  }
})
