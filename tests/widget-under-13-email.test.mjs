/**
 * Guard tests: Yuri does not ask a self-identified under-13 visitor for an
 * email (Sep 28 2026).
 *
 * On Sep 18 2026 a visitor opened with "Can i use the centella poremizing serum
 * at the age of twelve" and Yuri later offered "Want me to hang onto your
 * email". Our privacy policy says we do not knowingly collect personal
 * information from children under 13, and Yuri is the only part of the widget
 * that can know a visitor's age.
 *
 * Scoped to the rule's own paragraph: an assertion on the whole prompt would
 * pass on words that appear elsewhere (the v11.28 wrong-region failure).
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

function rule() {
  const src = readFileSync(ROUTE, 'utf8')
  const start = src.indexOf("**If a visitor tells you they're under 13")
  assert.ok(start > -1, 'the under-13 rule must exist in the widget prompt')
  const end = src.indexOf('\n\n', start)
  return src.slice(start, end)
}

test('the rule withholds the email ask and nothing else', () => {
  const r = rule()
  assert.match(r, /don't ask for their email/i)
  assert.match(r, /help them fully/i, 'the rule must not reduce the help a young visitor gets')
  // A second-model review showed "keep it to general safety only; a child
  // should not get product picks" passed the first version of this test.
  assert.doesNotMatch(r, /\b(no|not|don'?t|never|shouldn'?t|should not)\b[^.]*\b(product|picks?|recommend\w*)\b/i,
    'the rule must not restrict what a young visitor is recommended')
})

test('the rule never has Yuri ask visitors their age', () => {
  // Yuri acts on an age a visitor VOLUNTEERS. Asking everyone would be an
  // intake form, and would itself collect age from every visitor.
  assert.doesNotMatch(rule(), /\b(ask\w*|find out|check)\b[^.]*\b(how old|their age|your age)\b/i)
})

test('the rule tells the truth about the email gate and promises no non-retention', () => {
  // extractEmail() captures any typed address, and the platform gate asks
  // every visitor after N messages (EMAIL_GATE_AFTER_MESSAGES). The rule must say so, and must never lead
  // Yuri to tell a child their data is not kept. Shapes, not verbs: the review
  // defeated a verb list with "retained" and "won't be keeping".
  const r = rule()
  assert.match(r, /after \d+ messages/, 'the rule must tell Yuri the gate exists')
  assert.match(r, /\bis saved\b/, 'the rule must tell Yuri a gated email IS saved')
  assert.doesNotMatch(r, /\breassur\w*/i)
  assert.doesNotMatch(r, /\bnothing\b[^.]*\b(retain|kept|keep|sav|stor|record)\w*/i)
  assert.doesNotMatch(r, /\b(never|won'?t|will not)\b[^.]*\b(retain|keep|kept|sav|stor|record)\w*/i)  // Round 2: "saved for 24 hours and then automatically deleted, so tell them
  // it will be gone by tomorrow" passed the verb list above.
  assert.doesNotMatch(r, /\b(delet|gone|remov|expir|eras|purg|discard|wip)\w*/i)
})

test('the rule changes ONLY the email offer: no parent gate, no ending the chat', () => {
  // Round 2: paragraphs that solicited a PARENT's email, gated help on it, or
  // ended the conversation for children all passed the first version.
  const r = rule()
  assert.match(r, /The only change is the email offer\./)
  assert.match(r, /keep helping/i)
  assert.doesNotMatch(r, /\b(parent|guardian|adult|grown-?up)/i)
  assert.doesNotMatch(r, /\b(end|stop|close|wrap up|decline|refuse)\b[^.]*\b(conversation|chat|helping|help|answer)/i)
  assert.doesNotMatch(r, /\b(until|unless|before)\b[^.]*\b(help|answer)/i)
})

test('the gate arithmetic matches the code', () => {
  const src = readFileSync(ROUTE, 'utf8')
  const n = /EMAIL_GATE_AFTER_MESSAGES\s*=\s*(\d+)/.exec(src)?.[1]
  assert.ok(n, 'EMAIL_GATE_AFTER_MESSAGES must exist')
  assert.match(rule(), new RegExp(`after ${n} messages`), 'the rule must state the real gate threshold')
})

test('the gate fires at the configured count (Oct 30 2026: 6) and uses >=', () => {
  const src = readFileSync(ROUTE, 'utf8')
  assert.match(src, /const EMAIL_GATE_AFTER_MESSAGES = 6\b/, 'gate threshold changed: update this test on purpose')
  assert.match(src, /visitor\.total_messages >= EMAIL_GATE_AFTER_MESSAGES/, 'a > here silently moves the gate one message later')
})


test('the per-turn "question is still open" fact carries the under-13 exception', () => {
  const src = readFileSync(ROUTE, 'utf8')
  assert.match(src, /still genuinely open \(unless they've told you they're under 13/)
})
