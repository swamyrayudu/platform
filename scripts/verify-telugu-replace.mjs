// READ-ONLY post-write verification of telugu_subject_questions.
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

const T = 'telugu_subject_questions'
const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const q = async (s) => (await c.query(s)).rows
await c.connect()

console.log('=== table intact ===')
const [a] = await q(`select count(*)::int total,
                            count(distinct id)::int ids,
                            count(*) filter (where is_active)::int active
                       from ${T}`)
console.log(`  rows ${a.total} | distinct ids ${a.ids} | active ${a.active}`)

console.log('\n=== references still resolve ===')
for (const child of ['mock_test_questions', 'mock_question_usage',
                     'question_attempts', 'question_progress']) {
  const [r] = await q(
    `select count(*)::int n from "${child}" x
      where exists (select 1 from ${T} t where t.question_id = x.question_id)`)
  console.log(`  ${child}: ${r.n} rows still resolve`)
}

console.log('\n=== defect counts, measured on the live table ===')
const [d] = await q(`
  select count(*) filter (where correct_answer not in ('A','B','C','D'))::int bad_ans,
         count(*) filter (where option_a='' or option_b='' or option_c='' or option_d='')::int blank,
         count(*) filter (where option_a in (option_b,option_c,option_d)
                             or option_b in (option_c,option_d)
                             or option_c = option_d)::int dupe_opts,
         count(*) filter (where question like '%'||chr(65533)||'%'
                             or option_a like '%'||chr(65533)||'%')::int corrupted,
         count(*) filter (where option_a like '%గణిత శాస్త్రవేత్త%'
                             or option_b like '%గణిత శాస్త్రవేత్త%'
                             or option_c like '%గణిత శాస్త్రవేత్త%'
                             or option_d like '%గణిత శాస్త్రవేత్త%')::int absurd
    from ${T}`)
console.log(`  invalid answer letter : ${d.bad_ans}`)
console.log(`  blank options         : ${d.blank}`)
console.log(`  duplicate options     : ${d.dupe_opts}`)
console.log(`  corrupted characters  : ${d.corrupted}`)
console.log(`  "mathematician" foils : ${d.absurd}`)

console.log('\n=== answer key spread ===')
for (const r of await q(
  `select correct_answer, count(*)::int n from ${T} group by 1 order by 1`)) {
  console.log(`  ${r.correct_answer}: ${r.n}`)
}

console.log('\n=== the question from your screenshot ===')
for (const r of await q(
  `select question, option_a, option_b, option_c, option_d, correct_answer
     from ${T}
    where topic = 'కవుల పరిచయం' and question like '%నన్నయ%' limit 1`)) {
  console.log(`  Q: ${r.question}`)
  console.log(`  A. ${r.option_a}\n  B. ${r.option_b}\n  C. ${r.option_c}\n  D. ${r.option_d}`)
  console.log(`  correct: ${r.correct_answer}`)
}

await c.end()
