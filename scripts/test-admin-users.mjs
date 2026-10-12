// node --test scripts/test-admin-users.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createLoader } from './admin-users-test-loader.mjs'

const A = '00000000-0000-4000-8000-000000000001'
const B = '00000000-0000-4000-8000-000000000002'
const user = (id, extra = {}) => ({
  id, email: `${id}@example.com`, name: `User ${id.slice(-1)}`, avatar_url: null, role: 'user',
  account_type: 'FREE', subscription_status: 'NONE', subscription_plan: null,
  subscription_started_at: null, subscription_expires_at: null, education_medium: 'english',
  learning_goals: ['practice'], onboarding_completed: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  session_version: 1, google_id: 'private-google-id', supabase_uid: 'private-provider-id', ...extra,
})

function splitFields(value) {
  const fields = []; let start = 0; let quoted = false; let depth = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && quoted) { i++; continue }
    if (value[i] === '"') quoted = !quoted
    if (!quoted) {
      if (value[i] === '(') depth++
      if (value[i] === ')') depth--
      if (value[i] === ',' && depth === 0) { fields.push(value.slice(start, i).trim()); start = i + 1 }
    }
  }
  fields.push(value.slice(start).trim())
  return fields
}

function harness(overrides = {}, pageLimit = 1000) {
  const db = { users: [user(A), user(B)], sessions: [], practice_sessions: [], question_attempts: [],
    mock_test_attempts: [], mock_tests: [], devices: [], security_events: [], payment_orders: [], ...structuredClone(overrides) }
  const queries = []
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.orders = []; this.childOrders = []; this.childLimit = 1 }
    select(columns, options = {}) { this.columns = columns; this.options = options; return this }
    eq(column, value) { this.filters.push((r) => r[column] === value); return this }
    gt(column, value) { this.filters.push((r) => r[column] != null && r[column] > value); return this }
    not(column, operator, value) { assert.equal(operator, 'is'); this.filters.push((r) => r[column] !== value); return this }
    or(filter) {
      const parts = splitFields(filter)
      this.filters.push((r) => parts.some((part) => {
        const [column, op, ...rest] = part.split('.')
        const value = rest.join('.')
        if (op === 'eq') return r[column] === value
        if (op === 'neq') return r[column] !== value
        if (op === 'is') return r[column] === null
        if (op === 'lte') return r[column] !== null && r[column] <= value
        if (op === 'ilike') {
          const pattern = JSON.parse(value)
          const inner = pattern.slice(1, -1).replace(/\\(.)/g, '$1')
          return (r[column] ?? '').toLowerCase().includes(inner.toLowerCase())
        }
        throw new Error(`Unhandled filter ${op}`)
      }))
      return this
    }
    order(column, options = {}) { (options.referencedTable ? this.childOrders : this.orders).push({ column, ascending: options.ascending !== false }); return this }
    limit(count, options = {}) { if (options.referencedTable) this.childLimit = count; else this.slice = [0, count]; return this }
    range(from, to) { this.slice = [from, to + 1]; return this }
    maybeSingle() { this.singleMode = 'maybe'; return this }
    single() { this.singleMode = 'required'; return this }
    sort(rows, orders) {
      return [...rows].sort((a, b) => {
        for (const { column, ascending } of orders) {
          const cmp = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0
          if (cmp) return ascending ? cmp : -cmp
        }
        return 0
      })
    }
    project(row) {
      const out = {}
      for (const field of splitFields(this.columns)) {
        if (field.startsWith('latest_sessions:')) {
          out.latest_sessions = this.sort(db.sessions.filter((s) => s.user_id === row.id), this.childOrders)
            .slice(0, this.childLimit).map((s) => ({ last_activity_at: s.last_activity_at }))
        } else if (field.startsWith('mock_tests(')) {
          const mock = db.mock_tests.find((m) => m.id === row.mock_test_id)
          out.mock_tests = mock ? { title: mock.title, module_number: mock.module_number } : null
        } else out[field] = row[field]
      }
      return out
    }
    then(resolve, reject) {
      try {
        queries.push({ table: this.table, columns: this.columns, range: this.slice, head: this.options.head })
        let rows = this.sort(db[this.table].filter((r) => this.filters.every((f) => f(r))), this.orders)
        const count = rows.length
        if (this.slice) rows = rows.slice(this.slice[0], Math.min(this.slice[1], this.slice[0] + pageLimit))
        else rows = rows.slice(0, pageLimit)
        let data = this.options.head ? null : rows.map((r) => this.project(r))
        if (this.singleMode) data = data[0] ?? null
        return Promise.resolve({ data, count, error: null }).then(resolve, reject)
      } catch (error) { return Promise.reject(error).then(resolve, reject) }
    }
  }
  const client = { from: (table) => new Query(table) }
  const load = createLoader(client, {
    'lib/auth/crypto.ts': { verifyAccessToken: async (token) => ({ sid: token, sv: 1 }) },
    'lib/auth/cookies.ts': { getAccessTokenFromCookies: () => null, clearAuthCookies: () => {} },
    'lib/auth/ip.ts': { getHashedIp: () => 'test-ip-hash' },
    'lib/auth/db.ts': {
      findSessionById: async (id) => ({ id, user_id: id, status: 'ACTIVE', expires_at: '2100-01-01', session_version: 1 }),
      getUserById: async (id) => user(id, { role: id === 'admin' ? 'admin' : 'user' }),
      updateSessionActivity: async () => {}, logSecurityEvent: async () => {},
    },
  })
  const api = load('lib/admin/users.ts')
  async function request(params = {}, role = 'admin', id) {
    const route = load(id === undefined ? 'app/api/admin/users/route.ts' : 'app/api/admin/users/[id]/route.ts')
    const response = await route.GET(new Request(`http://localhost/api/admin/users?${new URLSearchParams(params)}`, {
      headers: role ? { Authorization: `Bearer ${role}` } : {},
    }), { params: Promise.resolve({ id }) })
    return { status: response.status, headers: response.headers, data: await response.json() }
  }
  return { api, request, queries }
}

test('directory pagination works beyond 1,000 users with stable ties and no private fields', async () => {
  const users = Array.from({ length: 1103 }, (_, i) => user(`00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`))
  const h = harness({ users })
  const result = await h.request({ page: '45', pageSize: '25' })
  assert.equal(result.status, 200)
  assert.equal(result.data.pagination.total, 1103)
  assert.equal(result.data.users.length, 3)
  assert.equal(result.data.users[0].id, users[1100].id)
  assert.equal(result.data.pagination.totalPages, 45)
  assert.equal(result.headers.get('cache-control'), 'private, no-store')
  assert.equal(JSON.stringify(result.data).includes('private-google-id'), false)
  assert.equal('session_version' in result.data.users[0], false)
  assert.deepEqual(h.queries[0].range, [1100, 1125])
})

test('search uses names, emails and exact UUIDs; grammar punctuation stays inside quoted values', async () => {
  const h = harness({ users: [user(A, { name: 'తెలుగు Student', email: 'student_one@example.com' }), user(B)] })
  for (const q of ['తెలుగు', 'student_one@example.com', A]) {
    const result = await h.request({ q })
    assert.deepEqual(result.data.users.map((u) => u.id), [A])
  }
  const filter = h.api.userSearchFilter('x",role.eq.admin,(x)')
  assert.equal(splitFields(filter).length, 2)
  assert.equal((await h.request({ q: 'x",role.eq.admin,(x)' })).data.pagination.total, 0)
})

test('access filters use actual subscription expiry, role and medium', async () => {
  const h = harness({ users: [user(A, { account_type: 'PREMIUM', subscription_status: 'ACTIVE', subscription_expires_at: '2100-01-01', role: 'admin', education_medium: 'telugu' }),
    user(B, { account_type: 'PREMIUM', subscription_status: 'ACTIVE', subscription_expires_at: '2000-01-01' })] })
  assert.deepEqual((await h.request({ access: 'premium', role: 'admin', medium: 'telugu' })).data.users.map((u) => u.id), [A])
  assert.deepEqual((await h.request({ access: 'free' })).data.users.map((u) => u.id), [B])
  assert.deepEqual((await h.request({ access: 'expired' })).data.users.map((u) => u.id), [B])
})

test('anonymous and ordinary users cannot call either admin endpoint', async () => {
  for (const role of ['', 'user']) {
    const h = harness()
    assert.equal((await h.request({}, role)).status, role ? 403 : 401)
    assert.equal((await h.request({}, role, A)).status, role ? 403 : 401)
    assert.equal(h.queries.length, 0)
  }
})

test('invalid pagination, filters, IDs and history sections are refused', async () => {
  const h = harness()
  for (const params of [{ page: '0' }, { page: '1.5' }, { pageSize: '101' }, { pageSize: '-1' }, { role: 'owner' }, { q: 'a'.repeat(121) }]) {
    assert.equal((await h.request(params)).status, 400)
  }
  assert.equal((await h.request({}, 'admin', 'bad-id')).status, 400)
  assert.equal((await h.request({ section: 'sessions' }, 'admin', A)).status, 400)
  assert.equal((await h.request({}, 'admin', '00000000-0000-4000-8000-000000009999')).status, 404)
})

test('summary uses all records, excludes skipped answers, groups currencies and ignores stale sessions', async () => {
  const h = harness({
    practice_sessions: [{ id: 'p1', user_id: A, status: 'completed' }, { id: 'p2', user_id: A, status: 'in_progress' }, { id: 'p3', user_id: B, status: 'completed' }],
    question_attempts: [{ id: 'q1', user_id: A, selected_answer: 'A', is_correct: true }, { id: 'q2', user_id: A, selected_answer: 'B', is_correct: false }, { id: 'q3', user_id: A, selected_answer: null, is_correct: false }],
    payment_orders: [{ id: 'o1', user_id: A, status: 'PAID', currency: 'INR', amount: 29900 }, { id: 'o2', user_id: A, status: 'PAID', currency: 'INR', amount: 59900 }, { id: 'o3', user_id: A, status: 'PAID', currency: 'USD', amount: 500 }, { id: 'o4', user_id: A, status: 'FAILED', amount: 99900 }, { id: 'o5', user_id: B, status: 'PAID', currency: 'INR', amount: 99900 }],
    sessions: [{ user_id: A, status: 'ACTIVE', session_version: 1, expires_at: '2100-01-01', last_activity_at: '2026-01-04' }, { user_id: A, status: 'ACTIVE', session_version: 0, expires_at: '2100-01-01', last_activity_at: '2026-01-03' }, { user_id: A, status: 'ACTIVE', session_version: 1, expires_at: '2000-01-01', last_activity_at: '2026-01-02', refresh_token_hash: 'private-refresh' }],
  }, 2)
  const result = await h.request({}, 'admin', A)
  assert.equal(result.status, 200)
  assert.equal(result.data.usage.practiceSessions, 2)
  assert.equal(result.data.usage.practiceCompleted, 1)
  assert.equal(result.data.usage.questionsAnswered, 2)
  assert.equal(result.data.usage.practiceAccuracy, 50)
  assert.equal(result.data.usage.activeSessions, 1)
  assert.equal(result.data.payments.paid, 3)
  assert.deepEqual(result.data.payments.totals, [{ currency: 'INR', amount: 89800 }, { currency: 'USD', amount: 500 }])
  assert.equal(result.data.user.lastActivityAt, '2026-01-04')
  assert.equal(JSON.stringify(result.data).includes('private-refresh'), false)
})

test('every history section is user scoped, paginated and projects only its allowed columns', async () => {
  const h = harness()
  for (const section of ['activity', 'practice', 'questions', 'mocks', 'payments', 'devices']) {
    const config = h.api.HISTORY_CONFIG[section]
    const data = Array.from({ length: 8 }, (_, i) => ({ id: String(i), user_id: i === 7 ? B : A,
      [config.order]: '2026-01-01', event_type: 'GOOGLE_LOGIN', ip_hash: 'private-ip', metadata: { secret: 'private-metadata' } }))
    const scoped = harness({ [config.table]: data })
    const result = await scoped.request({ section, page: '2', pageSize: '3' }, 'admin', A)
    assert.equal(result.status, 200)
    assert.equal(result.data.pagination.total, 7)
    assert.deepEqual(result.data.rows.map((r) => r.id), ['3', '4', '5'])
    assert.equal(JSON.stringify(result.data).includes('private-'), false)
  }
})

test('empty users have zero totals, no payments and no invented accuracy', async () => {
  const result = await harness().request({}, 'admin', A)
  assert.equal(result.status, 200)
  assert.equal(result.data.usage.practiceAccuracy, null)
  assert.equal(result.data.usage.mockAttempts, 0)
  assert.deepEqual(result.data.payments.totals, [])
})
