import { TOPIC_BATCH_MAX_QUESTIONS, TOPIC_BATCH_MAX_TOPICS, type BulkTopicOption } from '@/types/bulk-update'
import { sortTopicsByCount } from './topic-order'
import { isTopicReviewed } from './topic-workflow'

export function validateTopicBatch(input: unknown): input is (string | null)[] {
  return Array.isArray(input) && input.length >= 2 && input.length <= TOPIC_BATCH_MAX_TOPICS &&
    input.every((topic) => topic === null || (typeof topic === 'string' && topic.length <= 1000)) &&
    new Set(input.map((topic) => JSON.stringify(topic))).size === input.length
}

/** Add the next pending topic that fits, following the dropdown order and wrapping. */
export function addNextBatchTopic(topics: readonly BulkTopicOption[], chosen: readonly (string | null)[]): (string | null)[] {
  const ordered = sortTopicsByCount(topics)
  const selected = new Set(chosen.map((topic) => JSON.stringify(topic)))
  const total = chosen.reduce<number>((sum, topic) => sum + (ordered.find((entry) => entry.topic === topic)?.count ?? 0), 0)
  if (chosen.length >= TOPIC_BATCH_MAX_TOPICS || total >= TOPIC_BATCH_MAX_QUESTIONS) return [...chosen]
  const index = ordered.findIndex((entry) => entry.topic === chosen[chosen.length - 1])
  for (let offset = 1; offset <= ordered.length; offset++) {
    const entry = ordered[(index + offset) % ordered.length]!
    if (!selected.has(JSON.stringify(entry.topic)) && entry.count > 0 && !isTopicReviewed(entry) &&
      total + entry.count <= TOPIC_BATCH_MAX_QUESTIONS) return [...chosen, entry.topic]
  }
  return [...chosen]
}

export function fillTopicBatch(topics: readonly BulkTopicOption[], chosen: readonly (string | null)[]): (string | null)[] {
  let result = [...chosen]
  while (result.length < TOPIC_BATCH_MAX_TOPICS) {
    const next = addNextBatchTopic(topics, result)
    if (next.length === result.length) break
    result = next
  }
  return result
}
