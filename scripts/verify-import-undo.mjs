// Read-only check of the real Data API, relation joins and backup preview.
// node --env-file=.env scripts/verify-import-undo.mjs
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createLoader } from './admin-users-test-loader.mjs'

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })
const { data: admin, error: adminError } = await client.from('users').select('id').eq('role', 'admin').limit(1).single()
assert.ifError(adminError)
const load = createLoader(client, { 'lib/auth/session.ts': {
  requireAdmin: (handler) => (request) => handler(request, {}, { user: { id: admin.id, role: 'admin' } }),
} })
const historyRoute = load('app/api/admin/questions/import/history/route.ts')
const table = 'socal_telugu_medimum'
const topic = 'మొదటి ప్రపంచ యుద్ధం'
const params = new URLSearchParams({ table, topic: JSON.stringify(topic), page: '1' })
const response = await historyRoute.GET(new Request(`http://localhost/api/admin/questions/import/history?${params}`))
const data = await response.json()
assert.equal(response.status, 200, JSON.stringify(data))
assert.ok(Array.isArray(data.batches))
assert.ok(data.batches.every((batch) => batch.topics.includes(topic)))
assert.equal(JSON.stringify(data).includes('option_a'), false, 'History list must not expose full backups')
const backup = data.batches.find((batch) => batch.id === '5e79b38f-29f9-4235-82ba-00be50db498d')
assert.ok(backup, 'Requested recovery is visible in history')
assert.equal(backup.status, 'undone')
assert.equal(backup.row_count, 160)
const previewResponse = await historyRoute.POST(new Request('http://localhost/api/admin/questions/import/history', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ table, batchId: backup.id, action: 'restore', apply: false }),
}))
const preview = await previewResponse.json()
assert.equal(previewResponse.status, 200, JSON.stringify(preview))
assert.equal(preview.count, 160)
assert.equal(preview.applied, false)
assert.equal(preview.rows[0].question_id, 'SGTSOC02947')
const { count, error } = await client.from(table).select('question_id', { count: 'exact', head: true })
  .gte('question_id', 'SGTSOC02947').lte('question_id', 'SGTSOC03106')
assert.ifError(error)
assert.equal(count, 0, 'Read-only preview must not restore the removed batch')
console.log(JSON.stringify({ history: true, topicFilter: true, removed: 160, remaining: count, backup: true, restorePreview: true, restoreEligible: preview.eligible }))
