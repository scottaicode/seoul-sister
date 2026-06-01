/**
 * v10.10.0 — Proactive nudge eligibility (pure, no AI).
 *
 * Computes the SINGLE best nudge opportunity for a user from signals already in
 * the database. The whole point: nudge on the dermatologically/contextually right
 * moment, not raw inactivity (LGAAS's weakness, which we're improving on).
 *
 * Returns null far more often than not — conservatism is the default. A weak or
 * mistimed nudge is worse than no nudge (it erodes the "she shows up when it
 * matters" trust this feature exists to build).
 *
 * The cron does the DB loading and timezone/cap/spacing gating; this module only
 * decides "given this state, is there a worthwhile thing to nudge about, and which
 * one." It does NOT generate the message (that's Opus, in the cron) and it does NOT
 * make a skincare recommendation (Yuri does that when the user lands in chat —
 * Yuri Sole Authority Principle). It only picks the topic + reason + context.
 */

export type NudgeType =
  | 'open_loop'
  | 'phase_routine_mismatch'
  | 'cycle_timed_brightening'
  | 'glass_skin_cadence'

export interface NudgeOpportunity {
  type: NudgeType
  /** machine-readable reason (stored as trigger_reason; also used to dedup) */
  reason: string
  /** human context the Opus message-writer uses to ground the nudge in Yuri's voice */
  context: string
  /** what the prefilled /yuri?ask= should say, so the conversation lands ready */
  suggestedAsk: string
}

export interface OpenLoop {
  topic: string
  summary: string
  opened_date: string
}

export interface CycleSnapshot {
  /** 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' */
  phase: string
  dayInCycle: number
}

/**
 * v10.11.0 — per-nudge-type calibration from the outcome teacher. Maps a
 * nudge_type to its measured helped-rate (0..1) among graded outcomes, or null
 * when there isn't enough graded data yet. Passed in by the caller (the cron reads
 * it via getNudgeTypePerformance) so this module stays pure/testable. Optional —
 * when absent, no calibration is applied and all candidates proceed normally.
 */
export type NudgeTypePerformanceMap = Record<string, { helpedRate: number | null }>

export interface NudgeEligibilityInput {
  /** active treatment phase, if any */
  activePhase: { phase_number: number; name: string; goal: string | null } | null
  /** distinct phase numbers referenced by the user's ACTIVE routine names (e.g. [2]) */
  activeRoutinePhaseNumbers: number[]
  /** unresolved open loops from decision memory */
  openLoops: OpenLoop[]
  /** days since the user's latest Glass Skin Score, or null if never scored */
  daysSinceLastGlassScore: number | null
  /** current cycle snapshot if cycle tracking is enabled, else null */
  cycle: CycleSnapshot | null
  /** today, as an ISO date string (injected so the module stays pure/testable) */
  todayIso: string
  /**
   * Optional measured-outcome calibration. When a candidate nudge type's
   * helped-rate is below PERFORMANCE_FLOOR (with adequate sample, signaled by a
   * non-null rate), it's SUPPRESSED in favor of the next candidate — the loop
   * learns to stop firing types that don't move skin. Conservative: a null rate
   * (insufficient sample) never suppresses.
   */
  typePerformance?: NudgeTypePerformanceMap
}

const STALE_OPEN_LOOP_DAYS = 5
const GLASS_SKIN_STALE_DAYS = 14
// A nudge type measured to help less than this share of the time (with adequate
// sample) gets suppressed in favor of the next candidate. 0.25 is intentionally
// low — we only suppress types that are clearly not working, not merely mediocre.
const PERFORMANCE_FLOOR = 0.25

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

/** Loops whose topic implies introducing/adjusting actives (brightening, exfoliation, retinoid). */
function isActivesLoop(loop: OpenLoop): boolean {
  const t = `${loop.topic} ${loop.summary}`.toLowerCase()
  return /bright|vitamin\s?c|retin|exfoliat|aha|bha|pha|acid|active|tranexamic|glycolic|niacinamide/.test(
    t
  )
}

/**
 * Pick the single best nudge opportunity, or null. Priority order is deliberate:
 * timing-sensitive dermatology first, then unfinished work, then cadence.
 */
export function pickNudgeOpportunity(input: NudgeEligibilityInput): NudgeOpportunity | null {
  const {
    activePhase,
    activeRoutinePhaseNumbers,
    openLoops,
    daysSinceLastGlassScore,
    cycle,
    todayIso,
    typePerformance,
  } = input

  const staleLoops = openLoops.filter(
    (l) => daysBetween(l.opened_date, todayIso) >= STALE_OPEN_LOOP_DAYS
  )

  // Build candidates in deliberate priority order: timing-sensitive dermatology
  // first, then unfinished work, then cadence. We collect them rather than
  // early-returning so the measured-outcome calibration (Pillar C) can suppress a
  // clearly-underperforming type in favor of the next viable candidate.
  const candidates: NudgeOpportunity[] = []

  // ---- 1. Cycle-timed actives loop -------------------------------------------
  // A stale actives/brightening loop AND a GOOD cycle window (follicular/ovulatory,
  // skin resilient) = right thing AND right time. NEVER during menstrual/luteal —
  // the exact mistake a naive inactivity nudge makes (Bailey's May 31 session).
  if (cycle && (cycle.phase === 'follicular' || cycle.phase === 'ovulatory')) {
    const activesLoop = staleLoops.find(isActivesLoop)
    if (activesLoop) {
      candidates.push({
        type: 'cycle_timed_brightening',
        reason: `cycle_${cycle.phase}_actives_loop_${activesLoop.topic}`,
        context: `The user is in their ${cycle.phase} phase (day ${cycle.dayInCycle}) — skin is resilient, a good window to introduce or step up actives. There's an unresolved thread from a past conversation: "${activesLoop.summary}". This is the right time to pick it back up. (Do NOT push actives during menstrual/luteal weeks.)`,
        suggestedAsk: `I'm in my ${cycle.phase} phase now — is this a good week to pick back up on ${activesLoop.topic.replace(/_/g, ' ')}? Last time we talked about it: ${activesLoop.summary}`,
      })
    }
  }

  // ---- 2. Phase / routine mismatch -------------------------------------------
  // Active treatment phase advanced but the active routines still reference the
  // OLD phase number (Bailey's exact case: Phase 3 active, routines say Phase 2).
  if (
    activePhase &&
    activeRoutinePhaseNumbers.length > 0 &&
    !activeRoutinePhaseNumbers.includes(activePhase.phase_number) &&
    activeRoutinePhaseNumbers.every((n) => n < activePhase.phase_number)
  ) {
    candidates.push({
      type: 'phase_routine_mismatch',
      reason: `phase_${activePhase.phase_number}_routine_says_${activeRoutinePhaseNumbers.join('_')}`,
      context: `The user advanced to Phase ${activePhase.phase_number} (${activePhase.name})${activePhase.goal ? ` — goal: ${activePhase.goal}` : ''}, but their active AM/PM routines are still labeled for Phase ${Math.max(...activeRoutinePhaseNumbers)}. They're running an out-of-date routine. Offer to build the Phase ${activePhase.phase_number} routine.`,
      suggestedAsk: `You moved me to Phase ${activePhase.phase_number} (${activePhase.name}) but my routine is still set up for the last phase — can you build my updated AM/PM routine?`,
    })
  }

  // ---- 3. Stale open loop (non-actives, or actives out of cycle window) -------
  if (staleLoops.length > 0) {
    const oldest = [...staleLoops].sort((a, b) => a.opened_date.localeCompare(b.opened_date))[0]
    // Skip an actives loop when NOT in a good cycle window — wait for the right week.
    const inGoodWindow = cycle ? cycle.phase === 'follicular' || cycle.phase === 'ovulatory' : true
    if (!(isActivesLoop(oldest) && !inGoodWindow)) {
      candidates.push({
        type: 'open_loop',
        reason: `open_loop_${oldest.topic}`,
        context: `Yuri left this unresolved ${daysBetween(oldest.opened_date, todayIso)} days ago and the user hasn't returned to it: "${oldest.summary}". Pick it back up warmly.`,
        suggestedAsk: `Picking back up on ${oldest.topic.replace(/_/g, ' ')} — ${oldest.summary}`,
      })
    }
  }

  // ---- 4. Glass Skin cadence -------------------------------------------------
  if (activePhase && daysSinceLastGlassScore !== null && daysSinceLastGlassScore >= GLASS_SKIN_STALE_DAYS) {
    candidates.push({
      type: 'glass_skin_cadence',
      reason: `glass_skin_${daysSinceLastGlassScore}d_stale`,
      context: `It's been ${daysSinceLastGlassScore} days since the user's last Glass Skin Score, and they're actively in Phase ${activePhase.phase_number} (${activePhase.name}). A fresh photo would show whether the phase is moving the needle. Suggest one as their progress check-in.`,
      suggestedAsk: `It's been a couple weeks — want to look at a fresh Glass Skin Score with me to see how Phase ${activePhase.phase_number} is going?`,
    })
  }

  // Apply measured-outcome calibration: return the highest-priority candidate
  // whose type is NOT clearly underperforming. A type with a non-null helpedRate
  // below the floor is suppressed (the loop learned it doesn't move skin); a null
  // rate (insufficient sample) never suppresses. If every candidate is suppressed,
  // fall back to the top candidate anyway — a suppressed-but-well-timed nudge beats
  // staying silent, and the calibration is a discount, not a hard kill.
  for (const c of candidates) {
    const perf = typePerformance?.[c.type]
    const underperforming = perf && perf.helpedRate !== null && perf.helpedRate < PERFORMANCE_FLOOR
    if (!underperforming) return c
  }
  return candidates[0] ?? null
}
