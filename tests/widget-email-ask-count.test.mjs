/**
 * Guard test — Yuri must be able to tell "my offer got buried" from "I have
 * asked three times and been stepped around each time."
 *
 * THE DEFECT (Aug 26 2026, production session bf03c14e). A blog visitor was
 * asked for her email in FOUR consecutive replies — messages 3, 4, 5 and 6,
 * each one the closing paragraph of a substantive answer. She never refused;
 * she asked her next question every time. She left at message 6 of 12 with no
 * email, right after asking what to buy.
 *
 * WHY. The prompt's don't-repeat line stops the asking only when the visitor
 * "clearly passed on it". Asking a new question is not passing on it, so every
 * turn routed to the "buried, so ask again" branch — and because the asks were
 * themselves tacked onto substantive answers, each re-ask satisfied the
 * condition that licensed the next one.
 *
 * THE FIX IS NOT A CAP, AND THE DATA IS WHY. Measured across every widget
 * session ever recorded:
 *
 *   0 asks   66 sessions   13.6% captured
 *   1 ask    16 sessions   43.8% captured
 *   2 asks   10 sessions   70.0% captured   <- best state in the corpus
 *   3+ asks   6 sessions   33.3% captured
 *
 * "Ask once and stop" would have been the WRONG fix — it would suppress the
 * single move most associated with capture. And none of these differences is
 * significant (Fisher exact: 2 vs 3+ p=0.302; 1 vs 2 p=0.248; 1-2 vs 3+
 * p=0.654), so a tuned cutoff would be fitting noise across six tail sessions.
 * The module reports a COUNT and encodes no threshold.
 *
 * WHAT ALREADY WORKS AND MUST NOT BE BROKEN:
 *   - Asks-after-capture is ZERO across all 16 sessions with 2+ asks.
 *   - An explicit refusal is honored: on Aug 5 a visitor replied "No, I'm good.
 *     Maybe i'll share my email later" and Yuri let it rest and closed warmly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

// Execute the REAL module. A source-text test passes against broken code — an
// adversarial review defeated an earlier suite in this repo by replacing a
// matcher with one that could never match, while every grep-based test passed.
const js = ts.transpileModule(
  readFileSync(join(__dirname, '..', 'src', 'lib', 'widget', 'email-ask-count.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText
const modFile = join(mkdtempSync(join(tmpdir(), 'ss-emailask-')), 'email-ask-count.mjs')
writeFileSync(modFile, js)
const { isEmailAsk, isRefusal, detectEmailAsks, buildEmailAskBlock } = await import(
  pathToFileURL(modFile).href
)

// --- REAL asks from the Aug 26 transcript (session bf03c14e) ---------------
const ASK_3 =
  "This is worth not losing track of, since it's a two-week experiment with a specific before/after, want me to hang onto your email so I can send you a write-up of what we worked out here?"
const ASK_4 =
  "We've untangled something here that took you years to see, want me to hang onto your email and send you a write-up? You'd type your address in the box and I'll send the recap."
const ASK_5 =
  "That's a real four-week plan with a specific reintroduction order, worth keeping so you're not guessing in week 5, want me to hang onto your email and send you the write-up?"
// A REAL confirmation from the corpus — the address never appears, only a name.
const CONFIRMATION =
  "Got your email saved, betty, I'll send you a write-up of what we worked out (the gentle cleanser + BHA pad plan) so it's not living only in this chat."
const ORDINARY =
  'Your barrier needs time. Give it two weeks of one-exfoliant-at-a-time and the dehydration should lift on its own.'

test('a real ask is detected and a real answer is not', () => {
  for (const ask of [ASK_3, ASK_4, ASK_5]) {
    assert.equal(isEmailAsk(ask), true, `must detect: ${ask.slice(0, 50)}`)
  }
  assert.equal(isEmailAsk(ORDINARY), false, 'ordinary advice must not count as an ask')
})

test('a CONFIRMATION is never counted as an ask', () => {
  // Found in the real corpus. Counting it would inflate the tally on precisely
  // the visitor who complied — the one case where Yuri must not be told she has
  // been asking repeatedly. Note the address is absent, so matching only an
  // echoed email address is insufficient.
  assert.equal(isEmailAsk(CONFIRMATION), false, 'a receipt is the opposite of an ask')
  assert.equal(
    isEmailAsk("Got it, saved to lrwells2013@gmail.com, and I'll send you a write-up."),
    false,
    'an echoed address must also suppress the count'
  )
})

test('a conversational opener must NOT suppress a genuine ask', () => {
  // An earlier draft suppressed on bare openers ("got it", "locked in",
  // "you're all set"). An adversarial check found those are phrases Yuri opens
  // replies with constantly, so a real ask beginning "Got it, that makes
  // sense. Want me to hang onto your email...?" was SILENTLY DROPPED from the
  // count. Under-counting is the failure that makes this module useless: the
  // block goes quiet in exactly the sessions it exists for.
  const realAsks = [
    'Got it, that makes sense. Want me to hang onto your email so I can send you the write-up?',
    "You're all set for now. Want me to hang onto your email and send you a recap?",
    'Locked in: no acids for four weeks. Want me to hang onto your email so I can send you a recap?',
    'That saved you about forty dollars. Want me to hang onto your email for the write-up?',
  ]
  for (const ask of realAsks) {
    assert.equal(isEmailAsk(ask), true, `an opener must not suppress: ${ask.slice(0, 45)}`)
  }
})

test('the block stays SILENT at one ask — the healthy state', () => {
  // Two asks is the best-performing state in the corpus (70% vs 43.8%). A block
  // that fired after one would discourage the very move most associated with
  // capture, recreating the Jul 23 failure where a buried ask could never be
  // recovered.
  const h = detectEmailAsks([
    { role: 'user', content: 'help with my routine' },
    { role: 'assistant', content: ASK_3 },
  ])
  assert.equal(h.count, 1)
  assert.equal(buildEmailAskBlock(h), null, 'one ask must produce no block')
})

test('it fires once the offer has gone unanswered more than once', () => {
  const h = detectEmailAsks([
    { role: 'assistant', content: ASK_3 },
    { role: 'user', content: 'I bought most of my routine recently' },
    { role: 'assistant', content: ASK_4 },
  ])
  assert.equal(h.count, 2)
  const block = buildEmailAskBlock(h)
  assert.ok(block, 'two unanswered asks must surface the count')
  assert.match(block, /2 separate replies/, 'the count must be stated as a number')
})

test('the count is accurate on the REAL four-ask transcript', () => {
  const history = [
    { role: 'user', content: 'can you help me figure out what is right for my skin?' },
    { role: 'assistant', content: 'Happy to. Dehydrated is not the same as dry.' },
    { role: 'user', content: 'Round Lab cleanser, Purito gel cream, SKIN1004 sunscreen' },
    { role: 'assistant', content: 'Good lineup. Cut the prep pads back to 2-3x a week.' },
    { role: 'user', content: 'No prep pads i recently bought' },
    { role: 'assistant', content: ASK_3 },
    { role: 'user', content: 'I bought most of my routine recently' },
    { role: 'assistant', content: ASK_4 },
    { role: 'user', content: 'I have no centella' },
    { role: 'assistant', content: ASK_5 },
  ]
  const h = detectEmailAsks(history)
  assert.equal(h.count, 3, 'exactly the three asks, not the two ordinary replies')
  assert.equal(h.askedLastTurn, true, 'her most recent reply carried an offer')
  assert.match(buildEmailAskBlock(h), /including your most recent one/)
})

test('it names BOTH readings and commits to neither', () => {
  // "A mismatch is not a diagnosis." The instrument reports that the offer went
  // unanswered; it must not decide whether that means buried or declined.
  const block = buildEmailAskBlock(detectEmailAsks([
    { role: 'assistant', content: ASK_3 },
    { role: 'assistant', content: ASK_4 },
  ]))
  assert.match(block, /got buried/i, 'the buried reading must survive')
  assert.match(block, /quietly passed over/i, 'the stepped-around reading must be named')
  assert.match(block, /you can tell and nothing else can/i, 'the judgment must be handed back')
})

test('it is not a cap and does not tell her to stop', () => {
  // The house contract for these instruments (cumulative-give, value-density,
  // tool-grounding): state facts, never direct. A cap here would recreate the
  // Jul 23 failure this rule was written to fix.
  const block = buildEmailAskBlock(detectEmailAsks([
    { role: 'assistant', content: ASK_3 },
    { role: 'assistant', content: ASK_4 },
    { role: 'assistant', content: ASK_5 },
  ]))
  for (const banned of [
    /\bdo not ask\b/i,
    /\bdon't ask again\b/i,
    /\bstop asking\b/i,
    /\byou must\b/i,
    /\bnever ask\b/i,
    /\btoo many\b/i,
    /\byou should\b/i,
  ]) {
    assert.ok(!banned.test(block), `the block must not command or cap: ${banned}`)
  }
  assert.match(block, /Nothing here caps how many times/i,
    'it must explicitly disclaim being a cap')
  // The v11.32.0 precedent: a Fable review deleted "spend" framing from this
  // same widget's prompt because it frames the action as depleting currency.
  // It must not come back here.
  assert.ok(!/\bspends?\b/i.test(block),
    'the block must not frame asking as spending goodwill (v11.32.0 precedent)')
})

test('it NEVER asserts "they have not refused" against a real refusal', () => {
  // PROVEN DEFECT, caught by adversarial review. An earlier draft hardcoded
  // "They have not refused" while reading ONLY assistant turns, so it could
  // not know. Production session e60c9e4d: after the third ask the visitor
  // wrote exactly the message below. The block would have injected a flat
  // contradiction of the transcript directly above it — the v11.30.0
  // false-ternary failure, in a block whose only authority is being factual.
  const REAL_REFUSAL =
    "No, I'm good. Maybe i'll share my email later. Toodles for now. 고마워요, 유리 언니"
  assert.equal(isRefusal(REAL_REFUSAL), true, 'the real production refusal must be detected')

  const h = detectEmailAsks([
    { role: 'assistant', content: ASK_3 },
    { role: 'user', content: REAL_REFUSAL },
    { role: 'assistant', content: ASK_4 },
  ])
  assert.equal(h.refusalSeen, true, 'the refusal must reach the block')
  const block = buildEmailAskBlock(h)
  assert.ok(!/have not refused/i.test(block),
    'the block must NOT claim no refusal occurred when one did')
  assert.match(block, /reads as a no/i, 'it must surface the refusal')
  assert.match(block, /Take them at their word/i,
    'a stated no must outrank the count')
})

test('with no refusal it does not invent one either', () => {
  // The common case: 14 of 15 follow-ups across the repeat-ask sessions were a
  // brand-new question. Asserting a decline that did not happen would license
  // Yuri to drop a live opportunity.
  const h = detectEmailAsks([
    { role: 'assistant', content: ASK_3 },
    { role: 'user', content: 'I have no centella, i used to have anua rice toner' },
    { role: 'assistant', content: ASK_4 },
  ])
  assert.equal(h.refusalSeen, false)
  const block = buildEmailAskBlock(h)
  assert.match(block, /No refusal is detectable/i, 'it must say the refusal is absent, not assert one')
  assert.ok(!/reads as a no/i.test(block), 'it must not manufacture a decline')
})

test('the detector covers idioms beyond the transcript it was written from', () => {
  // PROVEN DEFECT. The first draft was fitted to one session and MISSED five
  // asks in session 66251ea8 (the worst asker in the corpus, six asks) and all
  // three Spanish asks in aaa12da0 — so the block stayed silent in exactly the
  // sessions the defect recurs. All strings below are REAL production text.
  const realMissedAsks = [
    "so let's lock in your email now and I'll send the full recap",
    'And go ahead and drop that email so I can send the recap before the preview runs out.',
    "so send me that email and I'll get the full recap, this exact schedule",
    "Want to add your email now? I'll send the full recap",
    '¿Quieres que te guarde tu email y te envíe un resumen de lo que hemos aclarado aquí?',
    "drop me your email and I'll send you this whole routine written up",
    "give me your email and I'll hang onto this routine",
  ]
  for (const ask of realMissedAsks) {
    assert.equal(isEmailAsk(ask), true, `must count real ask: ${ask.slice(0, 48)}`)
  }
})

test('a real confirmation with no address is still not an ask', () => {
  // Production reply ed03aa91 — counted as an ask by an earlier draft.
  assert.equal(
    isEmailAsk("Got it, saved. I'll send you a recap covering the big pieces we worked out"),
    false,
    'a receipt without an echoed address must still be suppressed'
  )
})

test('the route injects it only while no email is captured', () => {
  // Once the address lands, the Conversation State block already says "do NOT
  // ask again". Measured: asks-after-capture is zero across every session, so
  // rendering this then would be pure noise on a solved problem.
  const route = readFileSync(ROUTE, 'utf8')
  assert.match(route, /if \(!hasEmail\) \{\s*\n\s*const askBlock = buildEmailAskBlock\(detectEmailAsks\(history\)\)/,
    'the block must be gated on there being no captured email')
})

test('the route actually appends the block to the model context', () => {
  // Without this the module is dead code: every test above passes on fixtures
  // while Yuri never sees a word of it.
  const route = readFileSync(ROUTE, 'utf8')
  assert.match(route, /if \(askBlock\) dynamicContext \+= askBlock/,
    'the block must be appended to dynamicContext')
  assert.match(route, /from '@\/lib\/widget\/email-ask-count'/,
    'the route must import the detector')
})
