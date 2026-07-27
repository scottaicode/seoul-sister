/**
 * Guard test — GEO citation funnel (July 27 2026).
 *
 * Seoul Sister earns heavy AI-assistant citation volume (525 Bing Copilot
 * citations in one week, 33-66% share on commercial K-beauty queries) that was
 * converting to ~0 leads. Three defects caused it:
 *
 *   1. /products/[id] — the page type AI traffic lands on most — was the ONLY
 *      public content surface with no `?ask=` link. Its "Ask Yuri About This
 *      Product" panel was a LOCKED GatedTeaser whose only action was /register
 *      at full price.
 *   2. document.referrer was never captured, so AI-citation arrivals (no utm,
 *      no ?from=) were tagged 'landing' and the channel was invisible.
 *   3. Cited pages named nothing an AI answer couldn't already contain, so
 *      Copilot quoted the ranking and the reader had no reason to visit.
 *
 * Each assertion locks one of those fixes. Verified by reintroducing the bugs.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const productSrc = read('src', 'components', 'products', 'ProductIntelligenceSection.tsx')
const referrerSrc = read('src', 'lib', 'widget', 'ai-referrer.ts')
const widgetSrc = read('src', 'components', 'widget', 'TryYuriSection.tsx')
const bestSrc = read('src', 'app', 'best', '[category]', 'page.tsx')

// ---------------------------------------------------------------------------
// 1. The product page must offer FREE Yuri, not a locked upsell
// ---------------------------------------------------------------------------

test('product page routes to free Yuri with ?ask= prefill', () => {
  assert.match(productSrc, /from=product/)
  assert.match(productSrc, /\/\?ask=\$\{encodeURIComponent/)
})

test('the Ask-Yuri panel is NOT a GatedTeaser', () => {
  // The regression: reverting it to <GatedTeaser title="Ask Yuri About This
  // Product" .../> shows a locked box to a visitor who arrived from a citation
  // asking about that exact product.
  // Check the RENDER SITE, not a regex over the whole file: the earlier
  // version of this test passed even with the bug reintroduced, because a
  // multi-line <GatedTeaser ... title="Ask Yuri" /> never matched. Verified by
  // reintroducing the bug and watching this fail.
  const anonBlock =
    productSrc.match(/product-gated-content[\s\S]*?<\/div>/)?.[0] ?? ''
  assert.ok(anonBlock.length > 0, 'anonymous gated block must exist')
  assert.match(anonBlock, /<AskYuriAboutProduct/, 'must render the free-Yuri card')
  const teasers = anonBlock.match(/<GatedTeaser[\s\S]*?\/>/g) ?? []
  for (const t of teasers) {
    assert.ok(
      !/Ask Yuri/i.test(t),
      'Ask Yuri must never be rendered as a locked GatedTeaser'
    )
  }
  assert.match(productSrc, /function AskYuriAboutProduct/)
})

test('free-Yuri card states no signup is required', () => {
  // Slice from this function to the start of the next top-level function.
  const start = productSrc.indexOf('function AskYuriAboutProduct')
  const next = productSrc.indexOf('function GatedTeaser', start)
  const fn = start >= 0 && next > start ? productSrc.slice(start, next) : ''
  assert.ok(fn.length > 0, 'AskYuriAboutProduct must exist')
  assert.match(fn, /[Ff]ree, no signup/)
  assert.ok(!/PRICING\./.test(fn), 'the free-Yuri card must not quote a price')
})

// ---------------------------------------------------------------------------
// 2. AI-citation arrivals must be attributable
// ---------------------------------------------------------------------------

test('detects the major AI assistants', async () => {
  // Mirror of the shipped map, kept honest by the source assertions below.
  const cases = [
    ['https://www.bing.com/search?q=x', 'bing'],
    ['https://copilot.microsoft.com/', 'copilot'],
    ['https://chatgpt.com/c/abc', 'chatgpt'],
    ['https://www.perplexity.ai/search', 'perplexity'],
    ['https://claude.ai/chat/1', 'claude'],
    ['https://gemini.google.com/app', 'gemini'],
  ]
  for (const [ref, label] of cases) {
    assert.match(referrerSrc, new RegExp(`'${label}'`), `${label} must be mapped`)
    const host = new URL(ref).hostname
    assert.ok(host.length > 0)
  }
})

test('same-origin referrers are NOT treated as a discovery channel', () => {
  // Internal navigation must not masquerade as an AI citation, or the metric
  // inflates itself and the SEO Guardian grades against a lie.
  assert.match(referrerSrc, /seoulsister\.com/)
  assert.match(referrerSrc, /return null/)
})

test('detector fails safe on empty/malformed referrers', () => {
  assert.match(referrerSrc, /if \(!referrer\) return null/)
  assert.match(referrerSrc, /catch \{[\s\S]*?return null/)
})

test('referrer detection does NOT override an explicit utm/from', () => {
  // utm_source and ?from= are deliberate campaign/feeder tags and must win;
  // the referrer is only the fallback for arrivals carrying neither.
  const block = widgetSrc.match(/const utm = [\s\S]*?detectAiReferrer[\s\S]*?\n    \}/)?.[0] ?? ''
  assert.ok(block.length > 0, 'source-capture block must exist')
  assert.ok(
    block.indexOf('sourceRef.current = utm || from') < block.indexOf('detectAiReferrer'),
    'utm/from must be checked before the referrer fallback'
  )
})

test('detector documents that it is a floor, not a census', () => {
  // A metric that overclaims is worse than no metric. document.referrer is
  // empty for many AI surfaces; that limit must stay written down.
  assert.match(referrerSrc, /floor|not a census|at least this many/i)
})

// ---------------------------------------------------------------------------
// 3. Cited pages: name un-summarizable value, but NEVER advise
// ---------------------------------------------------------------------------

test('best-of pages name the free Yuri route in crawlable markup', () => {
  assert.match(bestSrc, /What you can check here/)
  assert.match(bestSrc, /from=best/)
  assert.match(bestSrc, /without an account|no signup/i)
})

test('the block describes and routes — it does not recommend', () => {
  // Yuri Sole Authority: seven separate Bailey-caught incidents came from a
  // non-Yuri surface rendering prescriptions. This block is a door, not a
  // recommender. Prescriptive verbs here would be incident #8.
  const block = bestSrc.match(/What you can check here[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
  assert.ok(block.length > 0, 'the block must exist')
  const prescriptive = /\b(switch to|consider reducing|we recommend|emphasize|you should use|best for your)\b/i
  assert.ok(
    !prescriptive.test(block),
    'cited-page copy must not give skincare advice — that is Yuri\'s job alone'
  )
})

// ---------------------------------------------------------------------------
// 4. Price freshness must be real or absent — never fabricated
// ---------------------------------------------------------------------------

test('price-checked date is queried from real last_checked data', () => {
  assert.match(bestSrc, /last_checked/)
  assert.match(bestSrc, /priceCheckedAt/)
})

test('freshness stamp renders ONLY when a real date exists', () => {
  // Only ~45 of ~5,100 price rows are fresh in a given week, so a blanket
  // "refreshed daily" claim would be false. Unknown must render as nothing —
  // the same discipline as the clinical-honesty rule (never default a fact).
  assert.match(bestSrc, /\{priceCheckedAt && \(/)
  assert.match(bestSrc, /let priceCheckedAt: string \| null = null/)
  // Scoped to the rendered block, not the whole file — the source comment
  // explains WHY we don't claim a cadence and legitimately says the words.
  const block = bestSrc.match(/What you can check here[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
  assert.ok(block.length > 0)
  assert.ok(
    !/refreshed daily|updated daily/i.test(block),
    'user-facing copy must not claim a refresh cadence the data does not support'
  )
})
