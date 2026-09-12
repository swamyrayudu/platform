// READ-ONLY. If telugu_medium_science is replaced with the new CSV, how many
// existing references survive and how many are orphaned?
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

const T = 'telugu_medium_science'
const CSV = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads',
                      'dsc_practice_science_FINAL.csv')
const csv = parseCsv(fs.readFileSync(CSV, 'utf8'))
const keepQids = new Set(csv.map((r) => String(r['Question ID']).trim()))
console.log(`new CSV: ${csv.length} rows, ${keepQids.size} distinct question_id`)

const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s, p = []) => (await c.query(s, p)).rows
await c.connect()

const dbQids = (await q(`select question_id from ${T}`)).map((r) => r.question_id)
const dbSet = new Set(dbQids)
const surviving = dbQids.filter((x) => keepQids.has(x))
const removed = dbQids.filter((x) => !keepQids.has(x))
const brandNew = [...keepQids].filter((x) => !dbSet.has(x))

console.log('\n=== what the replace does ===')
console.log(`  db rows kept (same question_id) : ${surviving.length}`)
console.log(`  db rows removed                 : ${removed.length}`)
console.log(`  brand new rows to insert        : ${brandNew.length}`)
console.log(`  final table size                : ${surviving.length + brandNew.length}`)

console.log('\n=== reference impact ===')
for (const child of ['mock_test_questions', 'mock_question_usage']) {
  const [tot] = await q(
    `select count(*)::int n from "${child}" x
      where exists (select 1 from ${T} t where t.question_id = x.question_id)`)
  const [surv] = await q(
    `select count(*)::int n from "${child}" x where x.question_id = any($1::text[])`, [surviving])
  const orphan = tot.n - surv.n
  console.log(`  ${child}:`)
  console.log(`     references today : ${tot.n}`)
  console.log(`     survive replace  : ${surv.n}`)
  console.log(`     ORPHANED         : ${orphan}`)
}

console.log('\n=== how many mock tests are affected ===')
try {
  const [r] = await q(
    `select count(distinct mock_test_id)::int n from mock_test_questions x
      where exists (select 1 from ${T} t where t.question_id = x.question_id)
        and not (x.question_id = any($1::text[]))`, [surviving])
  const [tot] = await q(`select count(distinct mock_test_id)::int n from mock_test_questions`)
  console.log(`  ${r.n} of ${tot.n} mock tests would lose at least one question`)
} catch (e) { console.log('  could not check:', e.message.split('\n')[0]) }

console.log('\n=== is_active on the rows that survive ===')
const [act] = await q(
  `select count(*) filter (where is_active)::int a,
          count(*) filter (where not is_active)::int i
     from ${T} where question_id = any($1::text[])`, [surviving])
console.log(`  of the ${surviving.length} surviving: active=${act.a}, inactive=${act.i}`)

await c.end()
