/**
 * Guard test — a memory callback must reward the user, not scold them.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * Bailey asked Yuri whether Rhode Glazing Milk was comedogenic. Yuri opened with:
 *
 *     "We started this exact breakdown last time, let me finish it properly
 *      this time."
 *
 * ...and then gave a genuinely excellent 1,235-character answer: C12-15 Alkyl
 * Benzoate at #2, coconut alkanes at #3, a coin-flip verdict at $28, and an
 * offer to find congestion-safe alternatives.
 *
 * Bailey's reaction: "Dammnnn I didn't get a good answer because I've already
 * asked it 😅 I'll find a different trending product."
 *
 * She read the callback as a reprimand — as though re-asking had cost her the
 * full response — and abandoned the thread. Nothing was broken; the ANSWER was
 * complete and correct. The opening line was the entire problem.
 *
 * Compounding it, the "last time" she was being reminded of was a reproduction
 * test run against her account minutes earlier, so the callback referenced a
 * conversation she had never had.
 *
 * Cross-session memory is the product's core differentiator. A returning user
 * reading continuity as a scold is a retention risk on the surface that matters
 * most, so the prompt must govern how a callback LANDS, not merely that Yuri is
 * allowed to make one.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const advisorSrc = read('src', 'lib', 'yuri', 'advisor.ts')

const memoryIdx = advisorSrc.indexOf('## Cross-Session Memory')
const memoryBlock = advisorSrc.slice(memoryIdx, memoryIdx + 6000)

test('the memory section governs how a callback lands, not just that it is made', () => {
  assert.ok(memoryIdx > -1, 'the cross-session memory section must exist')
  assert.ok(
    /How a callback LANDS matters/i.test(memoryBlock),
    'the prompt must address the TONE of a memory callback'
  )
})

test('the exact phrasings that read as a scold are named', () => {
  // Naming the real phrasings matters: a general instruction to "be warm" did
  // not prevent this, because Yuri did not experience the line as unkind.
  for (const phrase of [
    'we started this exact breakdown last time',
    'you asked me this already',
    'as I told you before',
  ]) {
    assert.ok(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(memoryBlock),
      `the prompt must name "${phrase}" as a callback that reads as a correction`
    )
  }
})

test('the fix is ordering — answer first, memory as added value', () => {
  assert.ok(
    /Lead with the ANSWER/i.test(memoryBlock),
    'the prompt must tell Yuri to lead with the answer, not the callback'
  )
  assert.ok(
    /added value, not as a preamble/i.test(memoryBlock),
    'memory must be framed as value added, not as commentary on the user'
  )
})

test('re-asking is explicitly legitimate', () => {
  // The user-facing failure was Bailey believing she had been penalised for
  // repeating herself. The prompt must state that re-asking is fine.
  assert.ok(
    /still deciding|forgot|hear it again/i.test(memoryBlock),
    'the prompt must legitimise why people re-ask'
  )
  assert.ok(
    /Never imply an answer is abbreviated because of history/i.test(memoryBlock),
    'Yuri must never suggest a reply was shortened due to repetition'
  )
})

test('odd history resolves in favour of the user in front of her', () => {
  // Bailey's callback referenced a test run on her account. Yuri should answer
  // the human, not litigate the transcript.
  assert.ok(
    /source of truth/i.test(memoryBlock) && /testing/i.test(memoryBlock),
    'strange-looking history must resolve toward answering the user'
  )
})

test('the rule adds judgment and does not cap the callback', () => {
  // This must not become "never reference past conversations" — continuity is
  // the differentiator. The existing never-deny-your-memory rules must survive.
  assert.ok(
    /NEVER deny making a recommendation/i.test(memoryBlock),
    'the never-deny-memory rule must remain intact'
  )
  assert.ok(
    /Build on previous conversations/i.test(memoryBlock),
    'Yuri must still be told to build on past conversations'
  )
  for (const banned of [
    'never reference past conversations',
    'do not mention previous',
  ]) {
    assert.ok(
      !new RegExp(banned, 'i').test(memoryBlock),
      `the fix must not suppress callbacks entirely (found "${banned}")`
    )
  }
})
