// Read-only Data API verification. Prints aggregate results, never user data.
// node --env-file=.env scripts/verify-topic-tracking.mjs
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createLoader } from './admin-users-test-loader.mjs'

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })
const load = createLoader(client)
const tracking = load('lib/questions/topic-tracking.ts')
let checkedTopics = 0
for (const table of ['english_medium_science', 'telugu_medium_science']) {
  const rows = []
  let offset = 0
  while (true) {
    const { data, error } = await client.from(table).select('question_id, topic').order('question_id').range(offset, offset + 999)
    assert.equal(error, null)
    if (!data.length) break
    rows.push(...data)
    offset += data.length
  }
  const topics = await tracking.sharedTopicOptions(table, rows)
  assert.equal(topics.reduce((sum, topic) => sum + topic.count, 0), rows.length)
  assert.ok(topics.every((topic) => topic.updateCount >= 0 && topic.reviewedCount <= topic.count))
  const reviewed = await tracking.sharedReviewedIds(table, rows.slice(0, 500))
  assert.ok(reviewed.every((id) => rows.some((row) => row.question_id === id)))
  checkedTopics += topics.length
}
console.log(JSON.stringify({ sharedMetadata: true, reviewedIds: true, subjects: 2, checkedTopics }))
