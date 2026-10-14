import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { createLoader, projectRoot } from './admin-users-test-loader.mjs'

const require = createRequire(import.meta.url)
const load = createLoader({})
const filename = `${projectRoot}/app/components/admin/TopicBatchSelector.tsx`
const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} }
vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
  (name) => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), module, module.exports)
const Selector = module.exports.default
const topics = [{ topic: 'చలనం', count: 19 }, { topic: 'Next topic', count: 18 }]
const render = (selected, disabled = false) => renderToStaticMarkup(createElement(Selector, {
  topics, selected, disabled, onChange: () => {}, onClose: () => {}, onLoad: () => {},
}))

test('a 19-question starting topic exposes next-topic selection immediately', () => {
  const html = render(['చలనం'])
  assert.match(html, /Include the next topics in this batch/)
  const next = html.match(/<button\b[^>]*>Add next topic<\/button>/)?.[0]
  assert.ok(next)
  assert.doesNotMatch(next, /\sdisabled(?:=|\s|>)/)
  assert.match(html, /Next topic/)
  assert.doesNotMatch(html, /Load selected topics/)
})

test('both topics show a combined 37-question load control and can return to one topic', () => {
  const html = render(['చలనం', 'Next topic'])
  assert.match(html, /Load selected topics · 37 questions/)
  assert.match(html, /Use one topic/)
  assert.match(html, /2 topics · 37 \/ 100 questions/)
})

test('busy upload or save disables the topic list and combined load action', () => {
  const html = render(['చలనం', 'Next topic'], true)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /<button\b[^>]*disabled=""[^>]*>Load selected topics · 37 questions<\/button>/)
})

test('five topics totaling 49 questions still allow adding the sixth topic', () => {
  const small = Array.from({ length: 6 }, (_, i) => ({ topic: `Small ${i}`, count: i < 4 ? 10 : 9 }))
  const html = renderToStaticMarkup(createElement(Selector, {
    topics: small, selected: small.slice(0, 5).map((t) => t.topic), disabled: false,
    onChange: () => {}, onClose: () => {}, onLoad: () => {},
  }))
  const next = html.match(/<button\b[^>]*>Add next topic<\/button>/)?.[0]
  assert.ok(next)
  assert.doesNotMatch(next, /\sdisabled(?:=|\s|>)/)
  assert.match(html, /5 topics · 49 \/ 100 questions/)
  assert.match(html, /No topic limit/)
  assert.doesNotMatch(html, /Maximum 5|5 \/ 5/)
})

test('a 90-question batch remains loadable when the next ordered topic would exceed 100', () => {
  const ordered = [30, 25, 20, 15, 12, 10].map((count, i) => ({ topic: String(i), count }))
  const html = renderToStaticMarkup(createElement(Selector, {
    topics: ordered, selected: ['0', '1', '2', '3'], disabled: false,
    onChange: () => {}, onClose: () => {}, onLoad: () => {},
  }))
  assert.match(html, /Keep this 90-question batch/)
  const loadButton = html.match(/<button\b[^>]*>Load selected topics · 90 questions<\/button>/)?.[0]
  assert.ok(loadButton)
  assert.doesNotMatch(loadButton, /\sdisabled(?:=|\s|>)/)
  assert.match(html, /<button\b[^>]*disabled=""[^>]*>Fill batch in topic order<\/button>/)
})
