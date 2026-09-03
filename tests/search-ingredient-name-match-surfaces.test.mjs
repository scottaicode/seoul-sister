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

test('a name-match pass exists', () => {
  const block = ingredientBlock()
  assert.ok(block.indexOf('name_en.ilike') > 0, 'no name-match query — products naming the ingredient will stay buried')
})

test('THE INCIDENT: the combined set is ranked BEFORE the final trim', () => {
  // The binding defect, and the one my first fix (dcf29f3) MISSED. Suzie's call
  // carried a `query` AND include_ingredients, so smartProductSearch populated
  // `products` first and the widened rows were appended after. All five
  // name-path rows contained tranexamic in their INCI, survived the include
  // filter, and `slice(0, limit)` consumed every slot — the widened candidates
  // could never surface no matter how their own window was ordered. Verified
  // against her exact stored result: 5 of 5 rows survive, 0 slots free.
  //
  // So the ordering must happen on the COMBINED list, before the trim.
  const sliceIdx = src.indexOf('filtered.slice(0, limit)')
  assert.ok(sliceIdx > 0, 'final trim not found')
  const before = src.slice(0, sliceIdx)
  const rankIdx = before.lastIndexOf('namesIngredient')
  assert.ok(
    rankIdx > 0,
    'the combined candidate set must be relevance-ranked BEFORE filtered.slice(0, limit); ranking only the widening query leaves the incident reproducible'
  )
})

test('ranking damps rating by review count instead of trusting a bare 5.00', () => {
  assert.match(
    src,
    /export function dampedRating/,
    'a bare rating sort is the bug: 359 verified products are rated 5.00 with ZERO reviews'
  )
})

test('the name signal is synonym-aware — the headline product has no "tranexamic" in its name', () => {
  // "Niacinamide 10% + TXA 4% Dark Spot Correcting Serum" — verified in the DB:
  // name ILIKE '%tranexamic%' is FALSE, only '%TXA%' matches. A name check
  // without the synonym map misses the very product this fix exists to surface.
  assert.match(src, /INGREDIENT_NAME_SYNONYMS/, 'a synonym map must exist')
  assert.match(src, /'tranexamic acid':\s*\['TXA'\]/, 'TXA must map to tranexamic acid')
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

// --- executed behaviour, not source assertions -----------------------------

import ts from 'typescript'
const helperSrc = src.slice(
  src.indexOf('const INGREDIENT_NAME_SYNONYMS'),
  src.indexOf('async function executeSearchProducts(')
)
const helpers = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(helperSrc, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
    ).toString('base64')
)

test('EXECUTED: the exact incident ranking puts the cheaper same-brand product first', () => {
  const { ingredientNameTerms, dampedRating } = helpers
  // The five rows the incident actually returned, plus the widened rows.
  const rows = [
    { id: 'a', name_en: 'Double Vita Spot Toning Serum', rating_avg: 5.0, review_count: 2 },
    { id: 'b', name_en: 'Clear Tone Dark Spot Serum', rating_avg: 5.0, review_count: 237 },
    { id: 'c', name_en: 'Baekdango Rice Wine Dark Spot Corrector Ampoule', rating_avg: 5.0, review_count: 2 },
    { id: 'd', name_en: 'Vita C Teca Triple Blemish Patch', rating_avg: 5.0, review_count: 0 },
    { id: 'e', name_en: 'DW-EGF Vitamin C Boosting Ampoule 25', rating_avg: 5.0, review_count: 5 },
    { id: 'f', name_en: 'Niacinamide 10% + TXA 4% Dark Spot Correcting Serum', rating_avg: 4.7, review_count: 963 },
    { id: 'g', name_en: 'Tranexamic Acid 6% Cream', rating_avg: 4.7, review_count: 68 },
  ]
  const terms = new Set(['tranexamic acid'].flatMap(ingredientNameTerms).map((t) => t.toLowerCase()))
  const names = (p) => [...terms].some((t) => p.name_en.toLowerCase().includes(t))
  const sorted = [...rows].sort((a, b) => {
    const at = names(a) ? 1 : 0, bt = names(b) ? 1 : 0
    if (at !== bt) return bt - at
    const ar = dampedRating(a.rating_avg, a.review_count), br = dampedRating(b.rating_avg, b.review_count)
    if (ar !== br) return br - ar
    const arc = a.review_count ?? 0, brc = b.review_count ?? 0
    if (arc !== brc) return brc - arc
    return String(a.id).localeCompare(String(b.id))
  })
  const top5 = sorted.slice(0, 5).map((p) => p.name_en)
  assert.ok(
    top5.some((n) => n.includes('TXA 4%')),
    `the $37.49 Anua TXA serum must reach the top ${5}; got ${JSON.stringify(top5)}`
  )
  assert.ok(top5.some((n) => n.includes('Tranexamic Acid 6%')), 'the $9.50 cream must reach the top 5')
  assert.equal(sorted[0].name_en, 'Niacinamide 10% + TXA 4% Dark Spot Correcting Serum')
  // The $55 option must still be REACHABLE — Yuri owns the recommendation.
  assert.ok(top5.includes('Clear Tone Dark Spot Serum'), 'the pricier option must remain visible, not be suppressed')
})

test('EXECUTED: an unreviewed 5.00 lands mid-pack, neither promoted nor buried', () => {
  const { dampedRating } = helpers
  // 2,332 of 5,311 verified products have review_count 0 because reviews were
  // never imported. Burying them would violate tools.ts's own NULL-rating rule.
  assert.equal(dampedRating(5.0, 0), 4.5, 'an unreviewed 5.00 must fall back to the prior')
  assert.equal(dampedRating(null, 0), 4.5, 'an unrated product must sit at the prior, not at zero')
  assert.ok(dampedRating(4.7, 963) > dampedRating(5.0, 0), 'a well-reviewed 4.70 must outrank an unreviewed 5.00')
  assert.ok(dampedRating(5.0, 237) > dampedRating(4.7, 963), 'a well-reviewed 5.00 still outranks a well-reviewed 4.70')
})

test('EXECUTED: synonyms resolve in both directions', () => {
  const { ingredientNameTerms } = helpers
  assert.ok(ingredientNameTerms('tranexamic acid').map((t) => t.toLowerCase()).includes('txa'))
  assert.ok(ingredientNameTerms('hyaluronic acid').map((t) => t.toLowerCase()).includes('ha'))
  // Reverse: asked for the label name, find the INCI name.
  assert.ok(ingredientNameTerms('PDRN').map((t) => t.toLowerCase()).includes('sodium dna'))
})
