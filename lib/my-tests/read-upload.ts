// ============================================================
// lib/my-tests/read-upload.ts — Read uploaded question files (browser only)
// ============================================================
// Accepts .xlsx (what chat tools offer as a download) and .csv. Several files
// can be combined, because a 160-question test is often produced in parts.
// ============================================================

import { readSheet } from 'read-excel-file/browser'
import { parseCsv, type CsvRow } from '@/lib/questions/csv'
import { readCsvFile } from '@/lib/questions/csv-upload'
import { rowsToQuestions, type ReadResult } from './format'

const MAX_FILE_BYTES = 5 * 1024 * 1024

async function readRows(file: File): Promise<{ rows: CsvRow[]; rowNumbers: number[] }> {
  if (/\.csv$/i.test(file.name)) {
    const { rows, rowLines } = parseCsv(await readCsvFile(file))
    return { rows, rowNumbers: rowLines }
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error(`${file.name}: choose an Excel (.xlsx) or CSV (.csv) file.`)
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: files must be 5 MB or smaller.`)
  let sheet: unknown[][]
  try {
    sheet = (await readSheet(file)) as unknown[][]
  } catch {
    throw new Error(`${file.name}: could not read this Excel file. Save it again as .xlsx or CSV.`)
  }
  const [header, ...body] = sheet
  if (!header) return { rows: [], rowNumbers: [] }
  const headers = header.map((h) => String(h ?? '').trim())
  const rows: CsvRow[] = []
  const rowNumbers: number[] = []
  body.forEach((cells, i) => {
    const values = headers.map((_, c) => (cells[c] == null ? '' : String(cells[c]).trim()))
    if (values.every((v) => v === '')) return
    rows.push(Object.fromEntries(headers.map((h, c) => [h, values[c]])))
    rowNumbers.push(i + 2)
  })
  return { rows, rowNumbers }
}

/** Read every chosen file, in order, into one list of questions plus row problems. */
export async function readQuestionFiles(files: readonly File[]): Promise<ReadResult> {
  const seen = new Set<string>()
  const result: ReadResult = { questions: [], problems: [] }
  for (const file of files) {
    const { rows, rowNumbers } = await readRows(file)
    if (rows.length === 0) {
      result.problems.push({ row: 1, file: file.name, message: 'No question rows found under the header.' })
      continue
    }
    const part = rowsToQuestions(rows, rowNumbers, file.name, seen)
    result.questions.push(...part.questions)
    result.problems.push(...part.problems)
  }
  return result
}
