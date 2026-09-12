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
// scripts/seed-medium-separated-mocks.mjs
// ============================================================
// Creates dedicated AP DSC SGT Mock Tests separated by Medium:
//   1. Telugu Medium (తెలుగు మాధ్యమం) - Grand Mocks, Previous Papers, Subject Mocks
//   2. English Medium - Grand Mocks, Previous Papers, Subject Mocks
//
// Tables used:
//   • Telugu: gk_telugu_medium, pedagogy_subject_questions, telugu_subject_questions,
//             telugu_medium_math, telugu_medium_science, socal_telugu_medimum, english_subject_questions
//   • English: gk_english_medium, pedagogy_english_medium, telugu_subject_questions,
//              english_subject_questions, math_english_medium, english_medium_science, socal_english_medium
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
    console.warn('  ⚠ Redis error:', err.message)
    return null
  }
}

// ── Telugu Medium Blueprint (160 Q) ─────────────────────────
const TELUGU_GRAND_BLUEPRINT = [
  { id: 'gk',          name: 'General Knowledge & Current Affairs (సాధారణ జ్ఞానం & వర్తమాన అంశాలు)',  count: 16, marks: 8,  tables: ['gk_telugu_medium'] },
  { id: 'perspectives',name: 'Perspectives in Education (విద్యా దృక్పథాలు)',                         count: 8,  marks: 4,  tables: ['pedagogy_subject_questions'] },
  { id: 'psychology',  name: 'Classroom Psychology (తరగతి గది మనోవిజ్ఞాన శాస్త్రం)',                count: 16, marks: 8,  tables: ['pedagogy_subject_questions'] },
  { id: 'telugu',      name: 'Telugu (భాష I - తెలుగు)',                                              count: 24, marks: 12, tables: ['telugu_subject_questions'] },
  { id: 'english',     name: 'English (Language II)',                                                count: 24, marks: 12, tables: ['english_subject_questions'] },
  { id: 'mathematics', name: 'Mathematics (గణితం)',                                                  count: 24, marks: 12, tables: ['telugu_medium_math'] },
  { id: 'science',     name: 'Science (సామాన్య శాస్త్రం)',                                            count: 24, marks: 12, tables: ['telugu_medium_science'] },
  { id: 'social',      name: 'Social Studies (సాంఘిక శాస్త్రం)',                                     count: 24, marks: 12, tables: ['socal_telugu_medimum'] },
]

// ── English Medium Blueprint (160 Q) ─────────────────────────
const ENGLISH_GRAND_BLUEPRINT = [
  { id: 'gk',          name: 'General Knowledge & Current Affairs', count: 16, marks: 8,  tables: ['gk_english_medium'] },
  { id: 'perspectives',name: 'Perspectives in Education',            count: 8,  marks: 4,  tables: ['pedagogy_english_medium'] },
  { id: 'psychology',  name: 'Classroom Psychology',                 count: 16, marks: 8,  tables: ['pedagogy_english_medium'] },
  { id: 'telugu',      name: 'Telugu (Language I)',                  count: 24, marks: 12, tables: ['telugu_subject_questions'] },
  { id: 'english',     name: 'English (Language II)',                count: 24, marks: 12, tables: ['english_subject_questions'] },
  { id: 'mathematics', name: 'Mathematics',                          count: 24, marks: 12, tables: ['math_english_medium'] },
  { id: 'science',     name: 'Science',                              count: 24, marks: 12, tables: ['english_medium_science'] },
  { id: 'social',      name: 'Social Studies',                       count: 24, marks: 12, tables: ['socal_english_medium'] },
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
    const raw = await fetchQuestionsFromTable(tableName, needed * 4, offset)
    const unique = raw.filter(q => !usedIds.has(q.question_id))
    selected.push(...unique.map(q => ({ ...q, _table: tableName })))
  }

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
  const TTL = 7 * 24 * 60 * 60
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
    medium,
    isFree,
    durationMinutes,
    totalQuestions,
    totalMarks,
    sections,
    offsetMultiplier,
  } = config

  console.log(`\n📦 Processing [${medium.toUpperCase()}]: "${title}"...`)

  // Check if test exists
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
        medium,
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

    if (createErr || !created) throw new Error(`Create failed: ${createErr?.message}`)
    testId = created.id
  } else {
    // Delete old mappings to ensure clean medium-specific questions
    await supabase.from('mock_test_questions').delete().eq('mock_test_id', testId)
  }

  const { mappings, clientQuestions, answerKey } = await buildTestQuestions(testId, sections, offsetMultiplier)

  // Batch insert
  for (let i = 0; i < mappings.length; i += 50) {
    const chunk = mappings.slice(i, i + 50)
    const { error: insErr } = await supabase.from('mock_test_questions').insert(chunk)
    if (insErr) throw new Error(`Mapping insert failed: ${insErr.message}`)
  }

  await warmCache(testId, 1, clientQuestions, answerKey)

  const snapshot = {
    title,
    category,
    medium,
    total_questions: mappings.length,
    total_marks: totalMarks,
    duration_minutes: durationMinutes,
    sections: sections.map(s => ({ id: s.id, name: s.name, total_questions: s.count, total_marks: s.marks })),
  }

  const { error: pubErr } = await supabase
    .from('mock_tests')
    .update({
      title,
      description,
      status: 'published',
      published_at: new Date().toISOString(),
      blueprint_snapshot: snapshot,
      total_questions: mappings.length,
      total_marks: totalMarks,
      duration_minutes: durationMinutes,
      is_free: isFree,
      category,
      medium,
      updated_at: new Date().toISOString(),
    })
    .eq('id', testId)

  if (pubErr) throw new Error(`Publish failed: ${pubErr.message}`)
  console.log(`  🎉 Published! Total: ${mappings.length} questions | Medium: ${medium}`)
  return testId
}

// ── Medium-Wise Test Catalog ──────────────────────────────────

const TESTS = [
  // ═════════════════════════════════════════════════════════════
  // TELUGU MEDIUM (తెలుగు మాధ్యమం)
  // ═════════════════════════════════════════════════════════════

  // Telugu Grand Mocks (160 Q · 80 M · 150 Min)
  {
    slug: 'ap-dsc-sgt-tm-grand-01',
    title: 'AP DSC SGT గ్రాండ్ మాక్ టెస్ట్ — Set 1 (తెలుగు మాధ్యమం)',
    description: 'పూర్తి 160 ప్రశ్నల గ్రాండ్ మాక్ టెస్ట్. ఆంధ్రప్రదేశ్ DSC SGT అధికారిక నమూనా ప్రకారం 8 విభాగాలు.',
    category: 'grand_mock',
    medium: 'telugu',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: TELUGU_GRAND_BLUEPRINT,
    offsetMultiplier: 0,
  },
  {
    slug: 'ap-dsc-sgt-tm-grand-02',
    title: 'AP DSC SGT గ్రాండ్ మాక్ టెస్ట్ — Set 2 (తెలుగు మాధ్యమం)',
    description: 'SCERT పాఠ్యపుస్తకాలు మరియు మునుపటి DSC పరీక్షల ఆధారంగా రూపొందించిన ప్రశ్నలు.',
    category: 'grand_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: TELUGU_GRAND_BLUEPRINT,
    offsetMultiplier: 1,
  },
  {
    slug: 'ap-dsc-sgt-tm-grand-03',
    title: 'AP DSC SGT గ్రాండ్ మాక్ టెస్ట్ — Set 3 (హై-యీల్డ్ తెలుగు)',
    description: 'అత్యధిక సంభావ్యత కలిగిన ముఖ్యమైన ప్రశ్నలతో తుది రివిజన్ గ్రాండ్ మాక్.',
    category: 'grand_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: TELUGU_GRAND_BLUEPRINT,
    offsetMultiplier: 2,
  },

  // Telugu Previous Year Papers
  {
    slug: 'ap-dsc-sgt-tm-prev-2018',
    title: 'AP DSC SGT 2018 అధికారిక సాల్వ్డ్ పేపర్ (తెలుగు మాధ్యమం)',
    description: '2018 DSC SGT అసలు పరీక్షా పత్రం పూర్తి వివరణలతో మరియు విశ్లేషణతో.',
    category: 'previous_paper',
    medium: 'telugu',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: TELUGU_GRAND_BLUEPRINT,
    offsetMultiplier: 3,
  },
  {
    slug: 'ap-dsc-sgt-tm-prev-2019',
    title: 'AP DSC SGT 2019 అధికారిక సాల్వ్డ్ పేపర్ (తెలుగు మాధ్యమం)',
    description: '2019 TRT/SGT సెషన్ పరీక్షా పత్రం 8 విభాగాలతో కూడిన ప్రాక్టీస్ పేపర్.',
    category: 'previous_paper',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: TELUGU_GRAND_BLUEPRINT,
    offsetMultiplier: 4,
  },

  // Telugu Subject Mocks
  {
    slug: 'ap-dsc-sgt-tm-sub-maths',
    title: 'గణితం & బోధనా పద్ధతులు సెక్షనల్ టెస్ట్ (తెలుగు మాధ్యమం)',
    description: '24 ప్రశ్నలు — సంఖ్యా వ్యవస్థ, రేఖాగణితం, బీజగణితం మరియు గణిత మెథడాలజీ.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'mathematics', name: 'గణితం (Mathematics TM)', count: 24, marks: 12, tables: ['telugu_medium_math'] },
    ],
    offsetMultiplier: 5,
  },
  {
    slug: 'ap-dsc-sgt-tm-sub-science',
    title: 'సామాన్య శాస్త్రం & మెథడాలజీ మాక్ (తెలుగు మాధ్యమం)',
    description: '24 ప్రశ్నలు — భౌతిక, రసాయన, జీవ శాస్త్రాలు మరియు సైన్స్ టీచింగ్ మెథడ్స్.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'science', name: 'సామాన్య శాస్త్రం (Science TM)', count: 24, marks: 12, tables: ['telugu_medium_science'] },
    ],
    offsetMultiplier: 6,
  },
  {
    slug: 'ap-dsc-sgt-tm-sub-social',
    title: 'సాంఘిక శాస్త్రం & మెథడాలజీ మాక్ (తెలుగు మాధ్యమం)',
    description: '24 ప్రశ్నలు — చరిత్ర, భూగోళం, పౌరనీతి, అర్థశాస్త్రం మరియు సోషల్ మెథడాలజీ.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'social', name: 'సాంఘిక శాస్త్రం (Social TM)', count: 24, marks: 12, tables: ['socal_telugu_medimum'] },
    ],
    offsetMultiplier: 7,
  },
  {
    slug: 'ap-dsc-sgt-tm-sub-pedagogy',
    title: 'విద్యా దృక్పథాలు & మనోవిజ్ఞాన శాస్త్రం (తెలుగు మాధ్యమం)',
    description: '24 ప్రశ్నలు — వికాస దశలు, అభ్యసన సిద్ధాంతాలు, NEP 2020 & RTE 2009.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'pedagogy', name: 'విద్యా దృక్పథాలు & సైకాలజీ', count: 24, marks: 12, tables: ['pedagogy_subject_questions'] },
    ],
    offsetMultiplier: 8,
  },
  {
    slug: 'ap-dsc-sgt-tm-sub-telugu',
    title: 'తెలుగు భాషా ప్రావీణ్యత & బోధనా పద్ధతులు',
    description: '24 ప్రశ్నలు — తెలుగు వ్యాకరణం, ఛందస్సు, అలంకారాలు, సాహిత్యం మరియు బోధనా పద్ధతులు.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: true,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'telugu', name: 'తెలుగు (Language I)', count: 24, marks: 12, tables: ['telugu_subject_questions'] },
    ],
    offsetMultiplier: 9,
  },
  {
    slug: 'ap-dsc-sgt-tm-sub-gk',
    title: 'జనరల్ నాలెడ్జ్ & వర్తమాన అంశాలు స్పీడ్ టెస్ట్ (తెలుగు)',
    description: '16 ముఖ్యమైన ప్రశ్నలు — భారత రాజ్యాంగం, ఏపీ భౌగోళికం, జాతీయ & అంతర్జాతీయ అంశాలు.',
    category: 'subject_mock',
    medium: 'telugu',
    isFree: true,
    durationMinutes: 15,
    totalQuestions: 16,
    totalMarks: 8,
    sections: [
      { id: 'gk', name: 'కరెంట్ అఫైర్స్ & GK (తెలుగు)', count: 16, marks: 8, tables: ['gk_telugu_medium'] },
    ],
    offsetMultiplier: 10,
  },

  // ═════════════════════════════════════════════════════════════
  // ENGLISH MEDIUM
  // ═════════════════════════════════════════════════════════════

  // English Grand Mocks (160 Q · 80 M · 150 Min)
  {
    slug: 'ap-dsc-sgt-em-grand-01',
    title: 'AP DSC SGT Grand Mock Test — Set 1 (English Medium)',
    description: 'Full 160-question Grand Mock based on official AP DSC SGT examination pattern for English Medium aspirants.',
    category: 'grand_mock',
    medium: 'english',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: ENGLISH_GRAND_BLUEPRINT,
    offsetMultiplier: 0,
  },
  {
    slug: 'ap-dsc-sgt-em-grand-02',
    title: 'AP DSC SGT Grand Mock Test — Set 2 (English Medium)',
    description: 'Comprehensive exam simulation with medium-to-hard questions across SCERT Syllabus & NCERT concepts.',
    category: 'grand_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: ENGLISH_GRAND_BLUEPRINT,
    offsetMultiplier: 1,
  },
  {
    slug: 'ap-dsc-sgt-em-grand-03',
    title: 'AP DSC SGT Grand Mock Test — Set 3 (High Yield English)',
    description: 'High-Yield examination set with expected questions from all sections for final revision.',
    category: 'grand_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: ENGLISH_GRAND_BLUEPRINT,
    offsetMultiplier: 2,
  },

  // English Previous Year Papers
  {
    slug: 'ap-dsc-sgt-em-prev-2018',
    title: 'AP DSC SGT 2018 Solved Paper (English Medium)',
    description: 'Authentic 2018 examination questions translated and solved with complete pedagogical rationale.',
    category: 'previous_paper',
    medium: 'english',
    isFree: true,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: ENGLISH_GRAND_BLUEPRINT,
    offsetMultiplier: 3,
  },
  {
    slug: 'ap-dsc-sgt-em-prev-2019',
    title: 'AP DSC SGT 2019 Solved Paper (English Medium)',
    description: 'Complete 2019 session examination paper covering all subjects and methodologies.',
    category: 'previous_paper',
    medium: 'english',
    isFree: false,
    durationMinutes: 150,
    totalQuestions: 160,
    totalMarks: 80,
    sections: ENGLISH_GRAND_BLUEPRINT,
    offsetMultiplier: 4,
  },

  // English Subject Mocks
  {
    slug: 'ap-dsc-sgt-em-sub-maths',
    title: 'Mathematics Concepts & Methodology (English Medium)',
    description: '24 questions on Number Systems, Geometry, Mensuration, Algebra & Math Pedagogy.',
    category: 'subject_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'mathematics', name: 'Mathematics (English Medium)', count: 24, marks: 12, tables: ['math_english_medium'] },
    ],
    offsetMultiplier: 5,
  },
  {
    slug: 'ap-dsc-sgt-em-sub-science',
    title: 'General Science & Methodology (English Medium)',
    description: '24 questions covering Physics, Chemistry, Biology and Science Teaching Methodology.',
    category: 'subject_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'science', name: 'Science (English Medium)', count: 24, marks: 12, tables: ['english_medium_science'] },
    ],
    offsetMultiplier: 6,
  },
  {
    slug: 'ap-dsc-sgt-em-sub-social',
    title: 'Social Studies & Methodology (English Medium)',
    description: '24 questions on Indian History, World Geography, Indian Polity and Social Methodology.',
    category: 'subject_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'social', name: 'Social Studies (English Medium)', count: 24, marks: 12, tables: ['socal_english_medium'] },
    ],
    offsetMultiplier: 7,
  },
  {
    slug: 'ap-dsc-sgt-em-sub-pedagogy',
    title: 'Perspectives in Education & Psychology (English Medium)',
    description: '24 questions on Child Development, Learning Theories, NEP 2020 & RTE Act 2009.',
    category: 'subject_mock',
    medium: 'english',
    isFree: false,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'pedagogy', name: 'Perspectives & Psychology (English)', count: 24, marks: 12, tables: ['pedagogy_english_medium'] },
    ],
    offsetMultiplier: 8,
  },
  {
    slug: 'ap-dsc-sgt-em-sub-english',
    title: 'English Language & Pedagogy Sectional Mock',
    description: '24 questions on English Grammar, Vocabulary, Reading Comprehension and Methodology.',
    category: 'subject_mock',
    medium: 'english',
    isFree: true,
    durationMinutes: 25,
    totalQuestions: 24,
    totalMarks: 12,
    sections: [
      { id: 'english', name: 'English (Language II)', count: 24, marks: 12, tables: ['english_subject_questions'] },
    ],
    offsetMultiplier: 9,
  },
  {
    slug: 'ap-dsc-sgt-em-sub-gk',
    title: 'General Knowledge & Current Affairs Speed Test (English)',
    description: '16 questions on Indian Constitution, Geography, Economy and National & International Events.',
    category: 'subject_mock',
    medium: 'english',
    isFree: true,
    durationMinutes: 15,
    totalQuestions: 16,
    totalMarks: 8,
    sections: [
      { id: 'gk', name: 'General Knowledge & Current Affairs', count: 16, marks: 8, tables: ['gk_english_medium'] },
    ],
    offsetMultiplier: 10,
  },
]

async function main() {
  console.log('====================================================')
  console.log(' AP DSC SGT Medium-Separated Mock Tests Generator')
  console.log('====================================================')
  console.log(`Total tests scheduled: ${TESTS.length}`)

  let successCount = 0
  for (const test of TESTS) {
    try {
      await createAndPublishTest(test)
      successCount++
    } catch (err) {
      console.error(`❌ Failed test "${test.slug}":`, err.message)
    }
  }

  // Clean up any old unseparated tests that are not in this list
  const activeSlugs = TESTS.map(t => t.slug)
  const { data: allDbTests } = await supabase.from('mock_tests').select('id, slug')
  const toDelete = (allDbTests || []).filter(t => !activeSlugs.includes(t.slug))
  if (toDelete.length > 0) {
    console.log(`\n🧹 Cleaning ${toDelete.length} legacy unseparated mock tests...`)
    for (const d of toDelete) {
      await supabase.from('mock_test_questions').delete().eq('mock_test_id', d.id)
      await supabase.from('mock_tests').delete().eq('id', d.id)
    }
    console.log('✓ Legacy cleanup complete.')
  }

  console.log('\n====================================================')
  console.log(`✅ Complete! Successfully prepared ${successCount} / ${TESTS.length} tests.`)
  console.log('====================================================')
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
