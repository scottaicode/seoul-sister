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
    /membership status is a FACT in Current State below -- read it there, never assume it/i,
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
  assert.match(source, /\$\{PRICING\.monthly_display_long\}/)
  assert.match(source, /\$\{PRICING\.trial_days\}/, 'the free week must come from pricing.ts too')
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

// The real stated-identity module (gender and exact age), with `export` removed
// so its functions are in scope the way the stripped import expects.
const identityJs = ts.transpileModule(
  readFileSync(new URL('../src/lib/yuri/stated-identity.ts', import.meta.url), 'utf8').replace(/^export /gm, ''),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText

// The real setup rules (what must be known before setup can finish).
const requirementsJs = ts.transpileModule(
  readFileSync(new URL('../src/lib/yuri/setup-requirements.ts', import.meta.url), 'utf8').replace(/^export /gm, ''),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText

const shimmed =
  identityJs + '\n' + requirementsJs + '\n' +
  `const PRICING = { monthly_display: '$24.99/mo', monthly_display_long: '$24.99/month', trial_days: 7 };\n` +
  `const detectCumulativeGive = globalThis.__detectCumulativeGive;\n` +
  `const buildCumulativeGiveBlock = globalThis.__buildCumulativeGiveBlock;\n` +
  js

const mod = await import(
  `data:text/javascript;base64,${Buffer.from(shimmed).toString('base64')}`
)
const { buildOnboardingTurnState, ONBOARDING_USER_MESSAGE_CAP } = mod

test('someone who is not a member yet is told so, with the free week and the price', () => {
  const out = buildOnboardingTurnState({}, undefined, {
    isSubscribed: false,
    userMessageNumber: 3,
    userMessageCap: 50,
  })
  // Nov 10 2026: the line used to read "NOT SUBSCRIBED ... the subscribe step
  // ($9.99) follows this conversation", so setup Yuri closed on a price right
  // before a screen that says free with no card. It now states the real next
  // step: a free week, no card, and the price only if they add one.
  assert.match(out, /NOT A MEMBER YET/)
  assert.match(out, /someone who has not had a free week gets their first 7 days free with no card\. Whether this person has already had a free week is not shown to you\./)
  assert.match(out, /The next screen shows what they can start: membership is \$24\.99\/month, and someone who has not had a free week/)
  assert.match(out, /Nothing has been paid/)
  assert.doesNotMatch(out, /subscribe step/)
  assert.match(out, /message 3 of the 50/)
})

test('a subscribed user is reported as SUBSCRIBED — no false scarcity', () => {
  // A paid user CAN re-enter onboarding. Telling them "nothing has been paid"
  // would be a NEW false fact — the exact bug class being fixed.
  const out = buildOnboardingTurnState({}, undefined, { isSubscribed: true })
  assert.match(out, /Membership status: MEMBER\./)
  // A member in a free week has paid nothing, so it must not call them a paying subscriber either.
  assert.doesNotMatch(out, /paying subscriber/)
  assert.ok(!/NOT A MEMBER YET/.test(out), 'must not contradict a real subscriber')
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

test('a creator-code fact is shown once to someone who is not a member, and never to a member or when status is unknown', () => {
  const X = 'Creator code: TESTFACT.'
  const shown = buildOnboardingTurnState({}, undefined, { isSubscribed: false, offerFact: X })
  assert.equal(shown.split(X).length - 1, 1)
  for (const isSubscribed of [true, undefined]) {
    assert.ok(!buildOnboardingTurnState({}, undefined, { isSubscribed, offerFact: X }).includes(X), `isSubscribed=${isSubscribed}`)
  }
  assert.ok(!buildOnboardingTurnState({}, undefined, { isSubscribed: false, offerFact: null }).includes('Creator code'))
})

test('the preview-age fact reaches setup Yuri whatever the membership status, and alone still renders', () => {
  const X = 'Their free preview chat on the landing page ended about 9 minutes before now.'
  for (const isSubscribed of [true, false, undefined]) {
    const out = buildOnboardingTurnState({}, undefined, { isSubscribed, previewAgeFact: X })
    assert.equal(out.split(X).length - 1, 1, `isSubscribed=${isSubscribed}`)
    assert.match(out, /## Where They Stand \(facts, not instructions\)/)
  }
  for (const none of [null, undefined, '']) {
    assert.ok(!buildOnboardingTurnState({}, undefined, { isSubscribed: false, previewAgeFact: none }).includes('preview chat on the landing page ended'))
  }
})

// Nov 11 2026: a setup recap said "Two months of over-washing" to someone who
// had given no duration. Measured: 1 of 123 stored setup replies, and it did
// not reach skin_profile_data. The rule sits where the recap is asked for.
test('the wrap-up playback is limited to facts the person gave', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/lib/yuri/onboarding.ts', import.meta.url), 'utf8')
  const start = src.indexOf('## Completion')
  const end = src.indexOf('\n## ', start + 5)
  assert.ok(start > -1 && end > start, 'Completion section not found')
  const section = src.slice(start, end)
  // The exact sentence, and then the whole section by fingerprint: a regex on
  // two phrases passed against the rule inverted, gutted, and with an
  // override appended after it (second-model review, Nov 11 2026). Any edit to
  // this section needs a second-model review and a new fingerprint.
  assert.ok(section.includes('play back what you now understand about their skin (this is where they feel genuinely heard, and it only works if it is theirs: your read of the cause is yours to give, but every fact in it about their life, how long, how often, how much, what happened, is one they told you, and one they did not tell you is a question to ask or a thing to leave out), give them their first move'))
  const { createHash } = await import('node:crypto')
  assert.equal(createHash('sha256').update(section).digest('hex'), '6dc6faf015e54823d0b3cc2eac24d1886888b0175a489df41dfa248c65031018')
  // And the whole static setup prompt: a sentence added to another section
  // ("except that in the wrap-up you may state a likely duration as fact")
  // would undo the rule while leaving this section untouched.
  const whole = src.slice(src.indexOf('export function buildOnboardingSystemPrompt'), src.indexOf('export interface OnboardingTurnFacts'))
  assert.equal(createHash('sha256').update(whole).digest('hex'), '432846c4939181dee83064ec9609a7f70a08412fabd9400daf38b846ae26be03')
})

test('the setup chat can read the catalog for a member, ingredients only; for anyone else it has no product database', async () => {
  const { readFileSync } = await import('node:fs')
  const lib = readFileSync(new URL('../src/lib/yuri/onboarding.ts', import.meta.url), 'utf8')
  // Nov 12 2026: a fragranced sunscreen was named from memory in setup to a
  // member who had reported a fragrance reaction. Nov 17 2026: a member asked
  // setup Yuri to check a cleansing oil's ingredients and was told to paste the
  // label in, while the verified list sat in the catalog (replayed with the
  // lookup, she found the oil she had recommended contains fragrance).
  const cached = lib.slice(lib.indexOf('function buildOnboardingSystemPrompt'), lib.indexOf('export interface OnboardingTurnFacts'))
  // The sentence for someone with no lookup is the one that was there before,
  // and still does not point at membership as where products get checked.
  const noLookup = `Where lookup is not available, this chat has no product database: unless a product's ingredients are already written out in this chat or in the "Before they signed up" transcript, what you say about its formula comes from memory and has not been checked against what this person has told you they react to.`
  assert.ok(cached.includes(noLookup))
  assert.doesNotMatch(noLookup, /member|subscri|free week|paid|later|once you/i)
  const para = cached.slice(cached.indexOf('One fact about this chat differs by person'), cached.indexOf('Nothing in this chat saves a product or a routine.') + 60)
  assert.ok(para.includes('Prices and stores are not shown in this chat.'))
  // Facts about the chat, not orders to Yuri.
  assert.doesNotMatch(para, /\byou say so\b|\bmust\b|\balways\b|\bnever\b|here and now|promise for later/i)
  // The transcript it names is the real heading of the carried-over chat.
  assert.match(readFileSync(new URL('../src/lib/yuri/widget-carryover.ts', import.meta.url), 'utf8'), /return `## Before they signed up\n/)

  // What each person is told this turn (executed).
  assert.match(buildOnboardingTurnState({}, [], { isSubscribed: true }), /Product lookup: AVAILABLE in this chat \(search_products, get_product_details\), ingredients only, no prices or stores\./)
  for (const facts of [{ isSubscribed: false }, {}, undefined]) {
    const state = buildOnboardingTurnState({}, [], facts)
    assert.match(state, /Product lookup: NOT available in this chat\./)
    assert.doesNotMatch(state, /Product lookup: AVAILABLE/)
  }

  // The statement must stay true of the code. Tools go to a confirmed member
  // only (unknown membership gets none); the line above and the tools are
  // decided by the same test.
  const stream = lib.slice(lib.indexOf('export async function* streamOnboardingResponse'), lib.indexOf('export interface SetupStreamHooks'))
  assert.ok(stream.includes('const lookupTools = isSubscribed === true ? setupLookupTools() : []'))
  assert.ok(stream.includes('...(lookupTools.length > 0 ? { tools: lookupTools } : {}),'))
  assert.equal(stream.split('messages.stream(').length - 1, 1, 'one model call site')
  assert.equal(/messages\.create\(/.test(stream), false)
  assert.equal(/tool_choice/.test(stream), false, 'never forced (a 400 on Opus 5.5)')
  // The loop runs lookups only through the runner that refuses everything else.
  assert.equal(stream.split('await runSetupLookup(use.name, input, userId)').length - 1, 1)
  assert.equal(/executeYuriTool\(/.test(stream), false, 'the loop never calls a tool directly')
  // The route makes no model call of its own.
  const route = readFileSync(new URL('../src/app/api/yuri/onboarding/route.ts', import.meta.url), 'utf8')
  assert.equal(/messages\.(stream|create)\(|getAnthropicClient/.test(route), false)

  const fn = (signature, deps, args) => {
    const start = lib.indexOf(signature)
    assert.ok(start > -1, signature)
    const body = lib.slice(start, lib.indexOf('\n}\n', start) + 3).replace(/^export /, '')
    const name = signature.match(/function (\w+)/)[1]
    return new Function(...deps, `${ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText}\nreturn ${name}`)(...args)
  }
  const NAMES = ['search_products', 'get_product_details']

  // The tools sent are those two out of everything Yuri has, and nothing else (executed).
  const ALL = ['search_products', 'get_product_details', 'save_routine', 'add_to_routine', 'update_user_product', 'web_search', 'get_current_weather'].map((name) => ({ name }))
  assert.deepEqual(fn('function setupLookupTools(', ['YURI_TOOLS', 'SETUP_LOOKUP_TOOL_NAMES'], [ALL, NAMES])().map((t) => t.name), NAMES)
  assert.ok(lib.includes("export const SETUP_LOOKUP_TOOL_NAMES = ['search_products', 'get_product_details'] as const"))
  assert.ok(lib.includes('export const SETUP_LOOKUP_ROUNDS = 3'))

  // What comes back has no prices, stores or counterfeit notes at any depth,
  // and a product with no list on file says so (executed).
  const noteSrc = lib.slice(lib.indexOf('const NOT_SHOWN_IN_SETUP ='), lib.indexOf('export function setupLookupResult('))
  const clean = new Function(`${ts.transpileModule(noteSrc + lib.slice(lib.indexOf('export function setupLookupResult('), lib.indexOf('\n}\n', lib.indexOf('export function setupLookupResult(')) + 3).replace('export ', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText}\nreturn setupLookupResult`)()
  const search = JSON.parse(clean(JSON.stringify({ products: [
    { id: 'a', name: 'Oil', prices: [{ retailer: 'Olive Young Global', price_usd: 19, ships_to_us: false }], key_ingredients: [{ name: 'Fragrance' }], other_ingredients: ['Olive Oil'], ingredients_total: 2, other_listings: [{ price_usd: 25 }] },
    { id: 'b', name: 'No list', price_usd: 12, key_ingredients: [], other_ingredients: [], ingredients_total: 0 },
  ], total_found: 2 })))
  assert.deepEqual(search.products[0], { id: 'a', name: 'Oil', key_ingredients: [{ name: 'Fragrance' }], other_ingredients: ['Olive Oil'], ingredients_total: 2 })
  assert.equal(search.products[1].ingredients_note, 'No ingredient list is on file for this product. That is different from it containing nothing of concern.')
  assert.equal(JSON.stringify(search).includes('price'), false)
  const details = JSON.parse(clean(JSON.stringify({ product: { id: 'a', name: 'Oil' }, ingredients: [{ name: 'Water' }], other_ingredients: [], ingredients_total: 1, prices: [{ price_usd: 20 }], prices_error: 'x', community: { avg_rating: 5 }, counterfeit_markers: [{ brand: 'other' }], ingredients_error: 'could not be read' })))
  assert.deepEqual(Object.keys(details).sort(), ['ingredients', 'ingredients_error', 'ingredients_total', 'other_ingredients', 'product'])
  assert.match(clean('not json'), /did not return a readable result/)
  // A failed ingredient read is said to be one, in the tool itself.
  assert.ok(readFileSync(new URL('../src/lib/yuri/tools.ts', import.meta.url), 'utf8').includes("...(ingredientsRes.error ? { ingredients_error: 'The ingredient list could not be read on our side just now; this is not a product with no ingredients.' } : {}),"))

  // The runner refuses anything else, whatever the model asks for, and cleans what it returns (executed).
  const calls = []
  const run = fn('export async function runSetupLookup(', ['SETUP_LOOKUP_TOOL_NAMES', 'executeYuriTool', 'setupLookupResult'], [NAMES, async (name, input, userId) => { calls.push([name, input, userId]); return JSON.stringify({ products: [{ id: 'a', prices: [1] }] }) }, clean])
  assert.equal(await run('search_products', { query: 'x' }, 'u1'), JSON.stringify({ products: [{ id: 'a' }] }))
  for (const other of ['save_routine', 'update_user_product', 'web_search', 'get_current_weather']) {
    assert.match(await run(other, {}, 'u1'), /is not available in the setup chat/)
  }
  assert.deepEqual(calls.map((c) => c[0]), ['search_products'])

  // What is written before a lookup is held, not shown; the round after the last lookup runs none; and a turn never ends on silence.
  assert.ok(stream.includes('if (holdText) held += event.delta.text'))
  assert.ok(stream.includes('if (round === SETUP_LOOKUP_ROUNDS) break'))
  assert.ok(stream.indexOf('if (round === SETUP_LOOKUP_ROUNDS) break') < stream.indexOf('await runSetupLookup('))
  assert.ok(stream.includes("loopMessages.push({ role: 'assistant', content: final.content as unknown as Anthropic.Messages.ContentBlockParam[] })"))
  assert.ok(stream.includes('if (!answered) yield declined ? DECLINED_REPLY : SETUP_NO_ANSWER_REPLY'))
  // Each lookup goes on the saved message, and an offer to look something up survives only where it can be taken up.
  assert.equal(route.split("await saveMessage(progress.conversation_id!, 'assistant', fullResponse, null, [], lookups)").length - 1, 2)
  assert.equal(route.split('cleanYuriResponse(fullResponse, { stripUnfulfillableOffers: !canLookUp })').length - 1, 2)
  assert.equal(route.includes('stripUnfulfillableOffers: true'), false)
  assert.ok(route.includes('export const maxDuration = 120'))
})

test('the setup facts carry an unplaced location, and nothing when there is none', () => {
  const fact = 'Location on file: "Northern California". There are no map coordinates on file for it, so there is no saved-location weather or weekly forecast for them.'
  const out = buildOnboardingTurnState({}, undefined, { isSubscribed: false, locationFact: fact })
  const block = out.slice(out.indexOf('## Where They Stand (facts, not instructions)'))
  assert.ok(block.includes(`${fact} (Read before their latest message.)`))
  assert.ok(block.trimEnd().endsWith('how and whether to use them is yours, every time.') || /how and whether to use them is yours, every time\./.test(block))
  for (const none of [null, undefined, '']) {
    assert.ok(!buildOnboardingTurnState({}, undefined, { isSubscribed: false, locationFact: none }).includes('Location on file'))
  }
})
