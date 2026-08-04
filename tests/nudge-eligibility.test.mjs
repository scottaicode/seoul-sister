/**
 * Guard test — proactive nudge eligibility.
 *
 * WHY THIS FILE EXISTS (Aug 3 2026)
 *
 * The nudge engine shipped in v10.10.0 with a "7-case eligibility unit test"
 * recorded in CHANGELOG:2081. That file was never committed. So the module that
 * decides WHEN Yuri reaches out to a paying subscriber — including a
 * dermatological safety rule — has had zero regression cover since May.
 *
 * That was tolerable while the only delivery surface was a dashboard card the
 * user had to visit. v11.23.0 adds an EMAIL channel, which makes every nudge
 * externally visible. A mistimed card is quiet; the same nudge in someone's
 * inbox is not. So the cover gets restored BEFORE the channel ships.
 *
 * THE SAFETY RULE (the one that must never regress)
 *
 * nudge-eligibility.ts:130,163 — actives/brightening nudges fire ONLY in the
 * follicular or ovulatory phases. Never menstrual, never luteal. Skin is more
 * reactive and inflammation-prone in those weeks, so "want to step up that acid?"
 * lands as bad dermatology at exactly the wrong moment. This is the precise
 * mistake a naive inactivity nudge makes (Bailey's May 31 session), and it is the
 * reason this engine is signal-driven rather than time-driven.
 *
 * These tests EXECUTE the real pickNudgeOpportunity rather than asserting on
 * source text — per feedback_source_tests_miss_runtime_bugs, a regex over source
 * passes happily against broken logic. The module is pure with no DB imports, so
 * it transpiles and imports directly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Transpile the real module and import it — no stubs, no re-implementation. */
async function loadEligibility() {
  const src = readFileSync(
    join(root, 'src', 'lib', 'intelligence', 'nudge-eligibility.ts'),
    'utf8'
  )
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dir = mkdtempSync(join(tmpdir(), 'nudge-elig-'))
  const file = join(dir, 'nudge-eligibility.mjs')
  writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

const TODAY = '2026-08-03'

/** A baseline input where nothing is eligible. Tests turn on one signal at a time. */
function baseInput(overrides = {}) {
  return {
    activePhase: null,
    activeRoutinePhaseNumbers: [],
    openLoops: [],
    daysSinceLastGlassScore: null,
    cycle: null,
    todayIso: TODAY,
    ...overrides,
  }
}

/** An actives-flavored open loop, stale enough to qualify (>= 5 days). */
function staleActivesLoop(openedDate = '2026-07-20') {
  return {
    topic: 'brightening_routine',
    summary: 'we were going to add a vitamin C serum for the dark spots',
    opened_date: openedDate,
  }
}

/** A non-actives open loop (barrier/moisturizer talk), stale enough to qualify. */
function staleBarrierLoop(openedDate = '2026-07-20') {
  return {
    topic: 'moisturizer_gap',
    summary: 'I never caught which moisturizer you are using',
    opened_date: openedDate,
  }
}

// ---------------------------------------------------------------------------
// THE SAFETY RULE — actives are never nudged in a reactive cycle window
// ---------------------------------------------------------------------------

test('SAFETY: an actives loop is NOT nudged during the menstrual phase', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [staleActivesLoop()],
      cycle: { phase: 'menstrual', dayInCycle: 2 },
    })
  )

  assert.equal(
    result,
    null,
    'a stale brightening loop during menstruation must produce NO nudge — ' +
      'not a cycle_timed nudge, and not an open_loop fallback either'
  )
})

test('SAFETY: an actives loop is NOT nudged during the luteal phase', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [staleActivesLoop()],
      cycle: { phase: 'luteal', dayInCycle: 24 },
    })
  )

  assert.equal(result, null, 'luteal is a reactive window — actives must wait')
})

test('SAFETY: every actives keyword is caught by the cycle guard', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // Each of these should be recognized as an "actives" topic and therefore
  // suppressed in a reactive window. A gap here silently reopens the defect for
  // one ingredient class.
  const activesTopics = [
    'vitamin c serum',
    'retinol introduction',
    'exfoliation cadence',
    'AHA step up',
    'BHA frequency',
    'PHA toner',
    'glycolic acid pads',
    'tranexamic acid for PIH',
    'niacinamide layering',
    'brightening plan',
  ]

  for (const topic of activesTopics) {
    const result = pickNudgeOpportunity(
      baseInput({
        openLoops: [{ topic, summary: topic, opened_date: '2026-07-20' }],
        cycle: { phase: 'luteal', dayInCycle: 22 },
      })
    )
    assert.equal(
      result,
      null,
      `"${topic}" must be treated as an actives topic and suppressed in luteal`
    )
  }
})

test('a NON-actives loop IS still nudged during menstrual/luteal', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // The cycle guard must be narrow. Asking which moisturizer she uses is safe
  // in any week — suppressing it would make the engine mute for half the month.
  for (const phase of ['menstrual', 'luteal']) {
    const result = pickNudgeOpportunity(
      baseInput({
        openLoops: [staleBarrierLoop()],
        cycle: { phase, dayInCycle: 3 },
      })
    )
    assert.ok(result, `a barrier/moisturizer loop should still nudge in ${phase}`)
    assert.equal(result.type, 'open_loop')
  }
})

test('an actives loop in a GOOD window produces the cycle-timed nudge', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  for (const phase of ['follicular', 'ovulatory']) {
    const result = pickNudgeOpportunity(
      baseInput({
        openLoops: [staleActivesLoop()],
        cycle: { phase, dayInCycle: 10 },
      })
    )
    assert.ok(result, `${phase} is the right window — expected a nudge`)
    assert.equal(result.type, 'cycle_timed_brightening')
    assert.match(
      result.context,
      /do NOT push actives during menstrual\/luteal/i,
      'the generated context must carry the timing caution into the Opus prompt'
    )
  }
})

// ---------------------------------------------------------------------------
// Staleness thresholds
// ---------------------------------------------------------------------------

test('an open loop younger than 5 days does not nudge', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // 4 days old — under STALE_OPEN_LOOP_DAYS. Nudging here would be nagging.
  const result = pickNudgeOpportunity(
    baseInput({ openLoops: [staleBarrierLoop('2026-07-30')] })
  )
  assert.equal(result, null, '4 days is not stale — must stay silent')
})

test('an open loop at exactly 5 days DOES nudge (boundary)', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({ openLoops: [staleBarrierLoop('2026-07-29')] })
  )
  assert.ok(result, '5 days is the documented threshold — must fire')
  assert.equal(result.type, 'open_loop')
})

test('the OLDEST stale loop is chosen, not the newest', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [
        { topic: 'newer_thread', summary: 'newer', opened_date: '2026-07-28' },
        { topic: 'oldest_thread', summary: 'oldest', opened_date: '2026-07-01' },
      ],
    })
  )
  assert.ok(result)
  assert.match(result.reason, /oldest_thread/, 'the longest-unresolved thread wins')
})

test('glass skin cadence requires BOTH an active phase and 14+ days', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()
  const phase = { phase_number: 2, name: 'Barrier Repair', goal: 'stabilize' }

  // Stale score but no active phase — nothing to measure against.
  assert.equal(
    pickNudgeOpportunity(baseInput({ daysSinceLastGlassScore: 30 })),
    null,
    'no active phase means a fresh photo has no protocol to grade'
  )

  // Active phase but the score is recent.
  assert.equal(
    pickNudgeOpportunity(
      baseInput({ activePhase: phase, daysSinceLastGlassScore: 13 })
    ),
    null,
    '13 days is under the 14-day cadence'
  )

  const result = pickNudgeOpportunity(
    baseInput({ activePhase: phase, daysSinceLastGlassScore: 14 })
  )
  assert.ok(result, 'active phase + 14 days should fire')
  assert.equal(result.type, 'glass_skin_cadence')
})

test('never-scored (null) does not trigger the cadence nudge', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      activePhase: { phase_number: 2, name: 'Barrier Repair', goal: null },
      daysSinceLastGlassScore: null,
    })
  )
  assert.equal(result, null, 'null is "never scored", not "infinitely stale"')
})

// ---------------------------------------------------------------------------
// Phase / routine mismatch
// ---------------------------------------------------------------------------

test('phase mismatch fires only when routines lag BEHIND the active phase', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()
  const phase3 = { phase_number: 3, name: 'Brightening', goal: 'fade PIH' }

  // Routines say Phase 2, user is on Phase 3 — genuinely out of date.
  const behind = pickNudgeOpportunity(
    baseInput({ activePhase: phase3, activeRoutinePhaseNumbers: [2] })
  )
  assert.ok(behind)
  assert.equal(behind.type, 'phase_routine_mismatch')

  // Routines already match — nothing to fix.
  assert.equal(
    pickNudgeOpportunity(
      baseInput({ activePhase: phase3, activeRoutinePhaseNumbers: [3] })
    ),
    null,
    'a matching routine must not nudge'
  )

  // A routine AHEAD of the active phase is not a lag — don't tell her to
  // downgrade. Only strictly-behind routines qualify.
  assert.equal(
    pickNudgeOpportunity(
      baseInput({ activePhase: phase3, activeRoutinePhaseNumbers: [4] })
    ),
    null,
    'a routine ahead of the phase must not fire a mismatch nudge'
  )
})

// ---------------------------------------------------------------------------
// Priority + calibration
// ---------------------------------------------------------------------------

test('cycle-timed actives outrank a phase mismatch when both are live', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      activePhase: { phase_number: 3, name: 'Brightening', goal: null },
      activeRoutinePhaseNumbers: [2],
      openLoops: [staleActivesLoop()],
      cycle: { phase: 'follicular', dayInCycle: 8 },
    })
  )
  assert.equal(
    result.type,
    'cycle_timed_brightening',
    'timing-sensitive dermatology comes first — the window closes, the mismatch waits'
  )
})

test('a measurably underperforming type is skipped for the next candidate', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const input = baseInput({
    activePhase: { phase_number: 3, name: 'Brightening', goal: null },
    activeRoutinePhaseNumbers: [2],
    openLoops: [staleActivesLoop()],
    cycle: { phase: 'follicular', dayInCycle: 8 },
  })

  // Without calibration the cycle nudge wins.
  assert.equal(pickNudgeOpportunity(input).type, 'cycle_timed_brightening')

  // Measured at 10% helped — below the 0.25 floor. Fall through to the mismatch.
  const calibrated = pickNudgeOpportunity({
    ...input,
    typePerformance: { cycle_timed_brightening: { helpedRate: 0.1 } },
  })
  assert.equal(
    calibrated.type,
    'phase_routine_mismatch',
    'the outcome teacher must be able to demote a type that does not move skin'
  )
})

test('a null helped-rate (insufficient sample) never suppresses', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [staleBarrierLoop()],
      typePerformance: { open_loop: { helpedRate: null } },
    })
  )
  assert.ok(result, 'no graded data must not be read as bad performance')
  assert.equal(result.type, 'open_loop')
})

test('an empty signal set returns null — silence is the default', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()
  assert.equal(
    pickNudgeOpportunity(baseInput()),
    null,
    'no signals means no nudge; this engine is conservative by design'
  )
})

// ---------------------------------------------------------------------------
// v11.23.0 — Yuri names her own check-back date
//
// WHY: the honest clinical answer is often "give this four to six weeks," which
// is correct dermatology and terrible retention design — an open interval decays
// into never. Both July 2026 subscribers were last told to wait 4-6 weeks and
// neither returned. Yuri now names a PROGRESS check-in date (tolerance and
// adherence, days) separate from the OUTCOME horizon (does it work, weeks), and
// the engine fires on the date SHE chose rather than a fixed interval.
// ---------------------------------------------------------------------------

test('a promised check-back date fires EARLY, before generic staleness', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // Opened 3 days ago — nowhere near the 5-day generic threshold. But Yuri said
  // she'd check back yesterday. Silence on a day she named is worse than early.
  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [
        {
          topic: 'barrier_recovery',
          summary: 'started her on the gentler cadence',
          opened_date: '2026-07-31',
          check_back_date: '2026-08-02',
        },
      ],
    })
  )

  assert.ok(result, 'a promised date that has arrived must fire even at 3 days old')
  assert.equal(result.type, 'open_loop')
  assert.match(
    result.context,
    /check back around 2026-08-02/,
    'the context must tell Yuri she is keeping her word, not chasing a quiet user'
  )
  assert.match(
    result.context,
    /keeping her word|said she would/i,
    'framing matters: following up on a promise is not the same as an inactivity ping'
  )
})

test('a promised date in the FUTURE holds the loop back past generic staleness', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // 14 days old — well past the 5-day threshold, so the OLD logic would fire.
  // But Yuri explicitly said "give this two weeks and I'll come back to it,"
  // and that date hasn't arrived. Nudging now contradicts her own instruction.
  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [
        {
          topic: 'retinoid_ramp',
          summary: 'told her to give the retinoid a full ramp before we judge it',
          opened_date: '2026-07-20',
          check_back_date: '2026-08-10',
        },
      ],
    })
  )

  assert.equal(
    result,
    null,
    'a date Yuri set in the future must SUPPRESS the generic staleness nudge — ' +
      'firing early contradicts her own instruction and reads as nagging'
  )
})

test('a loop with no promised date still uses generic staleness', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const withNull = pickNudgeOpportunity(
    baseInput({
      openLoops: [{ ...staleBarrierLoop(), check_back_date: null }],
    })
  )
  assert.ok(withNull, 'an explicit null must fall back to the 5-day threshold')
  assert.equal(withNull.type, 'open_loop')

  // And the field being absent entirely (pre-v11.23.0 rows) must behave the same.
  const withUndefined = pickNudgeOpportunity(
    baseInput({ openLoops: [staleBarrierLoop()] })
  )
  assert.ok(withUndefined, 'existing rows without the field must keep working')
})

test('SAFETY: a promised date does NOT override the cycle-window rule', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  // Yuri promised to check back today about a brightening plan, but the user is
  // luteal. The dermatological timing rule wins — a promise to follow up never
  // licenses pushing actives in a reactive week. The loop stays due and will
  // fire in the next good window.
  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [
        {
          topic: 'brightening_plan',
          summary: 'said we would step up the vitamin C',
          opened_date: '2026-07-25',
          check_back_date: '2026-08-01',
        },
      ],
      cycle: { phase: 'luteal', dayInCycle: 23 },
    })
  )

  assert.equal(
    result,
    null,
    'the cycle safety rule outranks a promised check-in date — always'
  )
})

test('a kept promise outranks a merely-stale loop', async () => {
  const { pickNudgeOpportunity } = await loadEligibility()

  const result = pickNudgeOpportunity(
    baseInput({
      openLoops: [
        // Older, but she never promised a date for it.
        { topic: 'old_thread', summary: 'older unresolved thing', opened_date: '2026-06-01' },
        // Newer, but she gave her word on it and the day has come.
        {
          topic: 'promised_thread',
          summary: 'said she would check the barrier Friday',
          opened_date: '2026-07-28',
          check_back_date: '2026-08-01',
        },
      ],
    })
  )

  assert.ok(result)
  assert.match(
    result.reason,
    /promised_thread/,
    'a date she committed to beats generic age — keeping her word is the point'
  )
})
