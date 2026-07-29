/**
 * Guard test — Phase 3: in-store buying, the sunscreen reformulation fact, and
 * honest handling of Western products.
 *
 * WHAT THIS PROTECTS
 *
 * 1. The reformulation fact. Phase 3 originally planned to answer "I only buy
 *    what I can pick up at Target" by pointing people at the Korean sunscreen on
 *    the shelf. Consumer Reports (Jul 2026) tested each brand's Korean formula
 *    against ITS OWN US formula and the US versions are a different, weaker
 *    product: Beauty of Joseon SPF 36 vs 19, Innisfree 48 vs 16, Round Lab
 *    46 vs 16. The naive version of the recommendation would have been actively
 *    wrong for a fair, burn-prone, post-Accutane user in a high-UV climate —
 *    the exact person it was aimed at.
 *
 * 2. Protection, NOT elegance. The same panel found the Korean sunscreens
 *    greasy, white-casting and not lightweight. The "cosmetically elegant"
 *    half of the standard K-beauty pitch is contradicted by the best test we
 *    have, and it must not creep back into either surface.
 *
 * 3. The bridge must be free to say "keep what you have." A recommender that
 *    must always find a Korean swap is the algorithmic surface the Yuri Sole
 *    Authority Principle exists to prevent.
 *
 * Source-structural assertions only. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const advisorSrc = read('src', 'lib', 'yuri', 'advisor.ts')
const widgetSrc = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')

const SURFACES = [
  ['advisor', advisorSrc],
  ['widget', widgetSrc],
]

// --- The reformulation fact (the one that would have made us wrong) ---------

for (const [name, src] of SURFACES) {
  test(`${name}: knows US-shelf Korean sunscreens are REFORMULATED`, () => {
    assert.match(
      src,
      /REFORMULATED|reformulated/,
      'Lost the fact that the US-shelf version is not the Korean formula.'
    )
    assert.match(
      src,
      /36 vs 19|SPF 36 vs 19/,
      'Lost the measured Consumer Reports figures backing the claim.'
    )
  })

  test(`${name}: leads on protection, not cosmetic elegance`, () => {
    // The contradicted half of the pitch must not return in either prompt.
    assert.ok(
      !/lightweight, cosmetically elegant/i.test(src),
      'The contradicted "lightweight, cosmetically elegant" claim is back.'
    )
    assert.match(
      src,
      /not (?:feel|texture)|PROTECTION, not|protection.{0,20}not (?:feel|texture)/i,
      'Must state that the documented advantage is protection rather than feel.'
    )
  })

  test(`${name}: never promises a product is on a specific store's shelf`, () => {
    // Chain assortments vary by store and format; the online range is wider.
    assert.match(
      src,
      /assortments vary|vary by (?:store|location)/i,
      'Lost the guard against claiming local stock we cannot know.'
    )
  })

  test(`${name}: the bridge may conclude "keep what you have"`, () => {
    assert.match(
      src,
      /keep (?:that|it), it's doing its job/i,
      'Yuri must be free to tell someone their Western product is fine.'
    )
    assert.match(
      src,
      /only where it genuinely wins/i,
      'A Korean alternative must be conditional, never the default answer.'
    )
    assert.match(
      src,
      /opinions about formulas, not about countries/i,
      'Lost the rule against treating non-Korean as inferior by default.'
    )
  })
}

// --- Calibration that keeps the claim honest -------------------------------

test('advisor keeps the relative/absolute and narrowing-gap caveats', () => {
  assert.match(
    advisorSrc,
    /under their SPF 50\+ labels/,
    'The finding is Korean-beats-US, NOT label-accurate. Lost that caveat.'
  )
  assert.match(
    advisorSrc,
    /bemotrizinol/,
    'The US filter gap narrowed in June 2026 — do not present it as static.'
  )
})

test('advisor states the personal-import grey area without overclaiming', () => {
  assert.match(advisorSrc, /grey area/i, 'Lost the import classification.')
  // The prompt legitimately QUOTES the two verdicts it forbids ('never say
  // "it's illegal" and never say "it's totally fine"'), so assert on the
  // prohibition being present rather than on the phrases being absent —
  // otherwise the rule itself trips the test that enforces it.
  assert.match(
    advisorSrc,
    /never say .it's illegal. and never say .it's totally fine/i,
    'Import status must be stated as a grey area, never as a verdict either way.'
  )
  assert.match(
    advisorSrc,
    /enforcement isn't consistent/i,
    'Lost the honest note that enforcement is inconsistent.'
  )
})

// --- Amazon accuracy (stale claim + unfounded harm claim) ------------------

test('advisor does not cite commingling as the current Amazon mechanism', () => {
  // Amazon ended commingled inventory March 31 2026.
  const amazonLine = advisorSrc.slice(
    advisorSrc.indexOf('- **Amazon** is a separate case'),
    advisorSrc.indexOf('- **Amazon** is a separate case') + 900
  )
  assert.match(
    amazonLine,
    /ended commingled inventory/i,
    'Lost the correction that commingling ended in March 2026.'
  )
})

test('counterfeit claim stays "failed protection", never documented harm', () => {
  assert.match(
    advisorSrc,
    /SPF 3\.6/,
    'Lost the concrete, documented counterfeit finding (tested SPF 3.6 vs claimed 45).'
  )
  assert.match(
    advisorSrc,
    /Never claim counterfeits have harmed people/i,
    'There is no documented medical harm — that claim must stay prohibited.'
  )
})

test('widget still avoids naming marketplaces as counterfeit channels', () => {
  // Pre-existing affiliate/legal rule. Phase 3 must not have broken it.
  assert.match(
    widgetSrc,
    /Never name specific marketplaces/,
    'Lost the widget rule against naming marketplaces as fake-goods channels.'
  )
})
