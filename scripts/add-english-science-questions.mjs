// ============================================================
// scripts/add-english-science-questions.mjs
// ============================================================
// ADDITIVE. Appends authored questions to english_medium_science from
// data/science-em-expansion/*.json. Nothing is deleted or rewritten, so no
// mock test reference can break.
//
//   node scripts/add-english-science-questions.mjs           # dry run (default)
//   node scripts/add-english-science-questions.mjs --apply   # commit
//
// Guarantees, enforced before a single row is written:
//   • every row well-formed (4 distinct options, answer in A-D, explanation)
//   • chapter/subject pairing matches the pairing the table already uses
//   • no stem contains its own correct option verbatim
//   • NO DUPLICATES — a candidate is dropped if its normalised stem already
//     exists in the table or earlier in the batch
//   • question_id is unique against the live table
// ============================================================

import crypto from 'node:crypto'
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
const SRC_DIR = path.resolve(process.cwd(), 'data/science-em-expansion')
const LETTERS = ['A', 'B', 'C', 'D']
const CLASS_LEVELS = new Set(['5', '6', '7', '8', '9', '10', 'III-VIII'])
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard'])
const PREAMBLE = /^(Considering|Analyzing|Observing|Based on|Looking at|Examining)/

/** Stem identity used for duplicate detection: case/punctuation/space blind. */
const normStem = (s) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Does `needle` occur in `hay` as a whole run of words?
 * Token-based so that the option "Double" is not reported as leaked by a stem
 * that merely says "doubled".
 */
function containsPhrase(hay, needle) {
  const h = normStem(hay).split(' ')
  const n = normStem(needle).split(' ').filter(Boolean)
  if (!n.length) return false
  for (let i = 0; i + n.length <= h.length; i++) {
    if (n.every((w, k) => h[i + k] === w)) return true
  }
  return false
}

/**
 * Authoring puts the correct option first, which would make every answer "A".
 * Re-place it: row `i` puts its correct option at ROTATION[i % 4], giving an
 * exactly even key spread, and the distractors are rotated by a hash of the
 * stem so their order does not fall into a visible pattern either.
 */
const ROTATION = [0, 2, 1, 3]
function placeOptions(correct, distractors, index, stemKey) {
  const slot = ROTATION[index % ROTATION.length]
  const seed = parseInt(
    crypto.createHash('sha256').update(stemKey).digest('hex').slice(0, 4), 16)
  const rest = distractors.slice()
  const rotated = rest.map((_, k) => rest[(k + seed) % rest.length])
  const out = []
  let r = 0
  for (let k = 0; k < 4; k++) out.push(k === slot ? correct : rotated[r++])
  return { options: out, answer: LETTERS[slot] }
}

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s, p = []) => (await client.query(s, p)).rows
await client.connect()

// ------------------------------------------------- live table conventions
const live = await q(
  `select question_id, chapter, subject, question from ${T}`)
const liveStems = new Map()      // normalised stem -> question_id
const liveIds = new Set()
const chapterSubject = new Map() // chapter -> subject already used for it
for (const r of live) {
  liveStems.set(normStem(r.question), r.question_id)
  liveIds.add(r.question_id)
  if (!chapterSubject.has(r.chapter)) chapterSubject.set(r.chapter, r.subject)
}
const liveSubjects = new Set(live.map((r) => r.subject))
console.log(`live table: ${live.length} rows, ${chapterSubject.size} chapters`)

// ------------------------------------------------- load candidates
if (!fs.existsSync(SRC_DIR)) {
  console.error(`missing source directory ${SRC_DIR}`)
  await client.end(); process.exit(1)
}
const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.json')).sort()
const candidates = []
for (const f of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'))
  if (!Array.isArray(parsed)) {
    console.error(`${f}: expected a JSON array`); await client.end(); process.exit(1)
  }
  parsed.forEach((row, i) => candidates.push({ ...row, __src: `${f}#${i}` }))
  console.log(`  ${f.padEnd(28)} ${parsed.length} candidates`)
}
console.log(`total candidates: ${candidates.length}`)

// ------------------------------------------------- validate + dedupe
const problems = []
const batchStems = new Map()
const usedIds = new Set()
const payload = []
const dropped = { dupLive: [], dupBatch: [] }

for (const r of candidates) {
  const where = r.__src
  const question = String(r.question ?? '').trim()
  const chapter = String(r.chapter ?? '').trim()
  const subject = String(r.subject ?? '').trim()
  const topic = String(r.topic ?? '').trim()
  const subtopic = String(r.subtopic ?? '').trim()
  const classLevel = String(r.class_level ?? '').trim()
  const difficulty = String(r.difficulty ?? '').trim()
  const explanation = String(r.explanation ?? '').trim()
  const answer = String(r.answer ?? '').trim().toUpperCase()
  const opts = Array.isArray(r.options) ? r.options.map((o) => String(o ?? '').trim()) : []

  if (!question) problems.push(`${where}: blank question`)
  if (PREAMBLE.test(question)) problems.push(`${where}: boilerplate preamble stem`)
  if (!explanation) problems.push(`${where}: blank explanation`)
  if (!topic) problems.push(`${where}: blank topic`)
  if (!subtopic) problems.push(`${where}: blank subtopic`)
  if (!CLASS_LEVELS.has(classLevel)) problems.push(`${where}: bad class_level "${classLevel}"`)
  if (!DIFFICULTIES.has(difficulty)) problems.push(`${where}: bad difficulty "${difficulty}"`)
  if (!LETTERS.includes(answer)) problems.push(`${where}: bad answer "${answer}"`)
  if (opts.length !== 4) problems.push(`${where}: needs exactly 4 options`)
  else {
    if (opts.some((o) => !o)) problems.push(`${where}: blank option`)
    if (new Set(opts).size !== 4) problems.push(`${where}: duplicate options`)
  }
  if (!liveSubjects.has(subject)) problems.push(`${where}: unknown subject "${subject}"`)
  const knownSubject = chapterSubject.get(chapter)
  if (knownSubject === undefined) {
    problems.push(`${where}: chapter "${chapter}" is not an existing chapter`)
  } else if (knownSubject !== subject) {
    problems.push(`${where}: chapter "${chapter}" is subject "${knownSubject}", got "${subject}"`)
  }

  // A stem must never hand over its own answer.
  let correct = ''
  if (LETTERS.includes(answer) && opts.length === 4) {
    correct = opts[LETTERS.indexOf(answer)]
    if (correct && normStem(correct).length > 3 && containsPhrase(question, correct)) {
      problems.push(`${where}: stem contains its own answer "${correct}"`)
    }
  }

  // ---- duplicate control
  const key = normStem(question)
  if (liveStems.has(key)) { dropped.dupLive.push(`${where} <- ${liveStems.get(key)}`); continue }
  if (batchStems.has(key)) { dropped.dupBatch.push(`${where} <- ${batchStems.get(key)}`); continue }
  batchStems.set(key, where)

  // ---- deterministic id, collision-checked against the live table
  let qid = ''
  for (let salt = 0; salt < 50; salt++) {
    const hex = crypto.createHash('sha256').update(key + (salt ? `#${salt}` : ''))
      .digest('hex').slice(0, 10).toUpperCase()
    qid = `APSGT-SCI-EM-V7-${hex}`
    if (!liveIds.has(qid) && !usedIds.has(qid)) break
    qid = ''
  }
  if (!qid) { problems.push(`${where}: could not mint a unique question_id`); continue }
  usedIds.add(qid)

  // Spread the correct option across A-D instead of leaving it wherever it
  // happened to be authored.
  const distractors = opts.filter((_, i) => i !== LETTERS.indexOf(answer))
  const placed = placeOptions(correct, distractors, payload.length, key)

  payload.push({
    question_id: qid,
    class_level: classLevel,
    subject,
    chapter,
    topic,
    subtopic,
    difficulty,
    question_type: 'MCQ',
    question,
    option_a: placed.options[0], option_b: placed.options[1],
    option_c: placed.options[2], option_d: placed.options[3],
    correct_answer: placed.answer,
    explanation,
    source_type: 'AUTHORED_QUALITY_V7',
    language: 'English',
    tags: `class${classLevel},science_english,sgt_practice,quality_v7,authored,expansion_v8`,
  })
}

if (dropped.dupLive.length || dropped.dupBatch.length) {
  console.log(`\nduplicates dropped: ${dropped.dupLive.length} already in table, ` +
              `${dropped.dupBatch.length} repeated inside the batch`)
  ;[...dropped.dupLive, ...dropped.dupBatch].slice(0, 15)
    .forEach((d) => console.log('   ', d))
}

if (problems.length) {
  console.error(`\nrefusing to continue: ${problems.length} invalid candidates`)
  problems.slice(0, 25).forEach((p) => console.error('   ', p))
  await client.end(); process.exit(1)
}
console.log(`\nvalidated: ${payload.length} new rows ready`)

// ------------------------------------------------- projected shape
const tally = (arr, k) => arr.reduce((a, r) => (a[r[k]] = (a[r[k]] || 0) + 1, a), {})
console.log('  new by difficulty :', JSON.stringify(tally(payload, 'difficulty')))
console.log('  new by subject    :', JSON.stringify(tally(payload, 'subject')))
console.log('  new answer keys   :', JSON.stringify(tally(payload, 'correct_answer')))
const [before] = await q(
  `select count(*) filter (where difficulty ilike 'easy')::int easy,
          count(*) filter (where difficulty ilike 'medium')::int medium,
          count(*) filter (where difficulty ilike 'hard')::int hard,
          count(*)::int total from ${T}`)
const add = tally(payload, 'difficulty')
const after = {
  easy: before.easy + (add.Easy || 0),
  medium: before.medium + (add.Medium || 0),
  hard: before.hard + (add.Hard || 0),
  total: before.total + payload.length,
}
const pct = (n, t) => `${((n / t) * 100).toFixed(1)}%`
console.log(`  pool difficulty before: easy ${pct(before.easy, before.total)} / ` +
  `medium ${pct(before.medium, before.total)} / hard ${pct(before.hard, before.total)} (n=${before.total})`)
console.log(`  pool difficulty after : easy ${pct(after.easy, after.total)} / ` +
  `medium ${pct(after.medium, after.total)} / hard ${pct(after.hard, after.total)} (n=${after.total})`)
console.log('  blueprint target      : easy 25% / medium 50% / hard 25%')

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
  await client.end(); process.exit(0)
}

// ------------------------------------------------- insert
const COLS = ['question_id', 'class_level', 'subject', 'chapter', 'topic', 'subtopic',
  'difficulty', 'question_type', 'question', 'option_a', 'option_b', 'option_c',
  'option_d', 'correct_answer', 'explanation', 'source_type', 'language', 'tags']

await q('begin')
try {
  const CHUNK = 250
  let written = 0
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK)
    const values = []
    const tuples = slice.map((row, n) => {
      const base = n * COLS.length
      COLS.forEach((c) => values.push(row[c]))
      return `(${COLS.map((_, k) => `$${base + k + 1}`).join(',')})`
    })
    // ON CONFLICT keeps the insert idempotent if the script is run twice.
    await q(`insert into ${T} (${COLS.join(',')}) values ${tuples.join(',')}
             on conflict (question_id) do nothing`, values)
    written += slice.length
    console.log(`  inserted ${written}/${payload.length}`)
  }
  await q('commit')
} catch (e) {
  await q('rollback')
  console.error('insert failed, rolled back:', e.message)
  await client.end(); process.exit(1)
}

const [now] = await q(`select count(*)::int n from ${T}`)
console.log(`\ndone. ${T} now holds ${now.n} rows (was ${before.total}).`)
await client.end()
