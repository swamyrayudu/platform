// READ-ONLY. Dump english_medium_science to CSV for offline analysis.
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

const OUT = process.argv[2]
  || path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads',
               'english_medium_science_EXPORT.csv')

const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(`select * from english_medium_science order by question_id`)
await c.end()

const COLS = ['id', 'question_id', 'class_level', 'subject', 'chapter', 'topic', 'subtopic',
              'difficulty', 'question_type', 'question', 'option_a', 'option_b', 'option_c',
              'option_d', 'correct_answer', 'explanation', 'source_type', 'language', 'tags']
const HEADER = ['ID', 'Question ID', 'Class Level', 'Subject', 'Chapter', 'Topic', 'Subtopic',
                'Difficulty', 'Question Type', 'Question', 'Option A', 'Option B', 'Option C',
                'Option D', 'Correct Answer', 'Explanation', 'Source Type', 'Language', 'Tags']

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const lines = [HEADER.map(esc).join(',')]
for (const r of rows) lines.push(COLS.map((cName) => esc(r[cName])).join(','))
fs.writeFileSync(OUT, '﻿' + lines.join('\r\n'), 'utf8')
console.log(`exported ${rows.length} rows -> ${OUT}`)
