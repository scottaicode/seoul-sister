import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// SEO Guardian Phase 3 — bet grader (the objective teacher for the SEO loop).
//
// This module is a RULER, not a judge. Every verdict is deterministic; there
// is no AI in the grading path. That is deliberate and mirrors
// `grade-nudge-outcomes`: an instrument that abstains beats one that
// fabricates a verdict, because graded outcomes are fed straight back into the
// strategist's prompt — a fabricated grade does not merely mislead a human, it
// corrupts next week's judgment.
//
// THE FAILURE THIS EXISTS TO PREVENT (measured Aug 19 2026, two independent
// adversarial reviews, both confirmed against live data):
//   The BoJ Aqua-Fresh bet predicted "clicks 5 -> >=10". Observed: 4 -> 5.
//   Filed naively that is a clean MISS. But P(X>=5 | lambda=4) = 0.371 — the
//   observed data is the SINGLE MOST LIKELY outcome under "the edit did
//   nothing" AND is fully consistent with the edit having worked, with 28 days
//   simply not containing enough trials to show it. Recording `miss` would
//   teach the strategist "metadata edits don't work" from pure Poisson noise.
//   A grader that compares 5 against 10 has found a SHORTFALL, not a verdict —
//   the repo's "a mismatch is not a diagnosis" rule, applied to measurement.
//
// Hence: the power check runs BEFORE the comparison and can VETO it. If it ran
// after, someone would eventually surface the delta "for context" and the veto
// would quietly become advisory.
// ---------------------------------------------------------------------------

/** Significance level for "could this bet's threshold have been distinguished
 *  from chance?" — the gate that decides gradeability. */
export const ALPHA = 0.05
/** Null-hypothesis rate for a zero-click baseline. GSC reports 0 for anything
 *  below its reporting threshold, so the true rate is low but not exactly 0;
 *  0.5 is the conservative stand-in. */
export const ZERO_BASELINE_NULL_LAMBDA = 0.5
/** Minimum days between baseline and after window START to avoid overlap. */
export const MIN_GAP_DAYS = 28
/**
 * How many standard deviations of sitewide movement counts as a shock.
 *
 * NOT a fixed percentage. Clicks are Poisson, so the noise floor is
 * 100/sqrt(N) percent — at this site's ~64 sitewide clicks that is **12.5% per
 * sigma**, which makes a fixed 15% threshold barely 1.2 sigma and fires on pure
 * noise roughly a quarter of the time. Measured on real adjacent runs with no
 * intervention: swings of -10.7%, +10.0%, +10.3% all occur naturally.
 *
 * Scaling by sigma also self-corrects as the site grows: at 500 sitewide clicks
 * the same 2.5-sigma rule tightens to ~11%, where a fixed 15% would go blind.
 */
export const SITEWIDE_CONFOUND_SIGMA = 2.5
/** Query-level position must move at least this to beat cross-snapshot noise. */
export const POSITION_DEADBAND = 1.5

export type Verdict =
  | 'hit'
  | 'miss'
  | 'mixed'
  | 'ungradeable_not_executed'
  | 'ungradeable_underpowered'
  | 'ungradeable_no_data'
  | 'ungradeable_too_soon'
  | 'ungradeable_execution_unknown'

export type ExecutionStatus = 'executed' | 'partially_executed' | 'not_executed' | 'unverified'

export interface BetGrade {
  verdict: Verdict
  /** First date this grader OBSERVED the action live on the page. Recorded on
   *  the first run that sees it and never overwritten — the grader runs weekly
   *  and fetches the live page anyway, so it can witness execution without the
   *  content pipeline stamping anything. Null until first observed. */
  execution_first_seen: string | null
  /** Provenance lives in the SAME object as the verdict — a caveat stored in a
   *  sibling table is a caveat that gets read past (the v11.33.0 `scorer`
   *  discipline, and `fitzpatrick_source` before it). */
  scorer: 'bet-grader-v1-deterministic'
  powered: boolean
  p_value: number | null
  baseline_clicks: number | null
  after_clicks: number | null
  baseline_impressions: number | null
  after_impressions: number | null
  gap_days: number | null
  execution_status: ExecutionStatus
  execution_evidence: string
  confounded_sitewide: boolean
  /** Position findings NEVER upgrade a verdict — advisory only. */
  position_notes: string[]
  notes: string
  graded_on: string
}

/** GSC rows store absolute URLs; bets store relative paths. A naive equality
 *  join returns ZERO rows silently and would grade every bet a confident MISS.
 *  Verified Aug 19 2026: 21 bets relative, all 21,263 snapshot rows absolute. */
export function normalizePath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '') || '/'
}

export interface SnapshotRow {
  query: string
  page: string
  clicks: number
  impressions: number
  position: number
}

/**
 * Exact conditional test for two Poisson counts over equal-length windows.
 *
 * Conditioning on the total N = before + after, the after-count is
 * Binomial(N, 1/2) under the null "the rate did not change". This is the
 * correct comparison because THE BASELINE IS ITSELF ONE NOISY DRAW — treating
 * it as a known rate is anti-conservative by roughly 10x at this site's click
 * volumes. Measured Aug 20 2026:
 *
 *   before -> after   naive-Poisson p   exact conditional p
 *        3 -> 8            0.0119              0.1133
 *        2 -> 7            0.0045              0.0898
 *        4 -> 12           0.0009              0.0384
 *
 * A 3 -> 8 bet would have graded a CONFIDENT HIT on a result a correct test
 * calls noise, and that verdict feeds the strategist "this action type works".
 * Determinism was never the safety property — calibration is.
 */
export function conditionalBinomialTail(before: number, after: number): number {
  const n = Math.round(before + after)
  const k = Math.round(after)
  if (n <= 0) return 1
  if (k <= 0) return 1
  // Sum of C(n,i)/2^n for i >= k, computed multiplicatively to avoid overflow.
  let acc = 0
  let c = Math.pow(0.5, n)
  for (let i = 0; i <= n; i++) {
    if (i >= k) acc += c
    c = (c * (n - i)) / (i + 1)
  }
  return Math.max(0, Math.min(1, acc))
}

/** Upper-tail Poisson P(X >= k | lambda) — used where the rate IS known (the
 *  bet's own stated threshold), never for baseline-vs-after comparison. */
export function poissonUpperTail(k: number, lambda: number): number {
  if (lambda <= 0) return k <= 0 ? 1 : 0
  if (k <= 0) return 1
  let term = Math.exp(-lambda)
  let cdf = term
  for (let i = 1; i < k; i++) {
    term = (term * lambda) / i
    cdf += term
  }
  return Math.max(0, Math.min(1, 1 - cdf))
}

/**
 * Is a sitewide move large enough to be a genuine shock rather than Poisson
 * noise? Compares the observed percentage against the noise floor implied by
 * the baseline volume itself.
 */
export function isSitewideShock(changePct: number, baselineClicks: number): boolean {
  if (!Number.isFinite(changePct)) return false
  // Below a handful of clicks the percentage is meaningless in either
  // direction; refuse to claim a shock rather than flag everything.
  if (!Number.isFinite(baselineClicks) || baselineClicks < 5) return false
  const sigmaPct = (100 / Math.sqrt(baselineClicks)) * SITEWIDE_CONFOUND_SIGMA
  return Math.abs(changePct) > sigmaPct
}

export function aggregatePage(rows: SnapshotRow[], targetPath: string) {
  const matched = rows.filter((r) => normalizePath(r.page) === targetPath)
  const impressions = matched.reduce((s, r) => s + r.impressions, 0)
  return {
    found: matched.length > 0,
    clicks: matched.reduce((s, r) => s + r.clicks, 0),
    impressions,
    queries: matched.length,
  }
}

/** Query-level position, both-snapshots-present only. A page-level average is
 *  uninterpretable here: the BoJ page gained 68 BRAND-NEW queries against a
 *  67-query baseline, so its "average position" mostly reports which long-tails
 *  Google surfaced, not how it ranks. Live proof of the same Simpson's paradox:
 *  `is beauty of joseon aqua fresh sunscreen mineral` improved 8.33 -> 5.35
 *  while the page average went BACKWARDS 7.87 -> 8.04. */
export function comparePositions(
  baseline: SnapshotRow[],
  after: SnapshotRow[],
  targetQueries: string[]
): string[] {
  const notes: string[] = []
  const weighted = (rows: SnapshotRow[], q: string) => {
    const m = rows.filter((r) => r.query.toLowerCase() === q.toLowerCase())
    const impr = m.reduce((s, r) => s + r.impressions, 0)
    if (impr === 0) return null
    return { pos: m.reduce((s, r) => s + r.position * r.impressions, 0) / impr, impr }
  }
  for (const q of targetQueries) {
    const b = weighted(baseline, q)
    const a = weighted(after, q)
    if (!b || !a) {
      // Absence is NOT a ranking loss: GSC privacy-filters low-volume queries.
      notes.push(`"${q}": absent from one snapshot — unmeasurable, not a loss`)
      continue
    }
    const delta = b.pos - a.pos
    if (Math.abs(delta) < POSITION_DEADBAND) {
      notes.push(`"${q}": ${b.pos.toFixed(1)} -> ${a.pos.toFixed(1)} (within noise deadband)`)
      continue
    }
    const imprSwing = Math.abs(a.impr - b.impr) / Math.max(b.impr, 1)
    const mixWarn = imprSwing > 0.3 ? ' [impression mix shifted >30% — intent mix differs, advisory]' : ''
    notes.push(
      `"${q}": ${b.pos.toFixed(1)} -> ${a.pos.toFixed(1)} (${delta > 0 ? 'improved' : 'worsened'} ${Math.abs(delta).toFixed(1)})${mixWarn}`
    )
  }
  return notes
}

/**
 * Extract a click threshold from a bet's natural-language expected_outcome.
 * Deliberately conservative: if no explicit numeric threshold is stated, the
 * bet is treated as having none and cannot produce hit/miss. An unfalsifiable
 * prediction must not be gradeable — otherwise the strategist learns to write
 * vague outcomes that always grade favourably (Goodhart).
 */
export function extractClickThreshold(expected: string): number | null {
  const text = expected.toLowerCase()
  // NOTE on adjacency (measured Sep 1 2026 by executing this function against
  // real stored bets): pattern 3 originally required the digit to sit IMMEDIATELY
  // before `clicks`, so a single qualifier defeated it — ">=3 additional clicks"
  // and ">=10 additional total clicks" both returned null despite stating a
  // perfectly explicit threshold, permanently ungradeable. Likewise "rise from 4
  // to at least 12 clicks" missed pattern 2, whose `to` could not be followed by
  // "at least". Two real bets (`pih-into-pie-post`, `sunscreen-buy-authentic-answer`)
  // were filed as "stated no numeric threshold" when they had in fact stated one:
  // an AUTHORING verdict pinned on a PARSER defect, which would have sent the fix
  // to the strategist prompt instead of here.
  //
  // The qualifier gap is deliberately narrow — \w+ words only, no digits — so it
  // cannot swallow an intervening number and mistake a position or impression
  // figure for a click threshold. Widening it to [^.]{0,N} would do exactly that.
  const QUAL = String.raw`(?:\s+\w+){0,3}\s*`
  const patterns = [
    new RegExp(String.raw`clicks?[^.]{0,40}?(?:>=|≥|at least|to)\s*(\d+)`),
    new RegExp(String.raw`(?:rise|grow|increase|move)[^.]{0,30}?from\s*\d+\s*to\s*(?:>=|≥|at least)?\s*(\d+)[^.]{0,20}clicks?`),
    new RegExp(String.raw`(?:>=|≥|at least)\s*(\d+)${QUAL}clicks?`),
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

export interface GradeInput {
  betId: string
  expectedOutcome: string
  targetPage: string | null
  targetQueries: string[]
  baselineRows: SnapshotRow[]
  afterRows: SnapshotRow[]
  gapDays: number
  execution: { status: ExecutionStatus; evidence: string }
  /** Carried forward from a prior grade so first-observation is sticky. */
  executionFirstSeen?: string | null
  sitewideChangePct: number
  /** Sitewide clicks in the BASELINE window — sets the noise floor the change
   *  percentage is judged against. */
  sitewideBaselineClicks: number
  /** First day of the AFTER window (YYYY-MM-DD). Used to detect a window that
   *  mostly predates the action going live. */
  windowStart?: string
  today: string
}

/**
 * Grade one bet. Order is load-bearing and strict — each gate can STOP the
 * pipeline before any metric comparison happens:
 *   1. executed?  2. window clean?  3. data present?  4. powered?  5. compare.
 * Never let non-execution become a `miss`: a miss says "the theory was wrong",
 * unshipped work says "the theory was untested". Conflating them teaches the
 * strategist about the content pipeline's throughput while labelling it SEO.
 */
export function gradeBet(input: GradeInput): BetGrade {
  // Sticky: once observed executed, the date never moves. A later run that
  // cannot re-confirm (page fetch flaked, wording changed) must not erase the
  // fact that we once saw it live.
  const firstSeen =
    input.executionFirstSeen ??
    (input.execution.status === 'executed' || input.execution.status === 'partially_executed'
      ? input.today
      : null)

  const base: Omit<BetGrade, 'verdict' | 'notes'> = {
    execution_first_seen: firstSeen,
    scorer: 'bet-grader-v1-deterministic',
    powered: false,
    p_value: null,
    baseline_clicks: null,
    after_clicks: null,
    baseline_impressions: null,
    after_impressions: null,
    gap_days: input.gapDays,
    execution_status: input.execution.status,
    execution_evidence: input.execution.evidence,
    confounded_sitewide: isSitewideShock(input.sitewideChangePct, input.sitewideBaselineClicks),
    position_notes: [],
    graded_on: input.today,
  }

  // GATE 1 — execution. Runs first so metrics are never computed for work that
  // never shipped.
  if (input.execution.status === 'not_executed') {
    return {
      ...base,
      verdict: 'ungradeable_not_executed',
      notes: `Action never shipped (${input.execution.evidence}). The theory is untested, not wrong — this must not count against the bet type.`,
    }
  }

  // GATE 2 — window cleanliness. Windows are 28 days; at a 21-day gap only 75%
  // of the after-window is post-intervention, and adjacent runs (7d) attenuate
  // a true effect ~4x. Grading through that haircut turns real wins into
  // recorded misses.
  if (input.gapDays < MIN_GAP_DAYS) {
    return {
      ...base,
      verdict: 'ungradeable_too_soon',
      notes: `Only ${input.gapDays}d between windows; ${MIN_GAP_DAYS}d required so the after-window contains no pre-bet days.`,
    }
  }

  // GATE 2b — execution-window contamination.
  //
  // Gate 2 guards the wrong boundary on its own: it ensures the after-window
  // contains no pre-BET days, but what biases a verdict is pre-EXECUTION days.
  // The content pipeline ships days-to-weeks after a bet is written (the BoJ
  // bet was still only half shipped weeks on), and the verifier fetches the
  // page TODAY — so it proves "shipped by now", never "shipped before the
  // window". An edit live for only the last 8 of 28 days would otherwise be
  // graded against a window that is 71% pre-execution, manufacturing a
  // confident MISS on work that barely existed in the measured period.
  if (firstSeen && input.windowStart && firstSeen > input.windowStart) {
    return {
      ...base,
      verdict: 'ungradeable_execution_unknown',
      notes: `The action was first observed live on ${firstSeen}, after the measurement window opened on ${input.windowStart}. The window is mostly pre-execution, so neither direction can be attributed to the action.`,
    }
  }

  // GATE 3 — data presence. A page that does not resolve is missing data, never
  // a miss (this is also the URL-normalization tripwire).
  if (!input.targetPage) {
    return {
      ...base,
      verdict: 'ungradeable_no_data',
      notes: 'Bet names no target page (new-content bet); page-level click grading does not apply.',
    }
  }
  const b = aggregatePage(input.baselineRows, input.targetPage)
  const a = aggregatePage(input.afterRows, input.targetPage)
  if (!a.found) {
    return {
      ...base,
      verdict: 'ungradeable_no_data',
      notes: `Target page ${input.targetPage} absent from the after snapshot — no data, not a ranking loss.`,
    }
  }

  const positionNotes = comparePositions(input.baselineRows, input.afterRows, input.targetQueries)
  const withData = {
    ...base,
    baseline_clicks: b.clicks,
    after_clicks: a.clicks,
    baseline_impressions: b.impressions,
    after_impressions: a.impressions,
    position_notes: positionNotes,
  }

  const threshold = extractClickThreshold(input.expectedOutcome)
  if (threshold === null) {
    return {
      ...withData,
      verdict: 'ungradeable_underpowered',
      notes: 'expected_outcome states no explicit numeric click threshold, so nothing falsifiable can be tested. Write thresholds, not directions.',
    }
  }

  // GATE 4 — statistical power, BEFORE any comparison.
  //
  // The test is NOT "is the baseline big enough" but the sharper question:
  // COULD HITTING THIS BET'S OWN THRESHOLD have been distinguished from chance?
  // A flat volume floor gets that wrong in both directions. Measured on real
  // rows: baseline 3 reaching the bet's stated 10 has p=0.0011 — decisively
  // significant — so a flat "baseline >= 10" floor would have discarded a
  // perfectly falsifiable bet. Conversely a baseline of 40 with a threshold of
  // 41 is unfalsifiable however large the numbers look.
  //
  // So: the bet is gradeable iff reaching its threshold would itself be
  // significant (p < ALPHA) against the no-effect baseline. Grade the
  // THRESHOLD, never the distance travelled.
  const lambdaNull = b.clicks === 0 ? ZERO_BASELINE_NULL_LAMBDA : b.clicks
  // A threshold at or below the baseline is satisfied by standing still — it
  // predicts nothing, whatever the traffic volume.
  //
  // Gradeability asks whether HITTING the threshold could be distinguished from
  // chance, so it uses the same conditional test the verdict will use — a gate
  // calibrated more loosely than the verdict would admit bets that can only
  // ever produce uncertain results.
  //
  // NOTE: this clause is provably REDUNDANT — the significance test below
  // already rejects every threshold <= baseline (checked for baselines 2..10:
  // P(X >= baseline | baseline) never drops below 0.54, far above ALPHA). It is
  // kept as a cheap, explicit statement of intent, and deliberately has NO
  // guard test, because a test asserting it would pass with the clause deleted
  // — a test that cannot fail is not evidence.
  const thresholdSignificance =
    b.clicks === 0
      ? poissonUpperTail(threshold, lambdaNull)
      : conditionalBinomialTail(b.clicks, threshold)
  // A borderline threshold is still gradeable if the ACHIEVED result clears
  // significance on its own: 30 -> 45 sits at p=0.053 (just over alpha), but an
  // observed 30 -> 60 is p=0.001 and plainly informative. Rejecting that as
  // "unfalsifiable" would discard the clearest evidence the loop can produce.
  // Only the threshold-side gate is relaxed; the verdict still requires the
  // observation itself to be significant.
  const observedSignificance =
    b.clicks === 0
      ? poissonUpperTail(a.clicks, lambdaNull)
      : conditionalBinomialTail(b.clicks, a.clicks)
  const rescuedByResult = a.clicks >= threshold && observedSignificance < ALPHA
  if (threshold <= b.clicks || (thresholdSignificance >= ALPHA && !rescuedByResult)) {
    return {
      ...withData,
      verdict: 'ungradeable_underpowered',
      notes: `Threshold >=${threshold} against a ${b.clicks}-click baseline could not have been distinguished from chance (reaching it scores p=${thresholdSignificance.toFixed(3)}, at or above alpha=${ALPHA}). No outcome could have confirmed this bet, so the result carries no information. This is a verdict about how the BET WAS WRITTEN, not about what happened.`,
    }
  }

  // GATE 5 — the comparison. Grade the THRESHOLD the bet named, never the
  // distance travelled.
  //
  // Gradeability (gate 4) and verdict CONFIDENCE are different questions. A
  // threshold can be perfectly falsifiable while the observed result still
  // fails to settle it. The real BoJ case: threshold >=10 on a 4-click baseline
  // is falsifiable (p=0.008), but the observed 4 -> 5 scores p=0.371 — the
  // single most likely outcome under "no effect" AND fully consistent with the
  // edit having worked in a window too short to show it. Recording that as
  // `miss` is the documented way this instrument corrupts the loop.
  //
  // So a MISS is only recorded when the shortfall is itself informative: the
  // observed count must be low enough that a true threshold-sized effect would
  // probably have produced more. Otherwise the honest answer is abstention.
  // The observed move, tested correctly: baseline and after are BOTH draws.
  const pValue =
    b.clicks === 0
      ? poissonUpperTail(a.clicks, lambdaNull)
      : conditionalBinomialTail(b.clicks, a.clicks)
  const met = a.clicks >= threshold

  if (!met) {
    // Under the bet's own hypothesis (true rate ~= threshold), how likely is a
    // count this low? If that is not unlikely, the shortfall does not
    // discriminate and we must not call it a miss.
    const pUnderHypothesis = 1 - poissonUpperTail(a.clicks + 1, threshold)
    if (pUnderHypothesis >= ALPHA) {
      return {
        ...withData,
        powered: false,
        p_value: +pValue.toFixed(4),
        verdict: 'ungradeable_underpowered',
        notes: `Threshold >=${threshold}; observed ${b.clicks} -> ${a.clicks}. The shortfall does NOT settle it: under the bet's own hypothesis a count this low still occurs with p=${pUnderHypothesis.toFixed(3)}, and the observed move scores p=${pValue.toFixed(4)} against no-effect. Consistent BOTH with the action doing nothing and with it working in a window too short to show it. Recording a miss here would teach the strategist from noise.`,
      }
    }
  }

  const verdict: Verdict = met ? 'hit' : 'miss'
  const confoundNote = withData.confounded_sitewide
    ? ` NOTE: sitewide clicks moved ${input.sitewideChangePct.toFixed(1)}% between these windows, beyond the ${SITEWIDE_CONFOUND_SIGMA}-sigma noise floor for ${input.sitewideBaselineClicks} baseline clicks — treat as confounded.`
    : ''

  // A HIT must not be credited to work we could not confirm shipped. The
  // verifier abstains readily (`unverified`) because a false `not_executed`
  // silently drops a bet — but that abstention must not then flow into a
  // confident hit, or the loop learns "this bet type works" from an action that
  // may never have happened. A MISS is left to stand: the ambiguity there is
  // already carried by execution_status, and suppressing negatives would make
  // the instrument systematically optimistic.
  if (input.execution.status !== 'executed') {
    // Symmetric by necessity, not by taste. An earlier version let a MISS stand
    // under unverified/partial execution, reasoning that suppressing negatives
    // would make the instrument optimistic. That was wrong: `partially_executed`
    // is the LITERAL BoJ case this module was built around — metadata shipped,
    // on-page section did not — and the verifier abstains far more often than it
    // returns `not_executed`, so most unshipped work presents as `unverified`.
    // Standing misses would therefore file content-pipeline failures as "the SEO
    // theory was wrong": opposite remediations, "a mismatch is not a diagnosis"
    // in its canonical form. Optimism bias is answered by reporting the
    // abstention rate BY CAUSE, not by buying pessimism with misattribution.
    return {
      ...withData,
      verdict: 'ungradeable_execution_unknown',
      powered: false,
      p_value: +pValue.toFixed(4),
      notes: `Threshold >=${threshold} was ${met ? 'MET' : 'NOT met'} (${b.clicks} -> ${a.clicks}, p=${pValue.toFixed(4)}), but execution is '${input.execution.status}' (${input.execution.evidence}). Neither direction can be attributed: an unconfirmed action cannot earn a hit, and cannot be blamed for a miss.${confoundNote}`,
    }
  }

  return {
    ...withData,
    verdict,
    powered: true,
    p_value: +pValue.toFixed(4),
    notes: `Threshold >=${threshold} clicks; observed ${b.clicks} -> ${a.clicks}. ${met ? 'Met' : 'Not met'} (p=${pValue.toFixed(4)} vs no-effect).${confoundNote}`,
  }
}
