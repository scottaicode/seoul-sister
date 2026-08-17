/**
 * Guard test — in a numbered product line, the NUMBER is the identity.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (Aug 17 2026, production transcript).
 *
 * A Nordic woman living in Seoul listed ~11 products and asked whether they
 * work together. Yuri built a confident routine edit on FABRICATED ingredients:
 * she called numbuzin's No.9 line a "retinol/bakuchiol elasticity family" (it is
 * their NAD+/PDRN/niacinamide line, zero retinoid), called a Rejuran ampoule a
 * "turnover active" (INCI: blackberry leaf, licorice, calendula), and claimed a
 * pH clash with a "Vitamin C" product that is tangerine extract + niacinamide.
 * She then told the visitor to STOP REPURCHASING three products on that basis.
 *
 * The retrieval half of that failure is what this file guards. Measured live
 * before the fix, `search_products` resolved:
 *
 *     "numbuzin No.9 toner"  ->  No.1 Pure-Fit Cica Calming Toner
 *     "numbuzin No.3 serum"  ->  No.5 Vitamin Niacinamide Concentrated Serum
 *     "numbuzin No.5 essence" -> No.3 Super Glowing Essence Toner
 *
 * Wrong product, right brand, full confidence, no signal to the caller. So even
 * if Yuri HAD searched — the thing she is criticised for not doing — she would
 * have been handed a sibling product's ingredient list as a clean result.
 *
 * WHERE IT ACTUALLY BROKE, because four plausible layers were wrong first:
 * Strategy 1.5 (the brand-prefix composite) queries brand='numbuzin' AND
 * name ILIKE '%no%' AND name ILIKE '%toner%'. "no" is a substring of EVERY
 * numbuzin product name, so it matched a pile of siblings and RETURNED
 * IMMEDIATELY — before any ranking, coverage, or scoring code ran. Fixes to
 * tokenization, to Strategy 2's coverage, and to Strategy 3's scorer all
 * changed nothing because that code never executed. Only tracing execution
 * (rather than reading it) found the deciding layer.
 *
 * Scope: 471 verified products across 118 brands carry an identity-bearing
 * number in the name.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'yuri', 'tools.ts')

/** Source of smartProductSearch, comments stripped (prose must not satisfy a test). */
function searchSource() {
  const src = readFileSync(SRC, 'utf8')
  const start = src.indexOf('async function smartProductSearch(')
  assert.ok(start > -1, 'smartProductSearch not found')
  const end = src.indexOf('\nasync function ', start + 10)
  return src
    .slice(start, end > -1 ? end : undefined)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('a line number is extracted from the query', () => {
  const code = searchSource()
  assert.match(code, /const lineNumber\s*=/,
    'the query line number must be captured')
})

test('the line number is a HARD PREDICATE in the strategy that decides', () => {
  // Strategy 1.5 returns immediately on a hit, so a ranking-only fix is dead
  // code for these queries. That is exactly the mistake this test pins down.
  // Scoped by CODE markers, not by a comment string. The first version sliced
  // to `indexOf('Strategy 2')` — a COMMENT — and comments are stripped by
  // searchSource(), so the slice ran to the end of the function and found
  // `if (lineNumber)` belonging to the Strategy 2 rescue instead. Deleting the
  // Strategy 1.5 predicate entirely still passed. Second time today a guard
  // test policed the wrong region; only reverting the bug caught it.
  const code = searchSource()
  const start = code.indexOf('brandCandidate')
  const end = code.indexOf('compositeMatch?.length')
  assert.ok(start > -1 && end > start, 'strategy 1.5 block not found')
  const s15 = code.slice(start, end)
  assert.match(s15, /if \(lineNumber\)/,
    'strategy 1.5 must constrain on the line number — it returns before any ranking runs')
  assert.match(s15, /q = q\.or\(/,
    'the constraint must be a SQL predicate on the strategy-1.5 query itself')
})

test('the PostgREST dot-quoting is preserved', () => {
  // Unquoted `%no.9 %` inside or() is parsed as a filter separator and silently
  // returns ZERO rows — verified live against No.9 and No.3. This is a silent
  // failure: a malformed filter reads as "no such product".
  const code = searchSource()
  const matches = code.match(/name_en\.ilike\."%no\./g) || []
  assert.ok(matches.length >= 2,
    `line-number ILIKE patterns must be QUOTED for PostgREST; found ${matches.length}`)
})

test('a differing line number DISQUALIFIES a candidate', () => {
  const code = searchSource()
  assert.match(code, /lineNumberConflict/,
    'a row whose number contradicts the query must be rejected, not merely down-ranked')
  // Rows with NO number must be untouched — only a genuine conflict rejects,
  // otherwise every unnumbered product disappears from numbered queries.
  const fn = code.slice(code.indexOf('const lineNumberConflict'), code.indexOf('const allTermMatch'))
  assert.match(fn, /rn !== null/,
    'a row without a line number must not be disqualified')
})

test('the rescue merges into the window it post-filters', () => {
  // The window is ORDER BY rating_avg + LIMIT, so Postgres decides which rows
  // exist before relevance is computed. Measured: the 75-row window for
  // "numbuzin No.9 toner" held 3 numbuzin rows and ALL were No.3.
  const code = searchSource()
  assert.match(code, /windowRows/,
    'rescue rows must merge into the post-filtered set')
  assert.ok(
    !/const rows = broadResults/.test(code),
    'post-filtering broadResults instead of windowRows silently discards the rescue'
  )
})

test('REGRESSION: nothing changes for queries with no line number', () => {
  const code = searchSource()
  // The tokenizer must be untouched — an earlier attempt folded "No.9" into a
  // single token `no9`, which fixed in-memory comparison and BROKE the SQL
  // fetch (`name_en.ilike.%no9%` matches nothing, since the catalog stores
  // "No. 9"). The right row then never entered the window at all. Every
  // non-numbered query must tokenize exactly as before.
  assert.match(code, /const normalized = cleaned\.toLowerCase\(\)\.replace/,
    'tokenization must remain punctuation-normalization only')
  assert.ok(!/joinLineNumbers\(cleaned/.test(code),
    'the line number must NOT be folded into search terms — it breaks the SQL fetch')
})
