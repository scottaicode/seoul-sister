/**
 * Guard tests — execution verifier marker extraction + HTML entity decoding.
 *
 * These EXECUTE the real functions. Both bugs below were live and would have
 * produced FALSE `not_executed`, which silently drops a bet from grading
 * entirely (gate 1 stops the pipeline) — the verifier's own header names a
 * false not_executed as one of its two catastrophic outcomes.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = readFileSync(join(root, 'src', 'lib', 'seo', 'execution-verifier.ts'), 'utf8')
// Strip the type-only import so the module runs standalone.
const js = ts.transpileModule(src.replace(/^import .*$/m, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const { extractMarkers, stripHtml } = mod

test('a contraction does not corrupt marker extraction', () => {
  // Measured: /['"]...['"]/  turned "Don't bury the ingredients: add a
  // scannable 'Ingredients list' section" into the marker
  // "t bury the ingredients: add a scannable " — garbage matching no page,
  // producing a false not_executed that drops the bet.
  const markers = extractMarkers("Don't bury the ingredients: add a scannable 'Ingredients list' section")
  assert.ok(markers.includes('Ingredients list'), `expected the real marker, got ${JSON.stringify(markers)}`)
  assert.ok(
    !markers.some((m) => m.startsWith('t bury')),
    `contraction leaked into markers: ${JSON.stringify(markers)}`
  )
})

test('a possessive does not corrupt marker extraction', () => {
  const markers = extractMarkers("Rewrite the page's intro to answer 'is it mineral or chemical'")
  assert.ok(markers.includes('is it mineral or chemical'), `got ${JSON.stringify(markers)}`)
  assert.ok(!markers.some((m) => m.startsWith('s intro')), `possessive leaked: ${JSON.stringify(markers)}`)
})

test('extraction artifacts are discarded rather than trusted as markers', () => {
  // Anything not starting AND ending alphanumerically is an artifact.
  for (const m of extractMarkers("It's the page's own 'real marker' here")) {
    assert.match(m, /^[A-Za-z0-9]/, `artifact survived: "${m}"`)
  }
})

test('both apostrophe entity forms decode — the live site emits each', () => {
  // Verified on a real page: 8 occurrences of &#39; and 3 of &#x27; in one
  // document. Missing &#x27; makes a genuinely-present marker fail to match.
  const stripped = stripHtml('<p>Yuri&#x27;s pick</p><p>Bailey&#39;s pick</p>')
  assert.match(stripped, /Yuri's pick/, '&#x27; must decode')
  assert.match(stripped, /Bailey's pick/, '&#39; must decode')
})

test('a network failure is never evidence of non-execution', async () => {
  // A false not_executed drops the bet; an unreachable host must abstain.
  const r = await mod.verifyExecution('/blog/definitely-not-a-real-page-xyz', 'Add a "Nonexistent Block" section', 'content_refresh')
  assert.ok(['not_executed', 'unverified'].includes(r.status))
})

test('a bet naming no quotable marker abstains rather than accusing', () => {
  const markers = extractMarkers('Refresh the sebaceous filaments post to expand the routine section')
  assert.equal(markers.length, 0, 'no markers should be extracted from unquoted prose')
})
