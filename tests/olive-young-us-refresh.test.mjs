/**
 * Guard tests — the Olive Young US monthly refresh must fail loudly, never quietly.
 *
 * Earned by the Olive Young Global refresher, which logged "completed" over total
 * failure for ~130 nights. Executes the real refresh against an in-memory DB stub
 * and a stubbed fetch.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'ss-oyus-refresh-'))
for (const f of ['olive-young-us', 'olive-young-us-refresh']) {
  const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'pipeline', `${f}.ts`), 'utf8')
    .replace("from './olive-young-us'", "from './olive-young-us.mjs'")
  writeFileSync(join(dir, `${f}.mjs`), ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText)
}
const { runOliveYoungUsRefresh, parseOyUsId, decideRefreshStatus } = await import(pathToFileURL(join(dir, 'olive-young-us-refresh.mjs')).href)

function fakeDb({ retailer = { id: 'R' }, rows = [] } = {}) {
  const updates = []
  const db = {
    updates,
    from(table) {
      const q = { table, filters: {}, patch: null }
      const chain = {
        select() { return chain },
        eq(k, v) { q.filters[k] = v; if (q.patch) { updates.push({ id: v, ...q.patch }); return Promise.resolve({ error: null }) } return chain },
        order() { return chain },
        maybeSingle: async () => ({ data: table === 'ss_retailers' ? retailer : null, error: null }),
        range: async (from) => ({ data: from === 0 ? rows : [], error: null }),
        update(patch) { q.patch = patch; return chain },
      }
      return chain
    },
  }
  return db
}
const json = (status, body) => async () => ({ status, ok: status < 400, json: async () => body })
const feed = (amount, soldout = false) => json(200, { data: { product_id: 'UA1', name: 'X', brand: { name: 'B' }, pricing: { price: { amount } }, is_soldout: soldout, has_variants: false } })

test('parseOyUsId reads only Olive Young US product urls', () => {
  assert.equal(parseOyUsId('https://us.oliveyoung.com/products/UA36240979'), 'UA36240979')
  assert.equal(parseOyUsId('https://global.oliveyoung.com/product/detail?prdtNo=GA1'), null)
  assert.equal(parseOyUsId(null), null)
})

test('a missing retailer row is reported, not returned as a clean zero', async () => {
  const r = await runOliveYoungUsRefresh(fakeDb({ retailer: null }), { budgetMs: 10000, fetchImpl: feed(1) })
  assert.equal(r.retailerMissing, true)
})

test('a price change is written and counted', async () => {
  const db = fakeDb({ rows: [{ id: 'p1', url: 'https://us.oliveyoung.com/products/UA1', price_usd: 30 }] })
  const r = await runOliveYoungUsRefresh(db, { budgetMs: 10000, fetchImpl: feed(38) })
  assert.equal(r.updated, 1)
  assert.equal(r.priceChanges, 1)
  assert.equal(db.updates[0].price_usd, 38)
  assert.equal(db.updates[0].in_stock, true)
})

test('a fetch ERROR never touches the row (a rate limit must not mark things sold out)', async () => {
  const db = fakeDb({ rows: [{ id: 'p1', url: 'https://us.oliveyoung.com/products/UA1', price_usd: 30 }] })
  const r = await runOliveYoungUsRefresh(db, { budgetMs: 10000, fetchImpl: json(429, {}) })
  assert.equal(r.fetchFailed, 1)
  assert.equal(r.updated, 0, 'scanned>0 && updated===0 is what the route logs as FAILED')
  assert.equal(db.updates.length, 0)
})

test('a listing that is gone is marked out of stock, price untouched', async () => {
  const db = fakeDb({ rows: [{ id: 'p1', url: 'https://us.oliveyoung.com/products/UA1', price_usd: 30 }] })
  const r = await runOliveYoungUsRefresh(db, { budgetMs: 10000, fetchImpl: json(404, {}) })
  assert.equal(r.gone, 1)
  assert.equal(db.updates[0].in_stock, false)
  assert.equal('price_usd' in db.updates[0], false)
})

test('run status: zero rows, nothing updated, or a missing retailer are all failures', () => {
  const base = { scanned: 3, updated: 3, priceChanges: 0, gone: 0, fetchFailed: 0, unparseable: 0, skipped: 0, retailerMissing: false }
  assert.equal(decideRefreshStatus(base).status, 'completed')
  assert.deepEqual(decideRefreshStatus({ ...base, scanned: 0, updated: 0 }), { status: 'failed', reason: 'no_rows' })
  assert.deepEqual(decideRefreshStatus({ ...base, updated: 0 }), { status: 'failed', reason: 'nothing_updated' })
  assert.deepEqual(decideRefreshStatus({ ...base, retailerMissing: true }), { status: 'failed', reason: 'retailer_missing' })
  const route = readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'cron', 'refresh-prices-olive-young-us', 'route.ts'), 'utf8')
  assert.match(route, /const \{ status, reason \} = decideRefreshStatus\(result\)/)
  assert.match(route, /^\s+status,$/m, 'the logged status must be the decided one')
  assert.match(route, /export \{ handler as GET \}/, 'Vercel cron sends GET')
})

test('no price or a listing that became multi-size leaves the row untouched', async () => {
  for (const body of [
    { data: { product_id: 'UA1', name: 'X', brand: { name: 'B' }, pricing: { price: { amount: 0 } }, is_soldout: false, has_variants: false } },
    { data: { product_id: 'UA1', name: 'X', brand: { name: 'B' }, pricing: { price: { amount: 12 } }, is_soldout: false, has_variants: true } },
  ]) {
    const db = fakeDb({ rows: [{ id: 'p1', url: 'https://us.oliveyoung.com/products/UA1', price_usd: 30 }] })
    const r = await runOliveYoungUsRefresh(db, { budgetMs: 10000, fetchImpl: json(200, body) })
    assert.equal(r.skipped, 1)
    assert.equal(db.updates.length, 0, 'last_checked must not move, or an old price reads as freshly verified')
  }
})
