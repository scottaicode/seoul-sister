/**
 * Guard test — Korean gloss discipline + English-first medical referrals.
 *
 * July 25-26 2026. Bailey, on a live mobile scan: "Way too much Korean." A
 * corpus audit turned a taste complaint into a clinical-safety finding:
 *
 *   - 78 assistant messages contained 피부과 (dermatologist)
 *   - 55 of them contained NO English form of the word ANYWHERE
 *   - 19 messages discussed a mole / lesion / melanoma / biopsy
 *   - 10 of THOSE were Korean-only
 *
 * Ten real messages where Yuri handled a possible-skin-cancer conversation and
 * the referral — the single most consequential thing she says — shipped in a
 * script the reader could not read. Correct judgment, undelivered.
 *
 * ROOT CAUSE: the prompts' own clinical rules modeled Korean-first
 * ("recommend 피부과 (dermatologist)"). Yuri was copying the demonstrated
 * example. Four such lines existed across three surfaces.
 *
 * THE FIX IS A PROMPT CHANGE, NOT A REGEX. A gloss post-processor would have to
 * choose translations — semantic generation, not mechanical text handling — and
 * `cleanYuriResponse` runs AFTER streaming, so it could never fix what the user
 * actually reads. voice-cleanup regexes already destroyed real content twice
 * (Jun 23 2026, Jul 25 2026 — the latter hit a live prospect mid-sentence).
 *
 * TWO REGRESSIONS THIS TEST EXISTS TO PREVENT (both were real defects in the
 * first draft, caught by adversarial review before shipping):
 *   1. Flipping Korean from default-ON to default-OFF. The measured defect was
 *      gloss COVERAGE, not frequency. Over-correcting to near-zero Korean
 *      destroys the differentiator and solves a complaint nobody made.
 *   2. Deleting 피부과 from the allowlist / adding weight with no floor. That
 *      signals "this word is fraught," and the cheapest way to satisfy a fraught
 *      rule is to AVOID THE SITUATION — trading an unreadable referral for no
 *      referral. Strictly worse.
 *
 * LIMITS — READ THIS BEFORE TRUSTING A GREEN CHECK: this test proves the
 * instruction is in the file. It proves NOTHING about Yuri's output. The
 * v11.10.0 cumulative-give incident is the precedent: a correctly-worded gate
 * that the model ignored completely. The real teacher is the SQL audit in
 * KOREAN-GLOSS-DISCIPLINE-PLAN.md §7, re-run ~2 weeks post-ship.
 *
 * Pure — no compile, no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
const widget = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
const onboarding = read('src', 'lib', 'yuri', 'onboarding.ts')
const specialists = read('src', 'lib', 'yuri', 'specialists.ts')
const skinBreakdown = read('src', 'lib', 'intelligence', 'skin-breakdown.ts')

/** Every file that carries Yuri-voiced prompt prose with Korean in it. */
const ALL_PROMPT_SURFACES = [
  ['advisor', advisor],
  ['widget', widget],
  ['onboarding', onboarding],
  ['specialists', specialists],
  ['skin-breakdown', skinBreakdown],
]

/** The three surfaces that carry an explicit medical-referral rule. */
const REFERRAL_SURFACES = [
  ['advisor', advisor],
  ['widget', widget],
  ['onboarding', onboarding],
]

// ---------------------------------------------------------------------------
// 1. THE ROOT CAUSE. No prompt may MODEL a Korean-first referral.
//    This is the behavioral assertion — keep it strict even if prose changes.
// ---------------------------------------------------------------------------

test('no prompt models a Korean-first referral', () => {
  const KOREAN_FIRST = /(?:recommend|see|visit|consult|refer\s+to)\s+(?:a\s+|an\s+|your\s+)?피부과/i
  for (const [name, src] of ALL_PROMPT_SURFACES) {
    const offenders = src
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => KOREAN_FIRST.test(line))
    assert.equal(
      offenders.length,
      0,
      `${name}: prompt demonstrates a Korean-first referral — this is the exact ` +
        `pattern Yuri copied into 55 messages, 10 of them about possible skin cancer. ` +
        `Write "recommend a dermatologist (피부과)" instead. Offending line(s): ` +
        offenders.map(([n, l]) => `${n}: ${l.trim()}`).join(' | ')
    )
  }
})

test('the English-first worked example is present on every referral surface', () => {
  for (const [name, src] of REFERRAL_SURFACES) {
    assert.ok(
      /(?:see|recommend)\s+a\s+dermatologist\s*\(피부과\)/i.test(src),
      `${name}: lost the English-first referral example "see a dermatologist (피부과)"`
    )
  }
})

// ---------------------------------------------------------------------------
// 2. The LOAD-BEARING referral invariant, and its anti-hedging floor.
// ---------------------------------------------------------------------------

test('referral rule is marked load-bearing, not a style preference', () => {
  for (const [name, src] of REFERRAL_SURFACES) {
    assert.ok(
      /Referrals land in English \(LOAD-BEARING\)/.test(src),
      `${name}: the referral invariant lost its LOAD-BEARING marking. In the VOICE ` +
        `section it reads as taste and gets traded against punchiness — which is how ` +
        `55 unreadable referrals shipped.`
    )
  }
})

test('anti-hedging floor is present — the rule must never reduce referral frequency', () => {
  for (const [name, src] of REFERRAL_SURFACES) {
    assert.ok(
      /changes wording only, never the threshold/i.test(src),
      `${name}: missing the anti-hedging floor. Without it, the cheapest way for the ` +
        `model to satisfy a weighty referral rule is to AVOID REFERRING — trading an ` +
        `unreadable referral for no referral at all, which is strictly worse.`
    )
  }
})

test('referrals are exempt from the gloss-once allowance', () => {
  for (const [name, src] of REFERRAL_SURFACES) {
    assert.ok(
      /(?:does NOT apply to referrals|allowance does NOT apply)/i.test(src) ||
        /[Ee]very referral sentence/.test(src),
      `${name}: without an explicit exemption, a message can gloss 피부과 in paragraph 1 ` +
        `and close with a bare "don't skip the 피부과" — technically compliant, and the ` +
        `operative sentence is still unreadable.`
    )
  }
})

// ---------------------------------------------------------------------------
// 3. ANTI-OVERCORRECTION. Korean must stay default-ON.
// ---------------------------------------------------------------------------

test('Korean is never banned or discouraged wholesale', () => {
  const BANNED = /(?:never use Korean|avoid Korean terms|English only|no Korean terms|stop using Korean)/i
  for (const [name, src] of ALL_PROMPT_SURFACES) {
    assert.ok(
      !BANNED.test(src),
      `${name}: Korean got banned outright. The measured defect was gloss COVERAGE ` +
        `(16 of 55), never frequency. Korean-with-translation IS the differentiator — ` +
        `removing it solves a complaint nobody made.`
    )
  }
})

test('피부과 stays in the allowlist — deleting it invites a chilling effect', () => {
  for (const [name, src] of REFERRAL_SURFACES) {
    assert.ok(
      src.includes('피부과'),
      `${name}: 피부과 was removed. Dropping the term while calling referrals "the most ` +
        `consequential thing you say" signals the word is fraught, and the model routes ` +
        `around the situation instead of translating it.`
    )
  }
})

test('the "not parenthetical essays" brake survives', () => {
  for (const [name, src] of [['advisor', advisor], ['widget', widget], ['skin-breakdown', skinBreakdown]]) {
    assert.ok(
      /not parenthetical essays|never parenthetical essays/i.test(src),
      `${name}: lost the gloss-length brake. Without it, "미백 (brightening — literally ` +
        `'whitening,' a whole regulated category...)" is fully compliant. Gloss bloat is ` +
        `the predicted failure mode of this change.`
    )
  }
})

// ---------------------------------------------------------------------------
// 4. The gloss rule itself, and no self-contradiction across surfaces.
// ---------------------------------------------------------------------------

test('every Korean-bearing prompt carries a first-use gloss instruction', () => {
  for (const [name, src] of ALL_PROMPT_SURFACES) {
    assert.ok(
      /gloss/i.test(src),
      `${name}: no glossing instruction. This surface will emit bare Korean while the ` +
        `others translate — inconsistent behavior inside one product.`
    )
  }
})

test('no surface instructs Yuri NOT to define Korean terms', () => {
  // skin-breakdown.ts:95 used to say "never define them with parenthetical
  // essays" — the direct opposite of the new rule, on a user-facing surface.
  for (const [name, src] of ALL_PROMPT_SURFACES) {
    assert.ok(
      !/never define them/i.test(src),
      `${name}: still instructs Yuri never to define Korean terms — this directly ` +
        `contradicts the gloss rule on the other surfaces.`
    )
  }
})

test('onboarding does not call Korean "insider energy" while also demanding glosses', () => {
  // onboarding.ts:98 said "Use your voice: casual, Korean terms, insider energy"
  // while the new line asked for glosses — the prompt argued with itself.
  const bare = /casual, Korean terms, insider energy/.test(onboarding)
  assert.ok(
    !bare,
    'onboarding: line ~98 still says "casual, Korean terms, insider energy" with no ' +
      'gloss qualifier, contradicting the glossing rule earlier in the same prompt.'
  )
})

// ---------------------------------------------------------------------------
// 5. AI-First: guidance, never a cap or a script.
// ---------------------------------------------------------------------------

test('the rule is guidance, not a hard cap on Korean usage', () => {
  const CAP = /(?:at most (?:one|two|1|2) Korean|maximum of \d+ Korean|no more than \d+ Korean)/i
  for (const [name, src] of ALL_PROMPT_SURFACES) {
    assert.ok(
      !CAP.test(src),
      `${name}: a numeric cap on Korean terms appeared. Caps are the rigid-rules ` +
        `anti-pattern — how many terms serve THIS reader is Yuri's judgment.`
    )
  }
})
