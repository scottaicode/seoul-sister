// What the blog generator is handed for each product (the LGAAS search endpoint).
// Nov 18 2026: it returned no product id and no review count, so drafts linked
// products to the general listing and quoted "5 out of 5" with nothing behind it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/app/api/admin/products/search/route.ts', import.meta.url), 'utf8')
const start = src.indexOf('const formatted = (products || []).map')
assert.ok(start > 0, 'response builder not found')
const builder = src.slice(start, src.indexOf('product.ingredients =', start))

test('each product carries the row it came from and its own page', () => {
  assert.match(builder, /^\s*id: p\.id,/m)
  assert.match(builder, /url: `https:\/\/www\.seoulsister\.com\/products\/\$\{p\.id\}`/)
})

test('a rating is returned only with its review count and whose reviews they are', () => {
  const ratingLine = builder.split('\n').find((l) => /^\s*rating:/.test(l)) ?? ''
  assert.match(ratingLine, /review_count/, 'rating is not tied to the review count')
  assert.doesNotMatch(builder, /^\s*rating: p\.rating_avg,/m)
  assert.match(builder, /^\s*review_count:/m)
  assert.match(builder, /^\s*rating_source:/m)
})

test('the query reads the review count', () => {
  assert.match(src, /const selectFields = '[^']*\breview_count\b/)
})
