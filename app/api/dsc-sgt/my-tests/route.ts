// ============================================================
// app/api/dsc-sgt/my-tests/route.ts — List and create user-made tests
// ============================================================
// GET   the signed-in user's tests, with best score and attempt count
// POST  { title, medium, subject, topics, duration_minutes, questions[] }
//       The questions are checked again here — the browser is not trusted —
//       then stored as one compressed file. See lib/my-tests/store.ts.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth, isUserPremium } from '@/lib/auth/session'
import { MY_TEST_LIMITS, checkQuestions, defaultDurationMinutes } from '@/lib/my-tests/format'
import { countMyTests, createMyTest, listMyTests } from '@/lib/my-tests/store'
import { myTestsError } from './respond'

const limitFor = (premium: boolean) => (premium ? MY_TEST_LIMITS.maxTestsPro : MY_TEST_LIMITS.maxTestsFree)

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  try {
    const tests = await listMyTests(user.id)
    return NextResponse.json({ success: true, tests, limit: limitFor(isUserPremium(user)) })
  } catch (err) {
    return myTestsError(err, 'Could not load your tests.')
  }
})

export const POST = requireAuth(async (request, _ctx, { user }) => {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const medium = body.medium === 'telugu' ? 'telugu' : body.medium === 'english' ? 'english' : null
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((t: unknown): t is string => typeof t === 'string')
        .map((t: string) => t.trim()).filter(Boolean).slice(0, 30)
        .filter((t: string) => t.length <= MY_TEST_LIMITS.maxShortChars)
      : []
    if (!title || title.length > MY_TEST_LIMITS.maxShortChars) {
      return NextResponse.json({ success: false, error: `Give the test a name of up to ${MY_TEST_LIMITS.maxShortChars} characters.` }, { status: 400 })
    }
    if (!subject || subject.length > MY_TEST_LIMITS.maxShortChars || !medium) {
      return NextResponse.json({ success: false, error: 'Choose a subject and medium.' }, { status: 400 })
    }

    const checked = checkQuestions(body.questions)
    if ('error' in checked) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })

    const requested = Number(body.duration_minutes)
    const duration = Number.isInteger(requested) && requested >= 1 && requested <= MY_TEST_LIMITS.maxDurationMinutes
      ? requested : defaultDurationMinutes(checked.questions.length)

    const limit = limitFor(isUserPremium(user))
    if ((await countMyTests(user.id)) >= limit) {
      return NextResponse.json({
        success: false,
        error: `You can keep up to ${limit} tests. Delete an old test to add a new one.`,
      }, { status: 409 })
    }

    const test = await createMyTest(user.id, { title, medium, subject, topics, duration_minutes: duration }, checked.questions)
    return NextResponse.json({ success: true, test }, { status: 201 })
  } catch (err) {
    return myTestsError(err, 'Could not save your test. Please try again.')
  }
})
