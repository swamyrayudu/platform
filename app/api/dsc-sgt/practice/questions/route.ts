// ============================================================
// app/api/dsc-sgt/practice/questions/route.ts — GET Questions
// ============================================================
// Fetches questions from english_subject_questions table
// Supports random ordering and limit (50, 100, 150)
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSubjectProvider } from '@/lib/practice/subjects'
import type { EnglishQuestion } from '@/types/questions'

// Helper to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const subject = searchParams.get('subject') || 'English'
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const limit = isNaN(limitParam) ? 50 : Math.min(Math.max(1, limitParam), 200)
    const difficulty = searchParams.get('difficulty')
    const topic = searchParams.get('topic')
    const classLevel = searchParams.get('class_level')
    const isRandom = searchParams.get('random') !== 'false'

    // Determine target table based on subject provider
    const provider = getSubjectProvider(subject)
    const tableName = provider ? provider.metadata.tableName : 'dsc_practice_questions'

    let query = supabaseAdmin
      .from(tableName)
      .select('*')

    if (difficulty && difficulty !== 'All') {
      query = query.ilike('difficulty', difficulty)
    }

    if (topic && topic !== 'All') {
      query = query.ilike('topic', `%${topic}%`)
    }

    if (classLevel && classLevel !== 'All') {
      query = query.ilike('class_level', `%${classLevel}%`)
    }

    // Fetch a pool of up to 300 to allow high-quality random distribution
    const fetchLimit = isRandom ? Math.max(limit * 2, 200) : limit
    const { data, error } = await query.limit(fetchLimit)

    if (error) {
      console.error('[Questions API] Supabase fetch error:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch questions from database',
          details: error.message,
          questions: [],
          total: 0,
        },
        { status: 500 }
      )
    }

    const rows: EnglishQuestion[] = (data || []) as EnglishQuestion[]

    // Randomize if requested
    const selectedQuestions = isRandom
      ? shuffleArray(rows).slice(0, limit)
      : rows.slice(0, limit)

    // Extract unique available topics and difficulties for filtering
    const availableTopics = Array.from(
      new Set(rows.map((q) => q.topic).filter(Boolean))
    ) as string[]

    const availableDifficulties = Array.from(
      new Set(rows.map((q) => q.difficulty).filter(Boolean))
    ) as string[]

    const availableClassLevels = Array.from(
      new Set(rows.map((q) => q.class_level).filter(Boolean))
    ) as string[]

    return NextResponse.json({
      success: true,
      subject,
      count: selectedQuestions.length,
      limit,
      totalInPool: rows.length,
      availableTopics,
      availableDifficulties,
      availableClassLevels,
      questions: selectedQuestions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Questions API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: message, questions: [], total: 0 },
      { status: 500 }
    )
  }
}
