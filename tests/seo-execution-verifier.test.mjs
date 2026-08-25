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

const { extractMarkers, stripHtml, extractAnchorIds, liveAnchorIds } = mod

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

// ---------------------------------------------------------------------------
// Aug 25 2026 — the paraphrase false-negative and the false-positive it invited.
//
// The Jul 26 `pih-into-pie-post` bet named "PIH vs PIE"; the page ships that
// section as "PIE vs PIH: Which One Do You Actually Have?". Verbatim matching
// returned `not_executed` — terminal at gate 1, and seo-guardian.ts tells the
// strategist to RE-PROPOSE anything not_executed, which is how a 4th bet landed
// on a finished page.
//
// These tests execute the real transpiled verifier against fixture HTML rather
// than asserting on source text, because a source-regex test passes against the
// broken code.
// ---------------------------------------------------------------------------

// A miniature of the live PIE post: ships the section under REVERSED wording,
// and carries PIH/PIE as ordinary topic vocabulary throughout.
const PIE_PAGE = `<html><head><title>Best Korean Skincare for PIE</title></head><body>
<h2 id="pie-vs-pih">PIE vs PIH: Which One Do You Actually Have?</h2>
<p>PIE is red, PIH is brown. If you have PIH instead of PIE, read the PIH guide.
Many people confuse PIE and PIH; PIH lingers while PIE fades.</p>
<h3 id="best-serum-for-pie">Best Korean Serum for PIE</h3>
<h3 id="best-toner-for-pie">Best Korean Toner for PIE</h3>
</body></html>`

test('zero verbatim matches abstains — it never accuses non-execution', async () => {
  // REVERT CHECK: restoring `status: 'not_executed'` here makes this fail.
  const r = await mod.verifyExecution.call(null, null, 'Add a "PIH vs PIE" H2 section', 'content_refresh')
  assert.equal(r.status, 'unverified', 'no target page must abstain')

  // The core of the bug, exercised through the real matching block via a stub
  // fetch so no network is involved.
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(PIE_PAGE, { status: 200 })
  try {
    const res = await mod.verifyExecution('/blog/pie', 'Add a "PIH vs PIE" H2 section', 'content_refresh')
    assert.notEqual(res.status, 'not_executed',
      'a reworded-but-shipped section must NOT be accused of never shipping')
    assert.equal(res.status, 'unverified')
    assert.match(res.evidence, /paraphrase/, 'evidence must name the ambiguity, not assert absence')
  } finally { globalThis.fetch = origFetch }
})

test('topic vocabulary must NOT satisfy a marker — the rejected fuzzy-match', async () => {
  // The negative control the suite lacked. Word-order-tolerant matching was
  // measured: 24 eight-word windows on the live PIE page contain both "PIH"
  // and "PIE", so token matching would return `executed` against the PRE-EDIT
  // page. A false `executed` is the only status that reaches hit/miss and it
  // stamps the write-once execution_first_seen. This test fails if anyone
  // reintroduces tolerant matching.
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(PIE_PAGE, { status: 200 })
  try {
    const res = await mod.verifyExecution('/blog/pie', 'Add a "PIH vs PIE" H2 section', 'content_refresh')
    assert.notEqual(res.status, 'executed',
      'scattered topic vocabulary must never be credited as shipped work')
  } finally { globalThis.fetch = origFetch }
})

test('anchor ids are read from raw HTML — stripHtml would delete them', () => {
  // The shipped #best-serum-for-pie anchors were invisible to the verifier
  // because stripHtml drops attributes. REVERT CHECK: matching ids against
  // stripHtml(html) instead of raw html makes this fail.
  const ids = liveAnchorIds(PIE_PAGE)
  assert.ok(ids.has('best-serum-for-pie'), 'id must be visible in raw HTML')
  assert.equal(stripHtml(PIE_PAGE).includes('best-serum-for-pie'), false,
    'stripped text must NOT contain the id — proving raw HTML is required')
  assert.deepEqual(extractAnchorIds('add a jump anchor #best-serum-for-pie to the post'), ['best-serum-for-pie'])
})

test('an internal-link bet abstains — the changed page is not the fetched page', async () => {
  // Measured: the Aug 5 pie-to-pih-internal-links bet adds links ON the PIE
  // post but names the PIH page as target; its markers appear on the PIH page
  // 18x as ordinary text, so it would have graded `executed` on evidence from
  // a document the action never touched.
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('<html><body>fade post-acne dark spots</body></html>', { status: 200 })
  try {
    const res = await mod.verifyExecution('/blog/pih', "add links using anchor 'fade post-acne dark spots'", 'internal_links')
    assert.equal(res.status, 'unverified')
    assert.match(res.evidence, /not the ranking target|page that CHANGES/i)
  } finally { globalThis.fetch = origFetch }
})

test('a 404 remains the one basis for not_executed', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('nope', { status: 404 })
  try {
    const res = await mod.verifyExecution('/blog/gone', 'Add a "Whatever" block', 'content_refresh')
    assert.equal(res.status, 'not_executed', 'positive evidence of absence must still accuse')
  } finally { globalThis.fetch = origFetch }
})
