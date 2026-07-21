/**
 * Guard test — clinical profile honesty.
 *
 * Two production defects, found July 21 2026 while auditing what Yuri actually
 * knows about a subscriber with a 25-excision skin cancer history:
 *
 * 1. FABRICATED CLINICAL DATA. `finalizeOnboardingProfile` wrote hardcoded
 *    defaults for anything the user never answered — fitzpatrick_scale=3,
 *    age_range='25-30', climate='temperate' — and memory.ts printed them to
 *    Yuri as bare fact. A guessed Fitzpatrick III was indistinguishable from a
 *    stated one. Fitzpatrick drives retinoid strength, acid aggressiveness,
 *    post-inflammatory-hyperpigmentation risk in deeper tones, and skin-cancer
 *    caution in fair ones — so this is the v10.2.1 "I checked our database"
 *    fake-confidence class with clinical consequences. The onboarding prompt
 *    made it worse by telling Yuri to "Infer from context" rather than ask.
 *
 * 2. MEDICAL HISTORY STORED AS AN ALLERGY. The schema had nowhere to put
 *    "skin cancer history", so extraction put it in `allergies` — which
 *    memory.ts injects under "ALWAYS check for these before recommending any
 *    product". Yuri read a cancer history as a contact allergen, something not
 *    to put on his face, instead of the standing fact that should reframe every
 *    recommendation (protection first, photosensitizer caution, low referral
 *    threshold).
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const onboardingSrc = readFileSync(join(root, 'src', 'lib', 'yuri', 'onboarding.ts'), 'utf8')
const memorySrc = readFileSync(join(root, 'src', 'lib', 'yuri', 'memory.ts'), 'utf8')
const advisorSrc = readFileSync(join(root, 'src', 'lib', 'yuri', 'advisor.ts'), 'utf8')
const widgetSrc = readFileSync(
  join(root, 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
  'utf8'
)

/** Body of a named function, so assertions are scoped and not fooled by matches elsewhere. */
function fnBody(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > 0, `${signature} not found — renamed?`)
  return src.slice(start, start + 3000)
}

test('onboarding never fabricates a Fitzpatrick, age, or climate', () => {
  const body = fnBody(onboardingSrc, 'export async function finalizeOnboardingProfile(')
  assert.ok(
    !/fitzpatrick_scale:\s*extracted\.fitzpatrick_scale\s*\|\|\s*\d/.test(body),
    'fitzpatrick_scale is being defaulted again — a guessed value is stored as fact and drives clinical decisions'
  )
  assert.ok(
    !/age_range:\s*extracted\.age_range\s*\|\|\s*'/.test(body),
    "age_range is being defaulted again (was '25-30' for a 59-year-old)"
  )
  assert.ok(
    !/climate:\s*extracted\.climate\s*\|\|\s*'/.test(body),
    'climate is being defaulted again'
  )
  // Written only when actually extracted, and stamped with provenance.
  assert.ok(
    /if \(extracted\.fitzpatrick_scale\)/.test(body) &&
      /fitzpatrick_source = 'stated'|fitzpatrick_source\]?\s*=\s*'stated'/.test(body),
    'a stated Fitzpatrick must be recorded with provenance so it is distinguishable from an estimate'
  )
})

test('skipping onboarding leaves clinical fields NULL, not invented', () => {
  const body = fnBody(onboardingSrc, 'export async function skipOnboarding(')
  assert.ok(
    !/fitzpatrick_scale:\s*\d/.test(body),
    'skipOnboarding invents a Fitzpatrick for someone who told us nothing at all'
  )
  assert.ok(!/age_range:\s*'/.test(body), 'skipOnboarding invents an age range')
})

test('Yuri is told when Fitzpatrick is unknown instead of shown a number', () => {
  assert.ok(
    /NOT ESTABLISHED/.test(memorySrc),
    'an unknown Fitzpatrick must render as unknown — never as a bare value or "undefined"'
  )
  assert.ok(
    /do not guess or state one|Do not guess or state one/i.test(memorySrc),
    'the unknown case must explicitly tell Yuri not to assert a value'
  )
  assert.ok(
    /ESTIMATED, never confirmed/.test(memorySrc),
    'an estimated Fitzpatrick must be flagged as estimated so she can confirm it'
  )
})

test('medical history is framed as reframing advice, NOT as an allergen list', () => {
  assert.ok(
    /## Medical History/.test(memorySrc),
    'medical history must have its own context block'
  )
  assert.ok(
    /not allergens|not an allergen|they are not allergens/i.test(memorySrc),
    'the block must state plainly that these are not allergens — the exact confusion that stored a cancer history under allergies'
  )
  assert.ok(
    /dermatologist question, not mine|lowers your threshold/i.test(memorySrc),
    'a medical history must lower the referral threshold, not just sit in context'
  )
  // The allergy line must say what allergies ARE, so the two never blur again.
  assert.ok(
    /Allergies \(ingredients to AVOID\)/.test(memorySrc),
    'the allergies line must be labelled as ingredients to avoid'
  )
})

test('lesion referral guidance exists on BOTH Yuri surfaces', () => {
  for (const [name, src] of [
    ['authenticated advisor', advisorSrc],
    ['landing widget', widgetSrc],
  ]) {
    assert.ok(
      /mole|lesion/i.test(src),
      `${name}: no mole/lesion referral guidance — the old rule named only "pain, spreading rashes, suspected infections"`
    )
    assert.ok(
      /changing|bleeding|crusting/i.test(src),
      `${name}: referral guidance must name the actual warning signs`
    )
    assert.ok(
      /do not (?:offer|reassure)|never a skincare answer/i.test(src),
      `${name}: must forbid answering a lesion with a product or a reassurance`
    )
  }
})

test('the extractor is told not to infer Fitzpatrick from ancestry or location', () => {
  assert.ok(
    /Do NOT infer it from ethnicity, location/.test(onboardingSrc),
    'the extraction schema must forbid inferring Fitzpatrick — it was previously told to "Infer from context when possible"'
  )
  assert.ok(
    !/Infer from context when possible/.test(onboardingSrc),
    'the old "infer rather than ask" instruction is back'
  )
})

test('widget reasons from population patterns but stays calibrated', () => {
  assert.ok(
    /stereotype in a lab coat/.test(widgetSrc),
    'the calibration rule is missing — Yuri should use base rates but never flatten the individual into them'
  )
  assert.ok(
    /confidence that matches your evidence/i.test(widgetSrc),
    'confidence-calibration guidance missing'
  )
})
