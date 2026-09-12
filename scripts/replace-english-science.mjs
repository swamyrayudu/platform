// ============================================================
// scripts/replace-english-science.mjs
// ============================================================
// Replaces english_medium_science with the rebuilt bank, then repairs the mock
// tests that referenced the removed questions. Same treatment applied to
// telugu_medium_science, and the same guarantees.
//
//   node scripts/replace-english-science.mjs           # dry run (default)
//   node scripts/replace-english-science.mjs --apply   # commit
//
// The new rows carry a fresh question_id namespace (APSGT-SCI-EM-V7-*), so
// every existing reference to the old APSGT-SCI-EM-F4000-* ids is orphaned.
// Those orphans are deleted and the affected mock tests are set to draft so a
// broken test is never served.
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
const T = 'english_medium_science'
const CSV = process.env.ENGLISH_CSV
  || path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads',
               'english_medium_science_NEW.csv')

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift()
  return rows.filter((r) => r.length === header.length)
             .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s, p = []) => (await client.query(s, p)).rows
await client.connect()

// ---------------------------------------------------------------- validate
const csv = parseCsv(fs.readFileSync(CSV, 'utf8'))
console.log(`csv: ${csv.length} rows <- ${CSV}`)

const LETTERS = ['A', 'B', 'C', 'D']
const VALID_SUBJECTS = new Set(
  (await q(`select distinct subject from ${T}`)).map((r) => r.subject))
const problems = []
const seen = new Set()
const payload = []

for (const r of csv) {
  const qid = String(r['Question ID'] ?? '').trim()
  const opts = LETTERS.map((L) => String(r[`Option ${L}`] ?? '').trim())
  const ans = String(r['Correct Answer'] ?? '').trim()
  const question = String(r.Question ?? '').trim()
  const subject = String(r.Subject ?? '').trim()

  if (!qid) problems.push('blank question_id')
  else if (seen.has(qid)) problems.push(`duplicate question_id ${qid}`)
  seen.add(qid)
  if (!question) problems.push(`${qid}: blank question`)
  if (!LETTERS.includes(ans)) problems.push(`${qid}: bad correct_answer "${ans}"`)
  if (opts.some((o) => !o)) problems.push(`${qid}: blank option`)
  if (new Set(opts).size !== 4) problems.push(`${qid}: duplicate options`)
  if (!VALID_SUBJECTS.has(subject)) problems.push(`${qid}: unknown subject "${subject}"`)

  payload.push({
    question_id: qid,
    class_level: String(r['Class Level'] ?? '').trim(),
    subject,
    chapter: String(r.Chapter ?? '').trim(),
    topic: String(r.Topic ?? '').trim(),
    subtopic: String(r.Subtopic ?? '').trim(),
    difficulty: String(r.Difficulty ?? 'Medium').trim(),
    question_type: String(r['Question Type'] ?? 'MCQ').trim(),
    question,
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
    correct_answer: ans,
    explanation: String(r.Explanation ?? '').trim(),
    source_type: String(r['Source Type'] ?? '').trim() || 'AUTHORED_QUALITY_V7',
    language: 'English',
    tags: String(r.Tags ?? '').trim(),
  })
}

if (problems.length) {
  console.error(`\nrefusing to continue: ${problems.length} invalid rows`)
  problems.slice(0, 10).forEach((p) => console.error('   ', p))
  await client.end(); process.exit(1)
}
console.log(`validated: ${payload.length} rows, all well-formed`)

// ---------------------------------------------------------------- backup
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.resolve(process.cwd(), 'backups')
fs.mkdirSync(dir, { recursive: true })

const newQids = [...seen]
const liveRows = await q(`select * from ${T}`)
const orphanMtq = await q(
  `select * from mock_test_questions
    where question_table = $1 and not (question_id = any($2::text[]))`, [T, newQids])
const orphanMqu = await q(
  `select * from mock_question_usage
    where question_id in (select question_id from ${T})
      and not (question_id = any($1::text[]))`, [newQids])
const affectedTests = await q(
  `select distinct mock_test_id from mock_test_questions
    where question_table = $1 and not (question_id = any($2::text[]))`, [T, newQids])
const alreadyDraft = await q(
  `select count(*)::int n from mock_tests
    where id = any($1::uuid[]) and status = 'draft'`,
  [affectedTests.map((r) => r.mock_test_id)])

const backupFile = path.join(dir, `english-science-replace-${stamp}.json`)
fs.writeFileSync(backupFile, JSON.stringify({
  takenAt: stamp,
  english_medium_science: liveRows,
  mock_test_questions_removed: orphanMtq,
  mock_question_usage_removed: orphanMqu,
  mock_tests_set_to_draft: affectedTests.map((r) => r.mock_test_id),
}, null, 2), 'utf8')
console.log(`backup: ${liveRows.length} question rows + ${orphanMtq.length} mtq + ` +
            `${orphanMqu.length} mqu -> ${path.relative(process.cwd(), backupFile)}`)

console.log('\n=== plan ===')
console.log(`  delete from ${T}                    : ${liveRows.length}`)
console.log(`  insert into ${T}                    : ${payload.length}`)
console.log(`  delete orphaned mock_test_questions : ${orphanMtq.length}`)
console.log(`  delete orphaned mock_question_usage : ${orphanMqu.length}`)
console.log(`  mock tests to set to draft          : ${affectedTests.length}` +
            ` (${alreadyDraft[0].n} already draft from the Telugu replace)`)

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
  await client.end(); process.exit(0)
}

// ---------------------------------------------------------------- apply
console.log('\napplying...')
await client.query('BEGIN')
try {
  const del = await client.query(`delete from ${T}`)
  console.log(`  deleted ${del.rowCount} question rows`)

  const COLS = ['question_id', 'class_level', 'subject', 'chapter', 'topic', 'subtopic',
                'difficulty', 'question_type', 'question', 'option_a', 'option_b',
                'option_c', 'option_d', 'correct_answer', 'explanation', 'source_type',
                'language', 'tags']
  let inserted = 0
  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200)
    const values = [], params = []
    batch.forEach((row, bi) => {
      values.push(`(${COLS.map((_, ci) => `$${bi * COLS.length + ci + 1}`).join(',')})`)
      COLS.forEach((c) => params.push(row[c]))
    })
    inserted += (await client.query(
      `insert into ${T} (${COLS.join(',')}) values ${values.join(',')}`, params)).rowCount
  }
  console.log(`  inserted ${inserted} question rows`)

  const dq = await client.query(
    `delete from mock_test_questions
      where question_table = $1 and not (question_id = any($2::text[]))`, [T, newQids])
  console.log(`  removed ${dq.rowCount} orphaned mock_test_questions`)

  const du = await client.query(
    `delete from mock_question_usage where question_id = any($1::text[])`,
    [orphanMqu.map((r) => r.question_id)])
  console.log(`  removed ${du.rowCount} orphaned mock_question_usage`)

  let drafted = { rowCount: 0 }
  if (affectedTests.length) {
    drafted = await client.query(
      `update mock_tests set status = 'draft', updated_at = now() where id = any($1::uuid[])`,
      [affectedTests.map((r) => r.mock_test_id)])
  }
  console.log(`  set ${drafted.rowCount} mock tests to draft`)

  // ---- post-checks inside the transaction ----
  const [{ n: total }] = (await client.query(`select count(*)::int n from ${T}`)).rows
  if (total !== payload.length) throw new Error(`row count ${total} != ${payload.length}`)
  const [{ n: bad }] = (await client.query(
    `select count(*)::int n from ${T}
      where correct_answer not in ('A','B','C','D')
         or option_a is null or option_b is null
         or option_c is null or option_d is null
         or language <> 'English'`)).rows
  if (bad > 0) throw new Error(`${bad} invalid rows after insert`)
  const [{ n: orphan }] = (await client.query(
    `select count(*)::int n from mock_test_questions x
      where x.question_table = $1
        and not exists (select 1 from ${T} t where t.question_id = x.question_id)`, [T])).rows
  if (orphan > 0) throw new Error(`${orphan} orphaned mock_test_questions remain`)

  await client.query('COMMIT')
  console.log('\ncommitted')
} catch (e) {
  await client.query('ROLLBACK')
  console.error('\nrolled back, database unchanged:', e.message)
  process.exitCode = 1
}

await client.end()
