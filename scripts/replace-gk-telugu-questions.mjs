// ============================================================
// scripts/replace-gk-telugu-questions.mjs
// ============================================================
// Loads a reviewed GK bank CSV into gk_telugu_medium, then REFILLS the
// mock-test slots that pointed at removed questions, so the published Telugu
// modules stay complete. Same approach as replace-social-telugu-questions.mjs.
//
//   node scripts/replace-gk-telugu-questions.mjs <csv>           # dry run
//   node scripts/replace-gk-telugu-questions.mjs <csv> --apply   # commit
//
// THE CSV (2026-10-16, 955 rows) uses the admin import headers:
//   question_id, question, option_a..d, correct_answer, explanation,
//   topic, subtopic, chapter, difficulty
// Its `topic` is a placeholder ("GK" / "Current Affairs") and the real
// category is in `chapter`, so topic is set from chapter: practice topic
// choice and the mock series mixer both group by topic. The columns the file
// leaves out get the values the previous bank used.
//
// WHY THE REFILL: a mock module is a fixed list of question_ids. The loader
// does `.in('question_id', ids)` and quietly gets fewer rows back for ids that
// no longer exist, so a module would serve fewer than 16 GK questions. Each
// orphaned slot keeps its number/section/marks and gets a least-used question
// from the new pool that its module does not already contain. Every touched
// module's version is bumped, which changes its Redis keys, so the cached
// paper is rebuilt from PostgreSQL.
//
// TRANSPORT: PostgREST over HTTPS (the direct Postgres host is IPv6-only from
// this machine). Not atomic, so JSON backups go to supabase/backups/ first.
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
const CSV = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!CSV) { console.error('usage: node scripts/replace-gk-telugu-questions.mjs <csv> [--apply]'); process.exit(1) }
const T = 'gk_telugu_medium'

// What the previous bank carried for the columns this CSV does not have.
const DEFAULTS = {
  subject: 'GK & Current Affairs',
  question_type: 'బహుళైచ్ఛిక ప్రశ్న',
  source_type: 'ప్రామాణిక సాధారణ జ్ఞాన మూలాలు',
  language: 'Telugu',
  tags: 'సాధారణ_జ్ఞానం,ప్రస్తుత_వ్యవహారాలు,తెలుగు_మాధ్యమం',
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const LETTERS = ['A', 'B', 'C', 'D']

/** Read a whole table, 1000 rows per request. */
async function readAll(table, select = '*', filter = '') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=${select}${filter}&order=id`,
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
  const header = rows.shift().map((h) => h.trim().toLowerCase())
  return rows.filter((r) => r.length === header.length)
             .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i].trim()])))
}

// ------------------------------------------------------- validate the CSV
const csv = parseCsv(fs.readFileSync(CSV, 'utf8'))
console.log(`csv: ${csv.length} rows <- ${CSV}`)

const problems = []
const seen = new Set()
const stems = new Map()
const payload = []
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

for (const [i, r] of csv.entries()) {
  const where = `row ${i + 2}`
  const qid = r.question_id
  const ans = r.correct_answer.toUpperCase()
  const opts = LETTERS.map((L) => r[`option_${L.toLowerCase()}`])

  if (!qid) problems.push(`${where}: blank question_id`)
  else if (seen.has(qid)) problems.push(`${where}: duplicate question_id ${qid}`)
  seen.add(qid)
  if (!r.question) problems.push(`${where}: blank question`)
  if (!LETTERS.includes(ans)) problems.push(`${where}: bad correct_answer "${r.correct_answer}"`)
  if (opts.some((o) => !o)) problems.push(`${where}: blank option`)
  else if (new Set(opts).size !== 4) problems.push(`${where}: duplicate options`)
  if (!r.explanation) problems.push(`${where}: blank explanation`)
  if (!r.chapter) problems.push(`${where}: blank chapter (it becomes the topic)`)
  const k = norm(r.question)
  if (stems.has(k)) problems.push(`${where}: same question text as row ${stems.get(k)}`)
  else stems.set(k, i + 2)

  payload.push({
    question_id: qid,
    ...DEFAULTS,
    chapter: r.chapter,
    topic: r.chapter,
    subtopic: r.subtopic || null,
    difficulty: r.difficulty || 'Medium',
    question: r.question,
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
    correct_answer: ans,
    explanation: r.explanation,
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
const oldRows = await readAll(T, 'id,question_id')
const newIds = new Set(payload.map((r) => r.question_id))
const mySlots = await readAll('mock_test_questions',
  'id,mock_test_id,question_id,question_table,question_number,section_id,section_name,marks,question_uid',
  `&question_table=eq.${T}`)
const orphans = mySlots.filter((s) => !newIds.has(s.question_id))
const affectedTests = new Set(mySlots.map((s) => s.mock_test_id))
const refilledTests = new Set(orphans.map((s) => s.mock_test_id))

console.log(`\ncurrent ${T}: ${oldRows.length} rows (all replaced)`)
console.log(`slots pointing at this table: ${mySlots.length} across ${affectedTests.size} mock tests`)
console.log(`  keep their question : ${mySlots.length - orphans.length}`)
console.log(`  need refilling      : ${orphans.length} in ${refilledTests.size} mock tests`)

// ------------------------------------------------------- plan the refill
// Least-used question that the module does not already contain, counting the
// slots that keep their question, so the series stays evenly spread.
const usedInTest = new Map()
const useCount = new Map(payload.map((r) => [r.question_id, 0]))
for (const s of mySlots) {
  if (!usedInTest.has(s.mock_test_id)) usedInTest.set(s.mock_test_id, new Set())
  if (newIds.has(s.question_id)) {
    usedInTest.get(s.mock_test_id).add(s.question_id)
    useCount.set(s.question_id, useCount.get(s.question_id) + 1)
  }
}
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
console.log(`  questions used in at least one mock: ${reuse.filter((n) => n > 0).length} of ${reuse.length}`)
console.log(`  most mocks any one question is in : ${Math.max(...reuse)}`)
if (unfillable.length) {
  console.error('  refusing to continue: pool too small to fill every slot without repeats')
  process.exit(1)
}
const topics = {}
for (const r of payload) topics[r.topic] = (topics[r.topic] ?? 0) + 1
console.log(`\ntopics (from chapter): ${Object.keys(topics).length}`)
for (const [t, n] of Object.entries(topics).sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${t}`)

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
  console.log(`  backup -> ${f} (${data.length} rows)`)
}
console.log('\nwriting backups...')
bk(`${T}-full`, await readAll(T, '*'))
bk('mock_test_questions-gk-telugu', mySlots)
bk('mock_question_usage-gk-telugu', await readAll('mock_question_usage', '*', `&question_table=eq.${T}`))

// ------------------------------------------------------- swap the bank
console.log('\nreplacing question rows...')
if (oldRows.length) await send('DELETE', `${T}?id=not.is.null`)
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
// mock_test_questions is the source of truth for membership.
console.log('\nrebuilding mock_question_usage for this table...')
await send('DELETE', `mock_question_usage?question_table=eq.${T}`)
const tests = await readAll('mock_tests', 'id,medium,module_number,version')
const testById = new Map(tests.map((t) => [t.id, t]))
const freshSlots = await readAll('mock_test_questions',
  'mock_test_id,question_id,question_table,section_id,question_uid', `&question_table=eq.${T}`)
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

// ------------------------------------------------------- refresh cached papers
console.log('\nbumping module versions so cached papers rebuild...')
let bumped = 0
for (const id of affectedTests) {
  const t = testById.get(id)
  if (!t) continue
  await send('PATCH', `mock_tests?id=eq.${id}`, { version: (t.version ?? 1) + 1, updated_at: new Date().toISOString() })
  bumped++
}
console.log(`  ${bumped} modules bumped`)

// ------------------------------------------------------- verify
const rows = await readAll(T, 'question_id')
const present = new Set(rows.map((r) => r.question_id))
const dangling = freshSlots.filter((s) => !present.has(s.question_id)).length
const dupModules = new Set()
const perTest = new Map()
for (const s of freshSlots) {
  const set = perTest.get(s.mock_test_id) ?? new Set()
  if (set.has(s.question_id)) dupModules.add(s.mock_test_id)
  set.add(s.question_id)
  perTest.set(s.mock_test_id, set)
}
console.log(`\nverify: ${rows.length} rows, ${dangling} dangling slots, ${dupModules.size} modules with a repeated GK question`)
console.log(dangling || dupModules.size ? 'CHECK FAILED — see above' : 'done.')
