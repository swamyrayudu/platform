// ============================================================
// scripts/seed-grand-mock.mjs
// ============================================================
// Seeds the database with:
//   1. Applies migration 018 (creates mock_tests tables)
//   2. Verifies which question tables exist + how many questions
//   3. Generates 160-question Grand Mock Set 1 & Set 2
//   4. Publishes both tests
//   5. Warms Redis cache
//
// Usage: node scripts/seed-grand-mock.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Supabase client ─────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Upstash Redis ────────────────────────────────────────────
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function redisPipeline(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  return res.json()
}

// ── AP DSC SGT Blueprint ─────────────────────────────────────
const BLUEPRINT = [
  { id: 'gk',          name: 'General Knowledge & Current Affairs',  count: 16, marks: 8,  tables: ['gk_english_medium', 'gk_telugu_medium'] },
  { id: 'perspectives',name: 'Perspectives in Education',             count: 8,  marks: 4,  tables: ['pedagogy_subject_questions','pedagogy_english_medium'] },
  { id: 'psychology',  name: 'Classroom Psychology',                  count: 16, marks: 8,  tables: ['pedagogy_subject_questions','pedagogy_english_medium'] },
  { id: 'telugu',      name: 'Telugu (Language I)',                   count: 24, marks: 12, tables: ['telugu_subject_questions'] },
  { id: 'english',     name: 'English (Language II)',                 count: 24, marks: 12, tables: ['english_subject_questions'] },
  { id: 'mathematics', name: 'Mathematics',                           count: 24, marks: 12, tables: ['math_english_medium','telugu_medium_math'] },
  { id: 'science',     name: 'Science',                               count: 24, marks: 12, tables: ['english_medium_science','telugu_medium_science'] },
  { id: 'social',      name: 'Social Studies',                        count: 24, marks: 12, tables: ['socal_english_medium','socal_telugu_medimum'] },
]

// ── Helpers ──────────────────────────────────────────────────

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

async function fetchTableCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('question_id', { count: 'exact', head: true })
    .not('question', 'is', null)

  if (error) return 0
  return count || 0
}

// ── Step 1: Check if migration 018 tables exist ──────────────

async function ensureMigrationApplied() {
  console.log('\n🔍 Checking if migration 018 tables exist...')

  const { error } = await supabase
    .from('mock_tests')
    .select('id')
    .limit(1)

  if (error && error.message.includes('does not exist')) {
    console.log('  ❌ Tables do not exist — please apply the migration first:')
    console.log('     npx supabase db push')
    console.log('     OR paste the SQL from: supabase/migrations/018_grand_mock_tests_schema.sql')
    console.log('\n  Attempting to apply migration via direct SQL...')
    
    const migrationPath = join(__dirname, '../supabase/migrations/018_grand_mock_tests_schema.sql')
    let migrationSQL
    try {
      migrationSQL = readFileSync(migrationPath, 'utf-8')
    } catch {
      console.error('  ❌ Could not read migration file.')
      process.exit(1)
    }

    // Try to apply via Supabase REST API exec SQL
    const { error: sqlErr } = await supabase.rpc('exec_sql', { sql: migrationSQL }).catch(() => ({ error: { message: 'rpc not available' } }))
    
    if (sqlErr) {
      console.error('  ❌ Auto-migration failed. Please run manually:')
      console.error('     npx supabase db push')
      process.exit(1)
    }

    console.log('  ✅ Migration applied successfully!')
  } else {
    console.log('  ✅ Tables already exist.')
  }
}

// ── Step 2: Survey question bank ────────────────────────────

async function surveyQuestionBank() {
  console.log('\n📊 Surveying question bank...')
  const allTables = [
    'english_subject_questions', 'telugu_subject_questions',
    'math_english_medium', 'telugu_medium_math',
    'english_medium_science', 'telugu_medium_science',
    'socal_english_medium', 'socal_telugu_medimum',
    'pedagogy_subject_questions', 'pedagogy_english_medium',
    'gk_english_medium', 'gk_telugu_medium', 'dsc_practice_questions',
  ]

  const available = {}
  for (const table of allTables) {
    const count = await fetchTableCount(table)
    available[table] = count
    console.log(`  ${count > 0 ? '✅' : '❌'} ${table}: ${count} questions`)
  }
  return available
}

// ── Step 3: Select questions for one section ──────────────────

async function selectForSection(section, usedIds, setIndex) {
  const needed = section.count
  const selected = []

  // Fetch from each table in the section
  for (const tableName of section.tables) {
    if (selected.length >= needed * 2) break // Have enough candidates

    // Offset by setIndex * large_number to get different questions per set
    const offset = setIndex * 300
    const raw = await fetchQuestionsFromTable(tableName, needed * 8, offset)
    const unique = raw.filter(q => !usedIds.has(q.question_id))
    selected.push(...unique.map(q => ({ ...q, _table: tableName })))
  }

  // If still short, try without offset (dip into overlapping pool)
  if (selected.length < needed) {
    console.warn(`  ⚠ Section "${section.name}": only ${selected.length} candidates, need ${needed}. Fetching without offset...`)
    for (const tableName of section.tables) {
      const raw = await fetchQuestionsFromTable(tableName, needed * 10, 0)
      const unique = raw.filter(q => !usedIds.has(q.question_id) && !selected.find(s => s.question_id === q.question_id))
      selected.push(...unique.map(q => ({ ...q, _table: tableName })))
    }
  }

  const shuffled = shuffle(selected)
  const final = shuffled.slice(0, Math.min(needed, shuffled.length))
  final.forEach(q => usedIds.add(q.question_id))

  console.log(`  ✅ ${section.name}: selected ${final.length}/${needed} questions`)
  return final
}

// ── Step 4: Generate one Grand Mock ──────────────────────────

async function generateGrandMock(mockTestId, blueprintSections, setIndex) {
  console.log(`\n📝 Generating 160 questions for set ${setIndex + 1}...`)

  const usedIds = new Set()
  let questionNumber = 1
  const mappings = []
  const clientQuestions = []
  const answerKey = []

  for (const section of blueprintSections) {
    const questions = await selectForSection(section, usedIds, setIndex)

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

  console.log(`  Total questions generated: ${mappings.length}/160`)

  if (mappings.length < 100) {
    throw new Error(`Not enough questions generated: ${mappings.length}. Please add questions to the database.`)
  }

  // Insert mappings in batches of 50
  console.log('  💾 Saving question mappings...')
  for (let i = 0; i < mappings.length; i += 50) {
    const batch = mappings.slice(i, i + 50)
    const { error } = await supabase.from('mock_test_questions').insert(batch)
    if (error) throw new Error(`Failed to insert mappings batch ${i}: ${error.message}`)
  }

  return { clientQuestions, answerKey, totalGenerated: mappings.length }
}

// ── Step 5: Warm Redis cache ──────────────────────────────────

async function warmCache(mockTestId, version, clientQuestions, answerKey) {
  console.log(`  🔥 Warming Redis cache...`)

  const questionsKey = `mock:test:${mockTestId}:v${version}:questions`
  const keyKey = `mock:test:${mockTestId}:v${version}:key`

  const commands = [
    ['SET', questionsKey, JSON.stringify(clientQuestions), 'EX', 86400],
    ['SET', keyKey, JSON.stringify(answerKey), 'EX', 86400],
  ]

  try {
    const results = await redisPipeline(commands)
    const ok = results.every(r => r.result === 'OK')
    console.log(`  ${ok ? '✅' : '⚠'} Redis cache ${ok ? 'warmed' : 'partially warmed'} (${clientQuestions.length} questions)`)
    return ok
  } catch (err) {
    console.warn(`  ⚠ Redis cache warming failed: ${err.message}. System will fall back to DB.`)
    return false
  }
}

// ── Step 6: Create and publish one Grand Mock ─────────────────

async function createAndPublishGrandMock({ slug, title, description, isFree, setIndex }) {
  console.log(`\n🚀 Creating "${title}"...`)

  // Check if test already exists
  const { data: existing } = await supabase
    .from('mock_tests')
    .select('id, status')
    .eq('slug', slug)
    .single()

  if (existing) {
    console.log(`  ⚡ Mock test "${slug}" already exists (id: ${existing.id}). Re-generating questions...`)
    // Delete old question mappings
    await supabase.from('mock_test_questions').delete().eq('mock_test_id', existing.id)
    
    // Re-set to draft for re-publish
    await supabase.from('mock_tests').update({ status: 'draft' }).eq('id', existing.id)

    // Generate & store 160 questions
    const { clientQuestions, answerKey, totalGenerated } = await generateGrandMock(existing.id, BLUEPRINT, setIndex)

    // Warm Redis cache
    await warmCache(existing.id, 1, clientQuestions, answerKey)

    // Publish
    const blueprintSnapshot = {
      id: 'ap_dsc_sgt_official',
      name: 'AP DSC SGT Official Blueprint',
      total_questions: 160,
      duration_minutes: 150,
      total_marks: 80,
      marks_per_question: 0.5,
      negative_marks: 0,
      sections: BLUEPRINT.map(s => ({ id: s.id, name: s.name, total_questions: s.count, total_marks: s.marks })),
    }

    await supabase
      .from('mock_tests')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        blueprint_snapshot: blueprintSnapshot,
        total_questions: totalGenerated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    console.log(`  🎉 Re-published "${title}" with ${totalGenerated} questions!`)
    return existing.id
  }

  // Create mock test record
  const { data: test, error: createErr } = await supabase
    .from('mock_tests')
    .insert({
      slug,
      title,
      description,
      category: 'grand_mock',
      medium: 'bilingual',
      blueprint_id: 'ap_dsc_sgt_official',
      duration_minutes: 150,
      total_questions: 160,
      total_marks: 80,
      marks_per_question: 0.5,
      negative_marks: 0,
      is_free: isFree,
      status: 'draft',
      version: 1,
    })
    .select('id')
    .single()

  if (createErr || !test) throw new Error(`Failed to create test: ${createErr?.message}`)
  console.log(`  ✅ Created draft (id: ${test.id})`)

  // Generate & store 160 questions
  const { clientQuestions, answerKey, totalGenerated } = await generateGrandMock(test.id, BLUEPRINT, setIndex)

  // Warm Redis cache
  await warmCache(test.id, 1, clientQuestions, answerKey)

  // Publish
  const blueprintSnapshot = {
    id: 'ap_dsc_sgt_official',
    name: 'AP DSC SGT Official Blueprint',
    total_questions: 160,
    duration_minutes: 150,
    total_marks: 80,
    marks_per_question: 0.5,
    negative_marks: 0,
    sections: BLUEPRINT.map(s => ({ id: s.id, name: s.name, total_questions: s.count, total_marks: s.marks })),
  }

  const { error: pubErr } = await supabase
    .from('mock_tests')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      blueprint_snapshot: blueprintSnapshot,
      total_questions: totalGenerated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', test.id)

  if (pubErr) throw new Error(`Failed to publish: ${pubErr.message}`)
  console.log(`  🎉 Published "${title}" with ${totalGenerated} questions!`)

  return test.id
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('   AP DSC SGT Grand Mock Test Seeder')
  console.log('═══════════════════════════════════════════════════════')

  await ensureMigrationApplied()
  await surveyQuestionBank()

  const tests = [
    {
      slug: 'ap-dsc-sgt-grand-mock-01',
      title: 'AP DSC SGT Grand Mock Test — Set 1',
      description: 'Full 160-question Grand Mock based on official AP DSC SGT examination pattern. 8 sections · 80 Marks · 150 Minutes.',
      isFree: true,   // First test is free
      setIndex: 0,
    },
    {
      slug: 'ap-dsc-sgt-grand-mock-02',
      title: 'AP DSC SGT Grand Mock Test — Set 2',
      description: 'Advanced Grand Mock with medium-to-hard questions. Focus on Previous DSC Papers and SCERT Syllabus.',
      isFree: false,
      setIndex: 1,
    },
    {
      slug: 'ap-dsc-sgt-grand-mock-03',
      title: 'AP DSC SGT Grand Mock Test — Set 3 (High Yield)',
      description: 'High-Yield Mock with expected questions from all 8 sections. Ideal for final revision.',
      isFree: false,
      setIndex: 2,
    },
  ]

  const created = []
  for (const t of tests) {
    try {
      const id = await createAndPublishGrandMock(t)
      created.push({ ...t, id })
    } catch (err) {
      console.error(`\n❌ Failed to create "${t.title}": ${err.message}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`   ✅ Done! ${created.length}/${tests.length} mock tests created.`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('\nCreated tests:')
  created.forEach(t => console.log(`  • ${t.title} (${t.isFree ? 'FREE' : 'PRO'}) → id: ${t.id}`))
  console.log('\nVisit: http://localhost:3000/dsc-sgt/mock-tests')
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
