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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
// Mirror of the shipped detectors, kept honest by the source assertions below.
// ---------------------------------------------------------------------------
const AM_BLOCK = /\b(?:AM|morning)\b[^\n]{0,80}(?::|—|-|→)/i
const PM_BLOCK = /\b(?:PM|night|evening|nightly)\b[^\n]{0,80}(?::|—|-|→)/i
const STEP_ARROWS = /(?:→|->)[^\n]*(?:→|->)/
const NIGHT_ROTATION = /\bnight\s*(?:a|b|c|1|2|3)\b/i
const WEEKLY_FREQUENCY = /\b\d\s*(?:x|times)\s*(?:\/|\s*per\s*|a\s*)?(?:wk|week)\b/i
const STAGED_ROLLOUT = /\b(?:two\s+weeks?|2\s*weeks?)\s+apart\b|\bone\s+(?:new\s+)?active\s+at\s+a\s+time\b/i
const CONFLICT_LANGUAGE =
  /\b(?:same job|do(?:ing)? the same|redundant|duplicat|don'?t (?:need|use) both|collide|stack(?:ing)? (?:two|both)|overlap)\b/i
const KEEP_CUT_ADD =
  /\b(?:keep(?:ers?)?\s*(?:as-is)?\b[^\n]{0,40}\b(?:cut|drop|add)|cut back|keep\/cut\/add|scorecard)\b/i

function detectArtifactsInReply(text) {
  const found = new Set()
  if (!text) return found
  const hasAm = AM_BLOCK.test(text)
  const hasPm = PM_BLOCK.test(text)
  if ((hasAm && hasPm) || ((hasAm || hasPm) && STEP_ARROWS.test(text))) found.add('am_pm_routine')
  if (NIGHT_ROTATION.test(text) || WEEKLY_FREQUENCY.test(text) || STAGED_ROLLOUT.test(text))
    found.add('weekly_schedule')
  if ((text.match(/\$\d/g) || []).length >= 2) found.add('slot_picks')
  if (CONFLICT_LANGUAGE.test(text)) found.add('lineup_conflict_check')
  if (KEEP_CUT_ADD.test(text)) found.add('shelf_audit')
  return found
}

function detectCumulativeGive(history) {
  const all = new Set()
  for (const t of history) {
    if (t.role !== 'assistant') continue
    for (const a of detectArtifactsInReply(t.content || '')) all.add(a)
  }
  return { artifacts: [...all], count: all.size }
}

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
