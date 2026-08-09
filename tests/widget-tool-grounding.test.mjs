/**
 * Guard test — tool-grounding instrument.
 *
 * Prevents regression of the failure found in a real 6-message preview
 * conversation on 2026-08-09 (session 2731265d-3fb3-4a5e-aee1-c007c459dc9b, a
 * visitor in India). Yuri read her five-product lineup, correctly diagnosed two
 * stacked BHA sources, and recommended seven brands across the conversation
 * with ZERO tool calls. She even wrote, in her own words, "Want me to pull a
 * couple with live pricing? Just say the word and I'll search" — and then
 * recommended brands in her very next reply without searching.
 *
 * That is a STATE-VISIBILITY failure, not a knowledge failure: Yuri sees one
 * turn at a time and had no way to observe that she'd made an offer and never
 * honored it. Same class as the email ask and the cumulative give.
 *
 * The instrument must never become a content filter or a nag. Two properties
 * are load-bearing and are asserted below:
 *   1. It states FACTS and hands the decision back — no command to search,
 *      withhold, or hedge.
 *   2. It never calls a recommendation "unverified"/"ungrounded", because 13
 *      of the 57 measured ungrounded replies name Western brands the Korean
 *      catalog does not and should not contain. Hedging on CeraVe is a
 *      documented REGRESSION (CLAUDE.md, "Yuri may say 'keep what you have'").
 *
 * Fixtures are excerpted from the REAL transcript.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'widget', 'tool-grounding.ts'),
  'utf8'
)
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
  'utf8'
)

// Execute the REAL module — never a hand-copied mirror of the regexes, which
// can pass while production is broken.
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-grounding-'))
const modFile = join(dir, 'tool-grounding.mjs')
writeFileSync(modFile, js)
const { namedProductCount, detectToolGrounding, buildToolGroundingBlock } =
  await import(pathToFileURL(modFile).href)

// --- REAL excerpts from the Aug 9 2026 transcript -------------------------
const REAL_AUDIT_REPLY = `Here's the honest audit of what you've got before we add anything. **Re'equil sunscreen**, keep it, no notes. **Dr. Sheth's 10% vitamin C**, keep, just space it from your BHA. Look at **Cetaphil Gentle** or **Minimalist Oat Extract 8% cleanser**, barrier-friendly, no acid.`

const REAL_OFFER_REPLY = `For the bridge, a gentle cleanser is worth having so you're not just going bare. Want me to pull a couple of genuinely mild, barrier-friendly Korean cleansers with live pricing? The **round lab** and **Aestura** lines are what I'd look at for skin that's flaking. Just say the word and I'll search.`

const REAL_VISITOR_SHELF = `I generally use a nutrogena salicylic acid cleanser, a rose water toner, 10% vitamin c serum from dr sheth, occasionally a ponds hyaluronic and salycylic acid gel and daily, a requil sunscreen`

// Prose from the same real conversation that must NEVER count as a product.
const REAL_PROSE_NEGATIVES = [
  'You need a gentle cleanser, one simple moisturizer, and daily sunscreen.',
  'Sunscreen, do you burn or tan in the sun?',
  'The flaking is from over-exfoliation. Drop one acid source.',
  'Your rose water toner is doing basically nothing either way.',
  'This week: pause the gel entirely and switch your cleanser to a plain one.',
  '**Do NOT** layer these two together.',
  '**This week:** pause the BHA gel entirely and let the barrier rebuild.',
  '**Non-negotiable:** your sunscreen every single morning, reapplied if you are out.',
  '**Then:** reintroduce ONE BHA source only, 2-3x a week.',
  'Two acid sources on one small area is where the flaking is coming from.',
  'I can read any local brand as well as a Korean one; INCI is INCI.',
  'Chin flaking is usually dehydration or an active drying you out.',
]

test('detects named products in the real audit reply', () => {
  // The bug: this reply named four specific products and the conversation
  // recorded zero tool calls. If this returns 0, the instrument is blind again.
  assert.ok(
    namedProductCount(REAL_AUDIT_REPLY) >= 3,
    `expected >=3 named products, got ${namedProductCount(REAL_AUDIT_REPLY)}`
  )
})

test('detects a lowercase brand next to a plural slot word', () => {
  // "**round lab**" — Yuri wrote the brand in lowercase, and the only nearby
  // slot word was the PLURAL "cleansers". A singular-only slot regex silently
  // missed this in the real reply.
  assert.ok(
    namedProductCount(REAL_OFFER_REPLY) >= 1,
    'lowercase brand beside a plural slot word must be detected'
  )
})

test('generic prose and emphasised instructions never count as products', () => {
  // Precision is the constraint. A noisy instrument teaches Yuri to discount
  // the block, which is worse than no instrument — the explicit tradeoff
  // recorded in cumulative-give.ts.
  for (const text of REAL_PROSE_NEGATIVES) {
    assert.equal(
      namedProductCount(text),
      0,
      `false positive on prose: ${JSON.stringify(text)}`
    )
  }
})

test('the VISITOR listing their own shelf is not Yuri recommending', () => {
  // The Aug 9 visitor named five products in one message. Counting that as
  // Yuri's ungrounded recommendation would invert the whole instrument.
  const g = detectToolGrounding([
    { role: 'user', content: REAL_VISITOR_SHELF, toolCalls: 0 },
  ])
  assert.equal(g.ungroundedReplies, 0)
  assert.equal(g.ungroundedProducts, 0)
})

test('replaying the real Aug 9 conversation flags the unhonored search offer', () => {
  const g = detectToolGrounding([
    { role: 'user', content: 'Hello. My skin keeps feeling a little flaky around the chin', toolCalls: 0 },
    { role: 'assistant', content: 'Flaky patches are common. What are you using right now?', toolCalls: 0 },
    { role: 'user', content: REAL_VISITOR_SHELF, toolCalls: 0 },
    { role: 'assistant', content: REAL_AUDIT_REPLY, toolCalls: 0 },
    { role: 'user', content: 'I burn and tan both', toolCalls: 0 },
    { role: 'assistant', content: REAL_OFFER_REPLY, toolCalls: 0 },
  ])
  assert.equal(g.toolCalls, 0)
  assert.ok(g.ungroundedReplies >= 1)
  assert.equal(
    g.unhonoredSearchOffer,
    true,
    'Yuri offered to search and never did — the sharpest signal in this transcript'
  )
})

test('a search that actually ran clears the unhonored offer', () => {
  const g = detectToolGrounding([
    { role: 'assistant', content: REAL_OFFER_REPLY, toolCalls: 0 },
    { role: 'user', content: 'yes please', toolCalls: 0 },
    { role: 'assistant', content: 'Here are two with live pricing.', toolCalls: 2 },
  ])
  assert.equal(g.unhonoredSearchOffer, false)
})

test('stays SILENT when tools fired and nothing is ungrounded', () => {
  // An empty state is noise and costs tokens every turn.
  const g = detectToolGrounding([
    { role: 'user', content: 'is COSRX snail mucin good', toolCalls: 0 },
    { role: 'assistant', content: '**COSRX Snail Mucin** is a solid essence.', toolCalls: 2 },
  ])
  assert.equal(buildToolGroundingBlock(g), null)
})

test('the injected block is a FACT, never a cap', () => {
  const g = detectToolGrounding([
    { role: 'assistant', content: REAL_AUDIT_REPLY, toolCalls: 0 },
  ])
  const block = buildToolGroundingBlock(g)
  assert.ok(block, 'block should render when a reply named products with no tool')

  assert.match(block, /facts, not instructions/i)
  assert.match(block, /not a rule and not a cap/i)

  // Must not become a command. This is the property that failed twice on the
  // widget give/gate before v11.10.0 fixed it with a fact instead of a rule.
  //
  // Matched on IMPERATIVES only. An earlier version of this assertion listed
  // bare "withhold", which matched the block's own disclaimer ("Nothing here
  // asks you to withhold a recommendation") — i.e. it flagged the sentence that
  // exists to PREVENT the failure. Assert the imperative form, not the word.
  assert.doesNotMatch(
    block,
    /\b(you must|you should|always call|never recommend|do not name|do not recommend)\b/i,
    'the grounding fact must not turn into an instruction'
  )
  // The disclaimer sentence itself is required.
  assert.match(block, /Nothing here asks you to withhold/i)
})

test('the block never brands recommendations as unverified', () => {
  // 13 of 57 measured ungrounded replies name Western brands that the Korean
  // catalog does not and should not contain. Calling those "unverified" would
  // push Yuri to hedge on CeraVe — a documented regression.
  const g = detectToolGrounding([
    { role: 'assistant', content: REAL_AUDIT_REPLY, toolCalls: 0 },
  ])
  const block = buildToolGroundingBlock(g)
  assert.doesNotMatch(block, /\b(unverified|ungrounded|unsubstantiated|made up|fabricat)\w*\b/i)
  // And it must actively say an empty result is not a verdict on the product.
  assert.match(block, /never a verdict on the product/i)
})

// ---------------------------------------------------------------------------
// Route-level guards
// ---------------------------------------------------------------------------

test('the recommend-intent detector fires on a routine revamp with no product noun', () => {
  // The real message that fired nothing: "I'm looking to revamp my routine
  // using indian brands. Can you help me?" — no product noun, so the old
  // `recommend.{0,20}(product|serum|...)` regex could not match.
  const start = routeSrc.indexOf('function shouldWidgetForceToolUse')
  const end = routeSrc.indexOf('\n}\n', start) + 3
  const fnJs = ts.transpileModule(routeSrc.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const shouldWidgetForceToolUse = new Function(
    fnJs + '\nreturn shouldWidgetForceToolUse'
  )()

  assert.equal(
    shouldWidgetForceToolUse("I'm looking to revamp my routine using indian brands. Can you help me?"),
    true,
    'a routine revamp request must be treated as recommendation intent'
  )
  // Market-neutral by construction — the same sentence with any other market.
  assert.equal(
    shouldWidgetForceToolUse('can you help me rebuild my routine with thai brands'),
    true
  )
  // Must NOT over-fire on pleasantries.
  assert.equal(shouldWidgetForceToolUse('Got it. Thank you'), false)
  assert.equal(shouldWidgetForceToolUse('hi'), false)
})

test('BRAND_SIGNALS was not expanded into an unbounded market list', () => {
  // The rejected fix. A hardcoded brand list was blind to Western lineups in
  // ffcede9 and to Indian brands on Aug 9, and would be blind to Thai next.
  // CLAUDE.md: "When a classifier needs repeated hand-tuning, that is the
  // signal to stop, not to keep adjusting."
  const block = routeSrc.slice(
    routeSrc.indexOf('const BRAND_SIGNALS'),
    routeSrc.indexOf(']', routeSrc.indexOf('const BRAND_SIGNALS'))
  )
  for (const western of ['cerave', 'cetaphil', 'vanicream', 'minimalist', 'sheth', 'equil']) {
    assert.ok(
      !block.toLowerCase().includes(western),
      `BRAND_SIGNALS must not grow a Western/Indian arm (found "${western}"); ` +
        'use the grounding fact instead — see WIDGET-GROUNDING-FIX.md'
    )
  }
})

test('the preview countdown is withheld mid-conversation', () => {
  // She volunteered "you've got 6 free messages left" at message 6 of 12.
  assert.match(routeSrc, /Volunteering the count is NOT appropriate yet/i)
  assert.match(routeSrc, /They ARE near the end now/i)
})

test('the email ask is not framed as a warning about the visitor', () => {
  assert.match(routeSrc, /Don't frame the ask as a warning about them/i)
  assert.match(routeSrc, /never in a forecast of their backsliding/i)
})

test('the grounded transcript carries tool-call counts', () => {
  // The client-sent history has no tool data; only the DB knows whether a
  // search ran. If this select loses tool_calls, the instrument goes blind
  // while every test above still passes on synthetic fixtures.
  const persistence = readFileSync(
    join(__dirname, '..', 'src', 'lib', 'widget', 'persistence.ts'),
    'utf8'
  )
  assert.match(persistence, /\.select\(\s*'role,\s*content,\s*tool_calls'\s*\)/)
  assert.match(routeSrc, /groundedHistory/)
})
