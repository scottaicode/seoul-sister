/**
 * Guard test — a price refresh must update the existing row, never pile up duplicates.
 *
 * THE DEFECT (found Oct 21 2026). upsertPrice looked up the existing row with
 * .single(), which ERRORS when two rows exist; only `data` was destructured, so
 * the error read as "no row" and it inserted another. Every later run did the
 * same: one COSRX product reached 14 identical Soko Glam rows, which crowded the
 * other stores out of the LGAAS price endpoint (the same product came back with
 * 2, 3 or 4 stores depending on the query).
 *
 * Executes the real PriceMatcher.upsertPrice (type-only imports, so it transpiles
 * standalone) against an in-memory stub.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'pipeline', 'price-matcher.ts'), 'utf8')
const dir = mkdtempSync(join(tmpdir(), 'ss-upsert-'))
writeFileSync(join(dir, 'm.mjs'), ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)
const { PriceMatcher } = await import(pathToFileURL(join(dir, 'm.mjs')).href)

/** A stub that behaves like PostgREST: .single() errors on 2+ rows. */
function fakeDb(existingRows, { lookupError = null } = {}) {
  const calls = { inserts: [], updates: [] }
  const db = {
    calls,
    from(table) {
      let patch = null
      const chain = {
        select() { return chain },
        eq(k, v) { if (patch) { calls.updates.push({ id: v, ...patch }); return Promise.resolve({ error: null }) } return chain },
        order() { return chain },
        limit: async () => ({ data: lookupError ? null : existingRows.slice(0, 1), error: lookupError }),
        single: async () => existingRows.length === 1
          ? { data: existingRows[0], error: null }
          : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } },
        update(p) { patch = p; return chain },
        insert: async (row) => { if (table === 'ss_product_prices') calls.inserts.push(row); return { error: null } },
      }
      return chain
    },
  }
  return db
}

const match = { product_id: 'P', retailer_id: 'R', retailer: 'soko_glam', price_usd: 20.9, price_krw: null, url: 'https://sokoglam.com/x?_psid=new', in_stock: true }

test('with duplicate rows already present, it UPDATES the newest and inserts nothing', async () => {
  const db = fakeDb([{ id: 'newest', price_usd: 20.9 }, { id: 'older', price_usd: 20.9 }])
  const r = await new PriceMatcher().upsertPrice(db, match)
  assert.equal(r.action, 'update')
  assert.equal(db.calls.inserts.length, 0, 'a second row must never produce a third')
  assert.equal(db.calls.updates[0].id, 'newest')
})

test('with no row, it inserts once', async () => {
  const db = fakeDb([])
  const r = await new PriceMatcher().upsertPrice(db, match)
  assert.equal(r.action, 'insert')
  assert.equal(db.calls.inserts.length, 1)
})

test('a failed lookup throws instead of becoming an insert', async () => {
  const db = fakeDb([], { lookupError: { message: 'boom' } })
  await assert.rejects(new PriceMatcher().upsertPrice(db, match), /price lookup failed/)
  assert.equal(db.calls.inserts.length, 0)
})
