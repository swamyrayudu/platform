import { TOPIC_BATCH_MAX_QUESTIONS, type BulkTopicOption } from '@/types/bulk-update'
import { sortTopicsByCount } from './topic-order'
import { isTopicReviewed } from './topic-workflow'

export function validateTopicBatch(input: unknown): input is (string | null)[] {
  // Each exported topic contains at least one question, so more than 100
  // distinct topics cannot fit the question budget. There is no separate cap.
  return Array.isArray(input) && input.length >= 2 && input.length <= TOPIC_BATCH_MAX_QUESTIONS &&
    input.every((topic) => topic === null || (typeof topic === 'string' && topic.length <= 1000)) &&
    new Set(input.map((topic) => JSON.stringify(topic))).size === input.length
}

/** The first pending topic in dropdown order, skipping topics already reviewed. */
export function nextPendingBatchTopic(topics: readonly BulkTopicOption[], chosen: readonly (string | null)[]): BulkTopicOption | null {
  const ordered = sortTopicsByCount(topics)
  const selected = new Set(chosen.map((topic) => JSON.stringify(topic)))
  const index = ordered.findIndex((entry) => entry.topic === chosen[chosen.length - 1])
  for (let offset = 1; offset <= ordered.length; offset++) {
    const entry = ordered[(index + offset) % ordered.length]!
    if (!selected.has(JSON.stringify(entry.topic)) && entry.count > 0 && !isTopicReviewed(entry)) return entry
  }
  return null
}

/** Stop before the next topic exceeds the budget; never skip ahead to fill gaps. */
export function addNextBatchTopic(topics: readonly BulkTopicOption[], chosen: readonly (string | null)[]): (string | null)[] {
  const total = chosen.reduce<number>((sum, topic) => sum + (topics.find((entry) => entry.topic === topic)?.count ?? 0), 0)
  const next = nextPendingBatchTopic(topics, chosen)
  if (next && total + next.count <= TOPIC_BATCH_MAX_QUESTIONS) return [...chosen, next.topic]
  return [...chosen]
}

export function fillTopicBatch(topics: readonly BulkTopicOption[], chosen: readonly (string | null)[]): (string | null)[] {
  let result = [...chosen]
  while (true) {
    const next = addNextBatchTopic(topics, result)
    if (next.length === result.length) break
    result = next
  }
  return result
}
