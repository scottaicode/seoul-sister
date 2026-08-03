/**
 * Guard test — duplicate catalog listings are surfaced as a FACT, never auto-picked.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Aug 3 2026, a real cold visitor from tropical Vijayawada with oily skin and a deeper
 * skin tone. Yuri reasoned well — chemical filters over mineral to avoid white cast,
 * light hydration for humidity — and recommended the SKIN1004 Hyalu-Cica Water-Fit Sun
 * Serum at "~$22.10 at Olive Young Global."
 *
 * The advice was right. The PRICE was the wrong row. The catalog carries that serum four
 * times:
 *     $15.50 / 5,800 reviews   <- what she should have quoted
 *     $16.00 / 3,400 reviews
 *     $22.10 /     0 reviews   <- what she quoted
 *     (Twin Pack) / 0 reviews
 * A 43% overquote at the exact moment a visitor decides whether to buy, on a platform
 * whose pitch is price transparency.
 *
 * WHY THIS IS A FACT AND NOT A RULE — the part that matters
 * The obvious fix is "prefer the highest-review row." It was built and MEASURED against
 * the live catalog before shipping, and it is WRONG. Most near-name pairs are genuinely
 * different products:
 *     Real Barrier "Extreme Cream Ampoule"      vs "Extreme Cream"
 *     Real Barrier "Extreme Cream Light"        vs "Extreme Cream"
 *     Heimish      "All Clean Balm Mandarin"    vs "All Clean Balm"
 *     Round Lab    "...Cream Refill Pack"       vs "...Cream"
 * Auto-preferring the popular row would quote a single-unit price for a two-pack, or a
 * cream's price for an ampoule — worse than the bug it fixes. Identical-INCI was also
 * tried as a discriminator and fails: the SKIN1004 rows differ by 35 characters while
 * being the same product.
 *
 * No deterministic rule separates "duplicate listing" from "different SKU" in this data.
 * That is exactly the call a model should make and a regex should not. So the tool
 * surfaces the sibling rows with their review counts and hands the judgment to Yuri.
 * Per CLAUDE.md: when a classifier needs repeated hand-tuning, that is the signal to
 * stop, not to keep adjusting.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'yuri', 'tools.ts')

function sliceFn(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, `expected "${signature}"`)
  const parenStart = src.indexOf('(', start)
  let pd = 0, i = parenStart
  for (; i < src.length; i++) {
    if (src[i] === '(') pd++
    else if (src[i] === ')') { pd--; if (!pd) break }
  }
  const bodyStart = src.indexOf('{', i)
  let d = 0, j = bodyStart
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  return src.slice(start, j + 1)
}

/** Execute the real matcher by transpiling the function out of tools.ts. */
async function loadAttach() {
  const src = readFileSync(SRC, 'utf8')
  const fn = sliceFn(src, 'async function attachSiblingListings(')
    .replace(/: SupabaseClient/g, '')
    .replace(/: Array<Record<string, unknown>>/g, '')
    .replace(/: Promise<Array<Record<string, unknown>>>/g, '')
  const js = ts.transpileModule(fn + '\nexport { attachSiblingListings }\n', {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText
  return await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

/** Minimal db stub returning the given rows for the .in('brand_en', …) lookup. */
function fakeDb(rows, { error = null } = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: error ? null : rows, error }),
        }),
      }),
    }),
  }
}

// The four real SKIN1004 rows, verbatim from the catalog.
const SKIN1004_ROWS = [
  { id: 'a', brand_en: 'SKIN1004', name_en: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++', price_usd: '15.50', review_count: 5800 },
  { id: 'b', brand_en: 'SKIN1004', name_en: 'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++', price_usd: '16.00', review_count: 3400 },
  { id: 'c', brand_en: 'SKIN1004', name_en: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', price_usd: '22.10', review_count: 0 },
  { id: 'd', brand_en: 'SKIN1004', name_en: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum (Twin Pack)', price_usd: null, review_count: 0 },
]

test('the cheap well-reviewed twin is surfaced beside the zero-review row', async () => {
  const { attachSiblingListings } = await loadAttach()

  // Yuri resolved to the $22.10 / 0-review listing. She must be shown the others.
  const results = [{ id: 'c', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', brand: 'SKIN1004' }]
  const out = await attachSiblingListings(fakeDb(SKIN1004_ROWS), results)

  assert.ok(out[0].other_listings, 'the duplicate listings must be attached')
  const names = out[0].other_listings.map((l) => l.name)
  assert.ok(
    names.some((n) => n.includes('SPF50+ PA++++') && !n.startsWith('Hyalu')),
    `the $15.50/5,800-review row must be surfaced. Got: ${JSON.stringify(names)}`
  )
  // Highest review volume first, so the credible listing is the one she reads first.
  assert.equal(out[0].other_listings[0].review_count, 5800)
  assert.equal(out[0].other_listings[0].price_usd, '15.50')
})

test('nothing is filtered, reordered, or auto-picked', async () => {
  const { attachSiblingListings } = await loadAttach()

  const results = [
    { id: 'c', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', brand: 'SKIN1004' },
    { id: 'z', name: 'Some Other Product', brand: 'SKIN1004' },
  ]
  const out = await attachSiblingListings(fakeDb(SKIN1004_ROWS), results)

  assert.equal(out.length, 2, 'no result may be dropped')
  assert.equal(out[0].id, 'c', 'order must be preserved')
  assert.equal(out[1].id, 'z')
  // The originally-resolved row keeps its identity — we did not swap it for the cheap one.
  assert.equal(out[0].name, 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum')
})

test('the note hands the judgment to Yuri rather than deciding for her', async () => {
  const { attachSiblingListings } = await loadAttach()
  const out = await attachSiblingListings(
    fakeDb(SKIN1004_ROWS),
    [{ id: 'c', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', brand: 'SKIN1004' }]
  )

  const note = out[0].listings_note
  assert.ok(note, 'a note must accompany the listings')
  assert.match(note, /may be the SAME product|genuinely DIFFERENT/i,
    'the note must present both readings rather than asserting one')
  assert.match(note, /Judge which/i, 'the decision must be handed back to Yuri')
  // It must NOT instruct a mechanical preference — that rule was measured and is wrong.
  assert.ok(
    !/always (use|prefer|quote) the (highest|cheapest)/i.test(note),
    'the note must not encode an auto-pick rule; different SKUs share these name shapes'
  )
})

test('genuinely different SKUs are surfaced too, not silently merged', async () => {
  const { attachSiblingListings } = await loadAttach()

  // Real catalog shape: an ampoule and a cream share a name prefix. Surfacing them is
  // correct — Yuri can tell them apart. Auto-preferring by review count could not.
  const rows = [
    { id: 'r1', brand_en: 'Real Barrier', name_en: 'Extreme Cream', price_usd: '22.00', review_count: 11501 },
    { id: 'r2', brand_en: 'Real Barrier', name_en: 'Extreme Cream Ampoule', price_usd: '33.61', review_count: 8 },
  ]
  const out = await attachSiblingListings(
    fakeDb(rows),
    [{ id: 'r2', name: 'Extreme Cream Ampoule', brand: 'Real Barrier' }]
  )

  assert.ok(out[0].other_listings, 'the sibling must be visible')
  assert.equal(out[0].id, 'r2', 'the ampoule must NOT be swapped for the cream')
  assert.equal(out[0].name, 'Extreme Cream Ampoule')
})

test('an unrelated product gets no listings and no note', async () => {
  const { attachSiblingListings } = await loadAttach()
  const rows = [{ id: 'x', brand_en: 'COSRX', name_en: 'Advanced Snail 96 Mucin Power Essence', price_usd: '17.00', review_count: 9000 }]
  const out = await attachSiblingListings(fakeDb(rows), [{ id: 'x', name: 'Advanced Snail 96 Mucin Power Essence', brand: 'COSRX' }])

  assert.equal(out[0].other_listings, undefined, 'no siblings means no noise')
  assert.equal(out[0].listings_note, undefined)
})

test('a failed lookup does not read as "no duplicates exist"', async () => {
  const { attachSiblingListings } = await loadAttach()
  const results = [{ id: 'c', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', brand: 'SKIN1004' }]

  // The silent-failure class: a dead query must not assert an all-clear.
  const out = await attachSiblingListings(fakeDb([], { error: { message: 'boom' } }), results)
  assert.equal(out.length, 1, 'results must survive a failed sibling lookup')
  assert.equal(out[0].id, 'c')

  const src = readFileSync(SRC, 'utf8')
  const fn = sliceFn(src, 'async function attachSiblingListings(')
  assert.match(fn, /console\.error/, 'the failure must be logged, not swallowed')
})
