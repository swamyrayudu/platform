// Exercise the real route, CSV parser and diff against an in-memory Data API.
// No credentials or database writes are needed: node --test scripts/test-topic-bulk-update.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const table = 'english_medium_science'
const row = (id, topic) => ({
  question_id: id, topic, question: `Original ${id}`, option_a: 'First',
  option_b: 'Second', option_c: 'Third', option_d: 'Fourth', correct_answer: 'A',
  explanation: 'Original explanation', subtopic: '', chapter: '', difficulty: 'Medium',
})

function harness(rows, pageLimit = 1000, live = false) {
  const db = {
    [table]: structuredClone(rows),
    mock_test_questions: [{ question_uid: `${table}:Q003`, mock_test_id: 'mock-1' }],
    mock_tests: [{ id: 'mock-1', version: 1 }],
  }
  const writes = []
  const added = []
  const invalidations = []
  class Query {
    constructor(name) { this.name = name; this.filters = []; this.columns = '*' }
    select(columns, options) { this.columns = columns; this.options = options; return this }
    eq(column, value) { this.filters.push((r) => r[column] === value); return this }
    is(column, value) { return this.eq(column, value) }
    in(column, values) { this.filters.push((r) => values.includes(r[column])); return this }
    order(column) { this.orderColumn = column; return this }
    range(from, to) { this.slice = [from, to + 1]; return this }
    limit(limit) { this.slice = [0, limit]; return this }
    update(update) { this.patch = update; return this }
    insert(values) { this.newRows = values; return this }
    then(resolve, reject) {
      try {
        if (this.newRows?.some((r) => db[this.name].some((existing) => existing.question_id === r.question_id))) {
          return Promise.resolve({ data: null, error: { code: '23505', message: 'ID already exists' } }).then(resolve, reject)
        }
        if (this.newRows) {
          const created = structuredClone(this.newRows)
          db[this.name].push(...created)
          added.push(...created)
        }
        let selected = this.newRows ? db[this.name].slice(-this.newRows.length)
          : db[this.name].filter((r) => this.filters.every((f) => f(r)))
        const count = selected.length
        if (this.orderColumn) selected.sort((a, b) =>
          a[this.orderColumn] < b[this.orderColumn] ? -1 : a[this.orderColumn] > b[this.orderColumn] ? 1 : 0)
        if (this.slice) selected = selected.slice(this.slice[0], Math.min(this.slice[1], this.slice[0] + pageLimit))
        else selected = selected.slice(0, pageLimit)
        if (this.patch) {
          for (const existing of selected) {
            writes.push({ id: existing.question_id, update: structuredClone(this.patch) })
            Object.assign(existing, this.patch)
          }
        }
        const columns = this.columns.split(',').map((s) => s.trim())
        const data = this.options?.head ? null : selected.map((r) =>
          Object.fromEntries(columns.map((column) => [column, r[column]])))
        return Promise.resolve({ data, count, error: null }).then(resolve, reject)
      } catch (error) { return Promise.reject(error).then(resolve, reject) }
    }
  }
  const overrides = {
    '@/lib/auth/session': { requireAdmin: (handler) => handler },
    '@/lib/supabase-admin': { supabaseAdmin: { from: (name) => new Query(name) } },
    '@/lib/mock-tests/cache': { invalidateMockTestCache: async (...args) => invalidations.push(args) },
    '@/lib/mock-tests/live-attempts': { findLiveAttempts: async () => live ? [{ mockTestId: 'mock-1' }] : [] },
    '@/lib/mock-tests/question-bank': { matchDifficulty: (value) => ['Easy', 'Medium', 'Hard'].includes(value) ? value : null },
  }
  const modules = new Map()
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports
    const loadedModule = { exports: {} }
    modules.set(filename, loadedModule)
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    function localRequire(name) {
      if (overrides[name]) return overrides[name]
      if (name.startsWith('@/') || name.startsWith('.')) {
        const resolved = name.startsWith('@/') ? path.join(root, name.slice(2))
          : path.resolve(path.dirname(filename), name)
        return load(`${resolved}.ts`)
      }
      return require(name)
    }
    vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  const route = load(path.join(root, 'app/api/admin/questions/bulk/route.ts'))
  async function get(params) {
    const response = await route.GET(new Request(`http://localhost/api/admin/questions/bulk?${new URLSearchParams({ table, ...params })}`))
    return { status: response.status, data: await response.json() }
  }
  async function post(payload) {
    const response = await route.POST(new Request('http://localhost/api/admin/questions/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table, ...payload }),
    }))
    return { status: response.status, data: await response.json() }
  }
  async function postImport(payload) {
    const importRoute = load(path.join(root, 'app/api/admin/questions/import/route.ts'))
    const response = await importRoute.POST(new Request('http://localhost/api/admin/questions/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table, ...payload }),
    }))
    return { status: response.status, data: await response.json() }
  }
  return { db, writes, added, invalidations, get, post, postImport, load }
}

const csv = (...rows) => `question_id,question\n${rows.map(([id, text]) => `${id},${text}`).join('\n')}`
const batch = (exported, text, apply = false) => ({
  from: exported.from, to: exported.to, topic: exported.topic,
  questionIds: exported.rows.map((r) => r.question_id), csv: text, apply,
})

test('topic counts include later pages, Telugu, null and empty topics', async () => {
  const rows = Array.from({ length: 1007 }, (_, i) => row(`Q${String(i).padStart(5, '0')}`, i < 1000 ? 'Biology' : 'కణం'))
  rows.push(row('Z001', null), row('Z002', ''))
  const h = harness(rows, 123)
  const { status, data } = await h.get({ topics: '1' })
  assert.equal(status, 200)
  assert.equal(data.total, 1009)
  assert.equal(data.topics.find((t) => t.topic === 'Biology').count, 1000)
  assert.equal(data.topics.find((t) => t.topic === 'కణం').count, 7)
  assert.equal(data.topics.find((t) => t.topic === null).count, 1)
  assert.equal(data.topics.find((t) => t.topic === '').count, 1)
})

test('export counts and offsets apply within the exact topic', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q002', 'Biology, advanced'), row('Q003', 'Biology'), row('Q004', 'Physics')])
  const { status, data } = await h.get({ topic: 'Biology', from: '2', to: '100' })
  assert.equal(status, 200)
  assert.equal(data.total, 2)
  assert.equal(data.topic, 'Biology')
  assert.deepEqual(data.rows.map((r) => r.question_id), ['Q003'])
  const legacy = await h.get({ from: '1', to: '2' })
  assert.equal(legacy.data.total, 4)
  assert.equal('topic' in legacy.data, false)
})

test('preview writes nothing; apply matches reordered CSV by ID and refreshes mocks', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q002', 'Physics'), row('Q003', 'Biology')])
  const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '100' })
  const payload = batch(exported, csv(['Q003', 'Better third question'], ['Q001', 'Better first question']))
  const preview = await h.post(payload)
  assert.equal(preview.status, 200)
  assert.equal(preview.data.summary.changed, 2)
  assert.equal(preview.data.summary.missing, 0)
  assert.equal(h.writes.length, 0)
  const applied = await h.post({ ...payload, apply: true })
  assert.equal(applied.data.summary.written, 2)
  assert.deepEqual(h.db[table].map((r) => r.question_id), ['Q001', 'Q002', 'Q003'])
  assert.equal(h.db[table][0].question, 'Better first question')
  assert.equal(h.db[table][1].question, 'Original Q002')
  assert.equal(h.db[table][2].question, 'Better third question')
  assert.ok(h.writes.every((w) => !('question_id' in w.update)))
  assert.deepEqual(h.invalidations, [['mock-1', 1]])
})

test('foreign IDs, even from the same topic, block the entire apply', async () => {
  for (const foreign of ['Q002', 'Q003', 'NEW_ID']) {
    const h = harness([row('Q001', 'Biology'), row('Q002', 'Physics'), row('Q003', 'Biology')])
    const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '1' })
    const payload = batch(exported, csv(['Q001', 'Valid rewrite'], [foreign, 'Foreign rewrite']))
    const preview = await h.post(payload)
    assert.equal(preview.data.summary.outOfRange, 1)
    const apply = await h.post({ ...payload, apply: true })
    assert.equal(apply.status, 400)
    assert.equal(h.writes.length, 0)
  }
})

test('a full rewrite updates content and classification without replacing IDs', async () => {
  const h = harness([row('Q002', 'Physics'), row('Q003', 'Biology')])
  const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '1' })
  const text = `question_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,topic,subtopic,chapter,difficulty,subject
${table}:Q003,"Improved question, with detail",Alpha,Beta,Gamma,Delta,B,"Why Beta, not Alpha",Physics,Motion,Chapter 2,Hard,Ignored subject`
  const result = await h.post(batch(exported, text, true))
  assert.equal(result.status, 200)
  assert.equal(result.data.summary.written, 1)
  const updated = h.db[table].find((r) => r.question_id === 'Q003')
  assert.equal(updated.question, 'Improved question, with detail')
  assert.equal(updated.option_b, 'Beta')
  assert.equal(updated.correct_answer, 'B')
  assert.equal(updated.explanation, 'Why Beta, not Alpha')
  assert.equal(updated.topic, 'Physics')
  assert.equal(updated.difficulty, 'Hard')
  assert.equal(updated.subject, undefined)
  assert.equal(h.db[table].length, 2)
})

test('a shifted topic offset still updates only the original exported ID', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q003', 'Biology'), row('Q005', 'Biology')])
  const { data: exported } = await h.get({ topic: 'Biology', from: '2', to: '2' })
  h.db[table][0].topic = 'Physics'
  const result = await h.post(batch(exported, csv(['Q003', 'Correct target']), true))
  assert.equal(result.status, 200)
  assert.equal(h.db[table][1].question, 'Correct target')
  assert.equal(h.db[table][2].question, 'Original Q005')
})

test('a moved or deleted loaded question requires a reload', async () => {
  for (const removed of [false, true]) {
    const h = harness([row('Q001', 'Biology')])
    const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '1' })
    if (removed) h.db[table] = []
    else h.db[table][0].topic = 'Physics'
    const result = await h.post(batch(exported, csv(['Q001', 'Rewrite']), true))
    assert.equal(result.status, 409)
    assert.equal(h.writes.length, 0)
  }
})

test('null and empty topics stay distinct and can both be updated', async () => {
  const h = harness([row('Q001', null), row('Q002', ''), row('Q003', 'Biology')])
  for (const [params, id] of [[{ topicMissing: '1' }, 'Q001'], [{ topic: '' }, 'Q002']]) {
    const { data: exported } = await h.get({ ...params, from: '1', to: '100' })
    assert.deepEqual(exported.rows.map((r) => r.question_id), [id])
    assert.equal((await h.post(batch(exported, csv([id, 'Updated']), true))).data.summary.written, 1)
  }
})

test('topic requests require original IDs and obey the batch limit', async () => {
  const h = harness([row('Q001', 'Biology')])
  const missing = await h.post({ topic: 'Biology', from: 1, to: 1, csv: csv(['Q001', 'Rewrite']), apply: true })
  assert.equal(missing.status, 400)
  assert.equal((await h.get({ topic: 'Biology', from: '1', to: '501' })).status, 400)
  assert.equal((await h.get({ table: 'users', topics: '1' })).status, 400)
  assert.equal(h.writes.length, 0)
})

test('topic updates retain the live exam answer lock', async () => {
  const h = harness([row('Q003', 'Biology')], 1000, true)
  const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '1' })
  const payload = batch(exported, 'question_id,option_a\nQ003,New first option')
  assert.equal((await h.post(payload)).data.summary.liveLocked, 1)
  assert.equal((await h.post({ ...payload, apply: true })).status, 409)
  assert.equal(h.writes.length, 0)
})

test('existing whole-table range updates still work', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q003', 'Physics')])
  const result = await h.post({ from: 1, to: 1, csv: csv(['Q001', 'Legacy update']), apply: true })
  assert.equal(result.status, 200)
  assert.equal(result.data.summary.written, 1)
  assert.equal(h.db[table][0].question_id, 'Q001')
  assert.equal(h.db[table][1].question, 'Original Q003')
})

const newCsv = (stem, extraHeader = '', extraValue = '') =>
  `question,option_a,option_b,option_c,option_d,correct_answer${extraHeader}\n${stem},One,Two,Three,Four,B${extraValue}`

test('topic import previews new IDs and adds new rows to the selected topic only', async () => {
  const h = harness([row('Q001', 'అడవులు'), row('Q003', 'Physics')])
  const originals = structuredClone(h.db[table])
  const payload = { topic: 'అడవులు', csv: newCsv('Brand new question', ',topic', ',Wrong CSV topic') }
  const preview = await h.postImport(payload)
  assert.equal(preview.status, 200)
  assert.equal(preview.data.summary.generatedIds, 1)
  assert.equal(preview.data.rows[0].questionId, 'Q004')
  assert.equal(h.added.length, 0)
  const applied = await h.postImport({ ...payload, apply: true })
  assert.equal(applied.status, 200)
  assert.equal(applied.data.summary.inserted, 1)
  assert.equal(h.added[0].question_id, 'Q004')
  assert.equal(h.added[0].topic, 'అడవులు')
  assert.deepEqual(h.db[table].slice(0, 2), originals)
  assert.equal(h.writes.length, 0)
  assert.equal(h.invalidations.length, 0)
})

test('new IDs continue after all pages and never reuse an existing ID', async () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(`Q${String(i + 1).padStart(3, '0')}`, 'Biology'))
  const h = harness(rows, 3)
  const result = await h.postImport({ topic: 'Biology', csv: newCsv('New after later pages'), apply: true })
  assert.equal(result.status, 200)
  assert.equal(h.added[0].question_id, 'Q013')
  assert.equal(h.db[table].length, 13)
})

test('topic imports refuse supplied IDs and duplicated or invalid questions', async () => {
  const variants = [
    newCsv('New question', ',question_id', ',Q999'),
    newCsv('Original Q001'),
    'question,option_a,option_b,option_c,option_d,correct_answer\nInvalid,Same,Same,Third,Fourth,A',
  ]
  for (const text of variants) {
    const h = harness([row('Q001', 'Biology')])
    const result = await h.postImport({ topic: 'Biology', csv: text, apply: true })
    assert.equal(result.status, 400)
    assert.equal(h.added.length, 0)
    assert.equal(h.db[table].length, 1)
  }
})

test('null, empty and exact whitespace topic names are assigned without changing them', async () => {
  for (const topic of [null, '', ' Biology ']) {
    const h = harness([row('Q001', topic)])
    const result = await h.postImport({ topic, csv: newCsv('Fresh question'), apply: true })
    assert.equal(result.status, 200)
    assert.equal(h.added[0].topic, topic)
    assert.equal(h.added[0].question_id, 'Q002')
  }
})

test('ordinary imports still accept an explicit new ID and a CSV topic', async () => {
  const h = harness([row('Q001', 'Biology')])
  const result = await h.postImport({ csv: newCsv('Ordinary import', ',question_id,topic', ',CUSTOM-1,Physics'), apply: true })
  assert.equal(result.status, 200)
  assert.equal(h.added[0].question_id, 'CUSTOM-1')
  assert.equal(h.added[0].topic, 'Physics')
})

test('completion persists by admin, subject/medium and topic, and count changes reopen it', () => {
  const h = harness([])
  const { topicCompletionKey, parseTopicCompletion, isTopicCompleted } = h.load(path.join(root, 'lib/questions/topic-completion.ts'))
  const key = topicCompletionKey('admin-1', table, 'Biology')
  const saved = parseTopicCompletion(JSON.stringify({ [key]: 8 }))
  assert.equal(isTopicCompleted(saved, key, 8), true)
  assert.equal(isTopicCompleted(saved, key, 9), false)
  assert.equal(isTopicCompleted(saved, topicCompletionKey('admin-2', table, 'Biology'), 8), false)
  assert.equal(isTopicCompleted(saved, topicCompletionKey('admin-1', 'telugu_medium_science', 'Biology'), 8), false)
  assert.equal(isTopicCompleted(saved, topicCompletionKey('admin-1', table, 'Physics'), 8), false)
  assert.notEqual(topicCompletionKey('admin-1', table, null), topicCompletionKey('admin-1', table, ''))
  delete saved[key]
  assert.equal(isTopicCompleted(saved, key, 8), false)
  assert.deepEqual(parseTopicCompletion('invalid'), {})
  assert.deepEqual(parseTopicCompletion('[8]'), {})
  assert.deepEqual(parseTopicCompletion('{"bad":true,"negative":-1}'), {})
})

test('a successful full topic apply is eligible for completion and moves past completed topics', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q003', 'Biology')])
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const { topicCompletionKey } = h.load(path.join(root, 'lib/questions/topic-completion.ts'))
  const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '2' })
  const { data: result } = await h.post(batch(exported, csv(['Q001', 'Improved one'], ['Q003', 'Improved three']), true))
  assert.equal(workflow.canAdvanceTopic(result), true)
  const remaining = await workflow.findUnreviewedTopicBatch(new Set(result.rows.map((r) => r.questionId)),
    async (from, to) => (await h.get({ topic: 'Biology', from: String(from), to: String(to) })).data)
  assert.equal(remaining.batch, null)
  assert.equal(remaining.total, 2)
  const completed = { [topicCompletionKey('admin', table, 'Biology')]: 2, [topicCompletionKey('admin', table, 'Chemistry')]: 1 }
  const topics = [{ topic: 'Biology', count: 2 }, { topic: 'Chemistry', count: 1 }, { topic: 'Physics', count: 1 }]
  assert.equal(workflow.nextUnfinishedTopic(topics, 'Biology', completed, 'admin', table).topic, 'Physics')
})

test('a paste missing a loaded question keeps the same topic and returns that question', async () => {
  const h = harness([row('Q001', 'Biology'), row('Q003', 'Biology')])
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const { data: exported } = await h.get({ topic: 'Biology', from: '1', to: '2' })
  const { data: result } = await h.post(batch(exported, csv(['Q001', 'Improved one']), true))
  assert.equal(result.summary.missing, 1)
  const remaining = await workflow.findUnreviewedTopicBatch(new Set(result.rows.map((r) => r.questionId)),
    async (from, to) => (await h.get({ topic: 'Biology', from: String(from), to: String(to) })).data)
  assert.deepEqual(remaining.batch.rows.map((r) => r.question_id), ['Q003'])
  assert.equal(remaining.batch.to, 2)
})

test('large topics continue to later batches before completion, including server row limits', async () => {
  const h = harness(Array.from({ length: 501 }, (_, i) => row(`Q${String(i + 1).padStart(4, '0')}`, 'Biology')), 123)
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const reviewed = new Set(Array.from({ length: 500 }, (_, i) => `Q${String(i + 1).padStart(4, '0')}`))
  const read = async (from, to) => (await h.get({ topic: 'Biology', from: String(from), to: String(to) })).data
  const remaining = await workflow.findUnreviewedTopicBatch(reviewed, read)
  assert.deepEqual(remaining.batch.rows.map((r) => r.question_id), ['Q0501'])
  reviewed.add('Q0501')
  assert.equal((await workflow.findUnreviewedTopicBatch(reviewed, read)).batch, null)
})

test('moved IDs cannot make a different, unreviewed question look completed', async () => {
  const h = harness([row('Q001', 'Physics'), row('Q003', 'Biology')])
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const remaining = await workflow.findUnreviewedTopicBatch(new Set(['Q001']),
    async (from, to) => (await h.get({ topic: 'Biology', from: String(from), to: String(to) })).data)
  assert.equal(remaining.total, 1)
  assert.deepEqual(remaining.batch.rows.map((r) => r.question_id), ['Q003'])
})

test('previews, partial writes and database errors cannot advance a topic', () => {
  const workflow = harness([]).load(path.join(root, 'lib/questions/topic-workflow.ts'))
  assert.equal(workflow.canAdvanceTopic({ applied: false, summary: { changed: 1, written: 1 }, rows: [] }), false)
  assert.equal(workflow.canAdvanceTopic({ applied: true, summary: { changed: 2, written: 1 }, rows: [{ status: 'changed' }] }), false)
  assert.equal(workflow.canAdvanceTopic({ applied: true, summary: { changed: 1, written: 1 }, rows: [{ status: 'invalid' }] }), false)
})

test('next topic wraps, handles removed topics and stops when all are completed', () => {
  const h = harness([])
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const { topicCompletionKey } = h.load(path.join(root, 'lib/questions/topic-completion.ts'))
  const topics = [{ topic: 'A', count: 1 }, { topic: 'B', count: 1 }, { topic: 'D', count: 1 }]
  assert.equal(workflow.nextUnfinishedTopic(topics, 'D', {}, 'admin', table).topic, 'A')
  assert.equal(workflow.nextUnfinishedTopic(topics, 'C', {}, 'admin', table).topic, 'A')
  assert.equal(workflow.nextUnfinishedTopic(topics, 'Z', {}, 'admin', table).topic, 'A')
  const completed = Object.fromEntries(topics.map((t) => [topicCompletionKey('admin', table, t.topic), 1]))
  assert.equal(workflow.nextUnfinishedTopic(topics, 'B', completed, 'admin', table), null)
  assert.equal(workflow.nextUnfinishedTopic([{ topic: null, count: 1 }, { topic: '', count: 1 }], null, {}, 'admin', table).topic, '')
})

test('topics are shown largest first and automatic navigation skips completed topics from the middle', async () => {
  const h = harness([row('Q001', 'Alpha'), row('Q002', 'Zulu'), row('Q003', 'Zulu'), row('Q004', 'Zulu'), row('Q005', 'Middle'), row('Q006', 'Middle')])
  const { data } = await h.get({ topics: '1' })
  assert.deepEqual(data.topics.map((t) => [t.topic, t.count]), [['Zulu', 3], ['Middle', 2], ['Alpha', 1]])
  const workflow = h.load(path.join(root, 'lib/questions/topic-workflow.ts'))
  const { topicCompletionKey } = h.load(path.join(root, 'lib/questions/topic-completion.ts'))
  const completed = { [topicCompletionKey('admin', table, 'Alpha')]: 1 }
  assert.equal(workflow.nextUnfinishedTopic(data.topics, 'Middle', completed, 'admin', table).topic, 'Zulu')
  const more = [{ topic: 'Largest', count: 100 }, { topic: 'Middle', count: 50 }, { topic: 'Done', count: 20 }, { topic: 'Next', count: 10 }]
  completed[topicCompletionKey('admin', table, 'Done')] = 20
  assert.equal(workflow.nextUnfinishedTopic(more, 'Middle', completed, 'admin', table).topic, 'Next')
  const { sortTopicsByCount } = h.load(path.join(root, 'lib/questions/topic-order.ts'))
  const tied = [{ topic: 'B', count: 5 }, { topic: 'A', count: 5 }]
  assert.deepEqual(sortTopicsByCount(tied).map((t) => t.topic), ['A', 'B'])
  assert.deepEqual(tied.map((t) => t.topic), ['B', 'A'])
})
