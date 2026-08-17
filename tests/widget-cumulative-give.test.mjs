/**
 * Guard test — cumulative-give instrument.
 *
 * Prevents regression of the give/gate failure found in a real 14-message
 * preview conversation on 2026-07-20. The system prompt's gate already says,
 * explicitly and with the artifacts named, "do NOT deliver that complete
 * blueprint in the preview." Yuri delivered all five anyway — a full AM/PM
 * routine, a Night A/B/C rotation, a keep/cut/add shelf audit, three priced
 * picks, and a lineup conflict-check.
 *
 * The instruction was not the problem. NO SINGLE REPLY crossed the line; the
 * complete build existed only in aggregate, and Yuri sees one turn at a time.
 * She was asked to hold a cumulative boundary with no cumulative instrument.
 * (The email side holds the identical policy perfectly — because a recap is one
 * artifact generated in one pass, where the model can see the whole thing.)
 *
 * This module is the instrument. It reads Yuri's OWN already-sent replies and
 * reports the running total as a fact. It must never become a content filter:
 * it blocks nothing, inspects no drafts, and leaves the judgment to her.
 *
 * Fixtures below are excerpted from the REAL transcript, so this reproduces the
 * production failure rather than an idealized version.
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
  join(__dirname, '..', 'src', 'lib', 'widget', 'cumulative-give.ts'),
  'utf8'
)
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
  'utf8'
)

// ---------------------------------------------------------------------------
// Execute the REAL module.
//
// These tests previously kept a hand-copied MIRROR of the detector regexes. That
// mirror could drift from the shipped code and pass while production was broken
// — the exact failure mode this repo has paid for before. The module is pure
// (no imports), so transpile and import the real thing instead.
// ---------------------------------------------------------------------------
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-give-'))
const modFile = join(dir, 'cumulative-give.mjs')
writeFileSync(modFile, js)
const {
  detectArtifactsInReply,
  detectCumulativeGive,
  buildCumulativeGiveBlock,
  namedSlotPickCount,
  detectBuildRequest,
  buildRequestBlock,
} = await import(pathToFileURL(modFile).href)

// Real excerpts from the Jul 21 2026 transcript.
const REAL_ROTATION_REPLY = `**How they tie into your nights (this is the sequencing that keeps you from overdoing it):**
- **AM:** gentle cleanse → your keeper toner → sunscreen. Every single day. That's it.
- **PM Night A (2x/wk):** cleanse → **BHA pad** → moisturizer
- **PM Night B (2x/wk):** cleanse → **AprilSkin TXA/niacinamide** → moisturizer
Introduce **one new active at a time**, two weeks apart, SPF first, then BHA.`

const REAL_SCORECARD_REPLY = `**The scorecard, keep vs. change:**
- **Keep as-is:** AprilSkin (use more), Geology (use more), one toner, Zero Pore oil
- **Cut back:** two foam cleansers → one; drop the redundant second toner
- **Add (your real gaps):** SPF (Physiogel), BHA (Celimax), retinal (Arencia)`

const REAL_PRICED_PICKS_REPLY = `- **Physiogel Red Soothing sunscreen**, $25.99 (Olive Young).
- **AGE 20's Skin-Fit Hydra Sun+**, $35.20 (Olive Young).
- **Arencia Retinal Booster Shot**, $18.81 (Olive Young).`

const REAL_CONFLICT_REPLY = `your COSRX AHA/BHA toner and the Celimax BHA pad do the same job, so you don't need both. Don't buy the Celimax.`

test('the production failure: the real transcript reads as a complete giveaway', () => {
  const history = [
    { role: 'assistant', content: REAL_ROTATION_REPLY },
    { role: 'assistant', content: REAL_SCORECARD_REPLY },
    { role: 'assistant', content: REAL_PRICED_PICKS_REPLY },
    { role: 'assistant', content: REAL_CONFLICT_REPLY },
  ]
  const give = detectCumulativeGive(history)
  assert.equal(give.count, 5, `expected all 5 artifacts, got ${give.artifacts.join(', ')}`)
})

test('each artifact is detected from its real-transcript form', () => {
  assert.ok(detectArtifactsInReply(REAL_ROTATION_REPLY).has('am_pm_routine'))
  assert.ok(detectArtifactsInReply(REAL_ROTATION_REPLY).has('weekly_schedule'))
  assert.ok(detectArtifactsInReply(REAL_SCORECARD_REPLY).has('shelf_audit'))
  assert.ok(detectArtifactsInReply(REAL_PRICED_PICKS_REPLY).has('slot_picks'))
  assert.ok(detectArtifactsInReply(REAL_CONFLICT_REPLY).has('lineup_conflict_check'))
})

test('the VISITOR describing their own routine never counts as Yuri giving one', () => {
  // Verbatim from the real transcript — the visitor listing his shelf.
  const history = [
    {
      role: 'user',
      content:
        'I use medicube pdrn hydrating gel cleanser, medicube zero pore blackhead cleaning oil, ' +
        'medicube zero pore clear cleansing foam in almost every shower each night. After the shower, ' +
        '2-3X a week i use calming liquid intensive cosrx along with teatreement toner',
    },
  ]
  assert.equal(
    detectCumulativeGive(history).count,
    0,
    'visitor turns must be ignored — only Yuri’s own replies count as delivered'
  )
})

test('discussing an ingredient is not delivering a routine (no false positives)', () => {
  const chatty =
    "Snail mucin is a genuinely good ingredient, not a gimmick. It's excellent for healing and " +
    'hydration, and it scores highest for dry skin in our effectiveness data. Not a priority for ' +
    'your oily skin though — save your money there for now.'
  assert.equal(detectArtifactsInReply(chatty).size, 0)
})

test('a single priced pick is the GIVE, not a multi-slot giveaway', () => {
  // The policy explicitly permits one specific pick for their #1 gap.
  const oneGive =
    "Your highest-leverage change is a BHA. I'd start you on the Celimax Ji Woo Gae Cica BHA " +
    'Blemish Toner Pad ($18.48 at Olive Young). Start twice a week.'
  const found = detectArtifactsInReply(oneGive)
  assert.ok(!found.has('slot_picks'), 'one pick must not trip the multi-slot artifact')
})

// ---------------------------------------------------------------------------
// The Aug 8 2026 blind spot: an UNPRICED (Western) lineup was invisible.
//
// A cold 20-year-old from Bailey's TikTok got a Korean reset lineup, then a
// complete second lineup rebuilt for Target/Ulta, then a third revision of that
// lineup re-textured for clog-prone skin. The instrument scored her 1/5 and
// never fired, because `slot_picks` keyed on `$\d` and our price feeds are
// Korean — a Target/Ulta lineup carries no dollar signs at all.
//
// The control makes it conclusive: Suzy, whose conversation was correctly
// calibrated, scored 3/5 and got the block from her third message. The
// instrument ranked the two conversations exactly backwards.
//
// Fixtures are verbatim from the two production transcripts.
// ---------------------------------------------------------------------------

const REAL_WESTERN_LINEUP = `Your reset, all findable at Target or Ulta:

- **Cleanser, Vanicream Gentle Facial Cleanser** or **CeraVe Hydrating Cleanser.** Both are non-foaming, no residue film.
- **Moisturizer, CeraVe Moisturizing Cream** (the tub) or **La Roche-Posay Cicaplast Baume B5.**
- **Sunscreen, La Roche-Posay Anthelios or the CeraVe Hydrating Mineral SPF.** Non-negotiable for your burn-then-tan skin.`

const REAL_KOREAN_LINEUP = `Here's your reset lineup, three products, one job each: calm and heal, don't provoke.

- **Cleanser, Thank You Farmer Phyto Relieful Cica Gel Cleanser** ($29.68 at Olive Young).
- **Moisturizer, Real Barrier Extreme Cream** ($22, the main listing with 11,000+ reviews).
- **Sunscreen, SKIN1004 Madagascar Centella Tea-Trica Soothing Sun Milk** ($17 at Olive Young).`

// Verbatim from the same visitor's FIRST reply — generic category advice, not a
// lineup. A first cut of this fix fired on it ("cleanser, one simple
// moisturizer") which would have taught Yuri to discount the block.
const REAL_GENERIC_ADVICE = `So the single highest-leverage change, starting tonight: **hands off completely, and strip your routine down to bare minimum**, gentle cleanser, one simple moisturizer, daily sunscreen, nothing active, nothing new, while things calm.

Two quick things that change my read: roughly what age range are we in, and out in the sun with no sunscreen, do you burn, tan, or both?`

test('an UNPRICED Western lineup counts as slot picks (the Aug 8 blind spot)', () => {
  const found = detectArtifactsInReply(REAL_WESTERN_LINEUP)
  assert.ok(
    found.has('slot_picks'),
    'a complete Target/Ulta lineup carries no $ tokens and must still register as a delivered lineup'
  )
  assert.equal((REAL_WESTERN_LINEUP.match(/\$\d/g) || []).length, 0,
    'fixture sanity: this lineup genuinely has no prices, which is why the old detector missed it')
})

test('generic category advice is NOT a lineup (no false positives)', () => {
  assert.equal(
    namedSlotPickCount(REAL_GENERIC_ADVICE), 0,
    '"gentle cleanser, one simple moisturizer, daily sunscreen" names categories, not products'
  )
  assert.ok(!detectArtifactsInReply(REAL_GENERIC_ADVICE).has('slot_picks'))
})

test('one named slot pick is the GIVE; two is a lineup', () => {
  // The policy explicitly permits one specific pick for their #1 gap.
  assert.equal(namedSlotPickCount('Cleanser, CeraVe Hydrating Cleanser. That is the only change I would make today.'), 1)
  assert.ok(!detectArtifactsInReply('Cleanser, CeraVe Hydrating Cleanser. Only change I would make.').has('slot_picks'))
  assert.ok(detectArtifactsInReply(REAL_WESTERN_LINEUP).has('slot_picks'))
})

test('two options for ONE slot is a choice, not two slots', () => {
  const oneSlot = '**Moisturizer, CeraVe Moisturizing Cream** or **La Roche-Posay Cicaplast Baume B5.**'
  assert.equal(namedSlotPickCount(oneSlot), 1, 'offering alternatives for a single slot must count once')
})

test('rebuilding the lineup is counted even though the artifact set cannot show it', () => {
  const history = [
    { role: 'assistant', content: REAL_KOREAN_LINEUP },
    { role: 'user', content: 'can you build me a routine I can get at target or ulta?' },
    { role: 'assistant', content: REAL_WESTERN_LINEUP },
  ]
  const give = detectCumulativeGive(history)
  assert.equal(give.count, 1, 'both replies collapse to the same single slot_picks artifact')
  assert.equal(give.lineupBuilds, 2, 'but two separate full lineups were delivered')
  const block = buildCumulativeGiveBlock(give)
  assert.ok(block, 'a second full lineup must surface even when the artifact count has not moved')
  assert.match(block, /2 separate times/)
})

test('the note fires BEFORE the second lineup, not after it', () => {
  // THE OFF-BY-ONE. Replaying the real Aug 8 2026 transcript (session
  // d3b442fb, a cold 20-year-old from Bailey's TikTok who received THREE
  // complete lineups): at the moment Yuri was about to write the Target/Ulta
  // rebuild, exactly one lineup had been sent. The old gate required TWO
  // (`count < 2 && lineupBuilds < 2`), so it returned null and she wrote the
  // second build with no visibility whatsoever. The warning only appeared
  // before the THIRD — always one build late, which is one build too late.
  const beforeTheRebuild = [
    { role: 'user', content: 'What should I do?' },
    { role: 'assistant', content: 'Referral for the cheek spot, and hands off.' },
    { role: 'user', content: 'Yes can you give me a product breakdown please' },
    { role: 'assistant', content: REAL_KOREAN_LINEUP },
  ]
  const give = detectCumulativeGive(beforeTheRebuild)
  assert.equal(give.lineupBuilds, 1, 'exactly one lineup has been delivered so far')

  const block = buildCumulativeGiveBlock(give)
  assert.ok(
    block,
    'the note MUST render while only one lineup exists — that is the turn on ' +
      'which "can I get this at Target?" arrives'
  )
  // It must name the rebuild pattern specifically, not just report a count.
  assert.match(block, /same build again, not a new question/i)
})

test('a rebuild request is named as a repeat, not a new question', () => {
  // The gate was defined by ARTIFACT ("a complete AM/PM routine is subscriber
  // work") but the real leak is REPETITION: each of the three Aug 8 replies
  // looked compliant in isolation, because a different store genuinely reads
  // as a different question from inside a single turn.
  const give = detectCumulativeGive([{ role: 'assistant', content: REAL_KOREAN_LINEUP }])
  const block = buildCumulativeGiveBlock(give)
  assert.match(block, /different retailer|different store|Target/i)
  // And it must point at the more useful answer rather than only forbidding.
  assert.match(block, /translation rule|the one pick that actually changes/i)
})

test('stays silent before any lineup has been built', () => {
  // The give is supposed to be generous. A visitor who has received a
  // diagnosis and a single pick must not trip the instrument — that is the
  // free value that converted the only paying subscriber on record.
  const give = detectCumulativeGive([
    { role: 'user', content: 'bumps on my chin' },
    { role: 'assistant', content: 'That cheek spot needs a dermatologist. Hands off, and strip back to a gentle cleanser.' },
  ])
  assert.equal(give.lineupBuilds, 0)
  assert.equal(buildCumulativeGiveBlock(give), null, 'no lineup yet — nothing to report')
})

test('the rebuild note stays a fact and never instructs a refusal', () => {
  const give = detectCumulativeGive([
    { role: 'assistant', content: REAL_KOREAN_LINEUP },
    { role: 'assistant', content: REAL_WESTERN_LINEUP },
  ])
  const block = buildCumulativeGiveBlock(give)
  assert.ok(
    !/\brefuse\b|\bdecline to\b|\bdo not (?:give|answer|provide)\b|\bwithhold\b(?! help)/i.test(block),
    'the rebuild note must never become an instruction to withhold — judgment stays with Yuri'
  )
  assert.match(block, /not a rule and not a cap/)
})

test('the visitor naming products never counts as Yuri delivering a lineup', () => {
  const give = detectCumulativeGive([
    { role: 'user', content: 'Cleanser, Vanicream Gentle Facial Cleanser. Moisturizer, CeraVe Moisturizing Cream.' },
  ])
  assert.equal(give.count, 0)
  assert.equal(give.lineupBuilds, 0)
})

// ---------------------------------------------------------------------------
// Source assertions — the instrument must stay an instrument.
// ---------------------------------------------------------------------------

test('the block is injected as FACTS and hands the decision back to Yuri', () => {
  assert.ok(
    /facts, not instructions/.test(src),
    'the injected block must be framed as facts, matching the Conversation State pattern'
  )
  assert.ok(
    /not a rule and not a cap/.test(src),
    'the block must explicitly disclaim being a rule — judgment stays with Yuri (AI-First)'
  )
  // Scope this to the TEMPLATE LITERAL that actually reaches Yuri. The module's
  // comments legitimately use words like "refuse" to document what it does NOT
  // do; only the injected text matters here.
  const tmplStart = src.indexOf("return `\\n\\n## What You've Already Given")
  assert.ok(tmplStart > 0, 'injected template not found — was it renamed?')
  const injected = src.slice(tmplStart, src.indexOf('`\n}', tmplStart))
  assert.ok(
    !/\brefuse\b|\bmust not (?:answer|say)\b|\bdecline to\b|\bwithhold\b(?! help)/.test(injected),
    'the injected text must never instruct Yuri to refuse or withhold — that would replace her judgment'
  )
})

test('detection reads only assistant turns, never drafts or visitor text', () => {
  assert.ok(
    /if \(turn\.role !== 'assistant'\) continue/.test(src),
    'must skip non-assistant turns'
  )
  // The route must feed it HISTORY (already-sent), not the in-flight response.
  assert.ok(
    /detectCumulativeGive\(history\)/.test(routeSrc),
    'the route must pass already-sent history — never a draft or the current reply'
  )
})

test('the instrument only appends context; it gates no output path', () => {
  const start = routeSrc.indexOf('const cumulativeGive = detectCumulativeGive(history)')
  assert.ok(start > 0, 'cumulative-give wiring not found in the route')
  const region = routeSrc.slice(start, start + 300)
  assert.ok(
    /dynamicContext \+= giveBlock/.test(region),
    'the block must be appended to context'
  )
  assert.ok(
    !/return new Response|throw |maxTokens|max_tokens/.test(region),
    'the instrument must not short-circuit the response or alter generation params'
  )
})

test('age/life-stage qualification is present and never gates advice', () => {
  assert.ok(
    /Age and life stage, when they change the answer/.test(routeSrc),
    'age qualification guidance missing — Bailey caught that Yuri asked only for location'
  )
  assert.ok(
    /never gate advice on it/.test(routeSrc),
    'age must never become a required field — help proceeds without it'
  )
  assert.ok(
    /retinoids are contraindicated/.test(routeSrc),
    'pregnancy/retinoid safety check missing'
  )
  assert.ok(
    /don't interrogate for it/.test(routeSrc),
    'gender must stay volunteered-only, not interrogated'
  )
})

/**
 * PRESCRIPTIVE SEQUENCES — a routine handed over as an arrow chain.
 *
 * THE BLIND SPOT (measured Aug 17 2026, session 3132e3ee). A visitor in Seoul
 * listed ~11 products she ALREADY OWNED. Yuri delivered a full AM sequence, a
 * PM retinol sequence with buffering, off-nights hydration, a 2x/week ramp and
 * a stop-repurchasing list — the subscriber deliverable — and `lineupBuilds`
 * stayed at 0, because `SLOT_WITH_PRODUCT` needs slot-word + SEPARATOR + a
 * KNOWN_BRANDS name and her routine was written as arrows. IOPE was not even in
 * the brand list. The shape appears in 5 of 19 deep conversations (26%).
 *
 * Ownership is irrelevant to the gate: it was always defined by the ARTIFACT
 * handed over, never by whether money moves. Yuri did not BUILD a lineup here,
 * she REORGANIZED one — same deliverable, invisible shape.
 */
test('a routine delivered as an arrow chain counts as a build', () => {
  const reply = '- **PM retinol nights:** cleanse → Sulwhasoo water → IOPE retinol → AESTURA smoothing cream'
  const g = detectCumulativeGive([{ role: 'assistant', content: reply }])
  assert.ok(g.artifacts.includes('slot_picks'),
    'a sequenced routine naming real products is a delivered build')
  assert.equal(g.lineupBuilds, 1)
})

test('it needs no brand list — the visitor\'s own products capitalise themselves', () => {
  // KNOWN_BRANDS failed twice here: the shape didn't match AND IOPE is absent.
  // A brand list was blind to Western brands until Aug 8, blind to Indian ones
  // after, and would be blind to Thai next. Capitalisation is market-neutral.
  const unknownBrands = 'cleanse → Sidmool Niaten → Hanbang Jinyul essence → moisturizer'
  const g = detectCumulativeGive([{ role: 'assistant', content: unknownBrands }])
  assert.ok(g.artifacts.includes('slot_picks'),
    'brands we have never catalogued must still count as a delivered build')
})

test('DISCUSSING an order is not DELIVERING a routine', () => {
  // The false-positive that would cost the instrument its credibility. Generic
  // step order is lowercase categories; a delivered routine names products.
  for (const prose of [
    'The general order is toner → serum → moisturizer → sunscreen.',
    'patch test → wait 24 hours → reassess before going further',
    'AM: cleanse → hydrate → vitamin C → SPF',
  ]) {
    const g = detectCumulativeGive([{ role: 'assistant', content: prose }])
    assert.ok(!g.artifacts.includes('slot_picks'),
      `generic sequencing must not count as a build: ${JSON.stringify(prose)}`)
  }
})

test('a single arrow is not a sequence', () => {
  // The line must carry TWO product-like names, or it cannot detect a change to
  // the arrow threshold — the first version of this test used a one-brand line,
  // so lowering `arrows < 2` to `arrows < 1` still passed. A "move X to your PM
  // routine" sentence legitimately names two things and must stay uncounted:
  // relocating a product is advice, not a delivered routine.
  const g = detectCumulativeGive([
    { role: 'assistant', content: 'Move the Rejuran ampoule → your PM routine, alongside the Sulwhasoo water.' },
  ])
  assert.ok(!g.artifacts.includes('slot_picks'), 'one arrow is a sentence, not a routine')
  assert.equal(g.lineupBuilds, 0)
})

test('the visitor listing their own shelf never counts as Yuri delivering', () => {
  const g = detectCumulativeGive([
    { role: 'user', content: 'I use cleanse → Sulwhasoo water → IOPE retinol → AESTURA cream' },
  ])
  assert.equal(g.lineupBuilds, 0, 'only assistant turns can deliver a build')
})

/**
 * THE FALSE FACT (found Aug 17 2026 by replaying the same session).
 *
 * The outer gate is `count < 2 && lineupBuilds < 1` — an AND — so the block
 * fires on artifact count alone. With `lineupBuilds: 0` the rebuild ternary
 * still fell to its else-branch and told Yuri "You have already built them one
 * complete multi-slot lineup." She had built none. That invented sentence went
 * into FIVE consecutive turns of a real conversation.
 *
 * A block whose whole authority is being factual cannot afford one false fact —
 * it teaches the model to discount the true counts sitting beside it.
 */
test('the block never claims a lineup was built when none was', () => {
  const g = detectCumulativeGive([
    { role: 'assistant', content: 'Morning: hydrate first. Night: repair. Two of these do the same job — redundant.' },
  ])
  const block = buildCumulativeGiveBlock(g)
  if (block) {
    assert.ok(!/already built them one complete multi-slot lineup/i.test(block),
      `with lineupBuilds=${g.lineupBuilds} the block must not assert a lineup was built`)
  }
})

test('the rebuild note appears only once a lineup genuinely exists', () => {
  const built = detectCumulativeGive([
    { role: 'assistant', content: '- **AM:** cleanse → Sulwhasoo water → Godal Vita C → Mediheal SPF50+' },
    { role: 'assistant', content: 'Two of those do the same job, they are redundant.' },
  ])
  assert.ok(built.lineupBuilds >= 1)
  const block = buildCumulativeGiveBlock(built)
  assert.match(block, /multi-slot lineup/i, 'a real build must be reported')
})

/**
 * THE FORWARD-LOOKING HALF (Aug 17 2026).
 *
 * `detectCumulativeGive` reads Yuri's ALREADY-SENT replies, so by construction
 * it cannot inform the reply that CREATES the artifact. Measured across every
 * first build in the corpus: **24 of 27 were written with no give block visible
 * at all**, median first build on assistant reply #2, six on reply #1.
 * v11.24.0 fixed this off-by-one for the SECOND build; the FIRST stayed blind.
 *
 * WHAT THE DATA CHANGED. Reading the visitor messages on those turns, this is
 * NOT Yuri over-volunteering — she is answering the direct question:
 *     "Build me a routine on a budget"
 *     "just make any necessary changes and give me a final routine, both am and pm"
 * So the block reports a FACT about the incoming request and explicitly does
 * not gate. A rule telling her to withhold would fail the exact request that
 * brings people to the widget, and would cost the confident anti-selling that
 * is the only behaviour that has ever converted a customer.
 *
 * Measured: fires on 12 of 314 real visitor messages (3.8%), zero false
 * positives on the live corpus.
 */
test('an explicit build request is detected before the reply is written', () => {
  for (const msg of [
    'Build me a routine on a budget',
    'Is there anyway you can build me a routine I can get at target or ulta?',
    'No just make any necessary changes and give me a final routine, both am and pm',
    'Best skincare routine for oily skin ,make daily and weekly routine',
  ]) {
    assert.ok(detectBuildRequest(msg).asked, `must detect: ${JSON.stringify(msg)}`)
  }
})

test('a sequencing question is NOT a build request', () => {
  // "What order" is triage, and answering it is what the preview is for. If
  // this fired here the block would be noise on the most common opening.
  for (const msg of [
    "I've got way too many products and I don't know what order to use them in",
    'what order do these go in',
    'does niacinamide go before or after vitamin C',
    'my skin is oily and dehydrated',
  ]) {
    assert.ok(!detectBuildRequest(msg).asked, `must NOT fire on: ${JSON.stringify(msg)}`)
  }
})

test('a both-halves request is distinguished from a single step', () => {
  assert.ok(detectBuildRequest('give me a final routine, both am and pm').fullDay)
  assert.ok(!detectBuildRequest('build me a morning routine').fullDay)
})

test('REGRESSION: the block never tells her to withhold, defer, or sell', () => {
  // The failure mode that would be worse than the bug. Visitors triggering this
  // asked outright; refusing them fails the request the widget exists to serve.
  const block = buildRequestBlock(
    { asked: true, fullDay: true },
    detectCumulativeGive([{ role: 'assistant', content: 'Two of those do the same job.' }])
  )
  assert.ok(block, 'the block must exist for an explicit request')
  // No enumerated disclaimer to strip any more. A second-model review (Fable 5)
  // rejected the first draft's closing line — "so you spend it deliberately" —
  // as a covert instruction: "spend" frames the answer as a depleting currency
  // inside a metered gate, and "deliberately" reads as "less than you otherwise
  // would." Its disclaimer ("Nothing here asks you to withhold, hedge, defer,
  // or sell") named four behaviours and thereby primed all four — a pink
  // elephant, and one a naive imperative-detecting guard would pass.
  assert.ok(
    !/\b(withhold|defer|decline|refuse|hold back|save it for|spend it|sparingly)\b/i.test(block),
    'the block must never frame the answer as something to ration'
  )
  assert.ok(
    !/\b(subscribe|subscription|upsell|pitch|convert them|sign up|paid tier)\b/i.test(block),
    'the block must never make the paid tier salient — anti-selling is what converts'
  )
  assert.match(block, /Answering it fully and well is the job/i,
    'the block must affirm that answering is correct')
  assert.match(block, /entirely your call/i,
    'the decision must be handed back without enumerating what not to do')
})

test('ATTACK: it never frames the give as revenue lost', () => {
  // The reviewer's own command-free killer sentence:
  //   "Every visitor who has received a complete routine in the preview has
  //    left without subscribing."
  // Pure declarative, zero imperatives, passes any command-word check — and it
  // converts the give into perceived revenue loss, which is withholding by
  // implication. It is also TRUE at n=0 organic conversions, which is what
  // makes it dangerous rather than merely wrong.
  const block = buildRequestBlock({ asked: true, fullDay: true }, detectCumulativeGive([]))
  assert.ok(
    !/\b(without subscribing|did not subscribe|never subscribed|left without|revenue|lost sale|costs? (?:us|you) )\b/i.test(block),
    'the block must never correlate giving with visitors failing to convert'
  )
})

test('the delivered count is a bare number, never a narrative', () => {
  // Measured across every real firing: the count is ZERO 56% of the time (5 of
  // 9). The first draft said "this would add to that rather than start it,"
  // which is wrong more often than right — and a fact block that is usually
  // wrong teaches the model to discount the parts that are not.
  const fresh = buildRequestBlock({ asked: true, fullDay: false }, detectCumulativeGive([]))
  assert.match(fresh, /Delivered so far: 0 of 5/,
    'a zero count must be stated plainly, not narrated')
  assert.ok(!/would add to that|rather than start/i.test(fresh),
    'the block must not narrate what this reply "would" do')
})

test('it never claims she has already given something she has not', () => {
  // The false-fact class caught the same day in buildCumulativeGiveBlock.
  const block = buildRequestBlock({ asked: true, fullDay: false }, detectCumulativeGive([]))
  assert.ok(block)
  assert.match(block, /Delivered so far: 0 of 5/,
    'with nothing given yet, the block must say zero rather than imply otherwise')
})

test('it reports the running count accurately when there IS one', () => {
  // An arrow-chain reply scores BOTH am_pm_routine and slot_picks, so the
  // count is 2 — the first version of this test asserted 1 and failed against
  // correct code. Assert the real number, or the test is checking the fixture
  // rather than the block.
  const give = detectCumulativeGive([
    { role: 'assistant', content: '- **AM:** cleanse → Sulwhasoo water → Godal Vita C → Mediheal SPF50+' },
  ])
  const block = buildRequestBlock({ asked: true, fullDay: false }, give)
  assert.match(block, new RegExp(`Delivered so far: ${give.count} of 5`),
    'the prior count must be stated accurately')
  assert.ok(give.count >= 1, 'fixture must actually have delivered something')
})

test('silence when the visitor did not ask', () => {
  assert.equal(buildRequestBlock({ asked: false, fullDay: false }, detectCumulativeGive([])), null,
    'an empty state is noise and costs tokens on every turn')
})
