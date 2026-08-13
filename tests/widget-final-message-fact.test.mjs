/**
 * Guard test — the final-message fact (Aug 13 2026).
 *
 * THE DEFECT. The Conversation State block told Yuri the exact truth on her
 * last turn ("free message #12 of 12 ... exactly 0 free messages remain"), but
 * the ternary that INTERPRETS that number had only two live arms, split at
 * `> 3`. Messages #9, #10, #11 and #12 all received a byte-identical
 * instruction, and that instruction only granted permission to mention the
 * meter. Nothing anywhere in the prompt said what a FINAL message calls for.
 *
 * The consequence, measured across every high-engagement conversation on
 * record: 7 of 9 ended with no mention of the subscriber side at all. In the
 * Aug 13 conversation (visitor 1ce3b6ce, 12 messages, 53 minutes, rosacea,
 * email captured) Yuri named the subscriber ingredient-scan five times across
 * turns 1-7 and then went completely silent for turns 8-12 — including both
 * endgame turns — closing with "Take care of that barrier. 유리 out. 💛".
 *
 * That was not Yuri disobeying. It was Yuri obeying: the only count-related
 * instruction she had warns that a quota reading "converts a good goodbye into
 * a meter reading" (a real Aug 9 failure), and the prompt says "Ending on your
 * final sentence is fine." Correct generalization, wrong altitude — she had no
 * way to tell "three left" from "this is the last thing I will ever say to
 * this person."
 *
 * WHY THIS IS A FACT AND NOT A SCRIPT. Same class as the email ask, the
 * cumulative give and tool grounding: a state-visibility gap, not a wording
 * problem. The block states what is true (this reply is the last one), names
 * what only Yuri can know (which parts of the build she held back), and hands
 * the decision back. It scripts no phrasing, mandates no structure, and
 * forbids exactly one bad output — selling, which the UI card already does
 * one render later and which the SOCO literature shows subtracts trust.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')
const src = readFileSync(ROUTE, 'utf8')

/**
 * Execute the REAL branch expression from the route.
 *
 * A regex over the source can pass against broken code — the whole point of
 * this defect is that the string was present and the ARITHMETIC routed around
 * it. So lift the actual ternary out of the file and run it, rather than
 * asserting that some text exists somewhere.
 */
function extractBranch() {
  const anchor = src.indexOf('If they ask about limits, that\'s the honest answer')
  assert.ok(anchor > -1, 'the limits sentence must exist — has the block been rewritten?')
  const open = src.indexOf('${', anchor)
  assert.ok(open > -1, 'the branch interpolation must follow the limits sentence')

  // Walk to the matching close brace, tracking nesting and template literals.
  let depth = 0
  let i = open + 1
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = src.slice(open + 2, i)
  assert.ok(body.includes('MAX_FREE_MESSAGES'), 'branch must key off MAX_FREE_MESSAGES')
  return body
}

/** Run the branch for a given pre-increment ledger value. */
function armFor(lifetimeUsed, MAX_FREE_MESSAGES = 12) {
  const body = extractBranch()
  // eslint-disable-next-line no-new-func
  const fn = new Function('lifetimeUsed', 'MAX_FREE_MESSAGES', `return (${body});`)
  return fn(lifetimeUsed, MAX_FREE_MESSAGES)
}

const MAX = 12

test('the final message gets an arm the near-end messages do NOT get', () => {
  const nearEnd = armFor(MAX - 2) // 1 remaining after the reply
  const final = armFor(MAX - 1) // 0 remaining after the reply

  assert.notEqual(
    final,
    nearEnd,
    'THE BUG: message #12 and message #11 received byte-identical instructions, ' +
      'so Yuri could not tell her last turn from any other late turn'
  )
})

test('messages 9, 10 and 11 still share the near-end arm (no over-firing)', () => {
  const nine = armFor(MAX - 4)
  const ten = armFor(MAX - 3)
  const eleven = armFor(MAX - 2)
  assert.equal(nine, ten)
  assert.equal(ten, eleven)
  assert.doesNotMatch(
    eleven,
    /last one they get/,
    'the final-message fact must NOT leak onto turns that still have a next turn — ' +
      'a premature "this is the last thing I will say to you" is a lie'
  )
})

test('the final arm fires at exactly 0 remaining, and only there', () => {
  for (const used of [0, 5, 6, 7]) {
    assert.doesNotMatch(armFor(used), /last one they get/, `must not fire with ${MAX - used - 1} remaining`)
  }
  for (const used of [8, 9, 10]) {
    assert.doesNotMatch(armFor(used), /last one they get/, `must not fire with ${MAX - used - 1} remaining`)
  }
  assert.match(armFor(11), /last one they get/, 'must fire on the final message')
})

test('an over-limit ledger still lands on the final arm, never falls through', () => {
  // Reachable via the PREVIEW_IP_EXHAUSTED_ALLOWANCE softening, where the
  // counter can exceed the cap. Anything past the cap is still "no next turn".
  for (const used of [12, 13, 20]) {
    assert.match(armFor(used), /last one they get/, `ledger ${used} must be treated as final`)
  }
})

test('a missing count never fabricates a final-message claim', () => {
  const arm = armFor(null)
  assert.doesNotMatch(
    arm,
    /last one they get/,
    'with no authoritative count, claiming "this is your last message" could be false'
  )
  assert.match(arm, /Don't volunteer a count you don't have/)
})

test('the fact names what only Yuri can know: which parts she held back', () => {
  const arm = armFor(11)
  assert.match(
    arm,
    /held back/,
    'the cumulative give is invisible to the visitor — Yuri is the only party who ' +
      'knows which artifacts were withheld, which is exactly why the fact belongs here'
  )
  assert.match(
    arm,
    /honest status report, not a pitch/,
    'the frame must stay clinical; this is what makes the Zeigarnik lever usable ' +
      'without Yuri becoming a salesperson'
  )
})

test('the fact FORBIDS selling — the UI card owns the commercial ask', () => {
  const arm = armFor(11)
  assert.match(arm, /Do NOT sell/, 'the one tripwire must be explicit')
  assert.match(
    arm,
    /price/,
    'must name WHY: the card shows price + button one render later, so a price ' +
      'from Yuri duplicates it and reveals her as part of the sales apparatus'
  )
  assert.doesNotMatch(
    arm,
    /\$\d/,
    'a literal dollar amount in Yuri\'s instruction would invite her to quote it'
  )
})

test('the fact hands the decision back and scripts no phrasing', () => {
  const arm = armFor(11)

  // It must not dictate structure or exact words. Illustrative examples in
  // parentheses are fine; imperatives about form are not.
  assert.doesNotMatch(arm, /you must say|say exactly|use this phrasing|always end with/i)
  assert.doesNotMatch(arm, /\bstep 1\b|\bfirst,? then\b/i)

  assert.match(
    arm,
    /Warmth is right/,
    'the warm sign-off is correct and must be preserved — the defect was the ' +
      'sense of CLOSURE, not the warmth'
  )
})

test('the Aug 9 meter-reading lesson survives on the mid-conversation arm', () => {
  const mid = armFor(2)
  assert.match(
    mid,
    /6 free messages left/,
    'the earlier real failure must stay quoted — a future editor who sees only ' +
      'abstract advice will smooth it away'
  )
})
