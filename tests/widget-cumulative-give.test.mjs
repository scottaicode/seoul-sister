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
