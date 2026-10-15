// ============================================================
// app/api/dsc-sgt/my-tests/check/route.ts — Check questions from the app
// ============================================================
// POST { csv }                       pasted CSV text, or
// POST { file_base64, file_name }    an Excel (.xlsx) or CSV file
//   → { questions, problems }. The mobile app sends what the user pasted or
// picked; this reads it with the same rules as a website upload. The
// questions are saved through POST /api/dsc-sgt/my-tests, which checks again.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { MY_TEST_LIMITS, readPastedCsv, type ReadResult } from '@/lib/my-tests/format'
import { MAX_APP_FILE_BYTES, readQuestionFile } from '@/lib/my-tests/read-file'

/** Generous for 160 questions with explanations, but bounded. */
const MAX_CSV_CHARS = 600_000

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status })

export const POST = requireAuth(async (request) => {
  const body = await request.json().catch(() => null)
  let read: ReadResult

  if (typeof body?.file_base64 === 'string') {
    const name = typeof body.file_name === 'string' ? body.file_name.slice(0, 200) : ''
    // base64 is 4/3 of the file; refuse early before decoding something huge.
    if (body.file_base64.length > Math.ceil(MAX_APP_FILE_BYTES * 4 / 3) + 8) return bad('Choose a file of 2 MB or less.', 413)
    const result = await readQuestionFile(name, Buffer.from(body.file_base64, 'base64'))
    if ('error' in result) return bad(result.error)
    read = result
  } else {
    const csv = typeof body?.csv === 'string' ? body.csv : ''
    if (!csv.trim()) return bad('Paste the questions first.')
    if (csv.length > MAX_CSV_CHARS) return bad('That is too much text for one test.', 413)
    read = readPastedCsv(csv)
  }

  const { questions, problems } = read
  return NextResponse.json({
    success: true,
    questions: questions.slice(0, MY_TEST_LIMITS.maxQuestions),
    extra: Math.max(0, questions.length - MY_TEST_LIMITS.maxQuestions),
    problems: problems.slice(0, 20),
    problem_count: problems.length,
  })
})
