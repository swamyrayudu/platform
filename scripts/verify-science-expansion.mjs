// READ-ONLY. Post-insert integrity check on english_medium_science.
import fs from 'node:fs'; import path from 'node:path'; import { Client } from 'pg'
for(const f of ['.env.local','.env']){const p=path.resolve(process.cwd(),f);if(!fs.existsSync(p))continue
for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim()}}
const T='english_medium_science'
const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}})
const q=async(s,p=[])=>(await c.query(s,p)).rows
await c.connect()
const [a]=await q(`select count(*)::int total, count(distinct question_id)::int ids,
  count(*) filter (where is_active)::int active,
  count(*) filter (where tags like '%expansion_v8%')::int new_batch from ${T}`)
console.log('rows',a.total,'| distinct ids',a.ids,'| active',a.active,'| new batch',a.new_batch)
const [d]=await q(`select
  count(*) filter (where question is null or btrim(question)='')::int blank_q,
  count(*) filter (where explanation is null or btrim(explanation)='')::int blank_exp,
  count(*) filter (where correct_answer not in ('A','B','C','D'))::int bad_ans,
  count(*) filter (where option_a=option_b or option_a=option_c or option_a=option_d
                      or option_b=option_c or option_b=option_d or option_c=option_d)::int dup_opts
  from ${T}`)
console.log('defects:',JSON.stringify(d))
const [dup]=await q(`select count(*)::int n from (
  select lower(regexp_replace(question,'[^a-zA-Z0-9]+',' ','g')) k
  from ${T} group by 1 having count(*)>1) x`)
console.log('duplicate normalised stems:',dup.n)
console.log('answer key balance:',JSON.stringify(
  (await q(`select correct_answer a,count(*)::int n from ${T} group by 1 order by 1`))))
console.log('difficulty:',JSON.stringify(
  (await q(`select difficulty d,count(*)::int n from ${T} group by 1 order by n desc`))))
console.log('subjects:',JSON.stringify(
  (await q(`select subject s,count(*)::int n from ${T} group by 1 order by n desc`))))
const [cv]=await q(`select count(distinct chapter)::int ch,count(distinct topic)::int tp,
  count(distinct subtopic)::int st from ${T}`)
console.log('coverage: chapters',cv.ch,'topics',cv.tp,'subtopics',cv.st)
console.log('\nchapters that gained the most:')
for(const r of await q(`select chapter,count(*) filter (where tags like '%expansion_v8%')::int added,
  count(*)::int total from ${T} group by 1 order by added desc limit 12`))
  console.log(`  +${String(r.added).padStart(3)} -> ${String(r.total).padStart(4)} total  ${r.chapter}`)
await c.end()
