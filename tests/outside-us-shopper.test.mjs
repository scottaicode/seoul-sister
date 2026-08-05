/**
 * Guard test — a visitor outside the US must get a purchase path, and the gap
 * must be MEASURABLE rather than anecdotal.
 *
 * THE INCIDENT (Aug 5 2026)
 * A woman in Kolkata with PCOS and combination skin had a 45-minute, 7-message
 * conversation — the deepest cold session on record. Yuri performed well: she named the
 * PCOS breakouts as hormonal and pointed her to a dermatologist, told her to buy LESS,
 * and withdrew her own earlier product picks because the visitor's existing Plum toner
 * already covered niacinamide. The visitor closed in Korean: "고마워요, 유리 언니."
 *
 * Then she asked for something she could actually buy in India, and the honest answer was
 * "my live pricing tool is built on the Korean/US retailer feeds, so I can't quote you
 * accurate rupee prices without guessing." True, and it left a motivated person with no
 * purchase path at the end of a good conversation.
 *
 * TWO THINGS THIS FIXES, AND ONE IT DELIBERATELY DOESN'T
 * 1. Yuri now knows where people in major non-US markets actually shop, so she routes
 *    instead of apologising. She still must not quote a converted price — our USD feeds
 *    hide shipping, customs and local markup, which is the wrong-price-destroys-trust
 *    failure wearing a different currency.
 * 2. A `shopper_outside_us` signal records the region, so "how often does this happen"
 *    becomes a number. Today it is 3 grep hits across 58 visitors, which cannot
 *    distinguish 5% from 15% — and grep only finds people who volunteered a location.
 *
 * NOT built: an India catalog, regional pricing, or currency conversion. CLAUDE.md
 * rejected a Western catalog on measured 15:1 Korean intent; building a regional one on
 * three anecdotes would repeat exactly that mistake. The ingredient reasoning already
 * travels worldwide (Yuri read Plum, Re'equil and Pond's correctly — INCI is INCI). Only
 * the last mile breaks, so only the last mile is patched.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SIGNALS = join(ROOT, 'src', 'lib', 'widget', 'signals.ts')
const ROUTE = join(ROOT, 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

/** Evaluate the real REGIONS table out of signals.ts. */
function regionMatcher() {
  const src = readFileSync(SIGNALS, 'utf8')
  const s = src.indexOf('const REGIONS: Array<[RegExp, string]> = [')
  assert.ok(s > -1, 'the REGIONS table must exist in signals.ts')
  const open = src.indexOf('[', s + 40)
  let d = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '[') d++
    else if (src[i] === ']') { d--; if (!d) break }
  }
  const REGIONS = eval(src.slice(open, i + 1).replace(/: Array<\[RegExp, string\]>/, ''))
  return (msg) => {
    for (const [re, region] of REGIONS) if (re.test(msg)) return region
    return null
  }
}

test('the real visitor messages are detected', () => {
  const detect = regionMatcher()

  // Verbatim from the two transcripts that motivated this.
  assert.equal(detect('Place - Kolkata.'), 'india')
  assert.equal(detect('Can you give me something to work with accessible in india'), 'india')
  assert.equal(detect('Humid climate Andhra vijayawada'), 'india')
})

test('major markets are covered', () => {
  const detect = regionMatcher()
  assert.equal(detect('I live in Singapore, what sunscreen?'), 'southeast_asia')
  assert.equal(detect('im in london any recs'), 'uk')
  assert.equal(detect('shipping to Australia?'), 'anz')
  assert.equal(detect('anything available in Canada'), 'canada')
  assert.equal(detect('im in Dubai'), 'gulf')
})

test('Korean and generic skincare talk does NOT trip it', () => {
  const detect = regionMatcher()

  // The whole catalog is Korean, so a false positive here would drown the signal
  // in noise and make the eventual measurement worthless.
  assert.equal(detect('I use COSRX snail mucin from Korea'), null)
  assert.equal(detect('whats the best korean sunscreen'), null)
  assert.equal(detect('my skin is oily and i live in a humid place'), null)
  assert.equal(detect('is this ok for combination skin'), null)
  assert.equal(detect('I bought it on Amazon'), null)
})

test('the signal records WHICH region, not just that one occurred', () => {
  const src = readFileSync(SIGNALS, 'utf8')
  const block = src.slice(
    src.indexOf("type: 'shopper_outside_us'"),
    src.indexOf("type: 'asked_about_subscription'")
  )
  assert.ok(block.length > 0, 'the signal definition must exist')

  // A bare count cannot decide whether to build regional coverage; the region can.
  assert.match(block, /signal_data:\s*\{\s*region/, 'the region must be stored in signal_data')
  assert.match(block, /matched:/, 'the matched term must be stored so a later reader can audit a false positive')
  assert.match(block, /category:\s*'purchase_intent'/, 'this is a purchase-intent signal — it fires at the buying moment')
})

test('Yuri is told where to route, and told NOT to convert prices', () => {
  const src = readFileSync(ROUTE, 'utf8')

  assert.match(src, /When The Visitor Isn't In The US/, 'the guidance section must exist')
  // The specific markets that showed up in real transcripts.
  assert.match(src, /Nykaa/, 'India routing must be present — it is the market we actually saw')
  assert.match(src, /Shopee|Lazada/, 'Southeast Asia routing must be present')

  // The failure this must not create: a converted price hides shipping/customs/markup.
  assert.match(
    src, /never quote a converted price/i,
    'converting USD prices invisibly is the wrong-price failure in another currency'
  )
  // The valuable half must be stated so it is not lost in a later edit.
  assert.match(
    src, /Ingredient science is universal/i,
    'the reasoning travels worldwide even when the catalog does not — that must stay explicit'
  )
  assert.match(
    src, /Never let "not in our database" sound like "not good\."/,
    'catalog absence must never read as a verdict on the product'
  )
})

test('it stays judgment, not a lookup table', () => {
  const src = readFileSync(ROUTE, 'utf8')
  assert.match(
    src, /if you don't know a market, say you don't rather than invent a retailer/i,
    'Yuri must be told to decline rather than fabricate a retailer for an unlisted market'
  )
})
