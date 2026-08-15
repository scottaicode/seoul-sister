/**
 * Guard test — Yuri distinguishes what a visitor TOLD her from what she INFERRED.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Aug 15 2026, a real cold visitor on the Spanish Mediterranean coast. Yuri asked
 * the sun-response question correctly, twice, exactly as the prompt instructs
 * ("out in the sun with no sunscreen — do you burn, tan, or both?"). The visitor
 * answered NEXT TO it: "I have fair skin. I don't burn because I don't sunbathe."
 *
 * That is a statement about BEHAVIOUR, not about how her skin responds — someone
 * who avoids the sun has no recent evidence either way. Yuri read it as low
 * pigmentation risk, replied "Fair skin changes everything, and in your favour,"
 * and escalated straight to a retinal (a step above retinol).
 *
 * The inference was reasonable and probably correct. Presenting it back as
 * SETTLED FACT was the defect: the visitor never got the chance to say "actually,
 * I tan easily." The cost is asymmetric — nearly free on genuinely fair skin,
 * months of post-inflammatory hyperpigmentation on a deeper skin tone whose
 * owner is handed an active too fast.
 *
 * This is the v11.10.0 Clinical Data Honesty rule (`fitzpatrick_source`:
 * 'stated' | 'estimated' | NULL) reaching the widget, which had no equivalent —
 * the word "fitzpatrick" appeared nowhere in the anonymous prompt.
 *
 * WHY THESE ASSERTIONS ARE SHAPED THIS WAY
 * An earlier guard test in this same session was broken by an adversarial
 * reviewer in seconds, because it banned command VOCABULARY. The attacker picks
 * the verb. So this file asserts on SHAPE and on the specific regression that
 * matters most here: that the addition must not turn Yuri into a hedged,
 * disclaimer-heavy advisor, which CLAUDE.md calls a REGRESSION rather than
 * compliance. A "fix" that made her cautious would be worse than the bug.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

/**
 * The provenance rule ONLY.
 *
 * Scoping matters: slicing to the end of the prompt sweeps in unrelated rules —
 * the email-ask cadence legitimately contains "do NOT ask again" — and the test
 * then fails on text it was never meant to police. A guard test that polices
 * the wrong region produces pressure to reword innocent prompt text.
 */
function provenanceSection(p) {
  const start = p.indexOf('Never quote your own inference back')
  assert.ok(start > -1, 'provenance rule not found')
  const end = p.indexOf('asks you to soften nothing', start)
  assert.ok(end > -1, 'provenance rule end marker not found')
  return p.slice(start, end + 40)
}

/** The widget system prompt, as shipped. */
function prompt() {
  const src = readFileSync(ROUTE, 'utf8')
  const start = src.indexOf('const YURI_WIDGET_SYSTEM')
  assert.ok(start > -1, 'widget system prompt not found')
  return src.slice(start, src.indexOf('\n`', start))
}

test('the provenance rule exists and names the real failure', async () => {
  const p = prompt()
  // The distinction itself — told vs worked out — must be present.
  assert.match(p, /Never quote your own inference back as something they said/i,
    'the prompt must draw the stated-vs-inferred distinction')
  // Grounded in the actual transcript rather than an abstraction. A rule with a
  // concrete failure attached survives rewording; an abstract one gets sanded off.
  assert.match(p, /don't burn because I don't sunbathe/i,
    'the real answer that caused the defect must be quoted')
  assert.match(p, /describes her habits, not her skin/i,
    'the prompt must explain WHY that answer is not a sun-response answer')
})

test('the PIH stakes still live in the sun-response rule, not duplicated here', async () => {
  // A second adversarial review (Fable 5) cut this rule from ~250 words to ~130.
  // Its strongest point: in an ANONYMOUS widget nearly every clinical input is
  // inferred, so a long rule taxing inferred inputs taxes almost every sentence
  // Yuri writes — the same "fires on ~100% of cases" flaw already rejected for
  // the price-staleness threshold, missed here by the same author.
  //
  // So the deeper-skin-tone stakes are NOT restated here. They already live,
  // better, in the sun-response rule above. Duplicating them was narration.
  const p = prompt()
  assert.match(p, /post-inflammatory hyperpigmentation/i,
    'the PIH stakes must still be stated somewhere in the prompt')
  const section = provenanceSection(p)
  assert.ok(section.length < 1000,
    `the provenance rule must stay short (was ${section.length} chars); length is the hedging risk`)
})

test('REGRESSION GUARD: it must not make Yuri hedge or add disclaimers', async () => {
  const p = prompt()
  // The most likely way this "fix" goes wrong is by producing a more cautious
  // Yuri. CLAUDE.md is explicit that this is a regression, not compliance.
  const section = provenanceSection(p)
  assert.match(section, /provenance, not caution/i,
    'the rule must name itself as provenance rather than caution')
  assert.match(section, /asks you to soften nothing/i,
    'the rule must disclaim softening')
  assert.match(section, /stays exactly as confident/i,
    'the recommendation must be stated to keep its confidence')
})

test('ATTACK: it does not instruct her to re-ask or gate advice', async () => {
  const p = prompt()
  const section = provenanceSection(p)
  // A version that told her to re-ask until she gets a clean answer would be an
  // interrogation, and would contradict the existing "never gate advice on it"
  // rule two paragraphs above.
  // Match an INSTRUCTION to re-ask, not the prohibition against it. The shipped
  // text contains "Nothing here asks you to ... re-ask a question someone
  // already answered clearly" — a negation, and exactly the sentence we want.
  // A test that cannot tell "re-ask them" from "do not re-ask them" would force
  // the prompt to get vaguer to pass, i.e. it would make the prompt worse. So
  // drop the disclaiming sentence, then assert on what is left.
  const withoutDisclaimer = section
    .split(/(?<=\.)\s+/)
    .filter((s) => !/^Nothing here asks you to/i.test(s.trim()))
    .join(' ')
  assert.ok(
    !/\b(?:ask again|re-?ask|keep asking|do not proceed|withhold|refuse)\b/i.test(withoutDisclaimer),
    'provenance must not become an instruction to interrogate or gate advice'
  )
  // And no gating language at all, in any form.
  assert.ok(!/\bgate\s+(?:advice|your advice|the answer)\b/i.test(section),
    'advice must never be gated on provenance')
  // The tightened rule never mentions asking at all — it is about how a
  // conclusion is PHRASED, so there is nothing to re-ask.
  assert.ok(!/\bask\b/i.test(section),
    'the rule must not turn into an instruction to ask anything')
})

test('ATTACK: it does not ban the inference itself', async () => {
  const p = prompt()
  const section = provenanceSection(p)
  // The inference was RIGHT. Banning it would cost real clinical reasoning —
  // exactly what the "reason from population patterns" rule protects.
  assert.ok(
    !/\b(never (?:infer|assume|guess)|do not infer|must not infer)\b/i.test(section),
    'inferring is correct clinical reasoning; only presenting it as stated fact is the bug'
  )
  assert.match(section, /was sound/i,
    'the prompt must affirm the inference was sound')
})

test('ATTACK: it does not contradict the existing sun-response rule', async () => {
  const p = prompt()
  // The existing rule already says to ask before handing over an acid or
  // retinoid, and never to guess from name/ancestry/location. The addition must
  // sit beside that, not restate or fight it.
  assert.match(p, /Never guess it from their name, ancestry, or where they live/i,
    'the original rule must still be present')
  const idxOriginal = p.indexOf('Never guess it from their name')
  const idxNew = p.indexOf('Never quote your own inference back')
  assert.ok(idxNew > idxOriginal,
    'the provenance rule belongs after the sun-response rule it refines')
})

test('the fix is a CLAUSE, not a ritual — it shows the cheap version', async () => {
  const p = prompt()
  // If the remedy is expensive, it gets skipped. The prompt models the actual
  // one-clause phrasing so the cost is visibly near zero.
  const section = provenanceSection(p)
  assert.match(section, /one clause carries it/i, 'the remedy must be explicitly cheap')
  // The modelled line was rewritten in review: the first draft's "tell me if you
  // actually do tan and I will slow this down" doubts the visitor's honesty
  // ("actually") and pre-announces retreat ("I will slow this down") — liability
  // register, not expert register.
  assert.match(section, /pace this as if you burn/i,
    'the prompt must model an expert phrasing, not a self-protective one')
  assert.ok(!/\bactually do tan\b/i.test(section),
    'the doubting phrasing must not return')
})
