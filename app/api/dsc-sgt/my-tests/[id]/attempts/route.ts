// ============================================================
// app/api/dsc-sgt/my-tests/[id]/attempts/route.ts — Submit an attempt
// ============================================================
// POST { answers: "AB-D…" (one character per question), time_spent_seconds }
// The score is computed here from the stored answer key.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { gradeAttempt } from '@/lib/my-tests/format'
import { getMyTest, recordAttempt } from '@/lib/my-tests/store'
import { myTestsError } from '../../respond'

type Params = { params: Promise<{ id: string }> }

export const POST = requireAuth(async (request: Request, { params }: Params, { user }) => {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const answers = typeof body?.answers === 'string' ? body.answers.toUpperCase() : ''
    const seconds = Number(body?.time_spent_seconds)

    const test = /^[0-9a-f-]{36}$/i.test(id) ? await getMyTest(user.id, id) : null
    if (!test) return NextResponse.json({ success: false, error: 'Test not found.' }, { status: 404 })
    if (answers.length !== test.questions.length || !/^[A-D-]+$/.test(answers)) {
      return NextResponse.json({ success: false, error: 'Answers do not match this test.' }, { status: 400 })
    }

    const attempt = await recordAttempt(user.id, id, {
      answers,
      correct_count: gradeAttempt(answers, test.questions),
      total_questions: test.questions.length,
      time_spent_seconds: Number.isFinite(seconds) ? Math.min(Math.max(0, Math.round(seconds)), 24 * 3600) : 0,
    })
    return NextResponse.json({ success: true, attempt }, { status: 201 })
  } catch (err) {
    return myTestsError(err, 'Could not save your result. Please try again.')
  }
})
