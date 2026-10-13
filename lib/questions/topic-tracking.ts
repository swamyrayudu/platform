import { supabaseAdmin } from '@/lib/supabase-admin'
import type { BulkTopicOption } from '@/types/bulk-update'

type QuestionTopic = { question_id: string; topic: string | null }
type Review = { question_id: string; topic_key: string }
type TopicUpdate = {
  topic: string | null; update_count: number; last_updated_at: string
  editor: { name: string | null; email: string } | null
}

async function loadRows<T>(table: string, columns: string, questionTable: string, order: string): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).eq('question_table', questionTable)
      .order(order).range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data as unknown as T[])
    offset += data.length
  }
  return rows
}

export async function sharedTopicOptions(table: string, questions: QuestionTopic[]): Promise<BulkTopicOption[]> {
  const [updates, reviews] = await Promise.all([
    loadRows<TopicUpdate>('admin_question_topic_updates', 'topic, update_count, last_updated_at, editor:users(name, email)', table, 'topic_key'),
    loadRows<Review>('admin_question_reviews', 'question_id, topic_key', table, 'question_id'),
  ])
  const byTopic = new Map(updates.map((row) => [JSON.stringify(row.topic), row]))
  const byId = new Map(reviews.map((row) => [row.question_id, row.topic_key]))
  const options = new Map<string, BulkTopicOption>()
  for (const row of questions) {
    const key = JSON.stringify(row.topic)
    let option = options.get(key)
    if (!option) {
      const update = byTopic.get(key)
      option = { topic: row.topic, count: 0, reviewedCount: 0, updateCount: Number(update?.update_count ?? 0),
        lastUpdatedAt: update?.last_updated_at ?? null,
        lastUpdatedBy: update?.editor?.name || update?.editor?.email || null }
      options.set(key, option)
    }
    option.count++
    if (byId.get(row.question_id) === key) option.reviewedCount!++
  }
  return [...options.values()]
}

export async function sharedReviewedIds(table: string, questions: QuestionTopic[]): Promise<string[]> {
  const current = new Map(questions.map((row) => [row.question_id, JSON.stringify(row.topic)]))
  const ids = [...current.keys()]
  const reviewed: string[] = []
  for (let i = 0; i < ids.length; i += 200) {
    let offset = 0
    while (true) {
      const { data, error } = await supabaseAdmin.from('admin_question_reviews').select('question_id, topic_key')
        .eq('question_table', table).in('question_id', ids.slice(i, i + 200))
        .order('question_id').range(offset, offset + 199)
      if (error) throw error
      if (!data?.length) break
      for (const row of data as Review[]) if (current.get(row.question_id) === row.topic_key) reviewed.push(row.question_id)
      offset += data.length
    }
  }
  return reviewed
}
