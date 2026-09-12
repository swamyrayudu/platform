// ============================================================
// scripts/repair-module-slots.mjs
// ============================================================
// Replaces question slots in PUBLISHED modules that point at a retired
// (is_active = false) question.
//
// Retiring a bad question is only half the job: the 200 generated modules hold
// a FIXED set of question ids, so a module that already contains a corrupted
// question keeps serving it to students until that specific slot is swapped.
//
// For each affected slot this picks a replacement from the SAME source table
// (so section, subject and medium are preserved by construction), excluding
// anything already in that module, preferring the least-used question so the
// repair does not undo the coverage work.
//
// The module's `version` is then bumped, which changes the Redis cache key and
// forces a rebuild from PostgreSQL on the next read. Attempts pin their version
// at start, so an in-flight attempt keeps the paper it began.
//
// Usage:
//   node scripts/repair-module-slots.mjs            # dry run
//   node scripts/repair-module-slots.mjs --apply
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const full = path.resolve(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
    }
  }
}
loadEnv()

const APPLY = process.argv.includes('--apply')

const TABLES = [
  'telugu_subject_questions',
  'gk_telugu_medium',
  'pedagogy_subject_questions',
  'telugu_medium_math',
  'telugu_medium_science',
  'socal_telugu_medimum',
  'english_subject_questions',
  'pedagogy_english_medium',
  'math_english_medium',
  'english_medium_science',
  'socal_english_medium',
  'gk_english_medium',
]

async function main() {
  const c = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // 1. Slots in published modules whose question has been retired.
  const affected = []
  for (const table of TABLES) {
    const { rows } = await c.query(
      `select q.id mapping_id, q.mock_test_id, q.question_id, q.question_number,
              q.section_id, t.medium, t.module_number, t.version
         from mock_test_questions q
         join mock_tests t on t.id = q.mock_test_id
         join ${table} s on s.question_id = q.question_id
        where q.question_table = $1
          and t.status = 'published'
          and s.is_active = false`,
      [table]
    )
    rows.forEach((r) => affected.push({ ...r, question_table: table }))
  }

  if (affected.length === 0) {
    console.log('No published module slots point at a retired question. Nothing to do.')
    await c.end()
    return
  }

  const modules = new Set(affected.map((a) => a.mock_test_id))
  console.log(`${affected.length} slots across ${modules.size} published modules need replacing.`)

  const byTable = {}
  affected.forEach((a) => {
    byTable[a.question_table] = (byTable[a.question_table] ?? 0) + 1
  })
  console.table(
    Object.entries(byTable).map(([question_table, slots]) => ({ question_table, slots }))
  )

  if (!APPLY) {
    console.log('\nDry run — nothing changed. Re-run with --apply.')
    await c.end()
    return
  }

  // 2. Replace each slot.
  let replaced = 0
  let unreplaceable = 0
  const touchedModules = new Set()

  for (const slot of affected) {
    // Candidates: same table (=> same section/subject/medium), active, complete,
    // and not already present in this module. Least-used first so the repair
    // keeps question coverage as even as possible.
    const { rows: candidates } = await c.query(
      `select s.question_id,
              coalesce(u.usage_count, 0) as uses
         from ${slot.question_table} s
         left join mock_question_usage u
                on u.question_uid = $1 || ':' || s.question_id
               and u.medium = $2
        where s.is_active = true
          and s.question is not null and s.option_a is not null and s.option_b is not null
          and s.option_c is not null and s.option_d is not null and s.correct_answer is not null
          and upper(trim(s.correct_answer)) in ('A','B','C','D')
          and s.question_id is not null
          and not exists (
            select 1 from mock_test_questions m
             where m.mock_test_id = $3 and m.question_id = s.question_id
          )
        order by uses asc, random()
        limit 1`,
      [slot.question_table, slot.medium, slot.mock_test_id]
    )

    if (candidates.length === 0) {
      unreplaceable++
      console.warn(
        `  no replacement available for module ${slot.module_number} (${slot.medium}) slot Q${slot.question_number} from ${slot.question_table}`
      )
      continue
    }

    const next = candidates[0]
    const uid = `${slot.question_table}:${next.question_id}`

    await c.query(
      `update mock_test_questions
          set question_id = $1, question_uid = $2
        where id = $3`,
      [next.question_id, uid, slot.mapping_id]
    )

    await c.query(
      `insert into mock_question_usage
         (question_uid, question_id, question_table, medium, section_id, usage_count, last_mock_test_id)
       values ($1, $2, $3, $4, $5, 1, $6)
       on conflict (question_uid, medium)
       do update set usage_count = mock_question_usage.usage_count + 1,
                     last_mock_test_id = excluded.last_mock_test_id,
                     updated_at = now()`,
      [uid, next.question_id, slot.question_table, slot.medium, slot.section_id, slot.mock_test_id]
    )

    replaced++
    touchedModules.add(slot.mock_test_id)
  }

  // 3. Bump the version of every touched module so the cached paper is rebuilt.
  if (touchedModules.size > 0) {
    await c.query(
      `update mock_tests
          set version = version + 1, updated_at = now()
        where id = any($1)`,
      [[...touchedModules]]
    )
  }

  console.log(`\nreplaced ${replaced} slots across ${touchedModules.size} modules`)
  if (unreplaceable > 0) console.log(`${unreplaceable} slots had no eligible replacement`)
  console.log('module versions bumped — Redis keys change, papers rebuild from PostgreSQL on next read')

  // 4. Prove no published module still references a retired question.
  let remaining = 0
  for (const table of TABLES) {
    const { rows } = await c.query(
      `select count(*)::int n
         from mock_test_questions q
         join mock_tests t on t.id = q.mock_test_id
         join ${table} s on s.question_id = q.question_id
        where q.question_table = $1 and t.status = 'published' and s.is_active = false`,
      [table]
    )
    remaining += rows[0].n
  }
  console.log(`\nverification: ${remaining} slots still point at a retired question (expected 0)`)

  const integrity = await c.query(`
    select count(*)::int bad_modules from (
      select t.id
        from mock_tests t join mock_test_questions q on q.mock_test_id = t.id
       where t.module_number is not null
       group by t.id
      having count(*) <> 160
          or count(distinct q.question_uid) <> 160
          or count(distinct q.question_number) <> 160) x`)
  console.log(`modules not holding exactly 160 unique questions: ${integrity.rows[0].bad_modules} (expected 0)`)

  await c.end()
}

main().catch((err) => {
  console.error('Repair failed:', err.message)
  process.exitCode = 1
})
