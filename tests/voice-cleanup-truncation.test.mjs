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

// ---------------------------------------------------------------------------
// 6. The trailing-closer rule removes a whole final question, never the end of
//    a sentence (Nov 11 2026).
// ---------------------------------------------------------------------------

test('a sentence that merely contains a closer phrase keeps its ending', () => {
  // Each stored tail below is a real reply that was cut to a dangling word.
  const cases = [
    'All it takes is the CeraVe cream. Everything else is just a way to keep me involved if you want me to keep checking in.',
    'Barrier heals first, then TXA solo, then we find a night for this. Sound good, or want me to slow it down?',
    'A gentler exfoliation cadence and a winter-ready moisturizer swap. Anything you want me to change?',
    'Snap the Glass Skin Score. Then when you are back, want me to compare it with the 62?',
    'Do you know roughly where you land in Korean shade ranges, or want me to pull the shade chart?',
    'Tell me if you want me to go deeper on the retinol',
    'I can do that whenever you want me to.',
    'It is fine to tell me this does not make sense',
    'The plan will only sound good once the barrier calms down.',
  ]
  for (const input of cases) {
    assert.equal(clean(input), input, `the ending was cut:\n  in:  ${input}\n  out: ${clean(input)}`)
  }
})

test('an empty closing question is still removed, and only that sentence', () => {
  assert.equal(clean('Use it every other night. Sound good?'), 'Use it every other night.')
  assert.equal(clean('Use it every other night.\n\nDoes that make sense?'), 'Use it every other night.')
  assert.equal(clean('Why this one? It is gentle. Sound like a plan?'), 'Why this one? It is gentle.')
  assert.equal(clean('That covers it. Ready to dive in?'), 'That covers it.')
  // A statement is not a closing question.
  assert.equal(clean('Use it nightly. Sounds good.'), 'Use it nightly. Sounds good.')
  // The question must be the LAST thing in the reply.
  assert.equal(clean('Sound good? Then start tonight.'), 'Sound good? Then start tonight.')
  // After "!" or "?" as well as ".", and in any case.
  assert.equal(clean('Great! Sound good?'), 'Great!')
  assert.equal(clean('Is it gentle? Yes. sound good?'), 'Is it gentle? Yes.')
})

test('an offer of a real next step is never removed (Nov 11 2026)', () => {
  // The prompts tell Yuri to make these. Stripped, the offer showed on screen,
  // vanished when the cleaned text replaced it, and was missing from the
  // history when the person answered "yes".
  const offers = [
    'Got it. Want me to save this to your Routine page?',
    'Those are the three I would look at. Want me to pull live prices on any of these?',
    'That is the pick. Want me to pull live prices?',
    'Use the pad.\n\nWant me to compare it vs. the toner?',
    'Those are the three. Want me to look for more options before you decide?',
    'It is not in our catalog. Want me to add it to your library first as a custom entry, then tag it from there?',
    'That is the routine. want me to save it?',
  ]
  for (const input of offers) assert.equal(clean(input), input, input)
  // Closed world: the rule names exactly these closers and nothing else.
  const rule = src.match(/\(\?:(Sound good[^)]*\(\?:dive in\|get started\))\)/)
  assert.ok(rule, 'closer rule not found')
  assert.equal(rule[1], 'Sound good|Sounds good|Does that sound good|Does that feel doable|Make sense|Does that make sense|Sound like a plan|Ready to (?:dive in|get started)')
})

test('the closer rule leaves these alone (each was damaged or deleted before)', () => {
  const cases = [
    // The reply is only the question: storing an empty message is worse than the closer.
    'Want me to pull live prices on any of these?',
    'Sound good?',
    // A list item, a colon and a line break are not sentence ends.
    'Tell me two things.\n1. Where is it?\n2. Want me to check the price?',
    'That is the routine:\nWant me to save this to your Routine page?',
    'Use the cream: Want me to save it?',
    'Plan\nWant me to save this?',
    '- Want me to pull prices?',
    'That one is right (the gentle one) Want me to save it?',
    // A choice is a real question.
    'Two options. Want me to go with A, or B?',
    'Stop the BHA. Want me to check it or not?',
    // Two questions: the first is not the end of the reply, the second is not a closer.
    'Stop the BHA. Want me to check whether the Round Lab sunscreen is safe? Or the BOJ one?',
    // A question that runs over a line break is not a one-line closer.
    'Plan:\n1. CeraVe at night.\nWant me to save\nthis?',
    'Use it nightly. Want me to save\nthis?',
    // A number before the dot is not a sentence end.
    'Use SPF 50. Want me to find one?',
  ]
  for (const input of cases) assert.equal(clean(input), input, input)
})

test('the setup chat alone still drops a short trailing offer, which it has no tools to carry out', () => {
  const start = src.indexOf('const OFFER_CLOSER = ')
  const re = eval(src.slice(start + 'const OFFER_CLOSER = '.length, src.indexOf('\n', start)))
  const setup = (s) => clean(s).replace(re, '').trim()
  assert.equal(setup('Your barrier needs a rest first. Want me to build your full routine?'), 'Your barrier needs a rest first.')
  assert.equal(setup('That is the one change. Want me to pull prices?'), 'That is the one change.')
  // The same bounds as the closer rule: never mid-sentence, never the whole reply, never a choice.
  for (const keep of [
    'It is just a way to keep me involved if you want me to keep checking in.',
    'Want me to start with your cleanser?',
    'Two paths. Want me to start with the cleanser, or the sunscreen?',
    '1. Cleanser first.\n2. Want me to go on?',
  ]) assert.equal(setup(keep), keep, keep)
  // Wiring: the setup route asks for it in both places, and nothing else does.
  const read2 = (p) => readFileSync(join(__dirname, '..', p), 'utf8')
  assert.equal((read2('src/app/api/yuri/onboarding/route.ts').match(/cleanYuriResponse\(fullResponse, \{ stripUnfulfillableOffers: true \}\)/g) ?? []).length, 2)
  for (const p of ['src/app/api/yuri/chat/route.ts', 'src/app/api/widget/chat/route.ts', 'src/lib/yuri/advisor.ts', 'src/lib/email/lead-email.ts']) {
    assert.doesNotMatch(read2(p), /stripUnfulfillableOffers/, p)
  }
  assert.match(src, /if \(opts\.stripUnfulfillableOffers\) cleaned = cleaned\.replace\(OFFER_CLOSER, ''\)/)
})

test('the REAL cleanYuriResponse: offers are kept by default and dropped only when the setup chat asks', async () => {
  const ts = (await import('typescript')).default
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const { cleanYuriResponse } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
  const offer = 'That is the pick. Want me to pull live prices?'
  assert.equal(cleanYuriResponse(offer), offer)
  assert.equal(cleanYuriResponse(offer, {}), offer)
  assert.equal(cleanYuriResponse(offer, { stripUnfulfillableOffers: false }), offer)
  assert.equal(cleanYuriResponse(offer, { stripUnfulfillableOffers: true }), 'That is the pick.')
  // The empty closers go either way, and the Nov 11 truncation stays fixed in the real function.
  assert.equal(cleanYuriResponse('Use it nightly. Sound good?'), 'Use it nightly.')
  const whole = 'Everything else is just a way to keep me involved if you want me to keep checking in.'
  assert.equal(cleanYuriResponse(whole), whole)
  assert.equal(cleanYuriResponse(whole, { stripUnfulfillableOffers: true }), whole)
})
