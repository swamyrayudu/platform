import type { BulkTopicOption } from '@/types/bulk-update'

/** Largest topics first, with a stable name order when counts are equal. */
export function sortTopicsByCount(topics: readonly BulkTopicOption[]): BulkTopicOption[] {
  return [...topics].sort((a, b) => b.count - a.count ||
    (a.topic ?? '').localeCompare(b.topic ?? '') ||
    (a.topic === b.topic ? 0 : a.topic === null ? -1 : b.topic === null ? 1 : 0))
}
