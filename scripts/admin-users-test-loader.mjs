import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

export function createLoader(supabase, authMocks = {}) {
  const cache = new Map()
  const mocks = {
    [path.join(projectRoot, 'lib/supabase-admin.ts')]: { supabaseAdmin: supabase },
    ...Object.fromEntries(Object.entries(authMocks).map(([name, value]) => [path.join(projectRoot, name), value])),
  }
  return function load(relativePath) {
    const filename = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath)
    if (mocks[filename]) return mocks[filename]
    if (cache.has(filename)) return cache.get(filename).exports
    const loadedModule = { exports: {} }
    cache.set(filename, loadedModule)
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    function localRequire(name) {
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
      if (name.startsWith('.')) return load(`${path.resolve(path.dirname(filename), name)}.ts`)
      return require(name)
    }
    vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
}
