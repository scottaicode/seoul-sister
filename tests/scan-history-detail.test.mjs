/**
 * Guard test — a past scan must open its OWN stored results.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Bailey (paying subscriber, co-creator) reported on July 31 2026 that tapping a
 * card under "Recent Scans" on the dashboard took her to the empty label-scanner
 * upload page instead of that scan's score and ingredients.
 *
 * The cause was in RecentScansWidget:
 *     const href = scan.product_id ? `/products/${scan.product_id}` : '/scan'
 *
 * Her Cetaphil cleanser is a Western product, so it has no row in our Korean
 * catalog and `product_id` was NULL — the card fell through to '/scan'. The
 * COSRX card "worked" but was also wrong: it opened the generic catalog page,
 * not the scan, discarding the safety score and 12 extracted ingredients the
 * card itself had just displayed.
 *
 * The deeper cause: no scan detail page had ever been built. The stored
 * analysis_result was, in the words of api/scan/route.ts, "read back by exactly
 * one thing: a count on a dashboard widget."
 *
 * WHY THESE TESTS EXECUTE INSTEAD OF GREPPING
 * A source-regex test passes against the broken code — `/scan/${scan.id}` and
 * `'/scan'` both contain "/scan". So test 1 transpiles the real component and
 * evaluates the actual href expression against the exact row shapes from the
 * live database (one NULL product_id, one populated). Revert the fix and it fails.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const WIDGET = join(root, 'src', 'components', 'dashboard', 'RecentScansWidget.tsx')
const API = join(root, 'src', 'app', 'api', 'scans', '[id]', 'route.ts')
const PAGE = join(root, 'src', 'app', '(app)', 'scan', '[id]', 'page.tsx')

/**
 * Pull the href assignment out of the real component and evaluate it.
 * The component imports React + a Supabase client at module scope, so we
 * extract the single expression rather than importing the module.
 */
function evalHrefFor(scan) {
  const src = readFileSync(WIDGET, 'utf8')

  const line = src.split('\n').find((l) => /const\s+href\s*=/.test(l))
  assert.ok(line, 'RecentScansWidget must assign a const href for each scan row')

  const expr = line.slice(line.indexOf('=') + 1).trim().replace(/;$/, '')
  const js = ts.transpileModule(`(function(scan){ return ${expr} })`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText

  return eval(js)(scan)
}

// The two rows exactly as they exist in ss_user_scans for Bailey's account.
const CETAPHIL = { id: 'd038fe0c-f597-43a5-b1fa-d1e4afa4f724', product_id: null }
const COSRX = { id: '2431c639-234b-4341-b2ae-6f1358b9bf73', product_id: '09dabfa8-b373-4006-9bbc-2393fb2743db' }

test('a non-catalog scan opens its own results, not the empty scanner', () => {
  const href = evalHrefFor(CETAPHIL)

  assert.notEqual(
    href, '/scan',
    'A scan with a NULL product_id must not fall back to the blank upload page — this is the exact bug Bailey hit.'
  )
  assert.equal(href, `/scan/${CETAPHIL.id}`)
})

test('a catalog scan opens the scan, not the generic product page', () => {
  const href = evalHrefFor(COSRX)

  assert.ok(
    !href.startsWith('/products/'),
    'A scan must open its own stored analysis, not the catalog page for the matched product.'
  )
  assert.equal(href, `/scan/${COSRX.id}`)
})

test('the href does not branch on product_id at all', () => {
  // Both shapes must land on the same route pattern. If a future change
  // reintroduces a catalog/scan branch, these diverge.
  const a = evalHrefFor(CETAPHIL)
  const b = evalHrefFor(COSRX)
  assert.equal(a.replace(CETAPHIL.id, 'ID'), b.replace(COSRX.id, 'ID'))
})

test('the scan detail route and page exist', () => {
  assert.ok(existsSync(API), 'GET /api/scans/[id] must exist for the card to lead anywhere')
  assert.ok(existsSync(PAGE), '/scan/[id] page must exist')
})

test('the API scopes the lookup to the requesting user', () => {
  const src = readFileSync(API, 'utf8')

  assert.match(src, /requireAuth/, 'scan detail must require auth')
  assert.match(
    src, /\.eq\(\s*['"]user_id['"]\s*,\s*user\.id\s*\)/,
    "the query must filter on user_id — otherwise any signed-in user could read another user's scan by id"
  )
  assert.match(src, /404/, 'a scan belonging to someone else must 404, not 403, so ids are not enumerable')
})

test('stale snapshot data is not replayed as current', () => {
  const src = readFileSync(API, 'utf8')

  // The stored enrichment blob holds pricing captured at scan time — one live
  // row quotes Soko Glam at $20.90 from July 26, and names YesStyle, a retailer
  // we do not recommend. Serving it as current pricing is the fake-confidence
  // class this codebase keeps paying for.
  assert.ok(
    !/enrichment:/.test(src),
    'the scan detail API must NOT return the stored enrichment blob as current data'
  )
})

test('a failed load cannot render as an empty scan', () => {
  const src = readFileSync(PAGE, 'utf8')

  // "nothing wrong" vs "nothing checked": a fetch failure must surface as an
  // error, never as a successfully-rendered page with no content.
  assert.match(src, /res\.status\s*===\s*404/, 'not-found must be distinguished from a transport failure')
  assert.match(src, /setError\(/, 'a non-ok response must set an error state')
})
