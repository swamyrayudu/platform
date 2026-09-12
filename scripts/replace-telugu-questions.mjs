// ============================================================
// scripts/replace-telugu-questions.mjs
// ============================================================
// Swaps the Telugu question bank's text for the rebuilt version.
//
//   node scripts/replace-telugu-questions.mjs                  # dry run (default)
//   node scripts/replace-telugu-questions.mjs --backup-only    # just write the backup
//   node scripts/replace-telugu-questions.mjs --apply          # write to the database
//
// WHY UPDATE AND NOT DELETE + INSERT
//   mock_test_questions (4,944 rows), mock_question_usage (6,056),
//   question_attempts and question_progress all reference
//   telugu_subject_questions.question_id. Re-inserting would mint new rows and
//   orphan every one of those references, so the rows are updated in place and
//   keep their id and question_id.
//
// WHAT IS DELIBERATELY NOT TOUCHED
//   is_active  — 810 rows are switched off on purpose; the CSV export included
//                them, and honouring the CSV would silently switch them back on.
//   id, question_id, created_at, subject, class_level, chapter, topic,
//   subtopic, difficulty, question_type, source_type, language, tags.
//
// Only question, option_a..d, correct_answer, explanation and updated_at change.
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
const BACKUP_ONLY = process.argv.includes('--backup-only')
const TABLE = 'telugu_subject_questions'
const CSV = process.env.FIXED_CSV
  || path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads',
               'dsc_practice_telugu_FIXED.csv')

// ---------- minimal RFC4180 CSV reader ----------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift()
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (sql, p = []) => (await client.query(sql, p)).rows

await client.connect()

// ---------- 1. back up everything we are about to change ----------
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.resolve(process.cwd(), 'backups')
fs.mkdirSync(backupDir, { recursive: true })
const backupFile = path.join(backupDir, `${TABLE}-${stamp}.json`)

const live = await q(`select * from ${TABLE} order by question_id`)
fs.writeFileSync(backupFile, JSON.stringify(live, null, 2), 'utf8')
console.log(`backup: ${live.length} rows -> ${path.relative(process.cwd(), backupFile)}`)
if (BACKUP_ONLY) { await client.end(); process.exit(0) }

// ---------- 2. match CSV rows to live rows ----------
const csvRows = parseCsv(fs.readFileSync(CSV, 'utf8'))
console.log(`csv:    ${csvRows.length} rows <- ${CSV}`)

// Match on the uuid primary key, NOT question_id: 11 question_id values occur
// twice in this table, so matching on it would leave those rows unreachable.
const byQid = new Map(live.map((r) => [String(r.id), r]))
const seen = new Set()
const updates = []
const problems = { unmatched: [], duplicate: [], badAnswer: [], badOption: [] }

for (const r of csvRows) {
  const qid = String(r.ID ?? '').trim()
  const target = byQid.get(qid)
  if (!target) { problems.unmatched.push(qid); continue }
  // The CSV export is lossy: it repeats 11 ids and omits 11 others. The db has
  // a PRIMARY KEY on id, so a repeat is just a duplicated export row -- keep the
  // first copy, record the rest, and leave the omitted db rows untouched.
  if (seen.has(qid)) { problems.duplicate.push(qid); continue }
  seen.add(qid)

  const opts = ['A', 'B', 'C', 'D'].map((L) => String(r[`Option ${L}`] ?? '').trim())
  const ans = String(r['Correct Answer'] ?? '').trim()
  if (!['A', 'B', 'C', 'D'].includes(ans)) { problems.badAnswer.push(qid); continue }
  if (opts.some((o) => !o) || new Set(opts).size !== 4) { problems.badOption.push(qid); continue }

  const next = {
    question: String(r.Question ?? '').trim(),
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
    correct_answer: ans,
    explanation: String(r.Explanation ?? '').trim(),
  }
  const changed = Object.keys(next).some((k) => String(target[k] ?? '').trim() !== next[k])
  if (changed) updates.push({ id: target.id, qid, next })
}

console.log('\n=== match report ===')
console.log(`  matched and changed : ${updates.length}`)
console.log(`  matched, identical  : ${seen.size - updates.length}`)
console.log(`  csv id not in db    : ${problems.unmatched.length}`)
console.log(`  duplicate csv id    : ${problems.duplicate.length}`)
console.log(`  invalid answer col  : ${problems.badAnswer.length}`)
console.log(`  blank/dupe options  : ${problems.badOption.length}`)
console.log(`  db rows not in csv  : ${live.length - seen.size}`)
for (const [k, v] of Object.entries(problems)) {
  if (v.length) console.log(`    ${k} sample: ${v.slice(0, 5).join(', ')}`)
}

// A duplicated export row is harmless (first copy wins). Anything that could
// actually corrupt the table still stops the run.
const hardFail = problems.badAnswer.length || problems.badOption.length
  || problems.unmatched.length
if (hardFail) {
  console.error('\nrefusing to continue: the CSV has rows that would corrupt the table')
  await client.end()
  process.exit(1)
}

const missed = live.filter((r) => !seen.has(String(r.id)))
if (missed.length) {
  console.log(`\n  ${missed.length} db rows are absent from the CSV and stay UNCHANGED:`)
  for (const m of missed) console.log(`    ${m.question_id}  ${m.question.slice(0, 60)}`)
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
  const [ex] = updates
  if (ex) {
    const before = byQid.get(ex.qid)
    console.log(`\nexample (${ex.qid}):`)
    console.log(`  before Q: ${before.question}`)
    console.log(`  after  Q: ${ex.next.question}`)
    console.log(`  before A: ${before.option_a} / ${before.option_b} / ${before.option_c} / ${before.option_d}  [${before.correct_answer}]`)
    console.log(`  after  A: ${ex.next.option_a} / ${ex.next.option_b} / ${ex.next.option_c} / ${ex.next.option_d}  [${ex.next.correct_answer}]`)
  }
  await client.end()
  process.exit(0)
}

// ---------- 3. apply, all-or-nothing ----------
console.log('\napplying...')
await client.query('BEGIN')
try {
  let n = 0
  for (const u of updates) {
    await client.query(
      `update ${TABLE}
          set question = $2, option_a = $3, option_b = $4, option_c = $5,
              option_d = $6, correct_answer = $7, explanation = $8,
              updated_at = now()
        where id = $1`,
      [u.id, u.next.question, u.next.option_a, u.next.option_b, u.next.option_c,
       u.next.option_d, u.next.correct_answer, u.next.explanation],
    )
    if (++n % 500 === 0) console.log(`  ${n}/${updates.length}`)
  }

  const [{ bad }] = (await client.query(
    `select count(*)::int as bad from ${TABLE}
      where correct_answer not in ('A','B','C','D')
         or option_a is null or option_b is null
         or option_c is null or option_d is null`,
  )).rows
  if (bad > 0) throw new Error(`post-check failed: ${bad} invalid rows`)

  await client.query('COMMIT')
  console.log(`committed ${updates.length} row updates`)
} catch (e) {
  await client.query('ROLLBACK')
  console.error('rolled back, database unchanged:', e.message)
  process.exitCode = 1
}

const [{ active }] = await q(
  `select count(*)::int as active from ${TABLE} where is_active = true`,
)
console.log(`is_active=true still: ${active}`)
await client.end()
