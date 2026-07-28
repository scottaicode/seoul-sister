/**
 * Guard test — onboarding extraction fidelity.
 *
 * Context (2026-07-28): Caroline, Seoul Sister's second lighthouse tester,
 * completed the best onboarding conversation in the database. Yuri's JUDGMENT
 * was excellent — she diagnosed a dehydration/sebum cycle, caught the
 * post-Accutane barrier risk unprompted, fired the v11.10.0 lesion referral,
 * and told a subscriber with a $100/item budget to buy NOTHING and use fewer
 * actives. Every defect was in the EXTRACTION layer — what got written down,
 * not what Yuri said. Five bugs, four of them clinical:
 *
 *   1. `sun_history` NULL although she answered BOTH sun questions ("I burn
 *      easily initially" / "no history of skin cancer, no moles"). The field
 *      description primed for lifetime-UV prose and did not match the question
 *      Yuri actually asks, and negatives were never recordable.
 *   2. `fitzpatrick_scale=1` from HALF an answer, stamped `source='stated'`.
 *      Type 1 = always burns NEVER tans; she said she burns "initially",
 *      implying she then tans (2-3). Worse: a captured field is never re-asked,
 *      so the premature value SILENCED the clarifying question.
 *   3. Array fields accumulated near-duplicates forever (confirmed 2+ users):
 *      three spellings of one retinol, one of which appears in NO user message.
 *   4. A product ("Anua Oil Cleanser") stored as an ALLERGY, after Yuri herself
 *      said in-conversation "I wouldn't call it a true allergy."
 *   5. A reply truncated mid-sentence on "Anything you" (max_tokens 600).
 *
 * Each assertion locks a property that, if reverted, reintroduces a specific
 * real failure. Verified by reintroducing each bug and watching the test fail.
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

const src = read('src', 'lib', 'yuri', 'onboarding.ts')
const types = read('src', 'types', 'database.ts')
const memory = read('src', 'lib', 'yuri', 'memory.ts')

// ---------------------------------------------------------------------------
// 1. Fitzpatrick: both halves required, provenance must be honest
// ---------------------------------------------------------------------------

test('fitzpatrick extraction demands BOTH the burn and tan halves', () => {
  const line = src.split('\n').find((l) => l.startsWith('- fitzpatrick_scale:')) ?? ''
  assert.ok(line, 'the fitzpatrick extractor field description must exist')
  assert.ok(
    /BOTH/.test(line),
    'must require BOTH halves — "I burn easily" alone spans types 1-3'
  )
  assert.ok(
    /NEVER 1|never 1/.test(line),
    'must state that burns-then-tans is 2-3 and NEVER type 1 (the exact wrong value stored)'
  )
})

test('fitzpatrick_source is derived, never hardcoded to stated', () => {
  // The old line was `profileData.fitzpatrick_source = 'stated'` for ANY value,
  // so a model inference from half an answer was recorded as the user's own
  // declaration. Provenance that always says "stated" carries no information.
  // Anchor on the WRITE block specifically. A looser `if (extracted
  // .fitzpatrick_scale)` match also hits an unrelated quality-scoring function
  // earlier in the file, so the assertion silently graded the wrong code.
  const block = src.match(/profileData\.fitzpatrick_scale = [\s\S]{0,600}?fitzpatrick_source[^\n]*\n/)?.[0] ?? ''
  assert.ok(block, 'the fitzpatrick write block must exist')
  // Match an ASSIGNMENT of the bare literal with nothing conditional after it.
  // An earlier version of this assertion anchored on end-of-line and so was
  // tripped by the trailing `'stated' : 'estimated'` of the correct ternary —
  // it failed against working code, which is its own kind of broken test.
  assert.ok(
    !/fitzpatrick_source = 'stated'\s*(\n|$)/.test(block),
    'must NOT unconditionally hardcode source to stated'
  )
  assert.ok(
    /extracted\.fitzpatrick_source/.test(block) && /'estimated'/.test(block),
    'source must come from the extractor and fall back to estimated'
  )
})

test('ExtractedSkinProfile carries fitzpatrick_source', () => {
  assert.ok(
    /fitzpatrick_source\?: 'stated' \| 'estimated'/.test(types),
    'the extractor cannot report provenance if the type has no field for it'
  )
})

// ---------------------------------------------------------------------------
// 2. sun_history: matches the question actually asked, records negatives
// ---------------------------------------------------------------------------

test('sun_history captures burn response and mole/cancer answers, including negatives', () => {
  const line = src.split('\n').find((l) => l.startsWith('- sun_history:')) ?? ''
  assert.ok(line, 'the sun_history extractor field description must exist')
  assert.ok(
    /burn/i.test(line),
    'must cover burn response — that is what Yuri actually asks, and it landed nowhere'
  )
  assert.ok(
    /mole|cancer/i.test(line),
    'must cover the skin-cancer / mole safety answer'
  )
  assert.ok(
    /NEGATIVE/i.test(line),
    'must record negatives explicitly — "no history of skin cancer" is a clinical fact, not an absence'
  )
})

test('clinical fields are tracked so a missing safety answer is visible', () => {
  // Both were extractable and writable but appeared in no tracking list, so
  // nothing ever noticed sun_history was missing. This is what makes the gap
  // visible to Yuri as a "still needed" field.
  const allFields = src.match(/const ALL_FIELDS = \[[\s\S]*?\] as const/)?.[0] ?? ''
  assert.ok(allFields, 'ALL_FIELDS must exist')
  assert.ok(allFields.includes("'sun_history'"), 'sun_history must be tracked')
  assert.ok(allFields.includes("'medical_history'"), 'medical_history must be tracked')
})

test('REQUIRED_FIELDS is unchanged — tracking must not re-gate completion', () => {
  // Widening ALL_FIELDS is safe precisely because it does not change what
  // blocks completion. If clinical fields became required, every in-flight
  // onboarding would stall.
  const req = src.match(/const REQUIRED_FIELDS = \[[^\]]*\]/)?.[0] ?? ''
  assert.ok(
    !req.includes('sun_history') && !req.includes('medical_history'),
    'clinical fields must be TRACKED, not REQUIRED'
  )
})

// ---------------------------------------------------------------------------
// 3. Array merge: replace, never union
// ---------------------------------------------------------------------------

test('array fields are replaced, not unioned, on each extraction pass', () => {
  // The extractor re-reads the whole transcript every message, so the incoming
  // array is already a complete snapshot. Unioning accumulated phrasing
  // variance forever and could never converge — exact-string dedup cannot
  // collapse "Kiehl's" / "Kheils" / "Kieils".
  // Scope to mergeSkinProfileData. A bare `if (Array.isArray(value))` also
  // matches calculateOnboardingProgress, which legitimately branches on arrays
  // — grading that block would pass no matter what the merge does.
  const fn = src.match(/function mergeSkinProfileData[\s\S]*?\n\}/)?.[0] ?? ''
  assert.ok(fn, 'mergeSkinProfileData must exist')
  assert.ok(
    !/new Set\(\[\.\.\.existingArr/.test(fn),
    'must NOT union with the previous array — that is the duplicate-accumulation bug'
  )
  assert.ok(
    /REPLACE, don't union/.test(fn),
    'the replace-not-union decision must stay documented at the merge site'
  )
})

// ---------------------------------------------------------------------------
// 4. Allergies: ingredients only, honor Yuri's own classification
// ---------------------------------------------------------------------------

test('allergies extraction refuses product names and formula mismatches', () => {
  const line = src.split('\n').find((l) => l.startsWith('- allergies:')) ?? ''
  assert.ok(line, 'the allergies extractor field description must exist')
  assert.ok(
    /INGREDIENTS ONLY|ingredients only/i.test(line),
    'must restrict to ingredients — memory.ts injects this as a hard avoid list'
  )
  assert.ok(
    /NEVER store a product|never.*product or brand/i.test(line),
    'must forbid product/brand names (Anua Oil Cleanser was stored as an allergen)'
  )
  assert.ok(
    /mismatch/i.test(line),
    "must honor Yuri's own in-conversation judgment when she says it is not a true allergy"
  )
})

// ---------------------------------------------------------------------------
// 4b. Yuri must not read a stored PRODUCT as an ingredient allergy
// ---------------------------------------------------------------------------

test('the allergy context block distinguishes a product from an ingredient', () => {
  // Two live profiles hold product names in `allergies` ("Anua Oil Cleanser",
  // "innisfree green tea moisturizer"). The block used to say "Known
  // Allergies/Sensitivities ... ALWAYS check for these", which reads a whole
  // formula as an allergen and invites extrapolating the ban to anything
  // sharing an ingredient with it. The reaction is real; the inference was not.
  const block = memory.match(/## IMPORTANT: Things their skin reacted[\s\S]{0,700}/)?.[0] ?? ''
  assert.ok(block, 'the reaction context block must exist')
  assert.ok(
    /INGREDIENTS or whole PRODUCTS/.test(block),
    'must tell Yuri the list mixes ingredients and products'
  )
  assert.ok(
    /do not extrapolate/i.test(block),
    'must stop a product reaction becoming a blanket ingredient ban'
  )
})

// ---------------------------------------------------------------------------
// 5. Truncation + silent extraction failure
// ---------------------------------------------------------------------------

test('the user-facing onboarding stream has headroom for a full reply', () => {
  const streamBlock = src.match(/client\.messages\.stream\(\{[\s\S]*?max_tokens: (\d+)/)
  assert.ok(streamBlock, 'the onboarding stream call must set max_tokens')
  const tokens = Number(streamBlock[1])
  assert.ok(
    tokens >= 1000,
    `max_tokens ${tokens} is too low — 600 cut a real reply off mid-sentence on "Anything you"`
  )
})

test('extraction JSON parse failure is logged, not swallowed', () => {
  // A silent `return {}` is indistinguishable from "nothing to extract" — the
  // v10.3.4 silent-failure class, here with clinical fields at stake.
  const block = src.match(/\} catch[\s\S]*?return \{\}\n  \}\n\}/)?.[0] ?? ''
  assert.ok(block, 'the extraction catch block must exist')
  assert.ok(
    /console\.error/.test(block),
    'a dropped extraction must be visible in logs, never silent'
  )
})
