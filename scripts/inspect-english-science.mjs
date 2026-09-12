// READ-ONLY. What is in english_medium_science, and does it mirror the Telugu one?
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

const E = 'english_medium_science'
const T = 'telugu_medium_science'
const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s, p = []) => (await c.query(s, p)).rows
await c.connect()

console.log('=== columns ===')
for (const r of await q(
  `select column_name, data_type from information_schema.columns
    where table_name = $1 order by ordinal_position`, [E])) {
  console.log(`  ${r.column_name.padEnd(20)} ${r.data_type}`)
}

console.log('\n=== size & conventions ===')
const [a] = await q(`select count(*)::int total, count(distinct question_id)::int qids,
                            count(*) filter (where is_active)::int active from ${E}`)
console.log(`  rows ${a.total} | distinct question_id ${a.qids} | active ${a.active}`)
for (const col of ['subject', 'language', 'source_type', 'class_level', 'difficulty']) {
  const rows = await q(`select ${col} v, count(*)::int n from ${E} group by 1 order by n desc limit 8`)
  console.log(`  ${col}: ` + rows.map((r) => `${r.v}(${r.n})`).join(', '))
}

console.log('\n=== question_id shape ===')
for (const r of await q(`select question_id from ${E} limit 5`)) console.log('  ', r.question_id)

console.log('\n=== does it mirror the Telugu bank? ===')
const [m] = await q(
  `select count(*)::int n from ${E} e
    where exists (select 1 from ${T} t
                   where replace(t.question_id,'-TM-','-EM-') = e.question_id)`)
console.log(`  english rows whose id matches a telugu id (TM->EM): ${m.n}`)
const [ch] = await q(
  `select count(distinct chapter)::int n from ${E}`)
const [cht] = await q(`select count(distinct chapter)::int n from ${T}`)
console.log(`  distinct chapters: english ${ch.n} | telugu ${cht.n}`)

console.log('\n=== english chapters (top 15) ===')
for (const r of await q(
  `select chapter v, count(*)::int n from ${E} group by 1 order by n desc limit 15`)) {
  console.log(`  ${r.n.toString().padStart(4)}  ${r.v}`)
}

console.log('\n=== sample english rows ===')
for (const r of await q(`select question, option_a, option_b, option_c, option_d,
                                correct_answer, explanation from ${E} limit 3`)) {
  console.log(`\n  Q: ${r.question}`)
  console.log(`    A. ${r.option_a}`)
  console.log(`    B. ${r.option_b}`)
  console.log(`    C. ${r.option_c}`)
  console.log(`    D. ${r.option_d}`)
  console.log(`    ans=${r.correct_answer}  exp: ${(r.explanation || '').slice(0, 90)}`)
}

console.log('\n=== same defects as the telugu bank had? ===')
const [d] = await q(
  `select count(*) filter (where question ~ '^(Considering|Analyzing|Observing|Based on|Looking at|Examining)')::int preamble,
          count(*) filter (where position(
              case correct_answer when 'A' then option_a when 'B' then option_b
                                  when 'C' then option_c else option_d end in question) > 0)::int selfans,
          count(*)::int total
     from ${E}`)
console.log(`  stems opening with a boilerplate preamble : ${d.preamble}`)
console.log(`  stems containing their own answer         : ${d.selfans}`)
const [dup] = await q(
  `select count(*)::int n from (select question, correct_answer from ${E}
     group by 1,2 having count(*) > 1) x`)
console.log(`  duplicated (question, answer) pairs       : ${dup.n}`)

console.log('\n=== who references english_medium_science ===')
for (const child of ['mock_test_questions', 'mock_question_usage']) {
  const [r] = await q(
    `select count(*)::int n from "${child}" x
      where exists (select 1 from ${E} t where t.question_id = x.question_id)`)
  console.log(`  ${child}: ${r.n}`)
}

await c.end()
