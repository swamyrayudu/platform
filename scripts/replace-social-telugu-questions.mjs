// ============================================================
// scripts/replace-social-telugu-questions.mjs
// ============================================================
// Replaces socal_telugu_medimum with the supplied production bank CSV, then
// REFILLS the mock-test slots that referenced the removed questions so the
// published Telugu modules stay published and complete.
//
//   node scripts/replace-social-telugu-questions.mjs           # dry run
//   node scripts/replace-social-telugu-questions.mjs --apply    # commit
//
//   SOCIAL_CSV=<path>   override the input CSV
//
// TRANSPORT NOTE
//   The direct Postgres host (db.<ref>.supabase.co) publishes only an AAAA
//   record and is unreachable from this machine, so this script talks to
//   PostgREST over HTTPS with the service-role key instead of `pg`. PostgREST
//   gives no multi-statement transaction, so the run is NOT atomic: a full
//   JSON backup of every table it touches is written first, and the run is
//   ordered so the recoverable steps come last.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

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
const T = 'socal_telugu_medimum'
const CSV = process.env.SOCIAL_CSV || path.join(
  process.env.USERPROFILE || process.env.HOME,
  'OneDrive', 'Documents', 'ChatGPT', 'New project', 'outputs',
  'ap_sgt_social_studies_telugu_medium_production_bank_2026-09-12.csv')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const LETTERS = ['A', 'B', 'C', 'D']

/** Read a whole table, 1000 rows per request. */
async function readAll(table, select = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=${select}`,
      { headers: { ...H, Range: `${from}-${from + 999}` } })
    const body = await r.json()
    if (!Array.isArray(body)) throw new Error(`${table}: ${JSON.stringify(body)}`)
    out.push(...body)
    if (body.length < 1000) return out
  }
}

async function send(method, pathAndQuery, body, extraPrefer = '') {
  const r = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...H, Prefer: ['return=minimal', extraPrefer].filter(Boolean).join(',') },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${method} ${pathAndQuery} -> ${r.status} ${await r.text()}`)
}

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

// ------------------------------------------------------- validate the CSV
const csv = parseCsv(fs.readFileSync(CSV, 'utf8'))
console.log(`csv: ${csv.length} rows <- ${CSV}`)

const problems = []
const seen = new Set()
const payload = []
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const stems = new Map()

for (const [i, r] of csv.entries()) {
  const qid = String(r['Question ID'] ?? '').trim()
  const question = String(r.Question ?? '').trim()
  const ans = String(r['Correct Answer'] ?? '').trim().toUpperCase()
  const opts = LETTERS.map((L) => String(r[`Option ${L}`] ?? '').trim())
  const where = `row ${i + 2}`

  if (!qid) problems.push(`${where}: blank Question ID`)
  else if (seen.has(qid)) problems.push(`${where}: duplicate Question ID ${qid}`)
  seen.add(qid)
  if (!question) problems.push(`${where}: blank Question`)
  if (!LETTERS.includes(ans)) problems.push(`${where}: bad Correct Answer "${ans}"`)
  if (opts.some((o) => !o)) problems.push(`${where}: blank option`)
  if (new Set(opts).size !== 4) problems.push(`${where}: duplicate options`)
  if (!String(r.Explanation ?? '').trim()) problems.push(`${where}: blank Explanation`)

  const k = norm(question)
  if (stems.has(k)) problems.push(`${where}: duplicate question text, same as row ${stems.get(k)}`)
  else stems.set(k, i + 2)

  payload.push({
    question_id: qid,
    class_level: String(r['Class Level'] ?? '').trim(),
    subject: String(r.Subject ?? '').trim(),
    chapter: String(r.Chapter ?? '').trim(),
    topic: String(r.Topic ?? '').trim(),
    subtopic: String(r.Subtopic ?? '').trim(),
    difficulty: String(r.Difficulty ?? '').trim(),
    question_type: String(r['Question Type'] ?? '').trim() || 'MCQ',
    question,
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
    correct_answer: ans,
    explanation: String(r.Explanation ?? '').trim(),
    source_type: String(r['Source Type'] ?? '').trim(),
    language: String(r.Language ?? '').trim() || 'Telugu',
    tags: String(r.Tags ?? '').trim(),
    is_active: true,
  })
}

if (problems.length) {
  console.error(`\nrefusing to continue: ${problems.length} invalid CSV rows`)
  problems.slice(0, 20).forEach((p) => console.error('   ', p))
  process.exit(1)
}
console.log(`validated: ${payload.length} rows, all well-formed`)

// ------------------------------------------------------- current state
const oldRows = await readAll(T, 'question_id')
const oldIds = new Set(oldRows.map((r) => r.question_id))
const newIds = new Set(payload.map((r) => r.question_id))
const allSlots = await readAll('mock_test_questions',
  'id,mock_test_id,question_id,question_table,question_number,section_id,section_name,marks,question_uid')
const mySlots = allSlots.filter((s) => s.question_table === T)
const orphans = mySlots.filter((s) => !newIds.has(s.question_id))
const affectedTests = new Set(mySlots.map((s) => s.mock_test_id))

console.log(`\ncurrent ${T}: ${oldRows.length} rows`)
console.log(`slots pointing at this table: ${mySlots.length} across ${affectedTests.size} mock tests`)
console.log(`  survive the swap : ${mySlots.length - orphans.length}`)
console.log(`  need refilling   : ${orphans.length}`)
console.log(`rows removed       : ${[...oldIds].filter((i) => !newIds.has(i)).length}`)
console.log(`ids reused with new content: ${[...newIds].filter((i) => oldIds.has(i)).length}`)

// ------------------------------------------------------- plan the refill
// Spread replacements evenly: always take the least-used candidate that the
// test does not already contain, so no module repeats a question.
const usedInTest = new Map()
for (const s of mySlots) {
  if (!usedInTest.has(s.mock_test_id)) usedInTest.set(s.mock_test_id, new Set())
  if (newIds.has(s.question_id)) usedInTest.get(s.mock_test_id).add(s.question_id)
}
const useCount = new Map(payload.map((r) => [r.question_id, 0]))
const assignments = []
const unfillable = []

for (const slot of orphans) {
  const taken = usedInTest.get(slot.mock_test_id)
  let pick = null, best = Infinity
  for (const [qid, n] of useCount) {
    if (taken.has(qid)) continue
    if (n < best) { best = n; pick = qid; if (n === 0) break }
  }
  if (!pick) { unfillable.push(slot.id); continue }
  taken.add(pick)
  useCount.set(pick, useCount.get(pick) + 1)
  assignments.push({
    id: slot.id,
    mock_test_id: slot.mock_test_id,
    question_id: pick,
    question_table: T,
    question_number: slot.question_number,
    section_id: slot.section_id,
    section_name: slot.section_name,
    marks: slot.marks,
    question_uid: `${T}:${pick}`,
  })
}

const reuse = [...useCount.values()]
console.log(`\nrefill plan: ${assignments.length} slots reassigned` +
  (unfillable.length ? `, ${unfillable.length} UNFILLABLE` : ''))
console.log(`  pool questions used once or more: ${reuse.filter((n) => n > 0).length} of ${reuse.length}`)
console.log(`  max times any one question reused: ${Math.max(...reuse)}`)
if (unfillable.length) {
  console.error('  refusing to continue: pool too small to fill every slot without repeats')
  process.exit(1)
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
  process.exit(0)
}

// ------------------------------------------------------- backup
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
fs.mkdirSync('supabase/backups', { recursive: true })
const bk = (name, data) => {
  const f = `supabase/backups/${name}-${stamp}.json`
  fs.writeFileSync(f, JSON.stringify(data, null, 1))
  console.log(`  backup -> ${f} (${Array.isArray(data) ? data.length : 1} rows)`)
}
console.log('\nwriting backups...')
bk(`${T}-full`, await readAll(T, '*'))
bk('mock_test_questions-social-telugu', mySlots)
bk('mock_question_usage-social-telugu',
  (await readAll('mock_question_usage', '*')).filter((u) => u.question_table === T))

// ------------------------------------------------------- swap the bank
console.log('\nreplacing question rows...')
await send('DELETE', `${T}?id=not.is.null`)
console.log(`  deleted ${oldRows.length} old rows`)
for (let i = 0; i < payload.length; i += 500) {
  await send('POST', T, payload.slice(i, i + 500))
  console.log(`  inserted ${Math.min(i + 500, payload.length)}/${payload.length}`)
}

// ------------------------------------------------------- refill the slots
console.log('\nrefilling mock-test slots...')
for (let i = 0; i < assignments.length; i += 200) {
  await send('POST', 'mock_test_questions?on_conflict=id',
    assignments.slice(i, i + 200), 'resolution=merge-duplicates')
  console.log(`  reassigned ${Math.min(i + 200, assignments.length)}/${assignments.length}`)
}

// ------------------------------------------------------- rebuild usage
// mock_test_questions is the source of truth for membership, so recompute the
// per-question usage counters for this table rather than patching them.
console.log('\nrebuilding mock_question_usage for this table...')
await send('DELETE', `mock_question_usage?question_table=eq.${T}`)
const tests = await readAll('mock_tests', 'id,medium,module_number')
const testById = new Map(tests.map((t) => [t.id, t]))
const freshSlots = (await readAll('mock_test_questions',
  'mock_test_id,question_id,question_table,section_id,question_uid'))
  .filter((s) => s.question_table === T)
const usage = new Map()
for (const s of freshSlots) {
  const t = testById.get(s.mock_test_id)
  if (!t) continue
  const key = `${s.question_uid}|${t.medium}`
  const cur = usage.get(key) || {
    question_uid: s.question_uid, question_id: s.question_id, question_table: T,
    medium: t.medium, section_id: s.section_id, usage_count: 0,
    last_module_number: null, last_mock_test_id: null,
  }
  cur.usage_count += 1
  if (cur.last_module_number === null || (t.module_number ?? 0) >= cur.last_module_number) {
    cur.last_module_number = t.module_number ?? null
    cur.last_mock_test_id = s.mock_test_id
  }
  usage.set(key, cur)
}
const usageRows = [...usage.values()]
for (let i = 0; i < usageRows.length; i += 500) {
  await send('POST', 'mock_question_usage', usageRows.slice(i, i + 500))
  console.log(`  usage rows ${Math.min(i + 500, usageRows.length)}/${usageRows.length}`)
}

console.log('\ndone.')
