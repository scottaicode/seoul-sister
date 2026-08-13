/**
 * Guard test — `inci_complete` must never vouch for an EMPTY ingredient list.
 * Aug 12 2026.
 *
 * BACKGROUND
 *
 * On 2026-08-11 a public reply told a user with rosacea, on tazarotene, who was
 * specifically avoiding niacinamide, that Aestura's Atobarrier 365 Cream was
 * "niacinamide-free". It is not — the current manufacturer label lists
 * Niacinamide at position 24. The claim was walked back publicly.
 *
 * THE DEFECT
 *
 * src/app/api/admin/products/search/route.ts stamped:
 *
 *     if (full_inci) product.inci_complete = true
 *
 * unconditionally. `product.ingredients` is `[]` for any product with no row in
 * ss_product_ingredients — bundles/Sets (78 in catalog with zero INCI) and
 * un-mapped products (273 total with empty ingredients_raw). Those came back as
 *
 *     { ingredients: [], inci_complete: true }
 *
 * which reads as "this is the COMPLETE label, and it contains nothing."
 *
 * This is the negative-claim failure direction, and it is asymmetric. A POSITIVE
 * claim ("contains niacinamide") fails safe against an empty list — you cannot
 * find the ingredient, so you cannot assert it. A NEGATIVE claim ("free of X")
 * is CONFIRMED by an empty list, vacuously, for EVERY x. So the one marker whose
 * entire job is to make negative claims safely confirmable was the thing making
 * them falsely confirmable. Silence from a grounding pre-flight is not
 * verification.
 *
 * A missing label must read as MISSING, never as "contains nothing".
 *
 * WHY THIS TEST EXECUTES THE REAL EXPRESSION
 *
 * Per the repo's silent-failure discipline: a guard test that asserts on source
 * TEXT passes against broken code. This extracts the actual stamping expression
 * from the route and RUNS it, so reverting the fix to `= true` fails the test.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const ROUTE = ['src', 'app', 'api', 'admin', 'products', 'search', 'route.ts']

async function importSnippet(tsSource, filename) {
  const js = ts.transpileModule(tsSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-inci-'))
  const file = join(dir, filename)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

/**
 * Lift the REAL `if (full_inci) { ... }` stamping block out of the route and
 * wrap it in a callable. The route itself imports next/server and the Supabase
 * client, so it cannot be imported directly in a plain node test.
 */
async function loadStamper() {
  const src = read(...ROUTE)

  // Match the whole `if (full_inci) ...` statement, brace-form or single-line.
  const match = src.match(/if \(full_inci\)\s*(\{[\s\S]*?\n {6}\}|[^\n]*)/)
  assert.ok(
    match,
    'Could not find the `if (full_inci)` stamping block in the search route. ' +
      'If it was renamed or restructured, update this test rather than deleting it — ' +
      'the invariant (never vouch for an empty list) still applies.'
  )

  const snippet = `
    export function stamp(product, full_inci) {
      ${match[0]}
      return product
    }
  `
  const mod = await importSnippet(snippet, 'stamp.mjs')
  return mod.stamp
}

test('inci_complete is FALSE when the ingredient list is empty (the Atobarrier defect)', async () => {
  const stamp = await loadStamper()

  // A bundle/Set row: real product, zero INCI linkage. 78 of these exist.
  const bundle = stamp({ ingredients: [] }, true)

  assert.notEqual(
    bundle.inci_complete,
    true,
    'An EMPTY ingredient list was stamped inci_complete: true. This makes every ' +
      '"free of X" claim vacuously confirmable — the exact failure that produced ' +
      'the false "Atobarrier 365 Cream is niacinamide-free" claim on 2026-08-11.'
  )
  assert.equal(bundle.inci_complete, false, 'An absent label must report as NOT complete.')
})

test('inci_complete is TRUE when a real ingredient list is present', async () => {
  const stamp = await loadStamper()

  const withLabel = stamp(
    { ingredients: [{ position: 1, inci_name: 'Water' }, { position: 2, inci_name: 'Niacinamide' }] },
    true
  )

  assert.equal(
    withLabel.inci_complete,
    true,
    'A populated full_inci list must still be marked complete — the fix must not ' +
      'suppress the marker for products that legitimately have a full label, or ' +
      'consumers lose the ability to make ANY confident negative claim.'
  )
})

test('inci_complete is not stamped at all when full_inci was not requested', async () => {
  const stamp = await loadStamper()

  const def = stamp({ ingredients: [] }, false)

  assert.equal(
    'inci_complete' in def,
    false,
    'The default (non-full_inci) response shape must stay byte-identical for ' +
      'existing consumers — the marker is only meaningful on full_inci requests.'
  )
})
