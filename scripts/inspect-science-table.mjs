// READ-ONLY. What is in telugu_medium_science, and what points at it?
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

const T = 'telugu_medium_science'
const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s, p = []) => (await c.query(s, p)).rows
await c.connect()

console.log('=== columns ===')
for (const r of await q(
  `select column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_name = $1 order by ordinal_position`, [T])) {
  console.log(`  ${r.column_name.padEnd(22)} ${r.data_type.padEnd(26)} ${r.is_nullable === 'YES' ? 'null' : 'NOT NULL'}  ${r.column_default || ''}`)
}

console.log('\n=== constraints ===')
for (const r of await q(
  `select tc.constraint_type, kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.table_name = $1`, [T])) {
  console.log(`  ${r.constraint_type} on ${r.column_name}`)
}

console.log('\n=== row counts ===')
const [a] = await q(`select count(*)::int total, count(distinct id)::int ids,
                            count(distinct question_id)::int qids from ${T}`)
console.log(`  rows ${a.total} | distinct id ${a.ids} | distinct question_id ${a.qids}`)
for (const r of await q(
  `select subject, language, is_active, count(*)::int n from ${T} group by 1,2,3 order by n desc limit 10`)) {
  console.log(`    subject=${r.subject} language=${r.language} active=${r.is_active} -> ${r.n}`)
}

console.log('\n=== WHAT REFERENCES THIS TABLE ===')
const CHILDREN = ['mock_test_questions', 'mock_question_usage', 'mock_test_answers',
                  'question_attempts', 'question_progress', 'question_usage']
let totalRefs = 0
for (const child of CHILDREN) {
  for (const col of ['id', 'question_id']) {
    try {
      const [r] = await q(
        `select count(*)::int n from "${child}" x
          where exists (select 1 from ${T} t where t.${col}::text = x.question_id::text)`)
      if (r.n > 0) { console.log(`  ${child}.question_id -> ${T}.${col}: ${r.n} rows`); totalRefs += r.n }
    } catch (e) { console.log(`  ${child}/${col}: ${e.message.split('\n')[0]}`) }
  }
}
console.log(`  TOTAL referencing rows: ${totalRefs}`)

console.log('\n=== practice_sessions referencing it ===')
try {
  const [r] = await q(
    `select count(*) filter (where exists (
              select 1 from ${T} t where t.id::text = any(
                select jsonb_array_elements_text(to_jsonb(s.question_ids)))))::int n,
            count(*)::int tot from practice_sessions s`)
  console.log(`  ${r.n} of ${r.tot} practice sessions`)
} catch (e) { console.log('  could not check:', e.message.split('\n')[0]) }

console.log('\n=== sample rows ===')
for (const r of await q(`select id, question_id, subject, chapter, is_active from ${T} limit 3`)) {
  console.log(`  ${r.id} | ${r.question_id} | ${r.subject} | ${r.chapter} | active=${r.is_active}`)
}

await c.end()
