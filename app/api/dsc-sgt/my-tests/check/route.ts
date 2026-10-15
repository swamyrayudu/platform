// ============================================================
// app/api/dsc-sgt/my-tests/check/route.ts — Check pasted CSV text
// ============================================================
// POST { csv } → { questions, problems }. The mobile app pastes what the AI
// chat produced; this reads it with the same rules as a website upload. The
// questions are saved through POST /api/dsc-sgt/my-tests, which checks again.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { MY_TEST_LIMITS, readPastedCsv } from '@/lib/my-tests/format'

/** Generous for 160 questions with explanations, but bounded. */
const MAX_CSV_CHARS = 600_000

export const POST = requireAuth(async (request) => {
  const body = await request.json().catch(() => null)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) return NextResponse.json({ success: false, error: 'Paste the questions first.' }, { status: 400 })
  if (csv.length > MAX_CSV_CHARS) return NextResponse.json({ success: false, error: 'That is too much text for one test.' }, { status: 413 })
  const { questions, problems } = readPastedCsv(csv)
  return NextResponse.json({
    success: true,
    questions: questions.slice(0, MY_TEST_LIMITS.maxQuestions),
    extra: Math.max(0, questions.length - MY_TEST_LIMITS.maxQuestions),
    problems: problems.slice(0, 20),
    problem_count: problems.length,
  })
})
