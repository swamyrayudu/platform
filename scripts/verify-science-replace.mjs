// READ-ONLY post-write verification of telugu_medium_science.
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

console.log('=== table state ===')
const [a] = await q(`select count(*)::int total, count(distinct question_id)::int qids,
                            count(*) filter (where is_active)::int active from ${T}`)
console.log(`  rows ${a.total} | distinct question_id ${a.qids} | active ${a.active}`)

console.log('\n=== value conventions the app depends on ===')
for (const r of await q(`select subject, language, count(*)::int n from ${T} group by 1,2`)) {
  console.log(`  subject='${r.subject}' language='${r.language}' -> ${r.n}`)
}

console.log('\n=== integrity ===')
const [b] = await q(
  `select count(*) filter (where correct_answer not in ('A','B','C','D'))::int bad_ans,
          count(*) filter (where option_a='' or option_b='' or option_c='' or option_d='')::int blank,
          count(*) filter (where option_a in (option_b,option_c,option_d)
                              or option_b in (option_c,option_d)
                              or option_c = option_d)::int dupe,
          count(*) filter (where question like '%'||chr(65533)||'%')::int corrupt
     from ${T}`)
console.log(`  bad answer letter ${b.bad_ans} | blank option ${b.blank} | duplicate options ${b.dupe} | corrupted ${b.corrupt}`)

console.log('\n=== no orphaned references remain ===')
for (const child of ['mock_test_questions', 'mock_question_usage']) {
  const [r] = await q(
    `select count(*)::int n from "${child}" x
      where x.question_id like 'APSGT-SCI-TM-%'
        and not exists (select 1 from ${T} t where t.question_id = x.question_id)`)
  console.log(`  ${child}: ${r.n} orphans`)
}

console.log('\n=== mock tests ===')
for (const r of await q(`select status, count(*)::int n from mock_tests group by 1 order by n desc`)) {
  console.log(`  ${r.status}: ${r.n}`)
}

console.log('\n=== new content landed ===')
for (const r of await q(
  `select chapter, count(*)::int n from ${T}
    where chapter in ('విజ్ఞాన శాస్త్ర బోధనా పద్ధతులు','విజ్ఞాన శాస్త్ర చరిత్ర',
                      'ప్రథమ చికిత్స','జలచక్రం','దహనం','వాయువు')
    group by 1 order by n desc`)) {
  console.log(`  ${r.chapter}: ${r.n}`)
}

console.log('\n=== what the practice query would return ===')
const [p] = await q(`select count(*)::int n from ${T} where subject = 'సైన్స్'`)
console.log(`  rows matching subject='సైన్స్': ${p.n}`)
for (const r of await q(
  `select class_level, count(*)::int n from ${T} group by 1 order by n desc`)) {
  console.log(`    class_level '${r.class_level}' -> ${r.n}`)
}

await c.end()
