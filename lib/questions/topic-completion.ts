/** Separate subjects, media, admins and null/empty topic names exactly. */
export function topicCompletionKey(adminId: string, table: string, topic: string | null): string {
  return JSON.stringify([adminId, table, topic])
}

export type TopicCompletion = Record<string, number>

export function parseTopicCompletion(raw: string): TopicCompletion {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, count]) =>
      typeof count === 'number' && Number.isSafeInteger(count) && count > 0))
  } catch {
    return {}
  }
}

/** A changed count means the topic needs reviewing again. */
export function isTopicCompleted(completion: TopicCompletion, key: string, count: number): boolean {
  return count > 0 && completion[key] === count
}
