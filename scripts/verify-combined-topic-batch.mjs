// Verify real combined exports and RPC validation without changing questions.
// node --env-file=.env scripts/verify-combined-topic-batch.mjs
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createLoader } from './admin-users-test-loader.mjs'

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })
const { data: admin, error: adminError } = await client.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle()
assert.equal(adminError, null)
assert.ok(admin)
const load = createLoader(client, {
  'lib/auth/session.ts': { requireAdmin: (handler) => (request) => handler(request, {}, { user: admin }) },
  'lib/mock-tests/cache.ts': { invalidateMockTestCache: async () => {} },
  'lib/mock-tests/live-attempts.ts': { findLiveAttempts: async () => [] },
  'lib/mock-tests/question-bank.ts': { matchDifficulty: () => null },
})
const api = load('app/api/admin/questions/bulk/route.ts')
let checked = 0
for (const table of ['english_medium_science', 'telugu_medium_science']) {
  const listing = await api.GET(new Request(`http://localhost/api/admin/questions/bulk?table=${table}&topics=1`))
  assert.equal(listing.status, 200)
  const topics = (await listing.json()).topics.filter((topic) => topic.count <= 10).slice(0, 6).map((topic) => topic.topic)
  assert.ok(topics.length > 5)
  const response = await api.POST(new Request('http://localhost/api/admin/questions/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, action: 'export', batchTopics: topics }),
  }))
  assert.equal(response.status, 200)
  const batch = await response.json()
  assert.ok(batch.rows.length <= 100)
  assert.equal(new Set(batch.rows.map((row) => row.question_id)).size, batch.rows.length)
  assert.deepEqual(batch.topics, topics)
  assert.ok(Object.values(batch.questionTopics).every((topic) => topics.includes(topic)))
  checked++
}
const { error } = await client.rpc('apply_admin_combined_topic_updates', {
  p_request_id: randomUUID(), p_fingerprint: 'invalid-batch-check', p_actor_id: admin.id, p_table: 'english_medium_science',
  p_writes: [], p_reviewed_ids: [], p_response: { summary: { written: 0 } }, p_expected_topics: {},
})
assert.equal(error?.code, '22023')
console.log(JSON.stringify({ combinedExports: checked, rpcValidation: true, questionChanges: 0 }))
