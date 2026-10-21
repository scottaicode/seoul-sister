/**
 * Guard tests — a US shopper must never be handed a price they cannot pay.
 *
 * THE DEFECT (found Oct 21 2026). Olive Young Global stopped shipping to US
 * addresses on May 29 2026, when Olive Young US launched. 4,908 of our 5,157
 * price rows pointed at Global. For five months Yuri, the product pages and the
 * JSON-LD sent to Google presented its price as THE price — a number a US
 * visitor cannot pay (SKIN1004 twin pack: $21.50 Global, $38.00 at Olive Young
 * US) from a store that shows them "This site does not ship to the U.S."
 *
 * The rules these tests pin:
 *   1. Shipping reach is a FACT on every price row (ships_to_us), never a
 *      filter. The Global row stays visible as an international comparison.
 *   2. Unknown reach stays unknown — never coerced to "ships".
 *   3. Only a US-shippable price is ever shown as the US price or published to
 *      Google as a USD offer.
 *
 * The helpers are EXECUTED (transpiled), not matched as source text, because a
 * source regex passes against broken logic — this repo has shipped that before.
 * The wiring checks at the bottom are source-level by necessity (the call sites
 * need a database) and say so.
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

async function importTs(source, name) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'ss-ships-'))
  const file = join(dir, `${name}.mjs`)
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

async function loadShipsFact() {
  const src = read('src', 'lib', 'yuri', 'tools.ts')
  const fn = src.match(/export function shipsToUsFact\([\s\S]*?\n\}/)
  assert.ok(fn, 'shipsToUsFact not found in tools.ts — renamed or removed?')
  return importTs(fn[0], 'ships-fact')
}

const loadScope = () => importTs(read('src', 'lib', 'pricing', 'price-scope.ts'), 'price-scope')
const loadCountry = () => importTs(read('src', 'lib', 'widget', 'visitor-country.ts'), 'visitor-country')

// ---------------------------------------------------------------------------
// shipsToUsFact
// ---------------------------------------------------------------------------

test('shipsToUsFact reports the stored fact and keeps unknown as null', async () => {
  const { shipsToUsFact } = await loadShipsFact()
  assert.equal(shipsToUsFact({ ships_to_us: false, recommended: true }), false)
  assert.equal(shipsToUsFact({ ships_to_us: true, recommended: true }), true)
  assert.equal(shipsToUsFact({ ships_to_us: null, recommended: true }), null)
  assert.equal(shipsToUsFact({}), null)
  assert.equal(shipsToUsFact(null), null)
  // A truthy non-boolean is not "ships". Coercion is the failure this guards.
  assert.equal(shipsToUsFact({ ships_to_us: 'yes' }), null)
  assert.equal(shipsToUsFact({ ships_to_us: 1 }), null)
})

// ---------------------------------------------------------------------------
// scopePrices — what the product and best-of pages show and publish
// ---------------------------------------------------------------------------

test('a Global-only product has NO US price — its price is international', async () => {
  const { scopePrices } = await loadScope()
  const s = scopePrices([{ price_usd: 21.5, last_checked: '2026-10-20T00:00:00Z', ships_to_us: false, recommended: true }])
  assert.equal(s.us, null, 'an Olive Young Global price must never become the US price')
  assert.equal(s.international, 21.5)
  assert.deepEqual(s.usAll, [], 'nothing may reach the Google Offer range')
})

test('when both exist, the US price is the US-shippable row even if Global is cheaper', async () => {
  const { scopePrices } = await loadScope()
  const s = scopePrices([
    { price_usd: 21.5, last_checked: '2026-10-20T00:00:00Z', ships_to_us: false, recommended: true },
    { price_usd: 38, last_checked: '2026-10-19T00:00:00Z', ships_to_us: true, recommended: true },
  ])
  assert.equal(s.us, 38)
  assert.equal(s.international, 21.5)
  assert.deepEqual(s.usAll, [38])
})

test('a row with unknown shipping reach is in neither bucket', async () => {
  const { scopePrices } = await loadScope()
  const s = scopePrices([{ price_usd: 14, last_checked: '2026-10-20T00:00:00Z', ships_to_us: null, recommended: true }])
  assert.equal(s.us, null)
  assert.equal(s.international, null)
  assert.deepEqual(s.usAll, [])
})

test('freshest wins within a bucket; same-day ties take the cheaper', async () => {
  const { scopePrices } = await loadScope()
  const s = scopePrices([
    { price_usd: 12, last_checked: '2026-04-01T00:00:00Z', ships_to_us: true, recommended: true }, // stale and cheap
    { price_usd: 20, last_checked: '2026-10-20T08:00:00Z', ships_to_us: true, recommended: true },
    { price_usd: 18, last_checked: '2026-10-20T20:00:00Z', ships_to_us: true, recommended: true },
  ])
  assert.equal(s.us, 18, 'a stale cheap row must not beat a fresh one')
})

test('zero, negative and non-numeric prices are ignored', async () => {
  const { scopePrices } = await loadScope()
  const s = scopePrices([
    { price_usd: 0, last_checked: '2026-10-20T00:00:00Z', ships_to_us: true, recommended: true },
    { price_usd: 'abc', last_checked: '2026-10-20T00:00:00Z', ships_to_us: true, recommended: true },
    { price_usd: '24.99', last_checked: '2026-10-19T00:00:00Z', ships_to_us: true, recommended: true },
  ])
  assert.equal(s.us, 24.99)
  assert.deepEqual(s.usAll, [24.99])
})


test('a store we never recommend is never "the US price", even if it ships here', async () => {
  // Review finding (Oct 21): YesStyle ships to the US, is on the never-steer
  // list, and its refresher was retired. Without this rule it became the
  // published US price for 115 products.
  const { scopePrices } = await loadScope()
  const s = scopePrices([
    { price_usd: 18.4, last_checked: '2026-10-20T00:00:00Z', ships_to_us: true, recommended: false },
    { price_usd: 21.5, last_checked: '2026-10-20T00:00:00Z', ships_to_us: false, recommended: true },
  ])
  assert.equal(s.us, null)
  assert.deepEqual(s.usAll, [])
  assert.equal(s.international, 21.5)
})

test('usPriceRange never falls back to anything but US prices', async () => {
  const { scopePrices, usPriceRange } = await loadScope()
  const globalOnly = scopePrices([{ price_usd: 21.5, last_checked: '2026-10-20T00:00:00Z', ships_to_us: false, recommended: true }])
  assert.deepEqual(usPriceRange(globalOnly), { min: null, max: null })
  const two = scopePrices([
    { price_usd: 23, last_checked: '2026-10-20T00:00:00Z', ships_to_us: true, recommended: true },
    { price_usd: 38, last_checked: '2026-10-19T00:00:00Z', ships_to_us: true, recommended: true },
  ])
  assert.deepEqual(usPriceRange(two), { min: 23, max: 38 })
  const one = scopePrices([{ price_usd: 23, last_checked: '2026-10-20T00:00:00Z', ships_to_us: true, recommended: true }])
  assert.deepEqual(usPriceRange(one), { min: 23, max: null })
})

test('isOrderableHere: a US shopper can only order from a store that ships to the US', async () => {
  const { isOrderableHere } = await loadScope()
  assert.equal(isOrderableHere(false, true), false)
  assert.equal(isOrderableHere(null, true), false, 'unknown reach is not orderable')
  assert.equal(isOrderableHere(true, true), true)
  assert.equal(isOrderableHere(false, false, true), true, 'outside the US, an internationally shipping store is orderable')
  assert.equal(isOrderableHere(true, false, false), false, 'outside the US, a US-only store is not')
  assert.equal(isOrderableHere(true, false, null), false, 'unknown international reach is not orderable')
})

test('cheapestUsOrderable returns a recommended US store, in stock first, else null', async () => {
  const { cheapestUsOrderable } = await loadScope()
  const rows = [
    { retailer: 'Olive Young Global', ships_to_us: false, recommended_to_buy_from: true, in_stock: true },
    { retailer: 'YesStyle', ships_to_us: true, recommended_to_buy_from: false, in_stock: true },
    { retailer: 'Soko Glam', ships_to_us: true, recommended_to_buy_from: true, in_stock: false },
    { retailer: 'iHerb', ships_to_us: true, recommended_to_buy_from: true, in_stock: true },
  ]
  assert.equal(cheapestUsOrderable(rows).retailer, 'iHerb')
  assert.equal(cheapestUsOrderable(rows.slice(0, 3)).retailer, 'Soko Glam')
  assert.equal(cheapestUsOrderable(rows.slice(0, 2)), null, 'YesStyle is never the stand-in')
})

// ---------------------------------------------------------------------------
// Visitor country fact for the landing-page chat
// ---------------------------------------------------------------------------

test('visitor country: valid codes are stated as a network guess, unknown as unknown', async () => {
  const { visitorCountryCode, visitorCountryFact } = await loadCountry()
  assert.equal(visitorCountryCode('us'), 'US')
  assert.equal(visitorCountryCode(' IN '), 'IN')
  assert.equal(visitorCountryCode(''), null)
  assert.equal(visitorCountryCode(null), null)
  assert.equal(visitorCountryCode('USA'), null)

  const us = visitorCountryFact('US')
  assert.match(us, /United States/)
  assert.match(us, /network guess/i, 'must say it is a guess so Yuri lets the visitor override it')

  const unknown = visitorCountryFact(null)
  assert.match(unknown, /unknown/i)
  assert.doesNotMatch(unknown, /United States/, 'unknown must never be defaulted to the US')
})

// ---------------------------------------------------------------------------
// Wiring (source-level by necessity: these call sites need a database)
// ---------------------------------------------------------------------------

test('every price row Yuri receives carries ships_to_us, and compare_prices uses the shared helper', () => {
  const src = read('src', 'lib', 'yuri', 'tools.ts')
  const attaches = src.match(/ships_to_us: shipsToUsFact\(/g) || []
  assert.ok(attaches.length >= 3, `expected ships_to_us on all three price paths, found ${attaches.length}`)
  const selects = src.match(/retailer:ss_retailers\([^)]*ships_to_us[^)]*\)/g) || []
  assert.ok(selects.length >= 3, `expected ships_to_us in all three retailer joins, found ${selects.length}`)
  // Binds against `cheapest_ships_to_us: null,` (a review attack that passed the old test).
  assert.match(src, /cheapest\.ships_to_us === false \? cheapestUsOrderable\(formatted\) : null/)
})

test('compare_prices reports a failed lookup as an error, not "no price data"', () => {
  const src = read('src', 'lib', 'yuri', 'tools.ts')
  assert.match(src, /const \{ data: prices, error: pricesError \} = await db/)
  assert.match(src, /if \(pricesError\) \{[\s\S]{0,200}return JSON\.stringify/)
})

test('Google only ever receives a US price from a recommended store', () => {
  const best = read('src', 'app', 'best', '[category]', 'page.tsx')
  assert.match(best, /usPrice\.has\(p\.id\) && \{\s*offers:/)
  assert.match(best, /recommended: isRecommendedRetailer\(/)

  const product = read('src', 'app', 'products', '[id]', 'page.tsx')
  // Binds against `priceMin = ... : internationalPrice` (a review attack that
  // passed the old test): priceMin may ONLY come from usPriceRange.
  assert.match(product, /const \{ min: priceMin, max: priceMax \} = usPriceRange\(scoped\)/)
  const otherAssignments = product.match(/\bpriceM(in|ax)\s*=(?!=)/g) || []
  assert.equal(otherAssignments.length, 0, 'priceMin/priceMax must not be assigned anywhere else')
  assert.match(product, /recommended: isRecommendedRetailer\(/)
})

test('the prices endpoint uses the shared orderability rule and fabricates no row', () => {
  const src = read('src', 'app', 'api', 'prices', 'route.ts')
  assert.doesNotMatch(src, /last_checked: new Date\(\)\.toISOString\(\)/)
  // Binds against `orderable_here: true` (a review attack that passed the old test).
  assert.match(src, /orderable_here: isOrderableHere\(\s*shipsToUs,\s*shopperInUs,/)
})

test('a refresh run that cannot find its retailer is recorded as failed, not completed', () => {
  const lib = read('src', 'lib', 'pipeline', 'olive-young-price-refresh.ts')
  assert.match(lib, /retailerMissing: true/)
  const route = read('src', 'app', 'api', 'cron', 'refresh-prices-olive-young', 'route.ts')
  assert.match(route, /status: refreshedNothing \|\| result\.retailerMissing \? 'failed' : 'completed'/)
})
