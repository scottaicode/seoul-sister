/**
 * Guard test — the subscriber-surface fact.
 *
 * THE DEFECT (Aug 13 2026, visitor 1ce3b6ce). Across a 53-minute, 12-message
 * conversation Yuri named the subscriber side five times and reached for the
 * SAME capability every time — "a mode that scans your lineup
 * ingredient-by-ingredient." Counted in the widget prompt at the time:
 * "remember"/memory 14 mentions, conflict-checking 4, "specialist" 4 — with the
 * six specialists NEVER NAMED, and proactive check-ins, weather-adaptive
 * alerts, cycle awareness and progress tracking appearing ZERO times.
 *
 * The visitor was in her fifties with rosacea, starting azelaic acid, and had
 * just been told to watch it for 2-3 weeks. Seoul Sister genuinely checks back
 * unprompted at exactly that moment (`ss_user_nudges`: 9 rows, 4 acted on).
 * Nobody told her, because Yuri did not know it existed. A missing fact, not a
 * judgment failure — the same class as the email ask and the cumulative give.
 *
 * WHY THIS IS A FACT AND NOT A SCRIPT. The block is a menu of things that are
 * TRUE. It names no moment to use them, ranks nothing, rotates nothing, and
 * ends by handing selection back. The one tripwire forbids reciting the list,
 * because a feature rundown is exactly the ad-shaped output that the trust
 * research says destroys the moat this product runs on.
 *
 * THE STANDING RISK this test exists to catch: a block that promises
 * capabilities we do not ship is worse than the silence it replaced — it turns
 * a trust asset into a liability the moment someone pays. So every capability
 * named is asserted to exist in the codebase below.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const MODULE = join(root, 'src', 'lib', 'widget', 'subscriber-surface.ts')
const ROUTE = join(root, 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

const moduleSrc = readFileSync(MODULE, 'utf8')
const routeSrc = readFileSync(ROUTE, 'utf8')

/** The literal text of the injected block. */
function block() {
  const open = moduleSrc.indexOf('return `')
  assert.ok(open > -1, 'buildSubscriberSurfaceBlock must return a template literal')
  const start = open + 'return `'.length
  const end = moduleSrc.indexOf('`\n}', start)
  assert.ok(end > start, 'could not find the end of the returned template literal')
  return moduleSrc.slice(start, end)
}

/**
 * CLOSED-WORLD GUARD.
 *
 * The per-capability tests below are an OPEN world: they verify that the things
 * we name exist, but they cannot see a capability someone ADDS. Proven by
 * attack during review — inserting "You give subscribers a personal
 * dermatologist video call every month" passed all nine tests. That is a false
 * promise to a paying customer and a medical-claim exposure (see the CLAUDE.md
 * rule against implying a clinical credential), and the suite waved it through.
 *
 * So the roster is pinned by SENTENCE COUNT and content. The capability
 * paragraph must stay exactly these claims; adding one requires editing this
 * list, which is the moment a human has to ask "do we actually ship that?"
 */
const APPROVED_CAPABILITIES = [
  /You route to six specialists by name/,
  /You follow up unprompted/,
  /You remember across sessions/,
  /You work from their real conditions/,
  /You check conflicts against their whole saved lineup/,
  /you track whether it is working photo over photo/,
]

/** The paragraph that enumerates capabilities. */
function capabilityParagraph() {
  const para = block()
    .split('\n')
    .find((l) => /You route to six specialists by name/.test(l))
  assert.ok(para, 'the capability paragraph must exist')
  return para
}

test('CLOSED WORLD: no capability may be added without updating this test', () => {
  const para = capabilityParagraph()

  for (const pattern of APPROVED_CAPABILITIES) {
    assert.match(para, pattern, `approved capability missing: ${pattern}`)
  }

  // Every "You <anything>" clause must be one of the approved ones. This is the
  // half that catches an ADDED claim, and it must NOT enumerate allowed verbs —
  // a first version listed (route|follow|remember|work|check|track) and a
  // fabricated "You GET a board-certified dermatologist review..." walked
  // straight through it, because the attacker picks the verb, not the test.
  // Match every second-person clause, then subtract the approved ones.
  const clauses = (para.match(/\b[Yy]ou\s+[a-z][^.;]*/g) || []).map((c) => c.trim())
  const unapproved = clauses.filter(
    (c) => !APPROVED_CAPABILITIES.some((p) => p.test(c))
  )
  assert.deepEqual(
    unapproved,
    [],
    'the block contains capability claims that are not on the approved roster. Every claim is a ' +
      "promise to someone paying $24.99/mo — if you added one, verify it actually ships and add " +
      'its pattern to APPROVED_CAPABILITIES.\n' +
      `Unapproved:\n${unapproved.map((c) => '  ' + c.slice(0, 100)).join('\n')}`
  )
})

test('it is not shaped like the output it forbids', () => {
  const b = block()
  // The prompt's own Response Format reserves bold + bullets for product
  // recommendations. A bolded bullet list of things Seoul Sister sells, sitting
  // in her context, is pre-drafted copy she can lift verbatim — which is
  // exactly the feature-rundown output the block forbids two paragraphs later.
  assert.doesNotMatch(
    b,
    /^\s*[-*]\s/m,
    'the capability roster must be plain prose, not a bullet list she can paste'
  )
  assert.doesNotMatch(
    b,
    /\*\*You [a-z]/,
    'no bolded second-person capability headings — that is ready-made marketing copy'
  )
})

test('it names the frequency problem, not just the variety problem', () => {
  const b = block()
  // Measured in the motivating transcript: 5 subscriber mentions across 12
  // replies (41.7%). Fixing monotony alone risks converting five repeats of one
  // feature into a six-stop tour, which is worse.
  assert.match(b, /5 of 12/, 'the measured rate must be stated as a fact')
  assert.match(
    b,
    /one or two replies, not most of them/,
    'the block must address how OFTEN, not only which one'
  )
  assert.match(b, /not variety, it is a tour/, 'the tour failure mode must be named')
})

test('it protects the behavior that actually converted someone', () => {
  const b = block()
  // The one paying customer converted because Yuri talked her OUT of purchases.
  // Every "you do not need that" is a natural on-ramp to "and the paid mode
  // finds those" — six capabilities means six more on-ramps.
  assert.match(
    b,
    /keep what you have.*reason to pay/is,
    'the block must forbid turning subtraction advice into an upsell'
  )
})

test('opt-in-gated capabilities are described as opt-in', () => {
  const b = block()
  // Cycle phase is hard-gated on ss_user_profiles.cycle_tracking_enabled
  // (memory.ts:457). Measured Aug 13 2026: 0 of 39 profiles have it on. A
  // visitor told "she adjusts to your cycle" would subscribe and get nothing
  // until they find a toggle on /profile. The opt-in IS the honest part.
  assert.match(
    b,
    /cycle phase if they turn cycle tracking on/i,
    'cycle phase must be stated as opt-in — it is off for every user today'
  )
  assert.doesNotMatch(
    b,
    /cycle phase where relevant/i,
    '"where relevant" reads to a visitor as "when your cycle matters", not "if you enable it"'
  )
})

test('no medical or clinical service is ever promised', () => {
  const b = block()
  // CLAUDE.md forbids implying a clinical credential. A subscriber-tier claim
  // of doctor access would be both false and an FTC-shaped problem.
  // Match the PROFESSION anywhere, not profession-plus-an-enumerated-noun. A
  // first version required (call|visit|consult|appointment|video) and let
  // "board-certified dermatologist REVIEW" through. Yuri referring someone TO a
  // dermatologist is core correct behavior, but that belongs in her conversation
  // prompt — this block lists what SUBSCRIBERS GET, so any clinician named here
  // is by construction a service claim.
  assert.doesNotMatch(
    b,
    /dermatologist|physician|\bdoctor\b|board-certified|licensed|clinician|prescription|prescribe|diagnos/i,
    'the block must never promise clinical services or credentials — Seoul Sister sells ' +
      'advice, not care, and CLAUDE.md forbids implying a clinical credential'
  )
  assert.doesNotMatch(
    b,
    /lab[- ](verif|test)|FDA|clinically proven/i,
    'no lab-verification or regulatory claims — the scope rule names this exact fabrication'
  )
})

test('every capability named is one we actually ship', () => {
  const b = block()

  // Six specialists — must exist by name in the specialist definitions.
  const specialists = readFileSync(join(root, 'src', 'lib', 'yuri', 'specialists.ts'), 'utf8')
  for (const name of [
    'Ingredient Analyst',
    'Routine Architect',
    'Sensitivity Guardian',
    'Authenticity Investigator',
    'Budget Optimizer',
    'Trend Scout',
  ]) {
    assert.match(b, new RegExp(name), `the block must name ${name}`)
    assert.match(
      specialists,
      new RegExp(`name: '${name}'`),
      `${name} is named to visitors but does not exist in specialists.ts — ` +
        'a fact block that promises a capability we do not ship is a liability, not an asset'
    )
  }

  // Conflict-checking against a saved lineup.
  const tools = readFileSync(join(root, 'src', 'lib', 'yuri', 'tools.ts'), 'utf8')
  assert.match(tools, /check_ingredient_conflicts/)
  // Weather adaptation.
  assert.match(tools, /get_current_weather/)
})

test('the proactive check-in is claimed only because it demonstrably runs', () => {
  const b = block()
  assert.match(b, /You follow up unprompted/i, 'the capability that fit this visitor must be named')

  // Timing must NOT be overclaimed. Measured (v11.25.0): no `scheduled_for`
  // column, median latency ~3 days, worst case 57.5 days. "At the moment it
  // matters" would be a promise the delivery path cannot keep.
  assert.match(
    b,
    /timing is approximate/i,
    'the nudge latency tail (median ~3d, max 57.5d) makes precise-timing language a false promise'
  )
  assert.doesNotMatch(b, /at the moment it matters/i, 'overclaims timing we do not control')

  // It is only honest to claim this because the cron and table exist.
  const nudgeCron = readFileSync(
    join(root, 'src', 'app', 'api', 'cron', 'proactive-nudge', 'route.ts'),
    'utf8'
  )
  assert.match(
    nudgeCron,
    /ss_user_nudges/,
    'the proactive check-in is claimed to visitors — the cron that produces it must exist'
  )
})

test('it is a menu, not a script: no timing, no ranking, no rotation', () => {
  const b = block()

  assert.doesNotMatch(b, /you must (say|mention)|say exactly|always mention|use this phrasing/i)
  assert.doesNotMatch(b, /\bin your (closing|final|last) message\b/i, 'must not bind to a moment')
  assert.doesNotMatch(b, /most (important|effective|compelling)|best feature|lead with/i, 'must not rank')
  assert.doesNotMatch(
    b,
    /already (used|mentioned)|rotate|instead of the one you/i,
    'must not become a rotation engine — that is a classifier of her judgment'
  )
})

test('it hands selection back and permits saying nothing', () => {
  const b = block()
  assert.match(b, /if anything does/i, 'mentioning nothing must be an explicitly allowed outcome')
  assert.match(
    b,
    /saying nothing is the right call/i,
    'the block must not create pressure to always name something'
  )
  assert.match(
    b,
    /changes nothing about when, or whether, to say it/i,
    'the decision must be handed back explicitly, as with every other fact block'
  )
})

test('the one tripwire forbids reciting a feature list', () => {
  const b = block()
  assert.match(b, /Do not recite this as a list/i)
  assert.match(
    b,
    /reads as an ad/i,
    'the reason must be recorded — a future editor who sees only the rule will soften it'
  )
})

test('it contains no sales language and no price', () => {
  const b = block()
  assert.doesNotMatch(b, /\$\d/, 'no price — the UI card owns that register')
  assert.doesNotMatch(b, /\bsign up now\b|\bupgrade now\b|\bdon'?t miss\b|\blimited time\b/i)
  assert.doesNotMatch(b, /\bconvert\b|\bconversion\b|\bupsell\b/i, 'no funnel vocabulary in her prompt')

  // Scarcity / FOMO framing, in the shapes that dodge the literal phrases above.
  // Proven necessary by attack during review: "remind them what they are
  // missing out on by staying free" passed the original suite. The product's
  // one conversion came from Yuri talking a customer OUT of purchases; loss
  // framing aimed at the visitor is the register that destroys that.
  assert.doesNotMatch(
    b,
    /missing out|what they(?:'| a)re missing|remind them what|staying free|only get this if|unlock/i,
    'no FOMO or loss framing — see the Aug 9 failure where an offer attached to a ' +
      'prediction of the visitor backsliding got "No. I\'m good." as the answer'
  )
  assert.doesNotMatch(
    b,
    /\bpitch\b|\bpersuade\b|\bencourage them to (?:subscribe|sign|join)\b/i,
    'the block must never instruct persuasion'
  )

  // Scarcity in any shape. "spots are running out" defeated an earlier version
  // of this test because it matched no enumerated phrase.
  assert.doesNotMatch(
    b,
    /running out|spots? (?:are|is)|act (?:now|fast)|while (?:you |they )?can|before it'?s gone|hurry/i,
    'no scarcity framing — the product has no capacity limit and inventing one is a lie'
  )

  // Imperatives that turn the menu into a mandate. The block may describe what
  // exists; it may never direct her to raise it.
  assert.doesNotMatch(
    b,
    /\bmention (?:the |this )?(?:subscription|it|them)\b(?![^.]*\bnot\b)|\btell them they should\b|\bin every reply\b/i,
    'the block must not instruct WHEN or HOW OFTEN to raise the subscription — ' +
      'it states what exists and hands the decision back'
  )
})

test('the real failure is recorded so the reasoning survives a reword', () => {
  assert.match(
    moduleSrc,
    /ingredient-by-ingredient/,
    'the repeated phrase must be quoted — abstract advice gets smoothed away'
  )
  assert.match(moduleSrc, /1ce3b6ce/, 'the visitor row must be named so the claim stays checkable')
  assert.match(
    moduleSrc,
    /ZERO times/,
    'the measured absence is the whole justification and must not be lost'
  )
})

test('the block is injected into the UNCACHED per-turn context', () => {
  assert.match(routeSrc, /dynamicContext \+= buildSubscriberSurfaceBlock\(\)/)

  // The cached block must remain the static system prompt ALONE. Appending
  // per-turn text to it silently kills the prompt cache (v11.1.0 regression).
  const cachedLine = routeSrc.match(/text: YURI_WIDGET_SYSTEM[^\n]*cache_control[^\n]*/)
  assert.ok(cachedLine, 'the cached system block must exist')
  assert.doesNotMatch(
    cachedLine[0],
    /buildSubscriberSurfaceBlock|subscriberSurface/,
    'the surface block must NEVER be appended to the cached system prompt'
  )
})

test('it is static — it inspects nothing about the conversation', () => {
  const sig = moduleSrc.match(/export function buildSubscriberSurfaceBlock\(([^)]*)\)/)
  assert.ok(sig, 'the builder must be exported')
  assert.equal(
    sig[1].trim(),
    '',
    'the builder must take NO arguments. A version that scored which capability ' +
      '"fits best" was built and discarded: choosing what this person needs is ' +
      'Yuri\'s job, and a keyword classifier doing it would be the Yuri Sole ' +
      'Authority Principle violated inside her own prompt.'
  )
})
