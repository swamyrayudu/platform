// ============================================================
// lib/my-tests/read-file.ts — Read a question file on the server
// ============================================================
// The mobile app sends the Excel (.xlsx) or CSV file the user picked; this
// reads it with the same rules as the website's browser upload
// (lib/my-tests/read-upload.ts). Server only.
// ============================================================

import { readSheet } from 'read-excel-file/node'
import { readPastedCsv, rowsToQuestions, sheetToRows, type ReadResult } from './format'

/** Small enough to arrive as base64 inside a Vercel request (about 4.5 MB). */
export const MAX_APP_FILE_BYTES = 2 * 1024 * 1024

/** Read the file, or say why not. */
export async function readQuestionFile(name: string, bytes: Buffer): Promise<ReadResult | { error: string }> {
  if (bytes.length === 0) return { error: 'This file is empty.' }
  if (bytes.length > MAX_APP_FILE_BYTES) return { error: 'Choose a file of 2 MB or less.' }
  // Phone pickers do not always give a name with an extension, so look at the
  // content: an .xlsx file is a ZIP archive ("PK"); the old binary .xls is not readable.
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const isOldExcel = bytes[0] === 0xd0 && bytes[1] === 0xcf
  if (isOldExcel || /\.xls$/i.test(name)) return { error: 'This is an old Excel file (.xls). Save it as .xlsx or CSV and try again.' }
  if (!isZip) {
    if (bytes.includes(0)) return { error: 'Choose an Excel (.xlsx) or CSV (.csv) file.' }
    return readPastedCsv(bytes.toString('utf8'))
  }
  try {
    const { rows, rowNumbers } = sheetToRows((await readSheet(bytes)) as unknown[][])
    if (rows.length === 0) return { error: 'No question rows were found under the header row.' }
    return rowsToQuestions(rows, rowNumbers, name)
  } catch {
    return { error: 'Could not read this Excel file. Save it again as .xlsx or CSV.' }
  }
}
