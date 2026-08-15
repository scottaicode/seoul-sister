/**
 * Guard test — delisted Olive Young products are flagged, never silently priced.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Aug 15 2026: of the six products Yuri recommended to a real visitor in Spain
 * at purchase intent, TWO were already gone from Olive Young Global — including
 * her #1 pick (Dr.G RTX Peptishot, quoted confidently at $35.23). Measured the
 * same day: 8 of our 30 most-reviewed OY products (27%) are delisted, while we
 * still advertise a price for every one of them.
 *
 * A stale price is recoverable — the shopper pays a bit more or less than we
 * said. An unbuyable product is a dead end: they follow the link and hit
 * nothing, having been told it was the best pick for their skin.
 *
 * THE THREE INVARIANTS, each a way this could go wrong:
 *
 *   1. delisted  -> in_stock:false. Otherwise the fix does nothing.
 *   2. ok        -> in_stock:true.  Olive Young RELISTS. Without an explicit
 *      restore, one bad reading would bury a live product forever — a transient
 *      condition made permanent, which is worse than the bug being fixed.
 *   3. error     -> NOTHING is written. A rate limit or timeout says nothing
 *      about the product. If an error could flip in_stock, one bad night could
 *      mark hundreds of live products dead. This is the assertion that matters
 *      most, and it is the one an author is most likely to get wrong.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'pipeline', 'olive-young-price-refresh.ts')

/**
 * Execute the REAL refresher. Its price lookup is stubbed via the module's
 * import, so we transpile with the import rewritten to an injected global —
 * this runs the actual update logic rather than asserting on source text.
 */
async function loadRefresher(priceLookup) {
  globalThis.__oyPriceLookup = priceLookup
  const src = readFileSync(SRC, 'utf8')
    .replace(/import type \{ SupabaseClient \}.*\n/, '')
    .replace(
      /import \{ fetchOliveYoungPrice \}.*\n/,
      'const fetchOliveYoungPrice = (...a) => globalThis.__oyPriceLookup(...a)\n'
    )
    .replace(/: SupabaseClient/g, '')
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** Records every .update() payload so we can assert on what was written. */
function fakeDb(rows) {
  const updates = []
  const priceRowsQuery = (isPopular) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lt: () => chain,
      gt: () => chain,
      order: () => chain,
      // Popular phase resolves to [] so only the sweep returns our rows —
      // keeps the test focused on the write behaviour, not phase selection.
      limit: () => Promise.resolve({ data: isPopular ? [] : rows, error: null }),
      update: (payload) => ({
        eq: (_c, id) => {
          updates.push({ id, payload })
          return Promise.resolve({ error: null })
        },
      }),
      insert: () => Promise.resolve({ error: null }),
      single: () => Promise.resolve({ data: { id: 'retailer-1' }, error: null }),
    }
    return chain
  }

  let priceQueryCount = 0
  return {
    updates,
    from: (table) => {
      if (table === 'ss_retailers') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'retailer-1' }, error: null }) }) }) }
      }
      if (table === 'ss_price_history') return { insert: () => Promise.resolve({ error: null }) }
      // First ss_product_prices call is phase 1 (popular), second is the sweep.
      const isPopular = priceQueryCount++ === 0
      return priceRowsQuery(isPopular)
    },
  }
}

const ROW = {
  id: 'price-1',
  product_id: 'prod-1',
  url: 'https://global.oliveyoung.com/product/detail?prdtNo=GA240422997',
  price_usd: '35.23',
  last_checked: '2026-04-07T00:00:00.000Z',
}

test('a delisted product is marked out of stock', async () => {
  const db = fakeDb([ROW])
  const { runOliveYoungPriceRefresh } = await loadRefresher(async () => ({ kind: 'delisted' }))
  const res = await runOliveYoungPriceRefresh(db, { limit: 5 })

  assert.equal(res.delisted, 1, 'the delisting must be counted')
  assert.equal(res.updated, 0, 'a delisted product has no price to update')
  assert.equal(db.updates.length, 1)
  assert.equal(db.updates[0].payload.in_stock, false,
    'a product Olive Young no longer carries must be flagged out of stock')
  assert.ok(db.updates[0].payload.last_checked, 'we genuinely looked today — stamp it')
  assert.equal(db.updates[0].payload.price_usd, undefined,
    'a delisted row must not have its price rewritten')
})

test('a live product is restored to in_stock — delisting must be reversible', async () => {
  const db = fakeDb([ROW])
  const { runOliveYoungPriceRefresh } = await loadRefresher(async () => ({
    kind: 'ok', priceUsd: 22.4, listPriceUsd: 32,
  }))
  const res = await runOliveYoungPriceRefresh(db, { limit: 5 })

  assert.equal(res.updated, 1)
  assert.equal(db.updates[0].payload.in_stock, true,
    'Olive Young relists; without an explicit restore a product stays buried forever')
  assert.equal(db.updates[0].payload.price_usd, 22.4)
})

test('a fetch ERROR writes nothing — a rate limit must not kill live products', async () => {
  const db = fakeDb([ROW])
  const { runOliveYoungPriceRefresh } = await loadRefresher(async () => ({
    kind: 'error', reason: 'HTTP 429',
  }))
  const res = await runOliveYoungPriceRefresh(db, { limit: 5 })

  assert.equal(res.fetchFailed, 1)
  assert.equal(res.delisted, 0, 'an error is not evidence the product is gone')
  assert.equal(db.updates.length, 0,
    'a transport failure must never write in_stock — one bad night would mark the catalog dead')
})

test('an all-delisted batch is NOT reported as a broken run', async () => {
  // The alert-fatigue trap: if a legitimately all-delisted batch counted as
  // failure, the Guardian alert would cry wolf and get ignored — which is how
  // the original 130-night silence happened in the first place.
  const db = fakeDb([ROW])
  const { runOliveYoungPriceRefresh } = await loadRefresher(async () => ({ kind: 'delisted' }))
  const res = await runOliveYoungPriceRefresh(db, { limit: 5 })

  assert.equal(res.scanned, res.delisted,
    'every scanned row was delisted; updated:0 here is correct, not a failure')
})

test('the cron reports a zero-update run as FAILED, not completed', async () => {
  // The 130-night defect itself: `status: 'completed'` was hardcoded, so total
  // failure looked identical to success. The Guardian's 48h pipeline check keys
  // on `status === 'failed'`, which is what escalates to the alert email.
  const route = readFileSync(
    join(__dirname, '..', 'src', 'app', 'api', 'cron', 'refresh-prices-olive-young', 'route.ts'),
    'utf8'
  )
  assert.ok(!/status:\s*'completed'\s*,/.test(route),
    'status must be conditional on the outcome, never hardcoded to completed')
  assert.match(route, /refreshedNothing\s*\?\s*'failed'\s*:\s*'completed'/,
    'a run that examined rows and updated none must be logged as failed')
  assert.match(route, /result\.delisted\s*<\s*result\.scanned/,
    'an all-delisted batch must be excluded from the failure condition')
})
