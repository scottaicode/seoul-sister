/**
 * Guard tests: Strategy 2.5, the sunscreen-vocabulary retry (Sep 28 2026).
 *
 * A visitor from our BoJ Aqua Fresh review got Relief Sun: Rice + Probiotics
 * because Yuri's query said "sunscreen" and the catalog name does not. These
 * EXECUTE the real smartProductSearch against a PostgREST-shaped fake with a
 * crowded rating-ordered window, which is the production failure shape. Each
 * was confirmed to FAIL with the fix reverted.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const TOOLS = join(root, 'src', 'lib', 'yuri', 'tools.ts')

function sliceDecl(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  // Start at the BODY brace, not the first '{'. The signature contains an
  // inline type literal (`options?: { category?: string ... }`), so naive
  // first-brace counting closes on the type and returns a truncated slice —
  // which imports cleanly and exports NOTHING, i.e. a silent no-op test.
  const sigEnd = src.indexOf('{\n', src.indexOf('(', start))
  let d = 0, j = sigEnd
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return src.slice(start, j + 1)
}

/** Slice a `const X ... = { ... }` object literal (sliceConst scans for `[`). */
function sliceObjectConst(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('{', start)
  let d = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '{') d++
    else if (src[i] === '}') { d--; if (!d) break }
  }
  return src.slice(start, i + 1)
}

function sliceConst(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const open = src.indexOf('[', start)
  let d = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '[') d++
    else if (src[i] === ']') { d--; if (!d) break }
  }
  return src.slice(start, src.indexOf('\n', i))
}

async function loadSearch() {
  const src = readFileSync(TOOLS, 'utf8')
  const mod = [
    sliceConst(src, 'const SEARCH_STOP_WORDS = new Set(['),
    sliceConst(src, 'const GENERIC_PRODUCT_WORDS = new Set(['),
    sliceDecl(src, 'function singularize('),
    // Added Aug 19 2026: the SQL predicates call normalizeTerm(), which wraps
    // singularize() with the catalog word-form map (milky->milk,
    // cleanser->cleans). Omitting these makes the transpiled module throw
    // "normalizeTerm is not defined" — a harness gap that looks like a
    // behavior failure.
    sliceObjectConst(src, 'const WORD_FORM_STEMS'),
    sliceDecl(src, 'function wordFormStem('),
    sliceDecl(src, 'function normalizeTerm('),
    sliceDecl(src, 'function termMatches('),
    sliceDecl(src, 'async function smartProductSearch('),
  ].join('\n\n') + '\nexport { smartProductSearch }\n'
  const js = ts.transpileModule(mod, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** PostgREST-shaped fake supporting the chain smartProductSearch uses. */
function fakeDb(rows) {
  const norm = (s) => (s || '').toLowerCase()
  const like = (v, p) => norm(v).includes(p.replace(/%/g, '').toLowerCase())
  return {
    from() {
      let set = rows.slice()
      let lim = Infinity
      const q = {
        select: () => q,
        eq(c, v) { set = set.filter((r) => r[c] === v); return q },
        ilike(c, p) { set = set.filter((r) => like(r[c], p)); return q },
        or(clauses) {
          // Split on the FIRST two dots only: real PostgREST accepts a quoted
          // pattern containing dots ("%no.1 %"), and a naive split('.')
          // mangles it, which made a correct line-number predicate look broken.
          const preds = clauses.split(',').map((c) => {
            const m = /^([^.]+)\.([^.]+)\.(.*)$/.exec(c)
            return { col: m ? m[1] : c, pattern: (m ? m[3] : '').replace(/"/g, '') }
          })
          set = set.filter((r) => preds.some((p) => like(r[p.col], p.pattern)))
          return q
        },
        order(col, opts) {
          const dir = opts?.ascending === false ? -1 : 1
          set = set.map((r, i) => ({ r, i })).sort((a, b) => {
            const av = a.r[col] ?? -Infinity, bv = b.r[col] ?? -Infinity
            if (av !== bv) return (av - bv) * dir
            return a.i - b.i
          }).map((x) => x.r)
          return q
        },
        limit(n) { lim = n; return Promise.resolve({ data: set.slice(0, lim), error: null }) },
        then(res) { return Promise.resolve({ data: set.slice(0, lim), error: null }).then(res) },
      }
      return q
    },
  }
}


// A window-crowding pool: many higher-rated rows that share the query's loose
// words, so the rating-ordered LIMIT windows of Strategies 2 and 3 never fetch
// the target. That is the production shape (~600 verified names contain
// "sun"). Built from each test's own words: a crowd that shares no words with
// the query crowds nothing, and the test would pass with the fix removed.
function crowd(n, words, category = 'sunscreen') {
  return Array.from({ length: n }, (_, i) => ({
    id: `crowd-${i}`, brand_en: `Crowd Brand ${i % 7}`,
    name_en: `${words} Filler ${i}`, category,
    is_verified: true, rating_avg: 5.0, review_count: 10,
  }))
}

const BOJ = [
  ...crowd(300, 'Beauty Relief Sun Aqua Fresh'),
  { id: 'boj-rice', brand_en: 'Beauty of Joseon', name_en: 'Relief Sun: Rice + Probiotics SPF50+ PA++++', category: 'sunscreen', is_verified: true, rating_avg: 5.0, review_count: 1 },
  { id: 'boj-aqua', brand_en: 'Beauty of Joseon', name_en: 'Relief Sun Aqua Fresh Rice+B5', category: 'sunscreen', is_verified: true, rating_avg: 4.9, review_count: 2219 },
  { id: 'boj-kit', brand_en: 'Beauty of Joseon', name_en: 'Hanbang Serum Discovery Kit', category: 'serum', is_verified: true, rating_avg: 5.0, review_count: 50 },
]

test('Aqua Fresh: a sunscreen named with the word "sunscreen" resolves to itself, not a sibling', async () => {
  const { smartProductSearch } = await loadSearch()
  const rows = await smartProductSearch(fakeDb(BOJ), 'Beauty of Joseon Relief Sun Aqua Fresh sunscreen', { limit: 5 })
  assert.ok(rows.length > 0, 'must return something')
  assert.equal(rows[0].id, 'boj-aqua', `expected Aqua Fresh, got "${rows[0].name_en}"`)
  for (const r of rows) assert.equal(r.brand_en, 'Beauty of Joseon', `no other brand may appear (got ${r.brand_en})`)
})

test('it also works when Yuri passes category="sunscreen" herself', async () => {
  const { smartProductSearch } = await loadSearch()
  const rows = await smartProductSearch(fakeDb(BOJ), 'Beauty of Joseon Relief Sun Aqua Fresh sunscreen', { limit: 5, category: 'sunscreen' })
  assert.equal(rows[0]?.id, 'boj-aqua', `expected Aqua Fresh, got "${rows[0]?.name_en}"`)
})

test('a category noun in the NAME ("Sun Gel") does not switch the retry off', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Hyaluronic Acid Watery Sun Gel'),
    { id: 'phys', brand_en: 'Physiogel', name_en: 'Cica Balance Pore Solution Sunscreen', category: 'sunscreen', is_verified: true, rating_avg: 5.0, review_count: 5 },
    { id: 'isn-gel', brand_en: 'Isntree', name_en: 'Hyaluronic Acid Watery Sun Gel', category: 'sunscreen', is_verified: true, rating_avg: 4.7, review_count: 1207 },
    { id: 'isn-stick', brand_en: 'Isntree', name_en: 'Hyaluronic Acid Airy Sun Stick', category: 'sunscreen', is_verified: true, rating_avg: 4.9, review_count: 0 },
  ])
  const rows = await smartProductSearch(db, 'Isntree Hyaluronic Acid Watery Sun Gel sunscreen', { limit: 5 })
  assert.equal(rows[0]?.id, 'isn-gel', `expected the Watery Sun Gel, got "${rows[0]?.name_en}"`)
})

test('the retry never pre-empts an exact match, under a production-sized crowd', async () => {
  // Placed right after Strategy 1.5, the retry returned the Sun Stick here.
  // The first version of this test had no crowd, so it exercised a Strategy 2
  // path production never reaches at limit 5 and stayed green over the bug.
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(60, 'Moisturizing Sun Cream'), // >25 (Strategy 2's window at limit 5) and <100 (Strategy 3's): the production shape. Generic words only; "birch juice" is Round Lab's alone.
    { id: 'rl-stick', brand_en: 'Round Lab', name_en: 'Birch Juice Moisturizing Sun Stick', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 1067 },
    { id: 'rl-exact', brand_en: 'Round Lab', name_en: 'Birch Juice Moisturizing Sunscreen', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 1113 },
  ])
  const rows = await smartProductSearch(db, 'Round Lab Birch Juice Moisturizing Sunscreen SPF50', { limit: 5 })
  assert.equal(rows[0]?.id, 'rl-exact', `expected the exact name first, got "${rows[0]?.name_en}"`)
})

test('the retry requires the category: a same-named non-sunscreen never wins', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Hyaluronic Acid Watery Sun Gel'),
    { id: 'isn-moist', brand_en: 'Isntree', name_en: 'Hyaluronic Acid Watery Sun Gel', category: 'moisturizer', is_verified: true, rating_avg: 4.9, review_count: 5000 },
    { id: 'isn-sun', brand_en: 'Isntree', name_en: 'Hyaluronic Acid Watery Sun Gel SPF50+', category: 'sunscreen', is_verified: true, rating_avg: 4.7, review_count: 1207 },
  ])
  const rows = await smartProductSearch(db, 'Isntree Hyaluronic Acid Watery Sun Gel sunscreen', { limit: 5 })
  assert.equal(rows[0]?.id, 'isn-sun', `expected the sunscreen, got "${rows[0]?.name_en}" (${rows[0]?.category})`)
})

test('the retry requires every name word: an uncarried product is not bound to a sibling', async () => {
  // Isntree makes a Watery Sun Gel and an Onion Newpair Sunscreen. A query
  // for a product we do not carry must not come back as either with the
  // retry's confidence. (A second-model review showed deleting the name-word
  // loop passed every test in the first version of this file.)
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Mugwort Calming Stick'),
    { id: 'isn-gel', brand_en: 'Isntree', name_en: 'Hyaluronic Acid Watery Sun Gel', category: 'sunscreen', is_verified: true, rating_avg: 4.7, review_count: 1207 },
    { id: 'isn-onion', brand_en: 'Isntree', name_en: 'Onion Newpair Sunscreen', category: 'sunscreen', is_verified: true, rating_avg: 4.6, review_count: 52 },
  ])
  const rows = await smartProductSearch(db, 'Isntree Mugwort Calming Sun Stick sunscreen', { limit: 5 })
  assert.ok(!['isn-gel', 'isn-onion'].includes(rows[0]?.id),
    `an uncarried product must not resolve to a different Isntree sunscreen (got "${rows[0]?.name_en}")`)
})

test('a query naming a second product type ("serum sunscreen") stands the retry down', async () => {
  // "Torriden Dive In serum sunscreen" names two products. The review found
  // the retry turning it into the Sun Serum Set. It must behave as before.
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(60, 'Dive Serum', 'serum'), // enough to push both out of Strategy 2's 25-row window
    { id: 'tor-serum', brand_en: 'Torriden', name_en: 'DIVE-IN Low Molecular Hyaluronic Acid Serum', category: 'serum', is_verified: true, rating_avg: 5.0, review_count: 1 },
    { id: 'tor-sunset', brand_en: 'Torriden', name_en: 'Dive In Watery Fit Sun Serum Set', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 27 },
  ])
  const rows = await smartProductSearch(db, 'Torriden Dive In serum sunscreen', { limit: 5 })
  assert.notEqual(rows[0]?.id, 'tor-sunset', 'the retry must not convert a two-product query into a sunscreen set')
})

test('a single listing ranks before its multi-unit sibling', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Madecassoside Sun'),
    { id: 'med-trio', brand_en: 'Mediheal', name_en: 'Madecassoside Sun Serum Trio', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 40 },
    { id: 'med-single', brand_en: 'Mediheal', name_en: 'Madecassoside Moisture Sun Serum Blemish Repair', category: 'sunscreen', is_verified: true, rating_avg: 4.9, review_count: 700 },
  ])
  const rows = await smartProductSearch(db, 'Mediheal madecassoside sunscreen SPF50', { limit: 5 })
  assert.equal(rows[0]?.id, 'med-single', `expected the single listing first, got "${rows[0]?.name_en}"`)
})

test('the retry keeps the line-number identity: No.1 never resolves to No.3', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Tone Up Base'),
    { id: 'nb3', brand_en: 'numbuzin', name_en: 'No.3 Porcelain Base-skip Tone Up Beige', category: 'sunscreen', is_verified: true, rating_avg: 5.0, review_count: 900 },
    { id: 'nb1', brand_en: 'numbuzin', name_en: 'No.1 Clear Filter Tone Up Base', category: 'sunscreen', is_verified: true, rating_avg: 4.5, review_count: 100 },
  ])
  const rows = await smartProductSearch(db, 'numbuzin No.1 tone up base sunscreen SPF50', { limit: 5 })
  assert.ok(rows.length > 0, 'must return something')
  assert.equal(rows[0].id, 'nb1', `expected No.1, got "${rows[0].name_en}"`)
  assert.ok(!rows.some((r) => r.id === 'nb3'), 'a No.3 row must never satisfy a No.1 query')
})

// ---- Round 2: each test below exists because a second-model review showed a
// WEAKENED (not deleted) mechanism passed every test above.

test('a routine-step word in the name ("Blue", "Water", "Daily") does not stand the retry down', async () => {
  // Also binds the split "SPF 50+" handling: the row carries no "50", so if
  // the number stayed a required name word the retry would find nothing.
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Mid Day Blue UV Shield'),
    { id: 'klairs', brand_en: 'Klairs', name_en: 'Mid-Day Blue UV Shield', category: 'sunscreen', is_verified: true, rating_avg: 4.5, review_count: 900 },
  ])
  const rows = await smartProductSearch(db, 'Klairs Mid-Day Blue UV Shield sunscreen SPF 50+', { limit: 5 })
  assert.equal(rows[0]?.id, 'klairs', `expected the Klairs shield, got "${rows[0]?.name_en}"`)
})

test('"cream and sunscreen" stands the retry down (not only "serum")', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(60, 'Heartleaf Cream', 'moisturizer'),
    { id: 'anua-cream', brand_en: 'Anua', name_en: 'Heartleaf 70 Intense Calming Cream', category: 'moisturizer', is_verified: true, rating_avg: 4.9, review_count: 3000 },
    { id: 'anua-sun', brand_en: 'Anua', name_en: 'Heartleaf Real Sun Protection Cream', category: 'sunscreen', is_verified: true, rating_avg: 4.7, review_count: 400 },
  ])
  const rows = await smartProductSearch(db, 'Anua heartleaf cream and sunscreen', { limit: 5 })
  assert.notEqual(rows[0]?.id, 'anua-sun', 'a two-product query must not be answered with the retry\'s sunscreen')
})

test('any multi-unit word ranks after the single, not just "Trio"', async () => {
  const { smartProductSearch } = await loadSearch()
  const db = fakeDb([
    ...crowd(300, 'Sun Project Water Sun Cream'),
    { id: 'tyf-set', brand_en: 'Thank You Farmer', name_en: 'Sun Project Water Sun Cream Set', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 50 },
    { id: 'tyf-dbl', brand_en: 'Thank You Farmer', name_en: 'Sun Project Water Sun Cream Double Pack', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 50 },
    { id: 'tyf-single', brand_en: 'Thank You Farmer', name_en: 'Sun Project Water Sun Cream SPF50+ PA+++', category: 'sunscreen', is_verified: true, rating_avg: 4.8, review_count: 6800 },
  ])
  const rows = await smartProductSearch(db, 'Thank You Farmer Sun Project Water Sun Cream sunscreen', { limit: 5 })
  assert.equal(rows[0]?.id, 'tyf-single', `expected the single listing, got "${rows[0]?.name_en}"`)
})

test('the ranking sees candidates beyond the first `limit` rows fetched', async () => {
  // Ten same-brand variants arrive before the row that also carries "SPF50".
  // Fetching only `limit` rows would never see it.
  const { smartProductSearch } = await loadSearch()
  const variants = Array.from({ length: 10 }, (_, i) => ({
    id: `isn-v${i}`, brand_en: 'Isntree', name_en: `Watery Sun Gel ${i}`, category: 'sunscreen', is_verified: true, rating_avg: 4.5, review_count: 5,
  }))
  const db = fakeDb([
    ...crowd(300, 'Watery Sun Gel'),
    ...variants,
    { id: 'isn-spf', brand_en: 'Isntree', name_en: 'Watery Sun Gel SPF50', category: 'sunscreen', is_verified: true, rating_avg: 4.5, review_count: 1207 },
  ])
  const rows = await smartProductSearch(db, 'Isntree Watery Sun Gel sunscreen SPF50', { limit: 5 })
  assert.equal(rows[0]?.id, 'isn-spf', `expected the SPF50 row, got "${rows[0]?.name_en}"`)
})
