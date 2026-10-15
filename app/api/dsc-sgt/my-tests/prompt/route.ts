// ============================================================
// app/api/dsc-sgt/my-tests/prompt/route.ts — The AI prompt for a new test
// ============================================================
// POST { subject, medium, topics?, question_count, difficulty, output? }
//   → { prompt }. The website builds the prompt in the browser; the mobile
// app asks here, so both use lib/my-tests/format.ts. output 'text' asks the
// AI for CSV text to paste, since a phone has no file to upload.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { MY_TEST_LIMITS, MY_TEST_QUESTION_COUNTS, buildPrompt, type PromptOptions } from '@/lib/my-tests/format'

const DIFFICULTIES: PromptOptions['difficulty'][] = ['mixed', 'easy', 'medium', 'hard']

export const POST = requireAuth(async (request) => {
  const body = await request.json().catch(() => null)
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const medium = body?.medium === 'telugu' ? 'telugu' : body?.medium === 'english' ? 'english' : null
  const count = Number(body?.question_count)
  if (!subject || subject.length > 200 || !medium || !(MY_TEST_QUESTION_COUNTS as readonly number[]).includes(count)) {
    return NextResponse.json({ success: false, error: 'Choose a subject, medium and number of questions.' }, { status: 400 })
  }
  const topics: string[] = Array.isArray(body?.topics)
    ? body.topics.filter((t: unknown): t is string => typeof t === 'string').map((t: string) => t.trim())
      .filter((t: string) => t && t.length <= MY_TEST_LIMITS.maxShortChars).slice(0, 30)
    : []
  const difficulty: PromptOptions['difficulty'] = DIFFICULTIES.includes(body?.difficulty) ? body.difficulty : 'mixed'
  const output = body?.output === 'text' ? 'text' : 'file'
  return NextResponse.json({ success: true, prompt: buildPrompt({ subject, medium, topics, questionCount: count, difficulty, output }) })
})
