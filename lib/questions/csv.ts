// ============================================================
// lib/questions/csv.ts — RFC 4180 CSV, both directions
// ============================================================
// The bulk question editor round-trips through a chat tool: an admin copies
// 100 rows out as CSV, an assistant rewrites the wording, and the result is
// pasted back. Every one of those rows is exam content, so the parser has to
// survive what real question text contains:
//
//   - commas inside a stem ("If a, b and c are consecutive...")
//   - double quotes inside a stem, escaped RFC-style as ""
//   - newlines inside a quoted field, which a chat tool will happily produce
//   - Telugu, which is multi-byte and must never be sliced by byte offset
//   - a UTF-8 BOM, which Excel adds and which would otherwise become part of
//     the first header name
//
// `text.split(',')` gets all five of those wrong, which is why this exists
// rather than a one-liner at the call site.
// ============================================================

/** A parsed row, keyed by the header name it appeared under. */
export type CsvRow = Record<string, string>

export interface CsvParseResult {
  headers: string[]
  rows: CsvRow[]
  /** 1-based line number each row started on, for error messages. */
  rowLines: number[]
}

/**
 * Split CSV text into fields, honouring quotes, escaped quotes and embedded
 * newlines. Returns raw records; header interpretation is the caller's job.
 */
function splitRecords(input: string): { fields: string[]; line: number }[] {
  const records: { fields: string[]; line: number }[] = []

  let field = ''
  let fields: string[] = []
  let inQuotes = false
  let line = 1
  let recordLine = 1
  let started = false

  const endField = () => {
    fields.push(field)
    field = ''
  }
  const endRecord = () => {
    endField()
    // A trailing newline at the end of the file produces one empty record,
    // which is not a row of data.
    const empty = fields.length === 1 && fields[0]!.trim() === ''
    if (!empty) records.push({ fields, line: recordLine })
    fields = []
    started = false
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!

    if (!started) {
      recordLine = line
      started = true
    }

    if (inQuotes) {
      if (ch === '"') {
        // "" inside a quoted field is a literal quote, not the end of it.
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      endField()
      continue
    }
    if (ch === '\r') {
      // Swallow CR so CRLF and LF behave identically.
      continue
    }
    if (ch === '\n') {
      line++
      endRecord()
      continue
    }
    field += ch
  }

  if (started || field !== '' || fields.length > 0) endRecord()

  return records
}

/** Strip the BOM Excel writes, so the first header is not "﻿question_id". */
function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}

export function parseCsv(input: string): CsvParseResult {
  const records = splitRecords(stripBom(input).trim())
  if (records.length === 0) return { headers: [], rows: [], rowLines: [] }

  const headers = records[0]!.fields.map((h) => h.trim().toLowerCase())
  const rows: CsvRow[] = []
  const rowLines: number[] = []

  for (let i = 1; i < records.length; i++) {
    const { fields, line } = records[i]!
    // A row that is entirely empty is padding, not data.
    if (fields.every((f) => f.trim() === '')) continue

    const row: CsvRow = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = (fields[c] ?? '').trim()
    }
    rows.push(row)
    rowLines.push(line)
  }

  return { headers, rows, rowLines }
}

/** Quote a single field only when it needs it. */
function encodeField(value: string | null | undefined): string {
  const text = value ?? ''
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/** Serialise rows under a fixed column order, header row included. */
export function toCsv(columns: readonly string[], rows: readonly CsvRow[]): string {
  const lines = [columns.map(encodeField).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => encodeField(row[c])).join(','))
  }
  return lines.join('\r\n')
}
