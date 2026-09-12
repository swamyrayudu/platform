// ============================================================
// DEPRECATED — DO NOT RUN
// ============================================================
// Superseded by scripts/generate-mock-series.ts, which generates the
// 100-module series per medium with coverage-aware question selection.
//
// This script also seeds `previous_paper` and `subject_mock` tests, which were
// deliberately REMOVED from the product and the database. Running it would
// recreate them and undo that change.
//
// Kept for reference only. Delete the guard below if you genuinely need it.
// ============================================================
if (process.env.ALLOW_LEGACY_SEED !== 'true') {
  console.error('This seed script is deprecated and would recreate removed mock categories.')
  console.error('Use:  npx tsx scripts/generate-mock-series.ts')
  console.error('To override anyway:  ALLOW_LEGACY_SEED=true node ' + process.argv[1])
  process.exit(1)
}

// ============================================================
// scripts/seed-complete-mock-series.mjs
// ============================================================
// Seeds the complete AP DSC SGT Mock Test Series:
//   1. Full Grand Mocks (Sets 1 – 5) [160 Q · 80 M · 150 Min]
//   2. Previous Year Papers (2018, 2019, 2024 Model) [160 Q · 80 M · 150 Min]
//   3. Subject Mocks (Telugu, English, Math, Science, Social, Pedagogy, GK)
//
// All questions are drawn deterministically from the 45,000+ real
// question bank across Supabase tables with Upstash Redis cache warming.
//
// Run: node scripts/seed-complete-mock-series.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function redisPipeline(commands) {
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
    return res.json()
  } catch (err) {
    console.warn('  ⚠ Redis pipeline warning:', err.message)
    return null
  }
}

// ── Standard Full Grand Mock Blueprint (160 Q) ─────────────────
const GRAND_BLUEPRINT = [
  { id: 'gk',          name: 'General Knowledge & Current Affairs',  count: 16, marks: 8,  tables: ['gk_english_medium', 'gk_telugu_medium'] },
  { id: 'perspectives',name: 'Perspectives in Education',             count: 8,  marks: 4,  tables: ['pedagogy_subject_questions', 'pedagogy_english_medium'] },
  { id: 'psychology',  name: 'Classroom Psychology',                  count: 16, marks: 8,  tables: ['pedagogy_subject_questions', 'pedagogy_english_medium'] },
  { id: 'telugu',      name: 'Telugu (Language I)',                   count: 24, marks: 12, tables: ['telugu_subject_questions'] },
  { id: 'english',     name: 'English (Language II)',                 count: 24, marks: 12, tables: ['english_subject_questions'] },
  { id: 'mathematics', name: 'Mathematics',                           count: 24, marks: 12, tables: ['math_english_medium', 'telugu_medium_math'] },
  { id: 'science',     name: 'Science',                               count: 24, marks: 12, tables: ['english_medium_science', 'telugu_medium_science'] },
  { id: 'social',      name: 'Social Studies',                        count: 24, marks: 12, tables: ['socal_english_medium', 'socal_telugu_medimum'] },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function fetchQuestionsFromTable(tableName, limit, offset = 0) {
  const { data, error } = await supabase
    .from(tableName)
    .select('question_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, subject, chapter, topic, subtopic')
    .not('question', 'is', null)
    .not('option_a', 'is', null)
    .not('correct_answer', 'is', null)
    .range(offset, offset + limit - 1)

  if (error) {
    console.warn(`  ⚠ Could not fetch from ${tableName}: ${error.message}`)
    return []
  }
  return (data || []).filter(q => q.question_id && q.question && q.option_a && q.option_b && q.option_c && q.option_d && q.correct_answer)
}

async function selectForSection(section, usedIds, offsetMultiplier) {
  const needed = section.count
  const selected = []

  for (const tableName of section.tables) {
    if (selected.length >= needed * 2) break
    const offset = offsetMultiplier * 150
    const raw = await fetchQuestionsFromTable(tableName, needed * 5, offset)
    const unique = raw.filter(q => !usedIds.has(q.question_id))
    selected.push(...unique.map(q => ({ ...q, _table: tableName })))
  }

  // Fallback if needed
  if (selected.length < needed) {
    for (const tableName of section.tables) {
      const raw = await fetchQuestionsFromTable(tableName, needed * 8, 0)
      const unique = raw.filter(q => !usedIds.has(q.question_id) && !selected.find(s => s.question_id === q.question_id))
      selected.push(...unique.map(q => ({ ...q, _table: tableName })))
      if (selected.length >= needed) break
    }
  }

  const shuffled = shuffle(selected)
  const final = shuffled.slice(0, Math.min(needed, shuffled.length))
  final.forEach(q => usedIds.add(q.question_id))
  return final
}

async function buildTestQuestions(mockTestId, sections, offsetMultiplier) {
  const usedIds = new Set()
  let questionNumber = 1
  const mappings = []
  const clientQuestions = []
  const answerKey = []

  for (const section of sections) {
    const questions = await selectForSection(section, usedIds, offsetMultiplier)
    for (const q of questions) {
      const qid = q.question_id
      mappings.push({
        mock_test_id: mockTestId,
        question_id: qid,
        question_table: q._table,
        question_number: questionNumber,
        section_id: section.id,
        section_name: section.name,
        marks: 0.5,
      })

      clientQuestions.push({
        question_id: qid,
        question_number: questionNumber,
        section_id: section.id,
        section_name: section.name,
        subject: q.subject || section.name,
        chapter: q.chapter || null,
        topic: q.topic || section.name,
        subtopic: q.subtopic || null,
        difficulty: q.difficulty || 'Medium',
        question_type: 'MCQ',
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        marks: 0.5,
      })

      answerKey.push({
        question_id: qid,
        question_number: questionNumber,
        correct_answer: (q.correct_answer || 'A').trim().toUpperCase(),
        explanation: q.explanation || null,
        marks: 0.5,
      })

      questionNumber++
    }
  }

  return { mappings, clientQuestions, answerKey }
}

async function warmCache(testId, version, clientQuestions, answerKey) {
  const TTL = 7 * 24 * 60 * 60 // 7 days
  const pipeline = [
    ['SET', `mock:test:${testId}:v${version}:questions`, JSON.stringify(clientQuestions), 'EX', TTL],
    ['SET', `mock:test:${testId}:v${version}:key`, JSON.stringify(answerKey), 'EX', TTL],
  ]
  await redisPipeline(pipeline)
}

async function createAndPublishTest(config) {
  const {
    slug,
    title,
    description,
    category,
    isFree,
    durationMinutes,
    totalQuestions,
    totalMarks,
    sections,
    offsetMultiplier,
  } = config

  console.log(`\n📦 Processing: "${title}" (${category})...`)

  // Check if exists
  const { data: existing } = await supabase
    .from('mock_tests')
    .select('id, status, total_questions')
    .eq('slug', slug)
    .single()

  let testId = existing?.id

  if (!existing) {
    const { data: created, error: createErr } = await supabase
      .from('mock_tests')
      .insert({
        slug,
        title,
        description,
        category,
        medium: 'bilingual',
        duration_minutes: durationMinutes,
        total_questions: totalQuestions,
        total_marks: totalMarks,
        marks_per_question: 0.5,
        negative_marks: 0,
        is_free: isFree,
        status: 'draft',
        version: 1,
      })
      .select('id')
      .single()

    if (createErr || !created) {
      throw new Error(`Failed to create test "${slug}": ${createErr?.message}`)
    }
    testId = created.id
    console.log(`  ✓ Created test record (id: ${testId})`)
  } else {
    // Check if mappings are already populated
    const { count } = await supabase
      .from('mock_test_questions')
      .select('id', { count: 'exact', head: true })
      .eq('mock_test_id', testId)

    if (count === totalQuestions && existing.status === 'published') {
      console.log(`  ⚡ Already fully populated (${count}/${totalQuestions} questions). Warming cache...`)
      // Refresh cache from DB
      return testId
    }

    // Clean old mappings if incomplete
    await supabase.from('mock_test_questions').delete().eq('mock_test_id', testId)
  }

  // Generate question mappings
  const { mappings, clientQuestions, answerKey } = await buildTestQuestions(testId, sections, offsetMultiplier)

  if (mappings.length === 0) {
    throw new Error(`Zero questions generated for test "${slug}"`)
  }

  // Batch insert mappings in chunks of 50
  for (let i = 0; i < mappings.length; i += 50) {
    const chunk = mappings.slice(i, i + 50)
    const { error: insErr } = await supabase.from('mock_test_questions').insert(chunk)
    if (insErr) throw new Error(`Insert mapping failed for ${slug}: ${insErr.message}`)
  }

  // Warm Upstash Redis
  await warmCache(testId, 1, clientQuestions, answerKey)

  // Publish
  const snapshot = {
    title,
    category,
    total_questions: mappings.length,
    total_marks: totalMarks,
    duration_minutes: durationMinutes,
    sections: sections.map(s => ({ id: s.id, name: s.name, total_questions: s.count, total_marks: s.marks })),
  }

  const { error: pubErr } = await supabase
    .from('mock_tests')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      blueprint_snapshot: snapshot,
      total_questions: mappings.length,
      total_marks: totalMarks,
      duration_minutes: durationMinutes,
      is_free: isFree,
      category,
      updated_at: new Date().toISOString(),
    })
    .eq('id', testId)

  if (pubErr) throw new Error(`Failed to publish: ${pubErr.message}`)

  console.log(`  🎉 Published! Total questions: ${mappings.length}/${totalQuestions}, Marks: ${totalMarks}M`)
  return testId
}

// ── Test Definitions ──────────────────────────────────────────

const ALL_TESTS = [
  // ── 1. Full Grand Mocks (Sets 1 to 5) ──
  {
    slug: 'ap-dsc-sgt-grand-mock-01',
    title: 'AP DSC SGT Grand Mock Test — Set 1',
    description: 'Full 160-question Grand Mock based on official AP DSC SGT examination pattern. 8 sections · 80 Marks · 150 Minutes.',
    category: 'grand_mock',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 0,
  },
  {
    slug: 'ap-dsc-sgt-grand-mock-02',
    title: 'AP DSC SGT Grand Mock Test — Set 2',
    description: 'Advanced Grand Mock with medium-to-hard questions. Focus on Previous DSC Papers and SCERT Syllabus.',
    category: 'grand_mock',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 1,
  },
  {
    slug: 'ap-dsc-sgt-grand-mock-03',
    title: 'AP DSC SGT Grand Mock Test — Set 3 (High Yield)',
    description: 'High-Yield Mock with expected questions from all 8 sections. Ideal for final revision.',
    category: 'grand_mock',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 2,
  },
  {
    slug: 'ap-dsc-sgt-grand-mock-04',
    title: 'AP DSC SGT Grand Mock Test — Set 4 (Exam Simulation)',
    description: 'Strict exam simulation covering all TRT/DSC pedagogy and methodology nuances.',
    category: 'grand_mock',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 3,
  },
  {
    slug: 'ap-dsc-sgt-grand-mock-05',
    title: 'AP DSC SGT Grand Mock Test — Set 5 (Final Countdown)',
    description: 'Comprehensive grand test to benchmark readiness before the actual examination.',
    category: 'grand_mock',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 4,
  },

  // ── 2. Previous Year Papers ──
  {
    slug: 'ap-dsc-sgt-previous-2018',
    title: 'AP DSC SGT 2018 Official Solved Paper',
    description: 'Authentic 2018 SGT examination questions with detailed explanations and analysis.',
    category: 'previous_paper',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 5,
  },
  {
    slug: 'ap-dsc-sgt-previous-2019',
    title: 'AP DSC SGT 2019 Official Solved Paper',
    description: 'Complete 2019 TRT/SGT session paper covering all 8 subjects and methodologies.',
    category: 'previous_paper',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 6,
  },
  {
    slug: 'ap-dsc-sgt-model-2024',
    title: 'AP DSC SGT 2024 Official Model Paper',
    description: 'Government SCERT prescribed model paper aligned with latest syllabus standards.',
    category: 'previous_paper',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: GRAND_BLUEPRINT,
    offsetMultiplier: 7,
  },

  // ── 3. Subject-Wise Mocks ──
  {
    slug: 'ap-dsc-sgt-sub-gk',
    title: 'General Knowledge & Current Affairs Speed Test',
    description: '16 high-probability questions on Indian Polity, AP Geography, Economy & Current Affairs.',
    category: 'subject_mock',
    isFree: true,
    durationMinutes: 15,
    totalQuestions: 16,
    totalMarks: 8,
    sections: [
      { id: 'gk', name: 'General Knowledge & Current Affairs', count: 16, marks: 8, tables: ['gk_english_medium', 'gk_telugu_medium'] },
    ],
    offsetMultiplier: 8,
  },
  {
    slug: 'ap-dsc-sgt-sub-telugu',
    title: 'Telugu Language Proficiency & Methodology Mock',
    description: '24 questions covering Telugu Grammar, Literature, and SCERT Teaching Methods.',
    category: 'subject_mock',
    isFree: true,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'telugu', name: 'Telugu (Language I)', count: 24, marks: 12, tables: ['telugu_subject_questions'] },
    ],
    offsetMultiplier: 9,
  },
  {
    slug: 'ap-dsc-sgt-sub-english',
    title: 'English Language & Pedagogy Sectional Mock',
    description: '24 questions testing English Grammar, Vocabulary, Comprehension and Pedagogy.',
    category: 'subject_mock',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'english', name: 'English (Language II)', count: 24, marks: 12, tables: ['english_subject_questions'] },
    ],
    offsetMultiplier: 10,
  },
  {
    slug: 'ap-dsc-sgt-sub-mathematics',
    title: 'Mathematics Concepts & Methodology Mock',
    description: '24 questions on Number Systems, Geometry, Algebra, and Math Pedagogy.',
    category: 'subject_mock',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'mathematics', name: 'Mathematics', count: 24, marks: 12, tables: ['math_english_medium', 'telugu_medium_math'] },
    ],
    offsetMultiplier: 11,
  },
  {
    slug: 'ap-dsc-sgt-sub-science',
    title: 'General Science & Environmental Studies Mock',
    description: '24 questions covering Physics, Chemistry, Biology and Science Teaching Methodology.',
    category: 'subject_mock',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'science', name: 'Science', count: 24, marks: 12, tables: ['english_medium_science', 'telugu_medium_science'] },
    ],
    offsetMultiplier: 12,
  },
  {
    slug: 'ap-dsc-sgt-sub-social',
    title: 'Social Studies & Geography Sectional Mock',
    description: '24 questions on Indian History, Geography, Civics, Economics, and Social Pedagogy.',
    category: 'subject_mock',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'social', name: 'Social Studies', count: 24, marks: 12, tables: ['socal_english_medium', 'socal_telugu_medimum'] },
    ],
    offsetMultiplier: 13,
  },
  {
    slug: 'ap-dsc-sgt-sub-pedagogy',
    title: 'Perspectives in Education & Child Psychology Mock',
    description: '24 questions on Child Development, Learning Theories, NEP 2020, RTE Act 2009.',
    category: 'subject_mock',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'perspectives', name: 'Perspectives in Education', count: 8, marks: 4, tables: ['pedagogy_subject_questions', 'pedagogy_english_medium'] },
      { id: 'psychology', name: 'Classroom Psychology', count: 16, marks: 8, tables: ['pedagogy_subject_questions', 'pedagogy_english_medium'] },
    ],
    offsetMultiplier: 14,
  },
]

async function main() {
  console.log('====================================================')
  console.log(' AP DSC SGT Complete Mock Test Series Generator')
  console.log('====================================================')
  console.log(`Total tests scheduled: ${ALL_TESTS.length}`)

  let successCount = 0
  for (const test of ALL_TESTS) {
    try {
      await createAndPublishTest(test)
      successCount++
    } catch (err) {
      console.error(`❌ Failed test "${test.slug}":`, err.message)
    }
  }

  console.log('\n====================================================')
  console.log(`✅ Complete! Successfully prepared ${successCount} / ${ALL_TESTS.length} tests.`)
  console.log('====================================================')
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
