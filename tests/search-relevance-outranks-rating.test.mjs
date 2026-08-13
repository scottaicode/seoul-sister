/**
 * Guard test — an exact-name search must return the product, not its siblings.
 * Aug 12 2026.
 *
 * THE DEFECT
 *
 * /api/admin/products/search ordered by `rating_avg DESC NULLS LAST` and applied
 * `.limit()` SERVER-SIDE, so the candidate window was chosen by rating before
 * relevance was ever computed. An unrated product sorts dead last, so:
 *
 *   { query: "Atobarrier 365 Cream", limit: 5 }
 *
 * returned five SIBLINGS (Cream Mist, Hydro Soothing Cream Set, Cream Special
 * Set, Water-Bag Barrier Cream, Hydro Soothing Cream) and NOT "Atobarrier 365
 * Cream" itself, which has rating_avg IS NULL. It surfaced only at limit 20.
 *
 * Measured scope: 642 products (10.5% of catalog) are unrated; 572 carry INCI;
 * 355 have rated siblings positioned to bury them.
 *
 * WHY IT IS A SAFETY BUG, NOT A UX ONE
 *
 * LGAAS's grounding pre-flight calls this endpoint with small caps (per-name
 * limit 3). When it cannot find a product, findContradictedInciClaims hits
 * `if (!status) continue` — emitting NO contradiction and NO abstention. A draft
 * making a false claim about an unrated product produces total silence, which is
 * byte-identical to a draft that was checked and came back clean. Same
 * "nothing wrong vs nothing checked" class as the inci_complete defect.
 *
 * It is also how the original Atobarrier work order came to assert that a
 * product present since Feb 19 2026 was missing from the catalog.
 *
 * THE FIX: over-fetch, rank by relevance in code, THEN trim. rating_avg is
 * demoted to a sub-1 tiebreak that cannot cross a tier boundary.
 *
 * This test EXECUTES the real extracted scoreRelevance rather than asserting on
 * source text, and uses the ACTUAL production rows from the reproduction.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const ROUTE = ['src', 'app', 'api', 'admin', 'products', 'search', 'route.ts']

async function importSnippet(tsSource, filename) {
  const js = ts.transpileModule(tsSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-rank-'))
  const file = join(dir, filename)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

/** Lift the REAL scoreRelevance + its constants out of the route. */
async function loadScorer() {
  const src = read(...ROUTE)

  const consts = src.match(/const RELEVANCE_OVERFETCH[\s\S]*?const MIN_OVERFETCH = \d+/)
  const fn = src.match(/function scoreRelevance\([\s\S]*?\n\}/)
  assert.ok(consts, 'Could not find RELEVANCE_OVERFETCH/MIN_OVERFETCH in the search route.')
  assert.ok(
    fn,
    'Could not find scoreRelevance() in the search route. If it was renamed, update this ' +
      'test rather than deleting it — the invariant (exact name beats a higher-rated sibling) holds.'
  )

  const mod = await importSnippet(
    `${consts[0]}\nexport ${fn[0]}\nexport { RELEVANCE_OVERFETCH, MIN_OVERFETCH }`,
    'score.mjs'
  )
  return mod
}

/** Reproduce the route's rank-then-trim over a candidate set. */
function rank(mod, candidates, query, limit) {
  const terms = query.trim().split(/\s+/).filter(t => t.length > 1)
  return [...candidates]
    .map(p => ({ p, s: mod.scoreRelevance(p, query, terms) }))
    .sort((a, b) => b.s - a.s || (a.p.name_en || '').localeCompare(b.p.name_en || ''))
    .slice(0, limit)
    .map(x => x.p)
}

// The ACTUAL production rows from the reproduction. Ratings are the real values:
// the target is unrated, every sibling that buried it is rated 4.7-5.0.
const AESTURA = [
  { name_en: 'Atobarrier 365 Cream', brand_en: 'Aestura', rating_avg: null },
  { name_en: 'Atobarrier 365 Cream Mist', brand_en: 'Aestura', rating_avg: 4.9 },
  { name_en: 'Atobarrier 365 Hydro Soothing Cream Set', brand_en: 'Aestura', rating_avg: 4.9 },
  { name_en: 'Atobarrier365 Cream Special Set', brand_en: 'Aestura', rating_avg: 4.9 },
  { name_en: 'Atobarrier 365 Water-Bag Barrier Cream', brand_en: 'Aestura', rating_avg: 4.9 },
  { name_en: 'Atobarrier 365 Hydro Soothing Cream', brand_en: 'Aestura', rating_avg: 4.7 },
  { name_en: 'Atobarrier 365 Cleansing Milk', brand_en: 'Aestura', rating_avg: 5.0 },
  { name_en: 'Atobarrier 365 Foaming Cleanser', brand_en: 'Aestura', rating_avg: 5.0 },
]

test('an UNRATED exact-name match outranks every higher-rated sibling', async () => {
  const mod = await loadScorer()
  const top = rank(mod, AESTURA, 'Atobarrier 365 Cream', 5)

  assert.equal(
    top[0].name_en,
    'Atobarrier 365 Cream',
    `The exact-name product must rank FIRST despite rating_avg IS NULL. Got: ${top.map(p => p.name_en).join(' | ')}`
  )
})

test('the reported reproduction: limit 5 now CONTAINS the product', async () => {
  const mod = await loadScorer()
  const names = rank(mod, AESTURA, 'Atobarrier 365 Cream', 5).map(p => p.name_en)

  assert.ok(
    names.includes('Atobarrier 365 Cream'),
    'This is the exact LGAAS reproduction. Before the fix, limit 5 returned only siblings ' +
      `and the product appeared solely at limit 20. Got: ${names.join(' | ')}`
  )
})

test('a brand-qualified query still finds the product', async () => {
  const mod = await loadScorer()
  const top = rank(mod, AESTURA, 'Aestura Atobarrier 365 Cream', 5)

  assert.equal(
    top[0].name_en,
    'Atobarrier 365 Cream',
    'Callers commonly prefix the brand; "Aestura Atobarrier 365 Cream" must still resolve ' +
      `to the cream itself. Got: ${top.map(p => p.name_en).join(' | ')}`
  )
})

test('rating_avg still breaks ties BETWEEN equally-relevant matches', async () => {
  const mod = await loadScorer()
  // Two identically-named products differing only by rating.
  const tied = [
    { name_en: 'Barrier Cream', brand_en: 'BrandA', rating_avg: 3.0 },
    { name_en: 'Barrier Cream', brand_en: 'BrandA', rating_avg: 4.9 },
  ]
  const top = rank(mod, tied, 'Barrier Cream', 2)

  assert.equal(
    top[0].rating_avg,
    4.9,
    'Popularity must still order equally-relevant matches — the fix demotes rating to a ' +
      'tiebreak, it does not discard it.'
  )
})

test('rating can NEVER outrank a better relevance tier', async () => {
  const mod = await loadScorer()
  // Worst case: a perfectly-rated sibling vs an unrated exact match.
  const exact = mod.scoreRelevance(
    { name_en: 'Atobarrier 365 Cream', brand_en: 'Aestura', rating_avg: null },
    'Atobarrier 365 Cream',
    ['Atobarrier', '365', 'Cream']
  )
  const sibling = mod.scoreRelevance(
    { name_en: 'Atobarrier 365 Cream Mist', brand_en: 'Aestura', rating_avg: 5.0 },
    'Atobarrier 365 Cream',
    ['Atobarrier', '365', 'Cream']
  )

  assert.ok(
    exact > sibling,
    `Tier separation must be wide enough that a max rating (5.0) cannot close the gap. ` +
      `exact=${exact} sibling=${sibling}`
  )
})

test('over-fetch window is large enough for small caller limits', async () => {
  const mod = await loadScorer()
  // LGAAS's grounding pre-flight uses limit 3. 3 * OVERFETCH alone is too narrow
  // for a product buried under a dozen rated siblings, so MIN_OVERFETCH floors it.
  const windowForLimit3 = Math.max(3 * mod.RELEVANCE_OVERFETCH, mod.MIN_OVERFETCH)

  assert.ok(
    windowForLimit3 >= 50,
    `A limit-3 grounding call must still scan a wide candidate window; got ${windowForLimit3}.`
  )
})
