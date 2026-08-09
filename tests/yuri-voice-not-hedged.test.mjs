/**
 * Guard test — Yuri's confident voice must survive compliance edits.
 *
 * WHY THIS EXISTS (Aug 9 2026)
 *
 * A marketing-claims rule was added to CLAUDE.md: do not advertise Seoul Sister
 * as "dermatologist-level," because the FTC has acted against skin apps for
 * unsubstantiated medical claims. That rule is about AD COPY. Scott immediately
 * flagged the real risk in it — that a future session reads a compliance note
 * and "helpfully" makes Yuri hedge, disclaim, and defer, destroying the exact
 * quality that makes her worth paying for.
 *
 * He is right, and the risk is not hypothetical: this repo's own history is a
 * list of times a rule was reworded and a behaviour silently changed (the widget
 * give/gate twice, the cumulative-give instrument). A prompt is prose; prose
 * drifts; nothing executes prose. So pin the anti-hedging guarantees.
 *
 * What Yuri may NOT lose:
 *   - "You don't hedge everything with 'it depends'"
 *   - reasoning from ancestry/age/climate/cycle "directly and without hedging"
 *   - stating confidence that MATCHES the evidence (calibration, not caution)
 *
 * What is NOT in tension with any of this, and must stay: the lesion referral
 * rule. Yuri's honest limit is that she cannot examine, biopsy, or prescribe —
 * she handles it by REFERRING, not by weakening ordinary skincare advice. A
 * Yuri who answers "is this moisturizer good for me" with "I'm just an AI,
 * consult a professional" is a regression, not compliance.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const widget = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
const claudeMd = read('CLAUDE.md')

test('the widget prompt keeps Yuri opinionated and un-hedged', () => {
  // NOTE the character class on the quotes: the source uses curly “it depends.”
  // A straight-quote regex silently fails to match and would pass vacuously.
  assert.ok(
    /You don't hedge everything with ["“]it depends[.”"]/.test(widget),
    'the anti-hedging line is the core of her voice — it must not be softened or removed'
  )
  assert.ok(
    /You have opinions and share them/.test(widget),
    'Yuri states opinions; removing this makes her a search engine'
  )
})

test('the widget prompt reasons from population patterns without hedging', () => {
  assert.ok(
    /use them, directly and without hedging/.test(widget),
    'clinical inputs must be reasoned from directly — this is why a specialist beats a search engine'
  )
  // Calibration is the discipline that keeps confidence honest. It is the
  // OPPOSITE of caution and must never be swapped for a blanket disclaimer.
  assert.ok(
    /state confidence that matches your evidence/.test(widget),
    'confidence must be CALIBRATED to evidence, not lowered across the board'
  )
})

test('the authenticated prompt keeps its own anti-hedging instruction', () => {
  // advisor.ts carries the anti-hedging guarantee in the tool-call honesty rule
  // ("own it directly without hedging") rather than a population-patterns
  // section. Pin what is actually there rather than asserting a line that has
  // never existed — a test that demands absent text teaches people to delete it.
  assert.ok(
    /without hedging/.test(advisor),
    'the authenticated prompt must keep its instruction to own things directly, without hedging'
  )
})

test('Yuri has 20+ years of expertise in her own self-description', () => {
  assert.ok(
    /20\+ years across Korean formulation labs/.test(widget),
    'her stated expertise is what justifies the advice; do not dilute it'
  )
})

test('no blanket "I am just an AI" disclaimer has been added to any Yuri prompt', () => {
  // The specific regression shape: a general-purpose medical disclaimer applied
  // to ORDINARY skincare questions. The lesion/referral rules are deliberately
  // NOT matched here — those are scoped, correct, and must stay.
  const BLANKET_DISCLAIMER =
    /\b(?:I'?m (?:just|only) an AI|I am not a (?:doctor|dermatologist|medical professional)|this is not medical advice|consult a (?:doctor|professional) before (?:using|trying) any)\b/i
  for (const [label, src] of [['widget', widget], ['advisor', advisor]]) {
    assert.ok(
      !BLANKET_DISCLAIMER.test(src),
      `${label}: a blanket AI/medical disclaimer was added — that is the regression this test exists to catch. Scoped referral rules (lesions, spreading rashes, infections) are correct and are not what this matches.`
    )
  }
})

test('the referral rule Yuri actually needs is still present', () => {
  // The honest limit, handled the right way: refer rather than hedge.
  assert.ok(
    /dermatologist|피부과/i.test(widget),
    'the referral path must exist — it is how Yuri handles what she genuinely cannot assess'
  )
})

test('the CLAUDE.md claims rule states it must not soften Yuri', () => {
  // The rule that created this risk must carry its own antidote, because the
  // next session will read CLAUDE.md, not this test.
  assert.ok(
    /NOT an instruction to soften Yuri/i.test(claudeMd),
    'the marketing-claims rule must say plainly that it does not change how Yuri speaks'
  )
  assert.ok(
    /is a REGRESSION, not compliance/i.test(claudeMd),
    'CLAUDE.md must name the hedging failure mode explicitly so a future session cannot misread the rule'
  )
})
