// READ-ONLY. Post-replace integrity check for socal_telugu_medimum.
import fs from 'node:fs'; import path from 'node:path'
for(const f of ['.env.local','.env']){const p=path.resolve(process.cwd(),f);if(!fs.existsSync(p))continue
for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim()}}
const U=process.env.NEXT_PUBLIC_SUPABASE_URL,KEY=process.env.SUPABASE_SERVICE_ROLE_KEY
const H={apikey:KEY,Authorization:`Bearer ${KEY}`}
const T='socal_telugu_medimum'
async function readAll(t,s='*'){const o=[];for(let f=0;;f+=1000){
  const r=await fetch(`${U}/rest/v1/${t}?select=${s}`,{headers:{...H,Range:`${f}-${f+999}`}})
  const b=await r.json();if(!Array.isArray(b))throw new Error(JSON.stringify(b));o.push(...b);if(b.length<1000)return o}}
const rows=await readAll(T,'question_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,chapter,subject,language,source_type')
console.log('rows:',rows.length,'| distinct question_id:',new Set(rows.map(r=>r.question_id)).size)
const L={A:'option_a',B:'option_b',C:'option_c',D:'option_d'}
let bad=0,blank=0,dup=0
for(const r of rows){ if(!L[r.correct_answer])bad++
  const o=[r.option_a,r.option_b,r.option_c,r.option_d]
  if(!r.question?.trim()||!r.explanation?.trim()||o.some(x=>!x?.trim()))blank++
  if(new Set(o).size!==4)dup++}
console.log('defects -> bad answer:',bad,'| blank field:',blank,'| duplicate options:',dup)
const stem=new Map();let dstem=0
for(const r of rows){const k=r.question.toLowerCase().replace(/\s+/g,' ').trim();if(stem.has(k))dstem++;else stem.set(k,1)}
console.log('duplicate question stems:',dstem)
const t=(k)=>{const m={};for(const r of rows)m[r[k]]=(m[r[k]]||0)+1;return m}
console.log('difficulty:',JSON.stringify(t('difficulty')))
console.log('answer keys:',JSON.stringify(t('correct_answer')))
console.log('chapters:',Object.keys(t('chapter')).length,'| language:',JSON.stringify(t('language')))
console.log('\n--- mock test integrity ---')
const ids=new Set(rows.map(r=>r.question_id))
const slots=(await readAll('mock_test_questions','mock_test_id,question_id,question_table,question_number,section_id'))
const mine=slots.filter(s=>s.question_table===T)
const dangling=mine.filter(s=>!ids.has(s.question_id))
console.log('slots using this table:',mine.length,'| DANGLING (question missing):',dangling.length)
const tests=await readAll('mock_tests','id,title,status,medium,total_questions')
const byTest={};for(const s of slots)byTest[s.mock_test_id]=(byTest[s.mock_test_id]||0)+1
const affected=new Set(mine.map(s=>s.mock_test_id))
let short=0,okTests=0
const statuses={}
for(const id of affected){const tt=tests.find(x=>x.id===id);const n=byTest[id]||0
  statuses[tt?.status]=(statuses[tt?.status]||0)+1
  if(n!==(tt?.total_questions??160))short++;else okTests++}
console.log('affected tests:',affected.size,'| with full slot count:',okTests,'| short:',short)
console.log('affected test statuses:',JSON.stringify(statuses))
// in-test duplicate check
let dupInTest=0
const per={};for(const s of slots){(per[s.mock_test_id]??=[]).push(s.question_table+':'+s.question_id)}
for(const[k,v]of Object.entries(per))if(new Set(v).size!==v.length)dupInTest++
console.log('tests containing a duplicate question:',dupInTest)
const usage=(await readAll('mock_question_usage','question_id,question_table,usage_count,medium')).filter(u=>u.question_table===T)
console.log('usage rows for this table:',usage.length,'| stale (question missing):',usage.filter(u=>!ids.has(u.question_id)).length)
console.log('max usage_count:',Math.max(0,...usage.map(u=>u.usage_count)))
