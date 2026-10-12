// Read-only verification against the configured database. Prints counts only.
// node --env-file=.env scripts/verify-admin-users.mjs
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createLoader } from './admin-users-test-loader.mjs'

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } })
const load = createLoader(client)
const api = load('lib/admin/users.ts')
const list = await api.listAdminUsers(new URLSearchParams({ pageSize: '2' }))
assert.ok(list.users.length <= 2)
const checked = { directory: true, totalUsers: list.pagination.total, summary: false, histories: 0, search: false, filters: 0 }
for (const access of ['premium', 'free', 'expired']) {
  await api.listAdminUsers(new URLSearchParams({ access, pageSize: '1' }))
  checked.filters++
}
const combined = await api.listAdminUsers(new URLSearchParams({ access: 'free', q: 'admin-query-check-no-matching-user-7f322e', pageSize: '1' }))
assert.equal(combined.pagination.total, 0)
await api.listAdminUsers(new URLSearchParams({ q: 'x",role.eq.admin,(x)%_', pageSize: '1' }))
if (list.users[0]) {
  const user = await api.getAdminUser(list.users[0].id)
  assert.ok(user)
  const search = await api.listAdminUsers(new URLSearchParams({ q: user.email, pageSize: '2' }))
  assert.ok(search.users.some((entry) => entry.id === user.id))
  checked.search = true
  const summary = await api.getAdminUserSummary(user)
  assert.ok(summary.usage.questionsAnswered >= 0)
  assert.ok(summary.payments.orders >= 0)
  assert.equal(JSON.stringify(summary).includes('refresh_token_hash'), false)
  checked.summary = true
  for (const section of ['activity', 'practice', 'questions', 'mocks', 'payments', 'devices']) {
    const history = await api.getAdminUserHistory(user.id, section, new URLSearchParams({ pageSize: '2' }))
    assert.ok(history.rows.length <= 2)
    checked.histories++
  }
}
console.log(JSON.stringify(checked))
