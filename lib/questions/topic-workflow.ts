import { isTopicCompleted, topicCompletionKey, type TopicCompletion } from './topic-completion'
import { BULK_MAX_ROWS, type BulkExportResponse, type BulkPreviewResponse, type BulkTopicOption } from '@/types/bulk-update'

/** Partial database writes must never complete a topic or discard its preview. */
export function canAdvanceTopic(result: BulkPreviewResponse): boolean {
  return result.applied && result.summary.changed > 0 &&
    result.summary.written === result.summary.changed &&
    result.rows.every((row) => row.status === 'changed' || row.status === 'unchanged')
}

/** Look at current IDs, so moved/deleted rows cannot make offsets skip questions. */
export async function findUnreviewedTopicBatch(
  reviewed: ReadonlySet<string>,
  readBatch: (from: number, to: number) => Promise<BulkExportResponse>
): Promise<{ batch: BulkExportResponse | null; total: number }> {
  let from = 1
  let total = 0
  while (true) {
    const data = await readBatch(from, from + BULK_MAX_ROWS - 1)
    total = data.total
    const remaining = data.rows.filter((row) => !reviewed.has(row.question_id))
    if (remaining.length > 0) return { batch: { ...data, to: Math.min(data.to, total), rows: remaining }, total }
    if (data.rows.length === 0 || from + data.rows.length > total) return { batch: null, total }
    from += data.rows.length
  }
}

/** Next unfinished topic in the displayed order, wrapping to earlier ones. */
export function nextUnfinishedTopic(
  topics: readonly BulkTopicOption[], current: string | null,
  completion: TopicCompletion, adminId: string, table: string
): BulkTopicOption | null {
  let index = topics.findIndex((entry) => entry.topic === current)
  // A reclassification may have removed the current topic altogether.
  if (index < 0) index = topics.findIndex((entry) => (entry.topic ?? '').localeCompare(current ?? '') > 0) - 1
  if (index < -1) index = topics.length - 1
  for (let offset = 1; offset <= topics.length; offset++) {
    const entry = topics[(index + offset) % topics.length]!
    if (entry.topic !== current && entry.count > 0 &&
      !isTopicCompleted(completion, topicCompletionKey(adminId, table, entry.topic), entry.count)) return entry
  }
  return null
}
