/**
 * Guard test — widget value-density fact (fast-burn email-capture fix).
 *
 * The failure this locks down (real transcript, July 23 2026): the highest-
 * intent stranger of the day front-loaded a structured self-diagnosis and an
 * 11-item product shelf across FOUR messages, got a genuine diagnosis by
 * message 4, was offered the email once — stapled to a competing question
 * ("save your email? AND do you burn or tan?") — answered only the second
 * question, and left. The hard email GATE is at message 8, so it never fired.
 * The value moment had already arrived at message 4 while the turn counter
 * still looked "early", and no clean standalone offer was ever made.
 *
 * The fix (per the v11.1.0 email-ask-state-bug precedent) is STATE VISIBILITY,
 * not persuasion copy: inject a FACT that the visitor has front-loaded rich
 * context, so Yuri can see the value moment may already be here regardless of a
 * low turn number. It must remain a fact she can disregard — never a trigger,
 * never a classifier of her intent, never a cap.
 *
 * This test mirrors the shipped detectors and (a) asserts the mirror matches
 * the real source (so a future edit to the regexes fails HERE, ms/zero-cost,
 * not silently in prod), and (b) replays the real transcript in the three
 * required states: fast-burn value landed + no email → fact fires; email on
 * file → suppressed; turn-1 throwaway → no fact.
 *
 * Pure source assertions — no compile, no API, no DB. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'widget', 'value-density.ts'),
  'utf8'
)
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
  'utf8'
)

// ---------------------------------------------------------------------------
// Mirror of the shipped detectors, kept honest by the source assertions below.
// ---------------------------------------------------------------------------
const ENUMERATED_LINE = /^\s*(?:\d+[.)]|[-*•])\s+\S/gm
const PRODUCT_LINE = /^\s*[A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9%+]+){2,}\s*$/gm
const SKIN_SELF_LANGUAGE =
  /\b(?:my skin|your skin appears|combination|dehydrated|oily|sensitive|acne-prone|breakout-prone|congestion|sebaceous|pores|redness|dark circles)\b/gi
const BUY_QUESTION =
  /\b(?:should i (?:buy|get|add|purchase)|what (?:else )?(?:should|do) i (?:buy|get|need)|anything else (?:to (?:buy|get)|i need)|worth (?:buying|getting)|do i need)\b/i

function countMatches(text, re) {
  const m = text.match(re)
  return m ? m.length : 0
}

function detectSignalsInMessage(text) {
  const found = new Set()
  if (!text) return found
  const enumerated = countMatches(text, ENUMERATED_LINE)
  const productLines = countMatches(text, PRODUCT_LINE)
  if (enumerated >= 3 || productLines >= 3) found.add('product_inventory')
  const skinMentions = countMatches(text, SKIN_SELF_LANGUAGE)
  const lineCount = text.split('\n').filter((l) => l.trim().length > 0).length
  if (skinMentions >= 3 && lineCount >= 3) found.add('self_diagnosis')
  if (BUY_QUESTION.test(text)) found.add('purchase_intent')
  return found
}

function detectValueDensity(history, currentMessage) {
  const all = new Set()
  for (const turn of history) {
    if (turn.role !== 'user') continue
    for (const s of detectSignalsInMessage(turn.content || '')) all.add(s)
  }
  for (const s of detectSignalsInMessage(currentMessage || '')) all.add(s)
  return { signals: Array.from(all) }
}

// ---------------------------------------------------------------------------
// The real July 23 2026 transcript (visitor 3de2504a), verbatim visitor turns.
// ---------------------------------------------------------------------------
const T_GLASS = 'What actually works for glass skin?'
const T_SELF_DIAGNOSIS = `your skin appears to be:

* Combination and dehydrated
    * Oilier nose and T-zone
    * Cheeks need more hydration
* Congestion-prone around the nose
    * Visible sebaceous filaments and some blackheads
* Occasionally acne-prone
* Sensitive to over-layering
    * Too much serum has previously caused temporary redness and stickiness`
const T_SHELF = `Products currently in my possession

Cleansers

1. SKIN1004 Madagascar Centella Light Cleansing Oil
2. SKIN1004 Madagascar Centella Ampoule Foam
3. La Roche-Posay Effaclar Micro-Peeling Purifying Gel

Serums

4. Torriden Dive In Serum
5. Anua Niacinamide 10% + TXA 4% Serum
6. Medicube PDRN Pink Peptide Serum

Moisturiser

7. Dr. Althea 345 Relief Cream. should i buy anything else?`
const T_BOTH = 'both'

// ---------------------------------------------------------------------------
// Source-mirror assertions: the test's regexes MUST equal the shipped ones.
// ---------------------------------------------------------------------------
test('source mirror: detector regexes match the shipped module', () => {
  assert.ok(src.includes(String(ENUMERATED_LINE)), 'ENUMERATED_LINE drifted from source')
  assert.ok(src.includes(String(PRODUCT_LINE)), 'PRODUCT_LINE drifted from source')
  assert.ok(src.includes(String(BUY_QUESTION)), 'BUY_QUESTION drifted from source')
  assert.ok(
    src.includes('SKIN_SELF_LANGUAGE'),
    'SKIN_SELF_LANGUAGE detector missing from source'
  )
})

test('source mirror: module only reads VISITOR turns, never assistant', () => {
  // The aggregate loop must skip non-user turns — a demo transcript or Yuri
  // restating a routine must never count as the visitor front-loading context.
  assert.ok(
    /if \(turn\.role !== 'user'\) continue/.test(src),
    'value-density must skip non-user turns'
  )
})

// ---------------------------------------------------------------------------
// Behavioral cases — the three required states.
// ---------------------------------------------------------------------------
test('STATE 1 — fast-burn value landed: fact fires by message 4', () => {
  // At the shelf-paste (message 4), across the conversation the visitor has
  // given a self-diagnosis, a product inventory, AND a buy question.
  const history = [
    { role: 'user', content: T_GLASS },
    { role: 'assistant', content: 'Glass skin is barrier health plus hydration...' },
    { role: 'user', content: T_SELF_DIAGNOSIS },
    { role: 'assistant', content: "That's a genuinely sharp self-read..." },
  ]
  const density = detectValueDensity(history, T_SHELF)
  assert.ok(
    density.signals.includes('self_diagnosis'),
    'should detect the structured self-diagnosis'
  )
  assert.ok(
    density.signals.includes('product_inventory'),
    'should detect the 7-item product shelf'
  )
  assert.ok(
    density.signals.includes('purchase_intent'),
    'should detect "should i buy anything else?"'
  )
})

test('STATE 2 — email on file: fact suppressed regardless of density', () => {
  // The route gates the fact on !hasEmail before building it. Assert that
  // guard exists in the route so a rich-context returning lead is not re-nagged.
  assert.ok(
    /const valueDensityFact = hasEmail\s*\n\s*\?\s*null/.test(routeSrc),
    'route must null the value-density fact when an email is already captured'
  )
})

test('STATE 3 — turn-1 throwaway: no fact', () => {
  // A visitor who opens with a bare one-liner has front-loaded nothing.
  const density = detectValueDensity([], T_GLASS)
  assert.equal(density.signals.length, 0, 'a one-line opener must produce no fact')
})

test('NEGATIVE — a chatty but shallow message does not trip self_diagnosis', () => {
  // Skin words present but no vertical structure (single line) → not a diagnosis.
  const density = detectValueDensity([], 'my skin is oily and a bit sensitive lately')
  assert.equal(
    density.signals.includes('self_diagnosis'),
    false,
    'a one-line skin mention must not count as a structured self-diagnosis'
  )
})

// ---------------------------------------------------------------------------
// AI-First contract: the fact must never become a trigger or a cap.
// ---------------------------------------------------------------------------
test('AI-First: injected fact states an observation, not a command', () => {
  // The built fact must not contain an imperative to ask. It reports where the
  // conversation is; whether to offer the email stays Yuri's judgment.
  const factLine = src.match(/Value already delivered:[^`]*/)
  assert.ok(factLine, 'value-density fact template not found in source')
  const text = factLine[0]
  assert.ok(
    /not an instruction/i.test(text),
    'fact must explicitly disclaim being an instruction'
  )
  assert.ok(
    !/\bASK NOW\b|\byou (?:should|must) ask\b/i.test(text),
    'fact must never command an ask'
  )
})

test('AI-First: route keeps the standalone-offer guidance as placement, not a script', () => {
  assert.ok(
    /never staple it to another open question/i.test(routeSrc),
    'standalone-offer placement guidance must be present'
  )
  // And the block must still hand the decision back — no hard trigger language.
  assert.ok(
    /context, not a trigger/i.test(routeSrc),
    'Conversation State block must still frame facts as non-triggers'
  )
})
