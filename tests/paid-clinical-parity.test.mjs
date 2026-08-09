/**
 * Guard test — a blank medical history must not read as "asked, and there is none."
 *
 * THE GAP (Aug 9 2026)
 *
 * The paid prompt was diffed against the widget prompt and looked alarmingly
 * thinner on clinical guidance. Most of that was an ARTIFACT of comparing the
 * wrong layer: the subscriber surface delivers clinical context by per-user
 * runtime injection (memory.ts), and onboarding.ts already instructs Yuri to ask
 * every field the widget block covers — burn-or-tan verbatim, medical history
 * "ask rather than wait", even the Central Valley photoaging example. Porting
 * the widget's static text would have duplicated all of it, and this repo has
 * already been burned by two rules stating one thing in slightly different words
 * (v11.22.0: "the prompt contradicted itself and the user got the collision").
 *
 * ONE gap survived scrutiny, and it is a real instance of the silent-failure
 * class this codebase keeps paying for:
 *
 *   `if (medical.length)` had NO else branch. When a subscriber had no medical
 *   history on file, Yuri saw NOTHING — byte-identical to a user who was asked
 *   and genuinely has none. 4 of 6 real paid profiles were in that state, and a
 *   blank field is evidence about OUR record, not about their health. It is the
 *   same shape as `fitzpatrick_source`: unknown must render AS unknown.
 *
 * WHAT THESE TESTS PROTECT, and it cuts both ways:
 *   - the empty-state fact must exist (or the silent failure returns), AND
 *   - it must never become a pre-ask GATE. A standing instruction to interrogate
 *     before every actives recommendation is the regression risk — Bailey has
 *     already objected to unnecessary preamble ("just makes it confusing",
 *     Aug 1 2026), and v11.18.0 showed the model picks the safe-looking action
 *     and narrates the correct one when a rule reads as a threat.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const memory = read('src', 'lib', 'yuri', 'memory.ts')
const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
const specialists = read('src', 'lib', 'yuri', 'specialists.ts')

test('an empty medical history renders as "never captured", not as silence', () => {
  assert.ok(
    /## Medical History \(not on file\)/.test(memory),
    'the empty state must render something — silence is indistinguishable from "asked, none"'
  )
  assert.ok(
    /never captured — NOT that there is none/.test(memory),
    'the fact must say a blank field is a gap in OUR record, not a fact about their health'
  )
})

test('the empty-history block is a fact, never a gate', () => {
  const block = memory.slice(
    memory.indexOf('## Medical History (not on file)'),
    memory.indexOf('## Medical History (not on file)') + 900
  )
  assert.ok(block.length > 100, 'empty-history block not found')

  // The exact regression: turning "ask when relevant" into a precondition.
  assert.ok(
    /never as a condition of helping them/.test(block),
    'must explicitly disclaim being a precondition for advice'
  )
  assert.ok(
    !/\b(?:you must ask|always ask (?:before|first)|do not (?:recommend|advise) until|refuse|require them to)\b/i.test(block),
    'the empty-history fact must never become a mandatory pre-ask gate'
  )
  // A user who declines must not leave Yuri stalled.
  assert.ok(
    /don't stall/.test(block),
    'must give Yuri a path when the user would rather not answer'
  )
})

test('the population-patterns guidance reached the paid prompt', () => {
  assert.ok(
    /Reason from population patterns, and stay calibrated/.test(advisor),
    'the calibration guidance had no home on the paid surface — this was the one static gap'
  )
  assert.ok(
    /stereotype in a lab coat/.test(advisor),
    'the anti-stereotype guardrail must travel with the population-patterns permission'
  )
  assert.ok(
    /directly and without hedging/.test(advisor),
    'population patterns must be reasoned from WITHOUT hedging — this is permission, not caution'
  )
})

test('the paid prompt does NOT duplicate what memory.ts injects per-user', () => {
  // memory.ts already fires the burn/tan ask exactly when Fitzpatrick is
  // missing or estimated. A static copy would fire on every turn for every
  // user including those already confirmed — strictly worse, and two rules
  // about one thing is the v11.22.0 defect class.
  assert.ok(
    /Ask \("do you burn, tan, or both\?"\)/.test(memory),
    'the conditional burn/tan ask must stay in memory.ts where it is targeted'
  )
  assert.ok(
    !/burn, tan, or both/.test(advisor),
    'the burn/tan ask must NOT be duplicated as static text in the advisor prompt'
  )
})

test('the pregnancy check names the real contraindication list', () => {
  // A draft version said "retinoids" only, which understated Yuri's own
  // specialist knowledge and would have been the sole guidance in an unrouted
  // conversation.
  const line = specialists.split('\n').find((l) => /Pregnancy-safe:/.test(l))
  assert.ok(line, 'pregnancy-safe line not found')
  for (const item of ['retinoid', 'salicylic', 'hydroquinone']) {
    assert.ok(new RegExp(item, 'i').test(line), `pregnancy contraindications must include ${item}`)
  }
  assert.ok(
    /never make the answer a condition of helping them/i.test(line),
    'the pregnancy check must not become a gate either'
  )
})

test('none of this weakened the referral rule or added a blanket disclaimer', () => {
  assert.ok(
    /Lesions are always a referral/.test(advisor),
    'the lesion referral rule is the honest limit and must survive every clinical edit'
  )
  assert.ok(
    !/\b(?:I'?m (?:just|only) an AI|this is not medical advice)\b/i.test(advisor),
    'clinical additions must never bring a blanket disclaimer with them'
  )
})
