/**
 * Guard test — the Olive Young live price lookup.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * The nightly OY price refresher failed 100% for ~130 consecutive nights
 * (Jul 6 -> Aug 15 2026): `scanned: 40, updated: 0, fetchFailed: 40`, every run,
 * while logging `status: "completed"`. 4,889 of 4,917 Olive Young prices — ~96%
 * of ALL price data in the app — sat frozen at Apr 7, and Yuri quoted six of
 * them to a real buyer at purchase intent.
 *
 * ROOT CAUSE: `scrapeProductDetail` read the price from the rendered DOM via
 * `document.querySelector('.price-info')`. Olive Young moved the price to an
 * async XHR, so that selector no longer exists. A missing selector returned
 * null WITHOUT throwing — a silent null that looked exactly like success.
 *
 * WHY THESE ASSERTIONS AND NOT OTHERS
 * Each test below encodes a decision that was MEASURED against live Olive Young
 * on Aug 15 2026, not assumed:
 *
 *   saleAmt vs nrmlAmt — of 8 popular products, 6 were discounted. Beauty of
 *   Joseon Revive Eye Serum lists at $17.00 and sells at $13.89 while we stored
 *   $25.99. Storing the LIST price would silently re-introduce the overquote
 *   this whole change exists to fix, and every test would still pass. So the
 *   saleAmt-wins test is the single most load-bearing assertion in this file.
 *
 *   delisted vs error — 4 of 20 sampled products (20%) return an EMPTY body,
 *   stably across three separate rounds. That is real catalog churn, not a
 *   transient. Conflating it with a fetch error would either (a) mark healthy
 *   runs as failures and train the alert to be ignored, or (b) let a genuine
 *   parse regression hide behind "must be delisted." Both are the silent-failure
 *   class, so the distinction is asserted in both directions.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'pipeline', 'sources', 'olive-young-price-api.ts')

/** Execute the REAL module — a source-regex test passes against broken code. */
async function loadApi() {
  const js = ts.transpileModule(readFileSync(SRC, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/**
 * A real captured payload shape from global.oliveyoung.com/product/detail-data
 * (numbuzin No.5+ Vitamin Concentrated Serum, GA230518832, Aug 15 2026),
 * trimmed to the fields we read.
 */
const REAL_PAYLOAD = JSON.stringify({
  product: {
    prdtNo: 'GA230518832',
    prdtNameEn: 'numbuzin No.5 Glutatione Vitamin Concentrated Serum 30ml Set (+Pad 6P)',
    brandNameEn: 'numbuzin',
    nrmlAmt: 26.0,
    saleAmt: 17.17,
    sellStatCode: '10',
  },
})

test('reads the live sale price from a real payload', async () => {
  const { parseDetailData } = await loadApi()
  const out = parseDetailData(REAL_PAYLOAD)
  assert.equal(out.kind, 'ok')
  assert.equal(out.priceUsd, 17.17)
  assert.equal(out.listPriceUsd, 26.0)
})

test('saleAmt WINS over nrmlAmt — storing list price is the overquote bug', async () => {
  const { parseDetailData } = await loadApi()
  const out = parseDetailData(REAL_PAYLOAD)
  // The measured harm: our stored $25.20 vs a real $17.17. If this ever returns
  // 26.00 (the list price), we are quoting a shopper 51% more than they pay.
  assert.equal(out.priceUsd, 17.17, 'must return what the shopper PAYS, not the struck-through list price')
  assert.notEqual(out.priceUsd, 26.0)
})

test('an empty body means DELISTED, not a price of zero and not an error', async () => {
  const { parseDetailData } = await loadApi()
  // Verified stable across 3 rounds on 4 real prdtNos, incl. two products Yuri
  // recommended to the Aug 15 visitor.
  for (const body of ['', '   ', '\n']) {
    const out = parseDetailData(body)
    assert.equal(out.kind, 'delisted', `empty body ${JSON.stringify(body)} must read as delisted`)
    assert.equal(out.priceUsd, undefined, 'a delisted product must not carry a price')
  }
})

test('a live product with an unreadable price is an ERROR, never "delisted"', async () => {
  const { parseDetailData } = await loadApi()
  // This is the anti-masquerade assertion. If a future payload change drops
  // saleAmt, that is OUR parser breaking. Reporting it as "delisted" would let a
  // total parse regression look like ordinary catalog churn and suppress the
  // alert — the exact silent failure that cost 130 nights.
  const out = parseDetailData(JSON.stringify({ product: { prdtNo: 'X', nrmlAmt: 26.0 } }))
  assert.equal(out.kind, 'error', 'a real product record with no sale price is a parse failure, not a delisting')

  const both = parseDetailData(JSON.stringify({ product: { prdtNo: 'X' } }))
  assert.equal(both.kind, 'error')
})

test('malformed and junk prices are rejected rather than stored', async () => {
  const { parseDetailData } = await loadApi()
  assert.equal(parseDetailData('<!DOCTYPE html><html>').kind, 'error', 'an HTML error page is not a price')

  // Zero and negative are not real prices; they must not become a $0.00 quote.
  for (const bad of [0, -5]) {
    const out = parseDetailData(JSON.stringify({ product: { saleAmt: bad, nrmlAmt: bad } }))
    assert.equal(out.kind, 'error', `saleAmt ${bad} must not be treated as a valid price`)
  }
})

test('a string price is coerced (the API is not contractually typed)', async () => {
  const { parseDetailData } = await loadApi()
  const out = parseDetailData(JSON.stringify({ product: { saleAmt: '17.17', nrmlAmt: '26.00' } }))
  assert.equal(out.kind, 'ok')
  assert.equal(out.priceUsd, 17.17)
})

test('a non-200 response is an error and never a delisting', async () => {
  const { fetchOliveYoungPrice } = await loadApi()
  // Rate limiting / an outage must not be recorded as "Olive Young dropped this
  // product" — that would silently mark live products dead across a whole run.
  const fetchImpl = async () => ({ ok: false, status: 429, text: async () => '' })
  const out = await fetchOliveYoungPrice('GA123', { fetchImpl })
  assert.equal(out.kind, 'error')
  assert.match(out.reason, /429/)
})

test('a network throw is caught and reported as an error', async () => {
  const { fetchOliveYoungPrice } = await loadApi()
  const fetchImpl = async () => { throw new Error('ECONNRESET') }
  const out = await fetchOliveYoungPrice('GA123', { fetchImpl })
  assert.equal(out.kind, 'error')
  assert.match(out.reason, /ECONNRESET/)
})

test('the request posts the prdtNo as JSON to the detail-data endpoint', async () => {
  const { fetchOliveYoungPrice } = await loadApi()
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init }
    return { ok: true, status: 200, text: async () => REAL_PAYLOAD }
  }
  const out = await fetchOliveYoungPrice('GA230518832', { fetchImpl })
  assert.equal(out.kind, 'ok')
  assert.match(seen.url, /\/product\/detail-data$/)
  assert.equal(seen.init.method, 'POST')
  assert.deepEqual(JSON.parse(seen.init.body), { prdtNo: 'GA230518832' })
})

test('no browser is used — the Playwright path is what broke', async () => {
  // The regression this guards: someone "restores" the scraper-based lookup.
  // Playwright is both the failure mode (a missing selector returns a silent
  // null) and the reason the batch was capped at 40 rows/night.
  // Strip comments first — this file's own docs explain the Playwright history,
  // and matching prose instead of code is how a guard test fools itself.
  const code = readFileSync(SRC, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  assert.ok(!/playwright|OliveYoungScraper|launchBrowser/i.test(code),
    'price lookup must stay fetch-only; a browser reintroduces the silent-null failure')
})
