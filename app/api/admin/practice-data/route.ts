// ============================================================
// app/api/admin/practice-data/route.ts — Practice Data Export & Stats
// ============================================================
// Admin-only API endpoint. Protected by requireAdmin middleware.
// Provides:
//   1. action=stats: Aggregated counts by medium, subject, and total
//   2. action=download: Full data export in CSV (UTF-8 with BOM) or JSON
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface TableConfig {
  table: string
  subjectKey: 'english' | 'telugu' | 'mathematics' | 'science' | 'social_studies' | 'pedagogy' | 'gk'
  subjectDisplayName: string
  subjectTeluguName: string
  medium: 'english' | 'telugu'
}

export const TABLE_CONFIGS: TableConfig[] = [
  {
    table: 'english_subject_questions',
    subjectKey: 'english',
    subjectDisplayName: 'English',
    subjectTeluguName: 'ఇంగ్లీష్ (భాష II)',
    medium: 'english',
  },
  {
    table: 'telugu_subject_questions',
    subjectKey: 'telugu',
    subjectDisplayName: 'Telugu',
    subjectTeluguName: 'తెలుగు (భాష I)',
    medium: 'telugu',
  },
  {
    table: 'math_english_medium',
    subjectKey: 'mathematics',
    subjectDisplayName: 'Mathematics',
    subjectTeluguName: 'గణితం',
    medium: 'english',
  },
  {
    table: 'telugu_medium_math',
    subjectKey: 'mathematics',
    subjectDisplayName: 'Mathematics',
    subjectTeluguName: 'గణితం',
    medium: 'telugu',
  },
  {
    table: 'english_medium_science',
    subjectKey: 'science',
    subjectDisplayName: 'Science',
    subjectTeluguName: 'సాధారణ సైన్స్',
    medium: 'english',
  },
  {
    table: 'telugu_medium_science',
    subjectKey: 'science',
    subjectDisplayName: 'Science',
    subjectTeluguName: 'సాధారణ సైన్స్',
    medium: 'telugu',
  },
  {
    table: 'socal_english_medium',
    subjectKey: 'social_studies',
    subjectDisplayName: 'Social Studies',
    subjectTeluguName: 'సాంఘిక శాస్త్రం',
    medium: 'english',
  },
  {
    table: 'socal_telugu_medimum',
    subjectKey: 'social_studies',
    subjectDisplayName: 'Social Studies',
    subjectTeluguName: 'సాంఘిక శాస్త్రం',
    medium: 'telugu',
  },
  {
    table: 'pedagogy_english_medium',
    subjectKey: 'pedagogy',
    subjectDisplayName: 'Educational Psychology & Pedagogy',
    subjectTeluguName: 'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు',
    medium: 'english',
  },
  {
    table: 'pedagogy_subject_questions',
    subjectKey: 'pedagogy',
    subjectDisplayName: 'Educational Psychology & Pedagogy',
    subjectTeluguName: 'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు',
    medium: 'telugu',
  },
  {
    table: 'gk_english_medium',
    subjectKey: 'gk',
    subjectDisplayName: 'GK & Current Affairs',
    subjectTeluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
    medium: 'english',
  },
  {
    table: 'gk_telugu_medium',
    subjectKey: 'gk',
    subjectDisplayName: 'GK & Current Affairs',
    subjectTeluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
    medium: 'telugu',
  },
]

export const SUBJECT_METADATA_LIST = [
  { key: 'english', name: 'English', teluguName: 'ఇంగ్లీష్ (భాష II)', icon: 'Languages' },
  { key: 'telugu', name: 'Telugu', teluguName: 'తెలుగు (భాష I)', icon: 'BookOpen' },
  { key: 'mathematics', name: 'Mathematics', teluguName: 'గణితం', icon: 'Calculator' },
  { key: 'science', name: 'Science', teluguName: 'సాధారణ సైన్స్', icon: 'FlaskConical' },
  { key: 'social_studies', name: 'Social Studies', teluguName: 'సాంఘిక శాస్త్రం', icon: 'Globe' },
  { key: 'pedagogy', name: 'Educational Psychology & Pedagogy', teluguName: 'సైకాలజీ & విద్యా దృక్పథాలు', icon: 'Brain' },
  { key: 'gk', name: 'GK & Current Affairs', teluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు', icon: 'Newspaper' },
]

/**
 * Escapes values for standard RFC 4180 CSV compliance
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  // Double internal quotes
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Paginates through a Supabase table in batches of 1,000 to ensure no data truncation
 */
async function fetchAllRowsFromTable(tableName: string): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) {
      console.error(`[PracticeDataExport] Error querying ${tableName}:`, error.message)
      break
    }

    if (!data || data.length === 0) break
    allRows.push(...(data as Record<string, unknown>[]))
    if (data.length < batchSize) break
    from += batchSize
  }

  return allRows
}

export const GET = requireAdmin(async (request) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'download'
  const mediumParam = (searchParams.get('medium') || 'all').toLowerCase()
  const subjectParam = (searchParams.get('subject') || 'all').toLowerCase()
  const formatParam = (searchParams.get('format') || 'csv').toLowerCase()

  // -------------------------------------------------------------
  // 1. STATS ACTION: Returns live counts for admin overview & UI
  // -------------------------------------------------------------
  if (action === 'stats') {
    const tableCounts = await Promise.all(
      TABLE_CONFIGS.map(async (cfg) => {
        const { count, error } = await supabaseAdmin
          .from(cfg.table)
          .select('*', { count: 'exact', head: true })

        return {
          ...cfg,
          count: error ? 0 : (count ?? 0),
        }
      })
    )

    let totalCount = 0
    let englishCount = 0
    let teluguCount = 0

    const subjectStatsMap: Record<
      string,
      { english: number; telugu: number; total: number }
    > = {}

    SUBJECT_METADATA_LIST.forEach((s) => {
      subjectStatsMap[s.key] = { english: 0, telugu: 0, total: 0 }
    })

    tableCounts.forEach((tc) => {
      totalCount += tc.count
      if (tc.medium === 'english') {
        englishCount += tc.count
        if (subjectStatsMap[tc.subjectKey]) {
          subjectStatsMap[tc.subjectKey].english += tc.count
          subjectStatsMap[tc.subjectKey].total += tc.count
        }
      } else {
        teluguCount += tc.count
        if (subjectStatsMap[tc.subjectKey]) {
          subjectStatsMap[tc.subjectKey].telugu += tc.count
          subjectStatsMap[tc.subjectKey].total += tc.count
        }
      }
    })

    const subjects = SUBJECT_METADATA_LIST.map((s) => ({
      key: s.key,
      name: s.name,
      teluguName: s.teluguName,
      icon: s.icon,
      englishCount: subjectStatsMap[s.key]?.english ?? 0,
      teluguCount: subjectStatsMap[s.key]?.telugu ?? 0,
      totalCount: subjectStatsMap[s.key]?.total ?? 0,
    }))

    return NextResponse.json({
      totalQuestions: totalCount,
      englishQuestions: englishCount,
      teluguQuestions: teluguCount,
      subjects,
      timestamp: new Date().toISOString(),
    })
  }

  // -------------------------------------------------------------
  // 2. DOWNLOAD ACTION: Filter, fetch, and format questions
  // -------------------------------------------------------------
  // Filter relevant table configurations based on query parameters
  const targetConfigs = TABLE_CONFIGS.filter((cfg) => {
    // Check medium match
    if (mediumParam !== 'all' && cfg.medium !== mediumParam) {
      return false
    }

    // Check subject match
    if (subjectParam !== 'all') {
      const match =
        cfg.subjectKey === subjectParam ||
        cfg.subjectDisplayName.toLowerCase().includes(subjectParam)
      if (!match) return false
    }

    return true
  })

  if (targetConfigs.length === 0) {
    return NextResponse.json(
      { error: 'No matching practice question tables found for the specified filters' },
      { status: 400 }
    )
  }

  // Fetch rows from all target tables in parallel
  const tableDataList = await Promise.all(
    targetConfigs.map(async (cfg) => {
      const rows = await fetchAllRowsFromTable(cfg.table)
      return rows.map((row) => ({
        id: row.id || row.question_id,
        question_id: row.question_id || row.id,
        medium: cfg.medium,
        subject: cfg.subjectDisplayName,
        class_level: row.class_level || 'Class 8',
        chapter: row.chapter || '',
        topic: row.topic || '',
        subtopic: row.subtopic || '',
        difficulty: row.difficulty || 'Medium',
        question_type: row.question_type || 'MCQ',
        question: row.question || '',
        option_a: row.option_a || '',
        option_b: row.option_b || '',
        option_c: row.option_c || '',
        option_d: row.option_d || '',
        correct_answer: (row.correct_answer || 'A').toString().trim(),
        explanation: row.explanation || '',
        source_type: row.source_type || 'SCERT',
        language: row.language || (cfg.medium === 'telugu' ? 'telugu' : 'english'),
        tags: row.tags || '',
        created_at: row.created_at || '',
        updated_at: row.updated_at || '',
      }))
    })
  )

  const flatQuestions = tableDataList.flat()

  const dateStamp = new Date().toISOString().split('T')[0]
  const mediumSuffix = mediumParam === 'all' ? 'all_mediums' : `${mediumParam}_medium`
  const subjectSuffix = subjectParam === 'all' ? 'all_subjects' : subjectParam

  // -------------------------------------------------------------
  // JSON EXPORT FORMAT
  // -------------------------------------------------------------
  if (formatParam === 'json') {
    const filename = `dsc_practice_${subjectSuffix}_${mediumSuffix}_${dateStamp}.json`
    return new Response(JSON.stringify(flatQuestions, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // -------------------------------------------------------------
  // CSV EXPORT FORMAT (with UTF-8 BOM for Microsoft Excel)
  // -------------------------------------------------------------
  const csvHeaders = [
    'ID',
    'Question ID',
    'Medium',
    'Subject',
    'Class Level',
    'Chapter',
    'Topic',
    'Subtopic',
    'Difficulty',
    'Question Type',
    'Question',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer',
    'Explanation',
    'Source Type',
    'Language',
    'Tags',
    'Created At',
    'Updated At',
  ]

  const csvRows: string[] = [csvHeaders.map(escapeCsvValue).join(',')]

  flatQuestions.forEach((q) => {
    const rowValues = [
      q.id,
      q.question_id,
      q.medium,
      q.subject,
      q.class_level,
      q.chapter,
      q.topic,
      q.subtopic,
      q.difficulty,
      q.question_type,
      q.question,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer,
      q.explanation,
      q.source_type,
      q.language,
      q.tags,
      q.created_at,
      q.updated_at,
    ]
    csvRows.push(rowValues.map(escapeCsvValue).join(','))
  })

  // \uFEFF is the UTF-8 Byte Order Mark (BOM).
  // Without this, Excel defaults to Windows-1252/ANSI and corrupts Telugu characters.
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const filename = `dsc_practice_${subjectSuffix}_${mediumSuffix}_${dateStamp}.csv`

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})
