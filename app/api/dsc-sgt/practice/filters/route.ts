// ============================================================
// app/api/dsc-sgt/practice/filters/route.ts — Dynamic Filters
// ============================================================
// `fields=total`   only total_matching_questions — one count per table, no
//                  rows transferred. The setup page needs nothing more until
//                  the user opens topic selection.
// `fields=topics`  only available_topics (name and count), largest first.
// no `fields`      the full options, as released mobile builds expect.
//
// Topics may arrive as repeated `topic=` parameters, which keep names with
// commas intact, or as the older comma-joined `topics=`.
// ============================================================

import { NextResponse } from 'next/server'
import { loadFilterOptions } from '@/lib/practice/filter-options'
import { countMatchingQuestions } from '@/lib/practice/question-loader'
import type { PracticeMedium } from '@/types/practice'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const list = (name: string) => searchParams.get(name)?.split(',') ?? []

    const medium = (searchParams.get('medium') || 'english') as PracticeMedium
    const subject = searchParams.get('subject') || undefined
    const repeatedTopics = searchParams.getAll('topic')
    const filter = {
      medium,
      subject,
      class_levels: list('class_levels'),
      topics: repeatedTopics.length ? repeatedTopics : list('topics'),
      subtopics: list('subtopics'),
      difficulty: list('difficulty'),
    }

    const fields = searchParams.get('fields')
    if (fields === 'total') {
      return NextResponse.json({
        success: true,
        data: { total_matching_questions: await countMatchingQuestions(filter) },
      })
    }
    if (fields === 'topics') {
      // Topic counts narrow by class only, so the list does not change while
      // the user ticks topics.
      const options = await loadFilterOptions({ ...filter, topics: [], subtopics: [], difficulty: [] }, { subjectCounts: false })
      return NextResponse.json({
        success: true,
        data: { available_topics: options.available_topics.map(({ name, count }) => ({ name, count })) },
      })
    }

    return NextResponse.json({
      success: true,
      data: await loadFilterOptions(filter),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load filter options'
    console.error('[Practice Filters API Error]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
