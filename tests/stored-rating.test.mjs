// A star rating is stored only with the number of reviews behind it.
// Nov 18 2026: 549 products held "rating X, 0 reviews" because the importer wrote an
// unknown count as zero, and a published post quoted one. Runs the real function.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const src = readFileSync(new URL('../src/lib/pipeline/stored-rating.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { storedRating } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('a rating with no review count is not stored', () => {
  for (const count of [null, undefined, 0, NaN, -3]) {
    assert.deepEqual(storedRating(5, count), { rating_avg: null, review_count: 0 })
  }
})

test('a rating with its count is stored as read', () => {
  assert.deepEqual(storedRating(4.7, 1158), { rating_avg: 4.7, review_count: 1158 })
  assert.deepEqual(storedRating(4.7, 12.6), { rating_avg: 4.7, review_count: 13 })
})

test('a count with no rating keeps the count', () => {
  assert.deepEqual(storedRating(null, 40), { rating_avg: null, review_count: 40 })
})

test('every writer of a product row goes through the rule, and none writes the pair by hand', () => {
  for (const file of ['batch-processor.ts', 'backfill-trending.ts']) {
    const code = readFileSync(new URL(`../src/lib/pipeline/${file}`, import.meta.url), 'utf8')
    const inserts = code.split(".from('ss_products')").slice(1).filter((part) => /^\s*\.(insert|upsert)\(/.test(part))
    assert.ok(inserts.length > 0, `${file}: no product insert found`)
    for (const part of inserts) {
      const body = part.slice(0, part.indexOf('})'))
      assert.match(body, /\.\.\.storedRating\(/, `${file}: a product insert does not use storedRating`)
      assert.doesNotMatch(body, /^\s*(rating_avg|review_count)\s*:/m, `${file}: a product insert writes rating or count by hand`)
    }
  }
})
