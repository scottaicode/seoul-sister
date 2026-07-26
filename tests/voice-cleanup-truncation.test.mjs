/**
 * Guard test — voice cleanup must never eat load-bearing content.
 *
 * The July 25 2026 incident: Bailey had a friend (Caroline) cold-test Yuri.
 * Caroline's first message was a long, high-intent description of post-accutane
 * acne and her skin-cycling routine. Yuri's answer was genuinely excellent —
 * and the stored/rendered reply BEGAN MID-SENTENCE:
 *
 *     ". that jumps out immediately: you had accutane-level acne..."
 *
 * Cause: the mid-sentence filler rules in voice-cleanup.ts made trailing
 * punctuation optional (`[.,:]?`) and consumed following whitespace. When the
 * filler ran INTO the next clause ("Let me break this down, the thing that
 * jumps out..."), the regex ate the comma and the clause's opening words,
 * leaving a decapitated fragment. On a first impression that reads as broken
 * software, not an advisor.
 *
 * Same failure class as the Jun 23 2026 "I can't promise X, but" bug: a
 * COSMETIC cleanup rule destroying REAL content. The rule of this file:
 * cleanup may remove filler, but must never remove a word the user needed.
 *
 * Each assertion below fails if the specific bug is reintroduced.
 * Pure — no compile, no DB, no network. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = join(__dirname, '..', 'src', 'lib', 'yuri', 'voice-cleanup.ts')
const src = readFileSync(SRC_PATH, 'utf8')

/**
 * Execute the REAL BANNED_PATTERNS array out of the TypeScript source, so this
 * test can never drift from what actually ships. We slice the literal and
 * evaluate it — the rules are plain regex/string pairs with no imports.
 */
function loadRules() {
  const start = src.indexOf('const BANNED_PATTERNS')
  assert.ok(start !== -1, 'BANNED_PATTERNS not found — did the file get restructured?')
  const open = src.indexOf('[', start)
  const end = src.indexOf('\n]', open)
  assert.ok(end !== -1, 'could not find end of BANNED_PATTERNS array')
  const literal = src
    .slice(open, end + 2)
    // strip the TS type annotation usage and comments are fine inside eval
    .replace(/\bpattern:/g, 'pattern:')
  // eslint-disable-next-line no-eval
  const rules = eval(literal)
  assert.ok(Array.isArray(rules) && rules.length > 0, 'rules did not parse')
  return rules
}

/** Mirror of cleanYuriResponse's transform loop. */
function clean(text) {
  let cleaned = text
  for (const { pattern, replacement } of loadRules()) {
    cleaned = cleaned.replace(pattern, replacement)
  }
  cleaned = cleaned
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()
  if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return cleaned
}

// ---------------------------------------------------------------------------
// 1. THE CAROLINE REGRESSION — the exact shape that broke.
// ---------------------------------------------------------------------------

test('filler fused to a following clause never decapitates that clause', () => {
  const cases = [
    "Let me break this down, the thing that jumps out immediately: you had accutane-level acne.",
    "Okay. Let me break this down, that jumps out immediately: you had accutane-level acne.",
    "Right. Here's the thing, that jumps out immediately: your barrier is compromised.",
    "Here's the deal, the Dr. Dennis Gross pads are likely the irritant.",
    "Let me explain, the retinol and the acid are fighting each other.",
  ]
  for (const input of cases) {
    const out = clean(input)
    assert.ok(
      !/^[\s]*[.,;:]/.test(out),
      `response must never begin with orphan punctuation.\n  in:  ${input}\n  out: ${out}`
    )
    // The load-bearing noun must survive.
    const keyword = input.match(/jumps out|Dennis Gross|retinol/)?.[0]
    if (keyword) {
      assert.ok(
        out.includes(keyword),
        `cleanup destroyed load-bearing content "${keyword}".\n  out: ${out}`
      )
    }
  }
})

test('the exact stored Caroline fragment can no longer be produced', () => {
  const input = "Let me break this down, that jumps out immediately: you had accutane-level acne"
  const out = clean(input)
  // The buggy version produced ". that jumps out immediately: ..." — note the
  // orphan-punct rule runs EARLIER in the array, so it does NOT rescue this;
  // the fragment survives to the DB exactly as stored on Jul 25 2026.
  assert.ok(!/^[\s]*[.,;:]/.test(out), `still decapitated: ${out}`)
  assert.ok(out.toLowerCase().includes('accutane'), `lost the content: ${out}`)
  // Strongest assertion: the reply must still open with a real capitalized
  // word, not a fragment. Anything else is the bug.
  assert.match(out, /^[A-Z]/, `reply does not start with a real word: ${out}`)
  // And the clause that followed the filler must be intact, not swallowed.
  // (Case-insensitive: removing a leading filler legitimately re-capitalizes
  // the new first word, which is correct behavior, not damage.)
  assert.ok(
    /\bthat jumps out immediately\b/i.test(out),
    `the clause after the filler was damaged: ${out}`
  )
})

// ---------------------------------------------------------------------------
// 2. A real word starting with "Ha" must survive the laugh-opener rule.
// ---------------------------------------------------------------------------

test('"Ha"-prefixed real words are not eaten by the laugh-opener rule', () => {
  const cases = [
    // The one that actually trips `^Ha,?\s+`: the standalone interjection "Ha"
    // used as a real word, with no comma. Without the comma requirement this
    // loses the word entirely.
    'Ha is what most brands hope you say instead of reading the label.',
    'Hang on, that retinol percentage matters here.',
    'Hard to say without knowing your age.',
    'Have you been using sunscreen every morning?',
    'Happy to pull pricing on that.',
    'Half your routine is doing the same job.',
  ]
  for (const input of cases) {
    const out = clean(input)
    assert.equal(out, input, `laugh rule mangled a real sentence:\n  in:  ${input}\n  out: ${out}`)
  }
})

test('genuine laugh openers are still stripped', () => {
  assert.equal(clean('Ha, that one is a classic marketing trap.'), 'That one is a classic marketing trap.')
  assert.equal(clean('Haha, fair enough.'), 'Fair enough.')
})

// ---------------------------------------------------------------------------
// 3. Standalone filler sentences ARE still removed (the rules must still work).
// ---------------------------------------------------------------------------

test('standalone filler sentences are still stripped', () => {
  assert.equal(
    clean("Let me break this down. Your barrier is compromised."),
    'Your barrier is compromised.'
  )
  assert.equal(
    clean("Here's the thing. Two of your four nights are actives."),
    'Two of your four nights are actives.'
  )
})

// ---------------------------------------------------------------------------
// 4. The Jun 23 2026 sibling incident must stay fixed.
// ---------------------------------------------------------------------------

test('honest "I can\'t promise X, but ..." content is preserved', () => {
  const input =
    "So I can't promise a truly clear one, but almost every no-cast SPF is slightly tinted."
  const out = clean(input)
  assert.ok(out.toLowerCase().includes('promise'), `honesty content stripped: ${out}`)
  assert.ok(!/^[\s]*[.,;:]/.test(out), `orphan punctuation: ${out}`)
})

// ---------------------------------------------------------------------------
// 5. Abbreviations with periods must not be mistaken for sentence breaks.
// ---------------------------------------------------------------------------

test('abbreviations like "vs." and "denat." are untouched', () => {
  const cases = [
    'The delivery format (pad vs. bottle) is not what makes a BHA better.',
    'Alcohol denat. in a sunscreen flashes off in seconds.',
  ]
  for (const input of cases) {
    assert.equal(clean(input), input, `abbreviation damaged: ${clean(input)}`)
  }
})
