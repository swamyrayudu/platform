// READ-ONLY. Coverage map of english_medium_science: chapter > topic > subtopic.
import fs from 'node:fs'; import path from 'node:path'; import { Client } from 'pg'
function loadEnv(){for(const f of ['.env.local','.env']){const p=path.resolve(process.cwd(),f);if(!fs.existsSync(p))continue
for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim()}}}
loadEnv()
const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}})
const q=async(s,p=[])=>(await c.query(s,p)).rows
await c.connect()
const [d]=await q(`select count(*)::int total,count(distinct chapter)::int ch,count(distinct topic)::int tp,count(distinct subtopic)::int st,
  count(*) filter (where topic is null or topic='')::int notopic,
  count(*) filter (where subtopic is null or subtopic='')::int nosub from english_medium_science`)
console.log('EM SCIENCE TOTALS:',JSON.stringify(d))
console.log('\n=== chapter (topic count, subtopic count, rows) ===')
for(const r of await q(`select chapter,count(*)::int n,count(distinct topic)::int tp,count(distinct subtopic)::int st
  from english_medium_science group by 1 order by n desc`))
  console.log(`  rows=${String(r.n).padStart(4)} topics=${String(r.tp).padStart(3)} subs=${String(r.st).padStart(3)}  ${r.chapter}`)
console.log('\n=== chapter > topic > subtopic detail ===')
let cur=''
for(const r of await q(`select chapter,topic,subtopic,count(*)::int n from english_medium_science
  group by 1,2,3 order by chapter,topic,subtopic`)){
  if(r.chapter!==cur){console.log('\n## '+r.chapter);cur=r.chapter}
  console.log(`   ${String(r.n).padStart(3)}  ${r.topic||'(null)'} / ${r.subtopic||'(null)'}`)}
console.log('\n=== TELUGU science chapters ===')
for(const r of await q(`select chapter,count(*)::int n from telugu_medium_science group by 1 order by n desc`))
  console.log(`  ${String(r.n).padStart(4)}  ${r.chapter}`)
const [t]=await q(`select count(*)::int n,count(distinct topic)::int tp,count(distinct subtopic)::int st from telugu_medium_science`)
console.log('TELUGU TOTALS:',JSON.stringify(t))
await c.end()
