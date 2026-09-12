// ============================================================
// scripts/inspect-telugu-table.mjs
// ============================================================
// READ-ONLY. Reports what is actually in telugu_subject_questions and what
// else in the database points at it, so a bulk replace can be judged safely.
//
//   node scripts/inspect-telugu-table.mjs
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

const TABLE = 'telugu_subject_questions'

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

const q = async (sql, params = []) => (await client.query(sql, params)).rows

await client.connect()
console.log('connected\n')

console.log('=== columns ===')
const cols = await q(
  `select column_name, data_type, is_nullable
     from information_schema.columns
    where table_name = $1
    order by ordinal_position`,
  [TABLE],
)
for (const c of cols) {
  console.log(`  ${c.column_name.padEnd(22)} ${c.data_type.padEnd(28)} ${c.is_nullable === 'YES' ? 'null' : 'NOT NULL'}`)
}

console.log('\n=== row counts ===')
const [{ total }] = await q(`select count(*)::int as total from ${TABLE}`)
console.log(`  total rows: ${total}`)
const byMedium = await q(
  `select language, subject, is_active, count(*)::int as n
     from ${TABLE} group by 1,2,3 order by n desc`,
)
for (const r of byMedium) {
  console.log(`    language=${r.language} subject=${r.subject} active=${r.is_active} -> ${r.n}`)
}

console.log('\n=== anything referencing this table (FKs) ===')
const fks = await q(
  `select tc.table_name   as child_table,
          kcu.column_name as child_column,
          ccu.column_name as parent_column
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name
     join information_schema.constraint_column_usage ccu
       on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = $1`,
  [TABLE],
)
if (!fks.length) console.log('  (no declared foreign keys)')
for (const f of fks) console.log(`  ${f.child_table}.${f.child_column} -> ${TABLE}.${f.parent_column}`)

console.log('\n=== tables holding question ids without a declared FK ===')
const suspects = await q(
  `select table_name, column_name
     from information_schema.columns
    where column_name in ('question_id','question_ids','questions')
      and table_schema = 'public'
    order by table_name`,
)
for (const s of suspects) console.log(`  ${s.table_name}.${s.column_name}`)

// do student answers actually point at these rows?
for (const s of suspects) {
  if (s.column_name !== 'question_id') continue
  try {
    const [{ n }] = await q(
      `select count(*)::int as n from "${s.table_name}" c
        where exists (select 1 from ${TABLE} t where t.id::text = c.question_id::text)`,
    )
    const [{ tot }] = await q(`select count(*)::int as tot from "${s.table_name}"`)
    console.log(`    ${s.table_name}: ${n} of ${tot} rows reference a ${TABLE} id`)
  } catch (e) {
    console.log(`    ${s.table_name}: could not check (${e.message.split('\n')[0]})`)
  }
}

console.log('\n=== do the CSV ids match the DB ids? ===')
const sample = await q(`select id, question_id from ${TABLE} limit 3`)
console.log('  sample db ids:', sample.map((r) => r.id).join(', '))

await client.end()
