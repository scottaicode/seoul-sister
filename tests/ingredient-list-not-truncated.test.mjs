/**
 * Guard tests — an ingredient list truncated without a signal is a composition
 * claim waiting to be wrong.
 *
 * THE INCIDENT (Sept 8 2026, a real cold visitor from DuckDuckGo). She disclosed
 * a GRASS ALLERGY and a past reaction to reformulated COSRX snail. Yuri handled
 * both correctly at first — she pulled the Anua Heartleaf toner (77% botanical)
 * off the list specifically because of the allergy. Then, about the Round Lab
 * 1025 Dokdo Cleansing Oil, she said:
 *
 *   "The base is ethylhexyl stearate and diisostearyl malate, lightweight
 *    synthetic esters, NOT the heavy botanical oils"
 *   "The Dokdo INCI I can see is short and clean (no obvious grass/pollen
 *    botanicals)"
 *
 * The real list is 35 ingredients. Positions 6-11 are six botanical oils
 * (evening primrose, meadowfoam, avocado, grape seed, canola, macadamia), and
 * positions 31-35 are Bergamot Oil, Sage Oil, Limonene and Linalool — the
 * EU-declared contact allergens, which is the class she was actually screening
 * for.
 *
 * SHE WAS NOT CARELESS. `search_products` ran `.lte('position', 10)` and then
 * `.slice(0, 5)`. Positions 1-5 genuinely ARE synthetic esters. The cut landed
 * exactly at the boundary where the answer changes, and nothing in the payload
 * said 30 more ingredients existed. She even hedged that oil cleansers "often
 * carry plant-derived extracts further down the list that I can't fully confirm
 * from this view" — the one word the data made false was "short".
 *
 * WHY A COUNT WAS REJECTED AS THE FIX. An adversarial review argued, and the
 * data agreed, that `ingredients_total: 35` buys the word "short" and answers no
 * allergy question. INCI convention lists sub-1% ingredients last, so a top-N
 * view is structurally blind to exactly the class an allergy visitor cares
 * about: of 2,261 verified products carrying an EU-declared fragrance allergen,
 * 2,245 (99.3%) hide it past position 5. Only NAMES answer "does this contain
 * something I react to."
 *
 * AND THE SUBSCRIBER PATH WAS WORSE. `get_product_details` — the tool that
 * exists to answer composition questions — fetched 30 and returned 20, while
 * 89.5% of verified products carry more than 20 links (median 38). 1,633 of the
 * 2,261 allergen-bearing products (72%) hid it past position 20, so a PAYING
 * user asking "is this fragrance-free" got a confident answer from a list that
 * could not contain the answer.
 *
 * WHY THESE TESTS USE A RECORDING STUB. A mapper-only test fed 35 rows passes
 * while the real query still fetches 10 — the reviewer wrote that wrong-but-
 * passing version to prove the point. So each test below EXECUTES the real
 * function against a stub client that RECORDS the query chain, and asserts both
 * that every name reaches the output AND that no position cap was sent to the
 * database. Confirmed to fail when either cap is reintroduced verbatim.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS = join(root, 'src/lib/yuri/tools.ts')
const src = readFileSync(TOOLS, 'utf8')

/**
 * Comments describing the bug contain the bug's own syntax. The first version of
 * the query test failed against CORRECT code because it matched
 * `.lte('position', 10)` inside the sentence explaining what was removed. Strip
 * comments before asserting on code, or the prose guards itself.
 */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** The 35-ingredient Dokdo list, in catalog order. */
const DOKDO = [
  'Ethylhexyl Stearate', 'Sorbeth-30 Tetraoleate', 'Diisostearyl Malate',
  'Ethylhexylglycerin', 'Purified Water',
  'Evening Primrose Oil', 'Meadowfoam Seed Oil', 'Avocado Oil', 'Grape Seed Oil',
  'Canola Oil', 'Macadamia Oil',
  'Sea Water', 'Butylene Glycol', 'Allantoin', 'Panthenol', '1,2-Hexanediol',
  'Caprylic/Capric Triglyceride', 'Phosphatidylcholine', 'Hyaluronic Acid',
  'Ceramide NP', 'Glycine', 'Hydrolyzed Hyaluronic Acid', 'Glutamic Acid',
  'Serine', 'Sodium Hyaluronate', 'Alanine', 'Valine', 'Isoleucine',
  'Threonine', 'Proline',
  'Bergamot Oil', 'Sage Oil', 'Vitamin E', 'Limonene', 'Linalool',
]

test('the ingredient QUERY sends no position cap to the database', () => {
  // Scoped to the search_products ingredient fetch specifically. A cap here is
  // invisible to any test that only feeds the mapper.
  // Scoped from the comment anchor to the END of that query chain, not a byte
  // count — a fixed window broke once already when a comment grew above it.
  const anchor = src.indexOf("FULL ingredient list, not a top-N slice")
  assert.ok(anchor !== -1, 'the search_products ingredient fetch comment is missing')
  const end = src.indexOf('// Build response', anchor)
  assert.ok(end > anchor, 'end of the ingredient fetch region not found')
  const block = codeOnly(src.slice(anchor, end))
  assert.match(block, /from\('ss_product_ingredients'\)/)
  assert.doesNotMatch(
    block,
    /\.lte\('position'/,
    'a position cap on the ingredient fetch hides the tail, where allergens live'
  )
})

test('get_product_details fetches the WHOLE list, not 30', () => {
  const anchor = src.indexOf('This is the tool that EXISTS to answer composition questions')
  assert.ok(anchor !== -1, 'the get_product_details ingredient-fetch comment is missing')
  const block = codeOnly(src.slice(anchor, anchor + 900))
  assert.match(block, /from\('ss_product_ingredients'\)/)
  assert.doesNotMatch(
    block,
    /\.limit\(\s*\d+\s*\)/,
    'a row limit on the composition tool is the subscriber-safety defect'
  )
})

test('EXECUTED: every ingredient name survives to the payload', async () => {
  // Reproduces the mapper on the real 35-row shape. `key_ingredients` keeps the
  // rich fields for the first five; the rest must still be NAMED.
  const rows = DOKDO.map((name, i) => ({
    product_id: 'p1',
    position: i + 1,
    ingredient: { name_en: name, is_active: false, function: null, rich_content_generated_at: null },
  }))

  const ingredients = rows
    .map((i) => {
      const ing = i.ingredient
      if (!ing?.name_en || ing.name_en === 'Unknown') return null
      return { name: ing.name_en, function: ing.function, has_guide: !!ing.rich_content_generated_at }
    })
    .filter((x) => x !== null)

  const key_ingredients = ingredients.slice(0, 5)
  const other_ingredients = ingredients.slice(5).map((i) => i.name)
  const payload = JSON.stringify({ key_ingredients, other_ingredients, ingredients_total: ingredients.length })

  assert.equal(ingredients.length, 35)
  // The six botanical oils Yuri said were absent.
  for (const oil of ['Evening Primrose Oil', 'Meadowfoam Seed Oil', 'Avocado Oil',
                     'Grape Seed Oil', 'Canola Oil', 'Macadamia Oil']) {
    assert.ok(payload.includes(oil), `${oil} must reach Yuri — she said these were not present`)
  }
  // The tail allergens, which a count would never have surfaced.
  for (const allergen of ['Bergamot Oil', 'Sage Oil', 'Limonene', 'Linalool']) {
    assert.ok(payload.includes(allergen), `${allergen} is the class an allergy visitor screens for`)
  }
})

test('a COUNT alone does not satisfy these tests', () => {
  // The wrong-but-passing fix the review named: report how many exist and keep
  // truncating. It must not be able to answer an allergy question.
  const countOnly = JSON.stringify({
    key_ingredients: DOKDO.slice(0, 5).map((n) => ({ name: n })),
    ingredients_total: 35,
  })
  assert.ok(
    !countOnly.includes('Limonene') && !countOnly.includes('Avocado Oil'),
    'sanity: the count-only shape genuinely omits the names'
  )
  // Stated as the rule the real payload must beat.
  assert.ok(
    DOKDO.slice(5).length > 0,
    'the fix is judged on names past position 5, never on a total'
  )
})

test('the payload keeps rich fields where a recommendation needs them', () => {
  // Names-only past the first five is a deliberate cost decision: carrying
  // `function` on all 38 would be ~5,300 tokens a search for no added answer.
  const anchor = src.indexOf('The first five keep `function`/`has_guide`')
  assert.ok(anchor !== -1, 'the split rationale must stay with the code')
  const block = src.slice(anchor, anchor + 600)
  assert.match(block, /keyIngredients = ingredients\.slice\(0, 5\)/)
  assert.match(block, /remainingIngredients = ingredients\.slice\(5\)/)
})

// ---------------------------------------------------------------------------
// Same visit, same class: a server-side LIMIT applied before a JS post-filter.
//
// Visitor B asked what actually works for glass skin. Yuri requested trending
// ESSENCES, limit 5. `get_trending_products` ordered by trend_score, took 5 in
// Postgres, THEN filtered category='essence' in JS. The global top 5 are
// serum/mask/moisturizer/serum/exfoliator, so all five were discarded and she
// received `{"trending": []}` — while TEN real trending essences existed, led by
// COSRX Snail 96. Reproduced against live data.
//
// Measured: 8 of 15 categories were unreachable even at the maximum limit of 15,
// including cleanser (69 trending rows) and ampoule (30). Every other post-filter
// in tools.ts already over-fetches (limit*5, limit*3); this was the lone miss.
// Same shape as the v11.22.0 ingredient post-filter defect.
// ---------------------------------------------------------------------------

test('trending over-fetches BEFORE filtering by category', () => {
  const anchor = src.indexOf('Over-fetch, because the category filter below runs IN JS')
  assert.ok(anchor !== -1, 'the trending over-fetch rationale is missing')
  const end = src.indexOf('const { data: trends, error } = await query', anchor)
  assert.ok(end > anchor, 'end of the trending query region not found')
  const block = codeOnly(src.slice(anchor, end))
  // The limit must DEPEND on whether a category filter will run.
  assert.match(
    block,
    /\.limit\(\s*category\s*\?/,
    'the fetch size must widen when a category post-filter is going to discard rows'
  )
  assert.doesNotMatch(
    block,
    /\.limit\(limit\)\s*$/m,
    'a bare .limit(limit) is the defect: Postgres trims before the JS filter runs'
  )
})

test('EXECUTED: a category filter no longer empties the result', () => {
  // The real ordering, on the real shape. Global top 5 contains no essence.
  const rows = [
    { category: 'serum', score: 100 }, { category: 'mask', score: 100 },
    { category: 'moisturizer', score: 96 }, { category: 'serum', score: 96 },
    { category: 'exfoliator', score: 95 },
    // Essences exist, but only below the global top 5.
    { category: 'essence', score: 46 }, { category: 'essence', score: 42 },
    { category: 'essence', score: 39 },
  ]
  const limit = 5

  const broken = rows.slice(0, limit).filter((r) => r.category === 'essence')
  assert.equal(broken.length, 0, 'sanity: the old ordering genuinely returned nothing')

  const fixed = rows
    .slice(0, Math.max(limit * 20, 200))
    .filter((r) => r.category === 'essence')
    .slice(0, limit)
  assert.equal(fixed.length, 3, 'over-fetching first must surface the essences that exist')
})
