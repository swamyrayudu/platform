// ============================================================
// app/api/dsc-sgt/practice/questions/route.ts — GET Questions
// ============================================================
// Returns questions from the shared question bank for a subject/medium.
//
// SECURITY
//   • Authentication is REQUIRED. This endpoint previously had none, which
//     made the entire 48,000-question bank downloadable by anyone.
//   • `correct_answer` and `explanation` are NEVER returned. They previously
//     leaked because the handler used `select('*')`, so a single unauthenticated
//     request returned the answer key alongside each question.
//
//   Grading happens server-side in the practice session flow
//   (/api/dsc-sgt/practice/sessions/[id]/answer), which is the only place an
//   answer is revealed, and only for a question the user has just answered.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSubjectProvider } from '@/lib/practice/subjects'

/**
 * Explicit column allowlist — never `select('*')` on a question table.
 * Adding a column to the bank must not silently start exposing it.
 */
const CLIENT_SAFE_COLUMNS = [
  'id',
  'question_id',
  'class_level',
  'subject',
  'chapter',
  'topic',
  'subtopic',
  'difficulty',
  'question_type',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'source_type',
  'language',
].join(', ')

// Helper to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface ClientSafeQuestion {
  question_id: string
  topic?: string | null
  difficulty?: string | null
  class_level?: string | null
}

export const GET = requireAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url)

    const subject = searchParams.get('subject') || 'English'
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const limit = isNaN(limitParam) ? 50 : Math.min(Math.max(1, limitParam), 200)
    const difficulty = searchParams.get('difficulty')
    const topic = searchParams.get('topic')
    const classLevel = searchParams.get('class_level')
    const medium = (searchParams.get('medium') || 'english').toLowerCase()
    const isRandom = searchParams.get('random') !== 'false'

    // Table comes from the registered subject provider, never from raw input,
    // so the table name is not attacker-controlled.
    const provider = getSubjectProvider(subject)
    let tableName = provider ? provider.metadata.tableName : 'dsc_practice_questions'
    if (
      subject.toLowerCase().includes('gk') ||
      subject.toLowerCase().includes('general knowledge') ||
      subject.toLowerCase().includes('current affairs')
    ) {
      tableName = medium === 'telugu' ? 'gk_telugu_medium' : 'gk_english_medium'
    } else if (
      subject.toLowerCase().includes('pedagogy') ||
      subject.toLowerCase().includes('psychology') ||
      subject.toLowerCase().includes('perspectives')
    ) {
      tableName = medium === 'english' ? 'pedagogy_english_medium' : 'pedagogy_subject_questions'
    }

    let query = supabaseAdmin.from(tableName).select(CLIENT_SAFE_COLUMNS)

    if (difficulty && difficulty !== 'All') {
      query = query.ilike('difficulty', difficulty)
    }
    if (topic && topic !== 'All') {
      query = query.ilike('topic', `%${topic}%`)
    }
    if (classLevel && classLevel !== 'All') {
      query = query.ilike('class_level', `%${classLevel}%`)
    }

    // Fetch a pool to allow reasonable random distribution
    const fetchLimit = isRandom ? Math.max(limit * 2, 200) : limit
    const { data, error } = await query.limit(fetchLimit)

    if (error) {
      console.error('[Questions API] Supabase fetch error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch questions', questions: [], total: 0 },
        { status: 500 }
      )
    }

    const rows = (data || []) as unknown as ClientSafeQuestion[]
    const selectedQuestions = isRandom ? shuffleArray(rows).slice(0, limit) : rows.slice(0, limit)

    const uniq = (key: keyof ClientSafeQuestion) =>
      Array.from(new Set(rows.map((q) => q[key]).filter(Boolean))) as string[]

    return NextResponse.json({
      success: true,
      subject,
      count: selectedQuestions.length,
      limit,
      totalInPool: rows.length,
      availableTopics: uniq('topic'),
      availableDifficulties: uniq('difficulty'),
      availableClassLevels: uniq('class_level'),
      questions: selectedQuestions,
      // correct_answer and explanation are intentionally absent.
    })
  } catch (err: unknown) {
    console.error('[Questions API] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', questions: [], total: 0 },
      { status: 500 }
    )
  }
})
