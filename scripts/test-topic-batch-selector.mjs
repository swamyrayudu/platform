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
  assert.match(html, /2 \/ 5 topics · 37 \/ 100 questions/)
})

test('busy upload or save disables the topic list and combined load action', () => {
  const html = render(['చలనం', 'Next topic'], true)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /<button\b[^>]*disabled=""[^>]*>Load selected topics · 37 questions<\/button>/)
})
