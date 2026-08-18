/**
 * Guard test — structured data must be a TRUE representation of the page.
 *
 * Google's structured-data policy: markup that misrepresents the page can cost
 * rich-result eligibility via manual action. These are the three claims this
 * repo was making to Google that its own database contradicted.
 *
 * 1. AVAILABILITY WAS ASSERTED, NEVER DERIVED (Aug 18 2026)
 *
 *    Both public routes hardcoded `availability: 'https://schema.org/InStock'`.
 *    Measured against ss_product_prices.in_stock: 841 products had EVERY price
 *    row flagged out of stock while the page told Google the item was buyable,
 *    and every /best/* category carried 1-4 such items in its top 20.
 *
 *    Fixed asymmetrically on purpose, because the two routes know different
 *    things. /products/[id] fetches the price rows, so it can derive three
 *    states — in stock / out of stock / UNKNOWN — and omits the property when
 *    unknown rather than guessing (the fitzpatrick_source discipline: a wrong
 *    availability degrades invisibly, a missing one degrades visibly).
 *    /best/[category] is backed only by the bare price_usd column, which carries
 *    no stock signal at all, so it asserts nothing.
 *
 * 2. A REVIEW COUNT WAS INVENTED
 *
 *    /best/[category] emitted `reviewCount: p.review_count || 1`, manufacturing
 *    a review for the 2,179 rated products that have none. An aggregateRating
 *    with a fabricated denominator is exactly the "true representation" problem.
 *
 * 3. THE RETAILER LIST WAS HARDCODED AND FALSE
 *
 *    Every product page told Google we "compare prices across 6+ authorized
 *    retailers including Olive Young, Soko Glam, and YesStyle" and that the item
 *    was "available from ... YesStyle, and Amazon". Measured: 3 retailers have
 *    any price row, Amazon has ZERO, and YesStyle is recommended_to_buy_from:
 *    false — the widget prompt explicitly tells Yuri not to steer people there
 *    on slow shipping and weak refund recourse. The SEO copy was sending
 *    searchers to the one retailer Yuri is instructed to avoid.
 *
 * WHAT THIS TEST DELIBERATELY DOES NOT DO
 *
 * It does not assert that `offers` is absent. Removing offers was the original
 * hypothesis and it was REFUTED by measurement: aggregateRating is gated on a
 * real ss_reviews row, and only 20 of 6,105 indexable products have one — so
 * dropping offers would strip rich-result eligibility from 6,085 pages to
 * silence two warnings Google itself labels non-critical. Emitting third-party
 * retailer prices via AggregateOffer is the documented pattern for comparison
 * sites. A future session must not "fix" the merchant warnings by deleting offers.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function findProductRoutes(dir = join(root, 'src'), out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) findProductRoutes(full, out)
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      const src = readFileSync(full, 'utf8')
      if (/'@type':\s*'Product'/.test(src)) out.push(full)
    }
  }
  return out
}

const PRODUCT_ROUTES = findProductRoutes()
const DETAIL = join(root, 'src/app/products/[id]/page.tsx')
const BEST = join(root, 'src/app/best/[category]/page.tsx')

test('no route hardcodes an availability it cannot know', () => {
  assert.ok(PRODUCT_ROUTES.length >= 3, 'route discovery found too few files')
  for (const rel of PRODUCT_ROUTES) {
    const src = readFileSync(rel, 'utf8')
    // A literal InStock string sitting in an offers block is the bug: it is a
    // claim about the world, not a value read from one.
    assert.doesNotMatch(
      src,
      /availability:\s*'https:\/\/schema\.org\/InStock'/,
      `${rel}: hardcodes InStock. Availability must be derived from in_stock, ` +
        `or omitted when unknown — never asserted.`
    )
  }
})

test('the detail page derives availability from real stock data', () => {
  const src = readFileSync(DETAIL, 'utf8')

  // It must actually FETCH the column. The price-staleness bug in this repo was
  // exactly this shape: the column existed and the SELECT silently dropped it.
  assert.match(
    src,
    /\.select\(\s*'[^']*\bin_stock\b/,
    'detail page must select in_stock, or availability cannot be derived'
  )
  // All three states must be represented, including the honest unknown.
  assert.match(src, /schema\.org\/OutOfStock/, 'must be able to say OutOfStock')
  assert.match(
    src,
    /\.\.\.\(availability && \{ availability \}\)/,
    'unknown availability must be OMITTED, not defaulted'
  )
})

test('the best-of listing asserts no availability at all', () => {
  const src = readFileSync(BEST, 'utf8')
  const offersBlock = src.match(/offers:\s*\{[\s\S]{0,260}?\}/)
  assert.ok(offersBlock, 'expected an offers block on the best-of page')
  assert.doesNotMatch(
    offersBlock[0],
    /availability/,
    'the best-of listing is backed only by price_usd, which carries no stock ' +
      'signal — it must not claim availability in either direction'
  )
})

test('no route fabricates a review count', () => {
  for (const rel of PRODUCT_ROUTES) {
    const src = readFileSync(rel, 'utf8')
    // `review_count || 1` invents a review for products that have none.
    assert.doesNotMatch(
      src,
      /reviewCount:\s*\w+\.review_count\s*\|\|\s*\d/,
      `${rel}: falls back to a made-up reviewCount. Emit aggregateRating only ` +
        `when the count is real.`
    )
  }
})

test('the FAQ does not hardcode retailers we do not have prices at', () => {
  const raw = readFileSync(DETAIL, 'utf8')
  // Strip comments first. The fix's own explanatory comment quotes the old
  // false sentence verbatim, and matching that would be the test policing
  // documentation instead of behaviour.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const faq = src.slice(0, src.indexOf('const jsonLd'))

  // Amazon has ZERO price rows; "6+ authorized retailers" is false at 3.
  assert.doesNotMatch(
    faq,
    /authorized retailers including[^`]*Amazon/,
    'FAQ names Amazon, which has no price rows'
  )
  assert.doesNotMatch(
    faq,
    /6\+ authorized retailers/,
    'FAQ claims 6+ retailers; only 3 have any price data'
  )
  // The list must come from the data, through the same policy Yuri uses.
  assert.match(
    src,
    /isRecommendedRetailer/,
    'retailer copy must be derived via isRecommendedRetailer, not hardcoded'
  )
})

test('public SEO copy never steers buyers to a non-recommended retailer', () => {
  // Yuri is told: "Do NOT steer people toward YesStyle, Stylevana, or
  // StyleKorean." Public pages must not contradict her. Naming a retailer as a
  // DATA SOURCE stays allowed — that is a true statement about provenance; what
  // is banned is framing one as somewhere to shop.
  const STEERING = /(compared across|available from|shop at|buy (?:it )?(?:at|from)|best deal[^.]*)\s*[^.]{0,80}(YesStyle|Stylevana|StyleKorean)/i
  for (const rel of [DETAIL, BEST]) {
    const src = readFileSync(rel, 'utf8')
    assert.doesNotMatch(
      src,
      STEERING,
      `${rel}: frames a non-recommended retailer as a place to buy, ` +
        `contradicting the retailer policy Yuri follows.`
    )
  }
})
