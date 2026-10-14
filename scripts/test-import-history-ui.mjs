import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { projectRoot } from './admin-users-test-loader.mjs'

const require = createRequire(import.meta.url)
const filename = `${projectRoot}/app/components/admin/QuestionImportHistory.tsx`
const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const batchId = '00000000-0000-4000-8000-000000000002'
const batch = { id: batchId, status: 'applied', origin: 'import', row_count: 160,
  topics: ['మొదటి ప్రపంచ యుద్ధం'], created_at: '2026-10-14T09:44:02.669Z', actor: null }
const preview = { success: true, eligible: true, applied: false, count: 1, rows: [{ question_id: 'Q001', question: 'Original question', topic: 'Wrong' }], batchId, action: 'undo' }

function harness(seed = {}) {
  let index = 0
  const states = { 0: 1, 1: { batches: [batch], total: 1 }, ...seed }
  const requests = []; const events = []
  const react = { ...require('react'), useEffect: () => {}, useRef: (value) => ({ current: value }),
    useState: (initial) => { const key = index++; return [Object.hasOwn(states, key) ? states[key] : initial,
      (value) => { states[key] = typeof value === 'function' ? value(states[key] ?? initial) : value }] } }
  const module = { exports: {} }
  vm.runInThisContext(`(function(require,module,exports,fetch){${source}\n})`, { filename })(
    (name) => name === 'react' ? react : name === './CsvFilePicker' ? { __esModule: true, default: () => null }
      : name === 'sonner' ? { toast: { success: (...args) => events.push(args) } } : require(name), module, module.exports,
    async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => preview } })
  function render(props = {}) {
    index = 0
    return module.exports.default({ table: 'socal_telugu_medimum', topic: 'Wrong', onBusyChange: (busy) => events.push(busy), onChanged: () => events.push('changed'), ...props })
  }
  function nodes(tree, type) {
    if (!tree || typeof tree !== 'object') return []
    if (Array.isArray(tree)) return tree.flatMap((entry) => nodes(entry, type))
    return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)]
  }
  const button = (tree, label) => nodes(tree, 'button').find((node) => renderToStaticMarkup(node).includes(label))
  return { render, button, nodes, requests, events, states }
}

test('an applied import offers a read-only Undo preview and an undone import offers Restore', async () => {
  const h = harness()
  const tree = h.render()
  assert.match(renderToStaticMarkup(tree), /Added question history · Undo/)
  await h.button(tree, 'Preview Undo').props.onClick()
  assert.equal(h.requests[0].url, '/api/admin/questions/import/history')
  assert.deepEqual(h.requests[0].body, { table: 'socal_telugu_medimum', batchId, action: 'undo', apply: false })
  const undone = harness({ 1: { batches: [{ ...batch, status: 'undone' }], total: 1 } })
  assert.ok(undone.button(undone.render(), 'Preview Restore'))
})

test('blocked Undo stays disabled and cannot send an Apply request even if invoked directly', async () => {
  const h = harness({ 5: { ...preview, eligible: false, reason: 'Used in practice' } })
  const tree = h.render()
  assert.match(renderToStaticMarkup(tree), /Used in practice/)
  const apply = h.button(tree, 'Undo 1 questions')
  assert.equal(apply.props.disabled, true)
  await apply.props.onClick()
  assert.equal(h.requests.length, 0)
})

test('legacy recovery sends the preview fingerprint and original CSV to the exact wrong topic', async () => {
  const h = harness({ 5: { ...preview, snapshotHash: 'checked-snapshot' }, 6: true, 7: 'original-csv', 10: batchId })
  await h.button(h.render(), 'Undo 1 questions').props.onClick()
  assert.equal(h.requests[0].url, '/api/admin/questions/import/recover')
  assert.deepEqual(h.requests[0].body, { table: 'socal_telugu_medimum', topic: 'Wrong', csv: 'original-csv', requestId: batchId, apply: true, snapshotHash: 'checked-snapshot' })
  assert.ok(h.events.includes('changed'))
})

test('editing an earlier CSV clears its approval preview before another Undo', () => {
  const h = harness({ 5: { ...preview, snapshotHash: 'stale' }, 6: true, 7: 'old-csv', 10: batchId })
  const textarea = h.nodes(h.render(), 'textarea')[0]
  textarea.props.onChange({ target: { value: 'different-csv' } })
  assert.equal(h.states[5], null)
  assert.equal(h.states[10], null)
  assert.equal(h.states[7], 'different-csv')
})

test('history pagination and active operations disable inappropriate navigation', () => {
  const h = harness({ 1: { batches: [batch], total: 41 } })
  const tree = h.render()
  assert.match(renderToStaticMarkup(tree), /Page 1 of 3/)
  assert.equal(h.button(tree, 'Previous').props.disabled, true)
  assert.equal(h.button(tree, 'Next').props.disabled, false)
  assert.equal(h.button(h.render({ disabled: true }), 'Preview Undo').props.disabled, true)
})
