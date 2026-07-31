/**
 * Guard test — Yuri must never be told the user has paid when they have not,
 * and the new facts must stay FACTS rather than becoming commands.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 31 2026)
 *
 * `buildOnboardingSystemPrompt` opened with:
 *
 *   "This person just subscribed to Seoul Sister -- they chose to invest in
 *    their skin. ... You are getting to know a paying subscriber ... Make them
 *    feel like they made the right decision."
 *
 * It was FALSE. Commit 68acafe (July 15) moved the paywall to AFTER onboarding;
 * this line still described the pre-68acafe funnel, so for two weeks Yuri was
 * told every free registrant had already paid.
 *
 * She behaved perfectly rationally given that premise. A 66-year-old Canadian
 * (skilback22@, July 24) described 50 years of sun, a plateaued IPL history and
 * a $100/mo budget; Yuri delivered a COMPLETE multi-week protocol — full AM
 * sequence, a Weeks 1-2 / 3-4 / 5+ retinal ramp, buffering technique, and rules
 * for backing off — then closed with "I'll be here whenever a product tempts
 * you" and "See you in a month." The user replied "we'll talk in another
 * month." She hit the $24.99 paywall 25 SECONDS LATER and never signed in again.
 *
 * The subtle part, and the reason "make Yuri stingier" would have been the wrong
 * fix: she structured the protocol to be SELF-SERVICE (the adjustment rules she
 * would otherwise supply live). Told the sale was closed, she optimised for the
 * user's independence — correct for a subscriber, wrong 25 seconds before a
 * paywall. The fix is telling her which conversation she is actually in.
 *
 * WHY A SOURCE-TEXT ASSERTION IS LEGITIMATE HERE: this repo's standing lesson is
 * that source-matching tests miss runtime bugs. That lesson does not bite for
 * the prompt itself, because the defect IS source text — a false sentence in a
 * string. The turn-state behaviour below is nonetheless EXECUTED, and each
 * assertion was confirmed to fail when its bug is reintroduced (see VERIFICATION).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const SRC = new URL('../src/lib/yuri/onboarding.ts', import.meta.url)
const source = readFileSync(SRC, 'utf8')

// ---------------------------------------------------------------------------
// Part 1 — the prompt must not assert a payment that has not happened
// ---------------------------------------------------------------------------

test('the STATIC onboarding prompt never claims the user has subscribed', () => {
  // Scope matters: "paying subscriber" is legitimate inside the CONDITIONAL
  // turn-state branch that only fires when hasActiveSubscription() returned
  // true. What must never return is an UNCONDITIONAL assertion in the static
  // prompt, which is what shipped for two weeks. So assert against the prompt
  // string itself, not the whole file.
  const promptStart = source.indexOf('export function buildOnboardingSystemPrompt')
  const promptEnd = source.indexOf('export function buildOnboardingTurnState')
  assert.ok(promptStart > -1 && promptEnd > promptStart, 'could not locate the prompt builder')
  const staticPrompt = source.slice(promptStart, promptEnd)

  const banned = [
    /just subscribed/i,
    /paying subscriber/i,
    /they chose to invest/i,
    /made the right decision/i,
  ]
  for (const re of banned) {
    assert.ok(
      !re.test(staticPrompt),
      `static onboarding prompt still asserts payment: ${re}`
    )
  }
})

test('the prompt defers to the queried status instead of assuming', () => {
  assert.match(
    source,
    /subscription status is a FACT in Current State below -- read it there, never assume it/i,
    'prompt must point Yuri at the queried fact rather than stating a status statically'
  )
})

test('the give/gate names the subscriber deliverable explicitly', () => {
  // The widget gate failed twice when it was vague. Name the artifacts.
  for (const phrase of [
    /full AM\/PM construction/i,
    /week-by-week ramp schedules/i,
    /adjustment rules/i,
  ]) {
    assert.match(source, phrase, `give/gate must name ${phrase}`)
  }
})

test('Yuri is told not to make promises this conversation cannot keep', () => {
  assert.match(source, /Promises You Can Keep/i)
  assert.match(
    source,
    /Never let someone leave holding a false belief about what happens next/i
  )
})

test('the price is interpolated from PRICING, never hardcoded', () => {
  assert.ok(
    !/\$24\.99/.test(source),
    'hardcoded price found — must use PRICING.monthly_display'
  )
  assert.match(source, /\$\{PRICING\.monthly_display\}/)
})

// ---------------------------------------------------------------------------
// Part 2 — EXECUTE the turn-state builder
// ---------------------------------------------------------------------------

// Strip DB/SDK imports so the pure prompt-building functions can be loaded.
// Drop EVERY '@/...' import (single- and multi-line), then re-supply the pure
// values the prompt builders actually need. Anything DB- or SDK-backed is
// irrelevant to the functions under test.
const stripped = source
  .replace(/^import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+'@\/[^']+'\s*$/gm, '')
  .replace(/^import\s+(?:type\s+)?[\w*\s{},]+\s+from\s+'@\/[^']+'\s*$/gm, '')
  .replace(/^import\s+type\s+\{[\s\S]*?\}\s+from\s+'[^']+'\s*$/gm, '')

const js = ts.transpileModule(stripped, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

// Provide the two cumulative-give helpers the module expects, loaded from the
// REAL widget implementation so the shared contract is exercised.
const giveSrc = readFileSync(
  new URL('../src/lib/widget/cumulative-give.ts', import.meta.url),
  'utf8'
)
const giveJs = ts.transpileModule(giveSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const give = await import(
  `data:text/javascript;base64,${Buffer.from(giveJs).toString('base64')}`
)

globalThis.__detectCumulativeGive = give.detectCumulativeGive
globalThis.__buildCumulativeGiveBlock = give.buildCumulativeGiveBlock

const shimmed =
  `const PRICING = { monthly_display: '$24.99/mo' };\n` +
  `const detectCumulativeGive = globalThis.__detectCumulativeGive;\n` +
  `const buildCumulativeGiveBlock = globalThis.__buildCumulativeGiveBlock;\n` +
  js

const mod = await import(
  `data:text/javascript;base64,${Buffer.from(shimmed).toString('base64')}`
)
const { buildOnboardingTurnState, ONBOARDING_USER_MESSAGE_CAP } = mod

test('an unsubscribed user is reported as NOT SUBSCRIBED with the price', () => {
  const out = buildOnboardingTurnState({}, undefined, {
    isSubscribed: false,
    userMessageNumber: 3,
    userMessageCap: 50,
  })
  assert.match(out, /NOT SUBSCRIBED/)
  assert.match(out, /\$24\.99/)
  assert.match(out, /message 3 of the 50/)
})

test('a subscribed user is reported as SUBSCRIBED — no false scarcity', () => {
  // A paid user CAN re-enter onboarding. Telling them "nothing has been paid"
  // would be a NEW false fact — the exact bug class being fixed.
  const out = buildOnboardingTurnState({}, undefined, { isSubscribed: true })
  assert.match(out, /SUBSCRIBED/)
  assert.ok(!/NOT SUBSCRIBED/.test(out), 'must not contradict a real subscriber')
  assert.ok(
    !/Nothing has been paid yet/i.test(out),
    'must not tell a paying subscriber they have not paid'
  )
})

test('unknown status claims nothing either way', () => {
  // If the lookup failed we say nothing — a guess is what caused this bug.
  const out = buildOnboardingTurnState({}, undefined, { userMessageNumber: 2, userMessageCap: 50 })
  assert.ok(!/SUBSCRIBED/.test(out), 'must not assert a status it could not query')
})

test('the status block is phrased as facts and hands the decision back', () => {
  const out = buildOnboardingTurnState({}, undefined, { isSubscribed: false })
  assert.match(out, /facts, not instructions/i)
  assert.match(out, /how and whether to use them is yours/i)
  // No imperative to withhold, deflect, upsell, or refuse.
  for (const re of [/you must/i, /do not tell/i, /refuse/i, /always say/i, /never answer/i]) {
    assert.ok(!re.test(out), `status block became a command: ${re}`)
  }
})

test('the cumulative-give block appears only once enough has been given', () => {
  const light = buildOnboardingTurnState({}, undefined, {
    isSubscribed: false,
    cumulativeGive: give.detectCumulativeGive([
      { role: 'assistant', content: 'Tell me about your skin.' },
    ]),
  })
  assert.ok(!/Already Given/i.test(light), 'no block when nothing substantial was given')

  // A reply carrying a full routine AND a weekly schedule — two artifacts.
  const heavy = buildOnboardingTurnState({}, undefined, {
    isSubscribed: false,
    cumulativeGive: give.detectCumulativeGive([
      {
        role: 'assistant',
        content:
          'AM: vitamin C → moisturizer → SPF\nPM: retinal → cream\nUse the retinal 2x/week to start.',
      },
    ]),
  })
  assert.match(heavy, /Already Given/i)
  assert.match(heavy, /not a rule and not a cap/i)
})

test('the instrument reads only Yuri, never the user', () => {
  // The USER describing their own elaborate routine must not count as Yuri
  // having delivered one — otherwise a detailed user like the KC subscriber
  // would trip the instrument on message one.
  const userDescribes = give.detectCumulativeGive([
    {
      role: 'user',
      content:
        'AM: I use vitamin C → moisturizer → SPF\nPM: retinol → cream, 2x/week',
    },
  ])
  assert.equal(userDescribes.count, 0, 'user turns must never count as Yuri giving')
})

test('the message cap is a single shared constant', () => {
  assert.equal(ONBOARDING_USER_MESSAGE_CAP, 50)
})

/**
 * VERIFICATION — each was confirmed to FAIL when its bug is reintroduced:
 *
 * 1. Restore the original line 62 ("This person just subscribed…"):
 *    "never claims the user has subscribed" FAILS on all four banned phrases.
 * 2. Hardcode "$24.99/mo" in the prompt instead of PRICING.monthly_display:
 *    "the price is interpolated from PRICING" FAILS.
 * 3. Emit the NOT-SUBSCRIBED string unconditionally (ignoring isSubscribed):
 *    "a subscribed user is reported as SUBSCRIBED" FAILS — this is the
 *    re-entering-paid-user false fact.
 * 4. Assert a default status when `isSubscribed` is undefined:
 *    "unknown status claims nothing either way" FAILS.
 * 5. Append an imperative ("You must not give more") to the status block:
 *    "phrased as facts and hands the decision back" FAILS.
 * 6. Drop the `turn.role !== 'assistant'` filter in detectCumulativeGive:
 *    "the instrument reads only Yuri, never the user" FAILS.
 */
