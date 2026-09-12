import fs from 'node:fs'; import path from 'node:path'; import { Client } from 'pg'
function loadEnv(){for(const f of ['.env.local','.env']){const p=path.resolve(process.cwd(),f);if(!fs.existsSync(p))continue
for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim()}}}
loadEnv()
const OUT=process.argv[2]
const c=new Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}})
await c.connect()
const {rows}=await c.query(`select question_id,class_level,subject,chapter,topic,subtopic,difficulty,question,option_a,option_b,option_c,option_d,correct_answer,explanation,tags from english_medium_science order by chapter,topic,subtopic`)
await c.end()
fs.writeFileSync(OUT,JSON.stringify(rows,null,1))
console.log('wrote',rows.length,'->',OUT)
