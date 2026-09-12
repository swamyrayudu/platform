// READ-ONLY. Does anything reference telugu_subject_questions by EITHER key?
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

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (sql, p = []) => (await client.query(sql, p)).rows
await client.connect()

const TABLE = 'telugu_subject_questions'
const CHILDREN = [
  'mock_test_questions', 'mock_question_usage', 'mock_test_answers',
  'question_attempts', 'question_progress', 'question_usage',
]

for (const child of CHILDREN) {
  for (const parentCol of ['id', 'question_id']) {
    try {
      const [{ n }] = await q(
        `select count(*)::int as n
           from "${child}" c
          where exists (select 1 from ${TABLE} t
                         where t.${parentCol}::text = c.question_id::text)`,
      )
      if (n > 0) console.log(`  ${child}.question_id -> ${TABLE}.${parentCol}: ${n} rows`)
    } catch (e) {
      console.log(`  ${child} / ${parentCol}: ${e.message.split('\n')[0]}`)
    }
  }
}

console.log('\n=== practice_sessions.question_ids (array) ===')
try {
  const [{ n, tot }] = await q(
    `select count(*) filter (where exists (
              select 1 from ${TABLE} t
               where t.id::text = any(
                 select jsonb_array_elements_text(to_jsonb(s.question_ids)))))::int as n,
            count(*)::int as tot
       from practice_sessions s`,
  )
  console.log(`  ${n} of ${tot} practice sessions reference at least one row`)
} catch (e) {
  console.log('  could not check:', e.message.split('\n')[0])
}

console.log('\n=== is_active breakdown (what is actually live) ===')
for (const r of await q(
  `select is_active, count(*)::int as n from ${TABLE} group by 1 order by 1`,
)) console.log(`  is_active=${r.is_active}: ${r.n}`)

console.log('\n=== sample question_id values, for CSV matching ===')
for (const r of await q(`select id, question_id, is_active from ${TABLE} limit 4`)) {
  console.log(`  ${r.id}  |  ${r.question_id}  |  active=${r.is_active}`)
}

await client.end()
