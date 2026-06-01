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
}

const STALE_OPEN_LOOP_DAYS = 5
const GLASS_SKIN_STALE_DAYS = 14

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
  const { activePhase, activeRoutinePhaseNumbers, openLoops, daysSinceLastGlassScore, cycle, todayIso } =
    input

  const staleLoops = openLoops.filter(
    (l) => daysBetween(l.opened_date, todayIso) >= STALE_OPEN_LOOP_DAYS
  )

  // ---- 1. Cycle-timed actives loop -------------------------------------------
  // If there's a stale loop about introducing actives/brightening AND the user is
  // in a GOOD window for it (follicular/ovulatory — skin is resilient), that's the
  // highest-value nudge: right thing AND right time. CRITICALLY: never fire this
  // during menstrual/luteal week, when the barrier is weakest — that's the exact
  // mistake a naive inactivity nudge would make (proven by Bailey's May 31 session
  // where Yuri correctly pulled actives for her menstrual week).
  if (cycle && (cycle.phase === 'follicular' || cycle.phase === 'ovulatory')) {
    const activesLoop = staleLoops.find(isActivesLoop)
    if (activesLoop) {
      return {
        type: 'cycle_timed_brightening',
        reason: `cycle_${cycle.phase}_actives_loop_${activesLoop.topic}`,
        context: `The user is in their ${cycle.phase} phase (day ${cycle.dayInCycle}) — skin is resilient, a good window to introduce or step up actives. There's an unresolved thread from a past conversation: "${activesLoop.summary}". This is the right time to pick it back up. (Do NOT push actives during menstrual/luteal weeks.)`,
        suggestedAsk: `I'm in my ${cycle.phase} phase now — is this a good week to pick back up on ${activesLoop.topic.replace(/_/g, ' ')}? Last time we talked about it: ${activesLoop.summary}`,
      }
    }
  }

  // ---- 2. Phase / routine mismatch -------------------------------------------
  // Active treatment phase advanced but the active routines still reference the
  // OLD phase number (Bailey's exact case: Phase 3 active, routines say Phase 2).
  // The user is running a routine that doesn't match where Yuri has them.
  if (
    activePhase &&
    activeRoutinePhaseNumbers.length > 0 &&
    !activeRoutinePhaseNumbers.includes(activePhase.phase_number) &&
    activeRoutinePhaseNumbers.every((n) => n < activePhase.phase_number)
  ) {
    return {
      type: 'phase_routine_mismatch',
      reason: `phase_${activePhase.phase_number}_routine_says_${activeRoutinePhaseNumbers.join('_')}`,
      context: `The user advanced to Phase ${activePhase.phase_number} (${activePhase.name})${activePhase.goal ? ` — goal: ${activePhase.goal}` : ''}, but their active AM/PM routines are still labeled for Phase ${Math.max(...activeRoutinePhaseNumbers)}. They're running an out-of-date routine. Offer to build the Phase ${activePhase.phase_number} routine.`,
      suggestedAsk: `You moved me to Phase ${activePhase.phase_number} (${activePhase.name}) but my routine is still set up for the last phase — can you build my updated AM/PM routine?`,
    }
  }

  // ---- 3. Stale open loop (non-actives, or actives out of cycle window) -------
  // Something Yuri left hanging ≥5 days ago that isn't cycle-timing-sensitive.
  if (staleLoops.length > 0) {
    // Prefer the oldest unresolved loop (most overdue).
    const oldest = [...staleLoops].sort((a, b) => a.opened_date.localeCompare(b.opened_date))[0]
    // Skip if it's an actives loop and we're NOT in a good cycle window — wait for
    // the right week rather than nudging into a barrier-compromised phase.
    const inGoodWindow = cycle ? cycle.phase === 'follicular' || cycle.phase === 'ovulatory' : true
    if (!(isActivesLoop(oldest) && !inGoodWindow)) {
      return {
        type: 'open_loop',
        reason: `open_loop_${oldest.topic}`,
        context: `Yuri left this unresolved ${daysBetween(oldest.opened_date, todayIso)} days ago and the user hasn't returned to it: "${oldest.summary}". Pick it back up warmly.`,
        suggestedAsk: `Picking back up on ${oldest.topic.replace(/_/g, ' ')} — ${oldest.summary}`,
      }
    }
  }

  // ---- 4. Glass Skin cadence -------------------------------------------------
  // A fresh score is the platform's strongest progress signal. If it's been ≥14
  // days AND the user is mid-treatment (has an active phase), suggest one — framed
  // as their journey, not a chore.
  if (activePhase && daysSinceLastGlassScore !== null && daysSinceLastGlassScore >= GLASS_SKIN_STALE_DAYS) {
    return {
      type: 'glass_skin_cadence',
      reason: `glass_skin_${daysSinceLastGlassScore}d_stale`,
      context: `It's been ${daysSinceLastGlassScore} days since the user's last Glass Skin Score, and they're actively in Phase ${activePhase.phase_number} (${activePhase.name}). A fresh photo would show whether the phase is moving the needle. Suggest one as their progress check-in.`,
      suggestedAsk: `It's been a couple weeks — want to look at a fresh Glass Skin Score with me to see how Phase ${activePhase.phase_number} is going?`,
    }
  }

  return null
}
