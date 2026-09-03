/**
 * Guard test — an ingredient search must surface products that NAME the
 * ingredient, not a rating-sorted window of unreviewed products.
 *
 * THE INCIDENT (Suzie, a real cold visitor, Sep 2 2026)
 *
 * A 55-year-old with melasma asked for tranexamic acid picks. Yuri's tool call
 * was correct and well-formed (include_ingredients: ["tranexamic acid"]), and
 * the price she quoted was accurate. She recommended the Anua Clear Tone Dark
 * Spot Serum at $55.00.
 *
 * The catalog also holds, unreturned:
 *   - Anua "Niacinamide 10% + TXA 4% Dark Spot Correcting Serum", $37.49,
 *     rating 4.70, 963 reviews — SAME BRAND, same two actives she recommended
 *   - Dermafactory "Tranexamic Acid 6% Cream", $9.50, rating 4.70, 68 reviews
 *
 * A $17.51 overquote at purchase intent, and the visitor acted on it.
 *
 * THE CAUSE
 *
 * The ingredient-candidate query ordered by `rating_avg DESC` and trimmed
 * SERVER-SIDE to limit*3 (15 rows max — `limit` is capped at 10). rating_avg is
 * a popularity signal with no bearing on whether a row matches the ingredient
 * asked for, and 359 verified products are rated 5.00 with ZERO reviews. So the
 * window filled with unreviewed 5.00s: measured against the live catalog, 7 of
 * the top 15 tranexamic rows had zero reviews, and BOTH name-carrying products
 * fell outside it.
 *
 * Systematic, not a one-off. Name-matching products present in the top 15:
 *   tranexamic acid   0 of 3
 *   niacinamide       0 of 58
 *   hyaluronic acid   0 of 134
 *   retinol           2 of 63
 *
 * This is the SAME defect class as tests/search-relevance-outranks-rating.test.mjs
 * (Aug 12), which fixed it for the admin search endpoint. It survived here in a
 * different code path — the repo's documented "killing one recommender is not
 * enough, grep the data source" pattern.
 *
 * WHY A SEPARATE QUERY RATHER THAN IN-MEMORY RE-RANKING
 *
 * The INCI candidate set can be enormous (measured: glycerin 4,794, niacinamide
 * 2,369, hyaluronic acid 1,674) and PostgREST silently caps at 1,000 rows —
 * verified live: asking for 2,000 niacinamide rows returns exactly 2,000 of
 * 2,369 under a raw limit, and the PostgREST default truncates lower. Over-
 * fetching to rank in memory walks straight into the repo's documented cap for
 * exactly the common ingredients. The name-match set is small by construction
 * (tranexamic 15, hyaluronic 134, glycerin 0) so it cannot truncate.
 *
 * These tests assert the SHAPE of the fix in source, because the query itself is
 * PostgREST and cannot be executed without the network. The behavioural proof is
 * recorded above from a live run against production.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'yuri', 'tools.ts'), 'utf8')

// Isolate the ingredient-widening block so an assertion cannot accidentally
// match identical-looking code elsewhere in this 2,800-line file — the
// "guard test scoped to the wrong region" failure this repo has shipped twice.
function ingredientBlock() {
  const start = src.indexOf('if (includeIngredients?.length) {')
  assert.ok(start > 0, 'ingredient-widening block not found')
  const end = src.indexOf("// Filter out men's-line products", start)
  assert.ok(end > start, 'end of ingredient-widening block not found')
  return src.slice(start, end)
}

test('a name-match pass exists and runs BEFORE the rating-ordered pass', () => {
  const block = ingredientBlock()
  const nameIdx = block.indexOf('name_en.ilike')
  const ratingIdx = block.lastIndexOf("order('rating_avg'")
  assert.ok(nameIdx > 0, 'no name-match query — products naming the ingredient will stay buried')
  assert.ok(
    nameIdx < ratingIdx,
    'the name-match pass must be collected BEFORE the rating-ordered pass, so name matches enter the candidate list first'
  )
})

test('the name pass is ordered by review_count, not by rating alone', () => {
  const block = ingredientBlock()
  assert.match(
    block,
    /order\('review_count'/,
    'the name pass must rank by review_count — ordering by rating alone is the exact bug: 359 verified products are rated 5.00 with ZERO reviews and would refill the window'
  )
})

test('tranexamic acid also searches the TXA abbreviation', () => {
  const block = ingredientBlock()
  // Both products Yuri missed abbreviate it. Searching only "tranexamic" finds
  // 3 products; including TXA finds 15.
  assert.match(block, /TXA/, 'must search the TXA abbreviation — most Korean products label it that way')
})

test('name-match candidates are merged into the SAME product list, not returned alone', () => {
  const block = ingredientBlock()
  assert.match(block, /nameFirst/, 'name-match results must be captured')
  // Both result sets must feed the SAME merge loop. Checked by position rather
  // than by exact formatting so a reflow cannot produce a false failure.
  const mergeIdx = block.indexOf('for (const c of')
  assert.ok(mergeIdx > 0, 'no merge loop found')
  const mergeStmt = block.slice(mergeIdx, block.indexOf('\n', block.indexOf('{', mergeIdx)))
  assert.ok(
    mergeStmt.includes('nameFirst') && mergeStmt.includes('ingCandidates'),
    `both passes must feed the same merge so the ingredient pass still contributes — a name-only result set would BREAK searches for ingredients nobody names a product after (glycerin: 4,794 products, 0 name matches). Saw: ${mergeStmt}`
  )
})

test('both passes still log their errors instead of reading as "no such product"', () => {
  const block = ingredientBlock()
  const errorLogs = block.match(/console\.error\(/g) || []
  assert.ok(
    errorLogs.length >= 2,
    `both candidate queries must log failures separately (found ${errorLogs.length}); a dead query that returns no rows is indistinguishable from "we do not carry this"`
  )
})

test('the ingredient pass is NOT deleted — it is the fallback for unnamed ingredients', () => {
  const block = ingredientBlock()
  assert.match(
    block,
    /ingCandidates/,
    'the original ingredient-driven pass must remain: for glycerin, hyaluronic-in-INCI-only, and any ingredient not in a product name, it is the ONLY source of candidates'
  )
})
