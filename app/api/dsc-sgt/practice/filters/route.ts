// ============================================================
// app/api/dsc-sgt/practice/filters/route.ts — Dynamic Filters
// ============================================================

import { NextResponse } from 'next/server'
import { getAllPracticeQuestions } from '@/lib/practice/db'
import { extractFilterOptions } from '@/lib/practice/engine'
import type { PracticeMedium } from '@/types/practice'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const medium = (searchParams.get('medium') || 'english') as PracticeMedium
    const subject = searchParams.get('subject') || undefined
    const classParam = searchParams.get('class_levels')
    const class_levels = classParam ? classParam.split(',') : []
    const topicParam = searchParams.get('topics')
    const topics = topicParam ? topicParam.split(',') : []
    const subtopicParam = searchParams.get('subtopics')
    const subtopics = subtopicParam ? subtopicParam.split(',') : []
    const diffParam = searchParams.get('difficulty')
    const difficulty = diffParam ? diffParam.split(',') : []

    const allQuestions = await getAllPracticeQuestions(medium)

    const filterOptions = extractFilterOptions(allQuestions, {
      medium,
      subject,
      class_levels,
      topics,
      subtopics,
      difficulty,
    })

    return NextResponse.json({
      success: true,
      data: filterOptions,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load filter options'
    console.error('[Practice Filters API Error]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
