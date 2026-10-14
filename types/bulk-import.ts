// ============================================================
// types/bulk-import.ts — Contract for the question importer
// ============================================================
// Shared by app/admin/import-questions and app/api/admin/questions/import.
// Separate from bulk-update's contract because adding a question and
// rewriting one fail in different ways: an import's interesting outcomes are
// about duplicates and generated ids, not diffs.
// ============================================================

import type { ImportRowResult } from '@/lib/questions/bulk-insert'

export type { ImportRowResult, ImportRowStatus } from '@/lib/questions/bulk-insert'

export interface ImportTableInfo {
  success: true
  table: string
  /** Rows already in the table. */
  total: number
  /** The id the next generated row would receive. */
  idPattern: string
  /** True when no convention was found and an IMP- family was invented. */
  idDerived: boolean
  /** Share of the table following the detected convention, 0-100. */
  idCoverage: number
  columns: string[]
}

export interface ImportSummary {
  parsed: number
  /** Valid, new, and would be written. */
  toInsert: number
  duplicateId: number
  duplicateText: number
  invalid: number
  /** Rows that arrived without a question_id and were numbered here. */
  generatedIds: number
  /** Present only on an applied run. */
  inserted?: number
}

export interface ImportPreviewResponse {
  success: true
  table: string
  applied: boolean
  importBatchId?: string
  idPattern: string
  idDerived: boolean
  summary: ImportSummary
  rows: ImportRowResult[]
  fileErrors: string[]
}

export interface QuestionImportBatch {
  id: string
  origin: 'import' | 'recovery'
  status: 'applied' | 'undone'
  row_count: number
  topics: (string | null)[]
  created_at: string
  changed_at: string
  actor: { name: string | null; email: string } | null
}

export interface ImportUndoPreview {
  success: true
  applied: boolean
  eligible: boolean
  reason: string | null
  status: 'applied' | 'undone'
  count: number
  rows: { question_id: string; question: string; topic: string | null }[]
  batchId: string
  action: 'undo' | 'restore'
  snapshotHash?: string
}
