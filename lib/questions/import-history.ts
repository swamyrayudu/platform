import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseCsv } from './csv'
import { IMPORT_COLUMNS, IMPORT_REQUIRED } from './bulk-insert'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function importFingerprint(table: string, csv: string, topic?: string | null) {
  return createHash('sha256').update(JSON.stringify([table, csv, topic === undefined ? { allTopics: true } : topic])).digest('hex')
}

export async function importReceipt(id: string, table: string, fingerprint: string) {
  const { data, error } = await supabaseAdmin.from('admin_question_import_batches')
    .select('question_table, fingerprint, status, result').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.question_table !== table || data.fingerprint !== fingerprint) throw new Error('This request belongs to another import. Preview again.')
  return data as { status: 'applied' | 'undone'; result: Record<string, unknown> }
}

/** Legacy imports have no ledger. Identify them by the original CSV, never by date or a guessed ID range. */
export function matchOriginalImport(csv: string, candidates: Record<string, unknown>[]) {
  const parsed = parseCsv(csv)
  if (!parsed.rows.length || parsed.rows.length > 500) throw new Error('Provide 1–500 rows from the original new-question CSV.')
  const missing = IMPORT_REQUIRED.filter((column) => !parsed.headers.includes(column))
  if (missing.length) throw new Error(`The original CSV needs these columns: ${missing.join(', ')}`)
  const matched: Record<string, unknown>[] = []
  const used = new Set<string>()
  for (const row of parsed.rows) {
    if (IMPORT_REQUIRED.some((column) => !row[column]?.trim())) throw new Error('Every original question needs its text, four options and correct answer.')
    const id = row.question_id?.trim()
    const matches = candidates.filter((candidate) => (!id || candidate.question_id === id) && IMPORT_COLUMNS.every((column) => {
      // The topic importer assigns the UI topic; the original file may name the intended one.
      if (column === 'topic' || !row[column]?.trim()) return true
      const expected = column === 'correct_answer' ? row[column]!.trim().toUpperCase() : row[column]!.trim()
      return String(candidate[column] ?? '') === expected
    }))
    if (matches.length !== 1) throw new Error(`Line ${parsed.rowLines[matched.length]}: ${matches.length ? 'multiple questions match; include question_id to identify the right one' : 'no unchanged question matches in the selected topic'}. Nothing was removed.`)
    const candidate = matches[0]!
    if (used.has(String(candidate.question_id))) throw new Error('The CSV repeats a question. Nothing was removed.')
    used.add(String(candidate.question_id))
    matched.push(candidate)
  }
  return matched.sort((a, b) => String(a.question_id).localeCompare(String(b.question_id)))
}

export function snapshotHash(rows: Record<string, unknown>[]) {
  const canonical = rows.map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
