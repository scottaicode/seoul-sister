/**
 * Guard test — product name resolution ranking (`resolveProductByName`).
 *
 * Prevents regression of the wrong-product substitution found in a live widget
 * conversation on 2026-07-19. A visitor at purchase intent asked Yuri to price
 * the "Celimax BHA pads"; `compare_prices` returned the **Celimax Makeup
 * Retouching Booster Pad** instead — a makeup prep pad, not an exfoliant.
 *
 * Two independent causes, both asserted here:
 *
 *  1. PLURAL. Every search strategy is substring ILIKE with no stemming. The
 *     catalog stores "…Toner Pad" (singular) but the query said "pads", so
 *     `name_en ILIKE '%pads%'` matched ZERO Celimax rows (verified against the
 *     live catalog) while `%pad%` matched six. The precise strategies (1.5 and
 *     2) therefore returned nothing and the query fell through to the
 *     last-resort ANY-term search.
 *
 *  2. RANKING. Among those loose candidates the sort was length-first, so
 *     "Celimax Makeup Retouching Booster Pad" (37 chars, matches neither "bha"
 *     nor "pad") beat "Celimax Ji Woo Gae Cica BHA Blemish Toner Pad" (45
 *     chars, matches both). The correct product lost by 8 characters and "BHA",
 *     the most discriminating token in the query, carried zero weight.
 *
 * The fixture below is the REAL Strategy-3 candidate set returned by the live
 * catalog for this query, so this test reproduces the production failure rather
 * than an idealized version of it.
 *
 * Pure logic assertions — no compile, no API, no DB. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const toolsSrc = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'yuri', 'tools.ts'),
  'utf8'
)

// ---------------------------------------------------------------------------
// Mirror of the shipped ranking logic. Kept in sync with tools.ts by the
// source assertions at the bottom of this file — if the real comparator changes
// shape, those fail loudly rather than letting this mirror drift silently.
// ---------------------------------------------------------------------------

const SEARCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'by', 'with', 'in', 'of', 'to',
  'my', 'me', 'is', 'it', 'do', 'you', 'have', 'this', 'that',
  'product', 'products', 'skincare', 'kbeauty', 'k-beauty', 'korean',
])

function singularize(term) {
  if (term.length > 4 && term.endsWith('es') && !term.endsWith('ses')) return term.slice(0, -2)
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return term
}

const termMatches = (haystack, term) =>
  haystack.includes(term) || haystack.includes(singularize(term))

const normalizePunct = (s) => s.toLowerCase().replace(/[-/_.]+/g, ' ')

function resolve(productName, results) {
  const queryLower = productName.toLowerCase()
  const queryNormalized = normalizePunct(productName)
  const terms = queryNormalized
    .split(/\s+/)
    .filter((t) => t.length > 1 && !SEARCH_STOP_WORDS.has(t))

  const combinedOf = (p) => normalizePunct(`${p.brand_en || ''} ${p.name_en || ''}`)
  const coverageOf = (p) => {
    const combined = combinedOf(p)
    return terms.filter((t) => termMatches(combined, t)).length
  }

  const allTermMatches = results.filter((p) => coverageOf(p) === terms.length)
  const candidates = [...(allTermMatches.length > 0 ? allTermMatches : results)]

  candidates.sort((a, b) => {
    const aCoverage = coverageOf(a)
    const bCoverage = coverageOf(b)
    if (aCoverage !== bCoverage) return bCoverage - aCoverage
    const aLen = `${a.brand_en || ''} ${a.name_en || ''}`.length
    const bLen = `${b.brand_en || ''} ${b.name_en || ''}`.length
    if (aLen !== bLen) return aLen - bLen
    return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
  })

  const chosen = candidates[0]
  const combinedLower = `${chosen.brand_en || ''} ${chosen.name_en || ''}`.toLowerCase()
  const combinedNormalized = normalizePunct(`${chosen.brand_en || ''} ${chosen.name_en || ''}`)

  let match_quality
  if (combinedLower.includes(queryLower)) match_quality = 'exact'
  else if (combinedNormalized.includes(queryNormalized)) match_quality = 'exact'
  else if (terms.length > 0 && terms.every((t) => termMatches(combinedNormalized, t)))
    match_quality = 'all_terms'
  else match_quality = 'partial'

  return { name: `${chosen.brand_en} ${chosen.name_en}`, match_quality }
}

// Real Strategy-3 candidate set for "Celimax BHA pads" (live catalog, 2026-07-20).
const CELIMAX_CANDIDATES = [
  { brand_en: 'Nightingale', name_en: 'Toning Peeling Pads Tea Tree', rating_avg: 5.0 },
  { brand_en: 'Celimax', name_en: 'Makeup Retouching Booster Pad', rating_avg: 5.0 },
  { brand_en: 'Dr.G', name_en: 'Red Blemish Radish Cica Icying Pads 60P Double Pack', rating_avg: 5.0 },
  { brand_en: 'Innisfree', name_en: 'Volcanic BHA Pore Cleansing Foam Double Pack', rating_avg: 5.0 },
  { brand_en: 'Celimax', name_en: 'Ji Woo Gae Cica BHA Blemish Toner Pad', rating_avg: 5.0 },
  { brand_en: 'Celimax', name_en: 'The Real Noni Acne Bubble Cleanser', rating_avg: 4.9 },
  { brand_en: 'Ariul', name_en: 'Apple Cider All Kill Cleansing Bubble Pads', rating_avg: 4.9 },
  { brand_en: 'Celimax', name_en: 'Brightening Pore+Dark Spot Sunscreen 50ml Set (+10ml)', rating_avg: 4.8 },
  { brand_en: 'Medicube', name_en: 'PDRN Pink Collagen Toning Gel Toner Pads', rating_avg: 4.8 },
  { brand_en: 'Aestura', name_en: 'A-Cica365 Cooling Relief Pads pH4.5', rating_avg: 4.8 },
]

test('the production failure: "Celimax BHA pads" resolves to the BHA pad, not the makeup pad', () => {
  const { name, match_quality } = resolve('Celimax BHA pads', CELIMAX_CANDIDATES)
  assert.equal(name, 'Celimax Ji Woo Gae Cica BHA Blemish Toner Pad')
  assert.notEqual(
    name,
    'Celimax Makeup Retouching Booster Pad',
    'regressed to the wrong-product substitution that shipped to a real visitor'
  )
  // A full-coverage hit must not be labeled 'partial' — compare_prices now
  // refuses to quote prices on 'partial', so mislabeling would dead-end the user.
  assert.equal(match_quality, 'all_terms')
})

test('coverage outranks length: a longer product matching more terms wins', () => {
  const { name } = resolve('Celimax BHA pad', [
    // Shorter, but matches only "celimax".
    { brand_en: 'Celimax', name_en: 'Booster Pad', rating_avg: 5.0 },
    // Longer, but matches all three terms.
    { brand_en: 'Celimax', name_en: 'Ji Woo Gae Cica BHA Blemish Toner Pad', rating_avg: 4.0 },
  ])
  assert.equal(name, 'Celimax Ji Woo Gae Cica BHA Blemish Toner Pad')
})

test('length still breaks ties at EQUAL coverage (the Goodal Cream-vs-Serum case)', () => {
  const { name } = resolve('Goodal Green Tangerine Vita C Serum', [
    { brand_en: 'Goodal', name_en: 'Green Tangerine Vita C Dark Spot Cream', rating_avg: 4.9 },
    { brand_en: 'Goodal', name_en: 'Green Tangerine Vita C Dark Spot Serum', rating_avg: 4.7 },
    { brand_en: 'Goodal', name_en: 'Green Tangerine Vita C Serum', rating_avg: 4.5 },
  ])
  // The exact-fitting Serum, not the higher-rated Cream.
  assert.equal(name, 'Goodal Green Tangerine Vita C Serum')
})

test('singularize strips plurals without mangling legitimate -ss / short words', () => {
  assert.equal(singularize('pads'), 'pad')
  assert.equal(singularize('serums'), 'serum')
  assert.equal(singularize('sunscreens'), 'sunscreen')
  // Must NOT strip: -ss words, or tokens short enough that the stem goes junk.
  assert.equal(singularize('glass'), 'glass')
  assert.equal(singularize('pass'), 'pass')
  assert.equal(singularize('is'), 'is')
  assert.equal(singularize('es'), 'es')
  // Substring matching makes the singular query -> plural catalog direction free.
  assert.ok(termMatches('toning peeling pads tea tree', 'pad'))
  assert.ok(termMatches('ji woo gae cica bha blemish toner pad', 'pads'))
})

// ---------------------------------------------------------------------------
// Source assertions — keep the mirror above honest against the real file.
// ---------------------------------------------------------------------------

test('tools.ts ranks by coverage BEFORE length', () => {
  const start = toolsSrc.indexOf('async function resolveProductByName(')
  assert.ok(start > 0, 'resolveProductByName not found — did it get renamed?')
  const body = toolsSrc.slice(start, start + 4000)

  const coverageIdx = body.indexOf('if (aCoverage !== bCoverage)')
  const lengthIdx = body.indexOf('if (aLen !== bLen)')
  assert.ok(coverageIdx > 0, 'coverage comparison missing from the comparator')
  assert.ok(lengthIdx > 0, 'length tiebreak missing from the comparator')
  assert.ok(
    coverageIdx < lengthIdx,
    'length is being compared before coverage — this is the exact bug that shipped the wrong product to a visitor'
  )
})

test('compare_prices refuses to quote prices on a partial match', () => {
  const start = toolsSrc.indexOf('async function executeComparePrices(')
  assert.ok(start > 0, 'executeComparePrices not found — did it get renamed?')
  const body = toolsSrc.slice(start, start + 2500)

  assert.ok(
    /match_quality === 'partial'/.test(body),
    'compare_prices no longer guards on partial matches — a weak name match can again quote a DIFFERENT product\'s price at purchase intent'
  )
  assert.ok(
    body.indexOf("match_quality === 'partial'") < body.indexOf('ss_product_prices'),
    'the partial-match guard must run BEFORE the price query, not after'
  )
})

test('search strategies match on the singular stem', () => {
  assert.ok(
    toolsSrc.includes('q.ilike(\'name_en\', `%${singularize(t)}%`)'),
    'Strategy 1.5 stopped stemming name terms — plural queries will silently miss again'
  )
  assert.ok(
    /const stem = singularize\(t\)/.test(toolsSrc),
    'Strategy 2 stopped stemming its OR clauses'
  )
})
