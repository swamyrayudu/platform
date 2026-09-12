// READ-ONLY. What value conventions does telugu_medium_science actually use?
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

for (const col of ['subject', 'language', 'class_level', 'difficulty',
                   'question_type', 'source_type']) {
  console.log(`\n=== ${col} ===`)
  for (const r of await q(
    `select ${col} v, count(*)::int n from ${T} group by 1 order by n desc limit 12`)) {
    console.log(`  ${String(r.v)} -> ${r.n}`)
  }
}

console.log('\n=== tags sample ===')
for (const r of await q(`select distinct tags from ${T} limit 5`)) console.log(' ', r.tags)

console.log('\n=== chapter values (top 12) ===')
for (const r of await q(
  `select chapter v, count(*)::int n from ${T} group by 1 order by n desc limit 12`)) {
  console.log(`  ${r.v} -> ${r.n}`)
}

console.log('\n=== mock_tests: is there a status/flag column? ===')
for (const r of await q(
  `select column_name, data_type from information_schema.columns
    where table_name = 'mock_tests' order by ordinal_position`)) {
  console.log(`  ${r.column_name.padEnd(24)} ${r.data_type}`)
}

console.log('\n=== mock_tests status values ===')
try {
  for (const r of await q(
    `select status v, count(*)::int n from mock_tests group by 1 order by n desc limit 10`)) {
    console.log(`  ${r.v} -> ${r.n}`)
  }
} catch (e) { console.log('  no status column:', e.message.split('\n')[0]) }

console.log('\n=== mock_test_questions columns ===')
for (const r of await q(
  `select column_name, data_type from information_schema.columns
    where table_name = 'mock_test_questions' order by ordinal_position`)) {
  console.log(`  ${r.column_name.padEnd(24)} ${r.data_type}`)
}

await c.end()
