import type { SupabaseClient } from '@supabase/supabase-js'
import type { SeoBet } from './seo-guardian'
import {
  gradeBet,
  normalizePath,
  MIN_GAP_DAYS,
  type BetGrade,
  type SnapshotRow,
} from './bet-grader'
import { verifyExecution } from './execution-verifier'

/** Google Search Console publishes with roughly this much delay. A window whose
 *  tail falls inside the lag returns partial data with NO error. */
const GSC_LAG_DAYS = 3
import { getGscConfig, fetchSearchAnalytics } from './gsc-client'

// ---------------------------------------------------------------------------
// Phase 3 orchestrator: find due bets, pick a CLEAN comparison window, verify
// execution, grade deterministically, persist.
//
// Window selection is the load-bearing choice. Snapshots are 28-day windows and
// runs are ~weekly, so consecutive snapshots share ~21 of 28 days. Comparing
// adjacent runs attenuates a true effect ~4x. The baseline is therefore the
// snapshot the bet was BORN in, and the after-snapshot is the first one whose
// window STARTS at least MIN_GAP_DAYS later — so the after-window contains no
// pre-bet days at all. If no such snapshot exists yet, the bet grades
// `ungradeable_too_soon` rather than being measured through the haircut.
// ---------------------------------------------------------------------------

interface ReportRow {
  id: string
  created_at: string
  window_start: string
  window_end: string
  bets: SeoBet[] | null
  grades: Record<string, BetGrade> | null
  gsc_snapshot: { rows?: SnapshotRow[] } | null
}

export interface GradeRunResult {
  status: 'completed' | 'failed'
  betsExamined: number
  betsGraded: number
  gradedNow: number
  summary: string
  error?: string
}

/** Verdicts that never change. Everything else is re-graded on each run. */
const TERMINAL_VERDICTS = new Set<string>(['hit', 'miss', 'mixed'])

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function totalClicks(rows: SnapshotRow[]): number {
  return rows.reduce((s, r) => s + r.clicks, 0)
}

/**
 * Sitewide clicks EXCLUDING the bet's own target page.
 *
 * A successful bet moves the sitewide total itself: on a 64-click site, a page
 * going 4 -> 20 is a +25% "sitewide change" caused entirely by the thing being
 * measured. Including the target page lets a genuine win flag itself as a
 * confounded run — the control has to be the rest of the site, not the site.
 */
function controlClicks(rows: SnapshotRow[], targetPath: string | null): number {
  if (!targetPath) return totalClicks(rows)
  return rows.reduce((sum, r) => (normalizePath(r.page) === targetPath ? sum : sum + r.clicks), 0)
}

/**
 * Fetch a CLEAN after-window straight from the GSC API.
 *
 * This is what makes the grader work at all. Stored snapshots are 28-day
 * windows taken ~weekly, so the widest separation the archive can offer is 23
 * days of window-start gap — always short of the 28 needed for a window with no
 * pre-bet days in it. Measured Aug 19 2026: every one of the 8 due bets graded
 * `ungradeable_too_soon` from snapshots alone, correctly.
 *
 * GSC retains ~16 months, so the API can serve an exact, non-overlapping window
 * for any bet. Returns null when credentials are absent (local runs) — the
 * caller then falls back to snapshots and the bet grades `too_soon` rather than
 * being measured through an overlapping window.
 */
async function fetchCleanWindow(
  startDate: string,
  endDate: string
): Promise<SnapshotRow[] | null> {
  const config = getGscConfig()
  if (!config) return null
  try {
    const rows = await fetchSearchAnalytics(config, startDate, endDate)
    return rows.map((r) => ({
      query: r.query,
      page: r.page,
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    }))
  } catch (err) {
    // A GSC failure must never masquerade as "no effect" — abstain instead.
    console.error(
      `[bet-grader] GSC fetch FAILED for ${startDate}..${endDate}: ${err instanceof Error ? err.message : 'unknown'} — falling back to snapshots`
    )
    return null
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function runBetGrader(db: SupabaseClient, todayIso?: string): Promise<GradeRunResult> {
  const today = todayIso ?? new Date().toISOString().slice(0, 10)

  const { data, error } = await db
    .from('ss_seo_reports')
    .select('id, created_at, window_start, window_end, bets, grades, gsc_snapshot')
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  // Destructuring only `data` would turn a failed query into "no bets due" —
  // the exact silent-failure shape this repo keeps paying for.
  if (error) {
    console.error(`[bet-grader] report fetch FAILED: ${error.message}`)
    return { status: 'failed', betsExamined: 0, betsGraded: 0, gradedNow: 0, summary: '', error: error.message }
  }

  const reports = (data ?? []) as ReportRow[]
  if (reports.length === 0) {
    return { status: 'completed', betsExamined: 0, betsGraded: 0, gradedNow: 0, summary: 'No completed reports to grade.' }
  }

  let examined = 0
  let gradedNow = 0
  let writeFailures = 0
  const verdictTally = new Map<string, number>()

  for (const report of reports) {
    const bets = report.bets ?? []
    if (bets.length === 0) continue

    const baselineRows = report.gsc_snapshot?.rows ?? []
    const existing = report.grades ?? {}
    const newGrades: Record<string, BetGrade> = { ...existing }
    // First-sightings recorded THIS run, for bets that have no stored stamp yet.
    // Kept separate from `existing` so a sighting taken before a bet is due can
    // still reach gradeBet on the same run it becomes due.
    const witnessed: Record<string, string> = {}
    let changed = false

    // Preferred: a clean window fetched live from GSC, starting the day after
    // this report's window ends so the two share no days at all. Falls back to
    // the snapshot archive when credentials are absent.
    const cleanStart = addDays(report.window_end, 1)
    const cleanEnd = addDays(cleanStart, 27)
    // GSC publishes with a ~3 day lag (gsc-client.ts:89). `cleanEnd < today`
    // alone lets a run 1-3 days past cleanEnd fetch a window whose final days
    // have no data published yet — silently UNDERCOUNTING after-window clicks
    // and biasing every verdict toward `miss`/`underpowered`, the exact
    // direction this module exists to prevent. A short window is not an error
    // anything reports; it just looks like the bet failed. Wait for the lag to
    // clear (one extra day of margin) before treating a window as complete.
    const liveRows = cleanEnd <= addDays(today, -GSC_LAG_DAYS - 1) ? await fetchCleanWindow(cleanStart, cleanEnd) : null

    // Fallback: first snapshot whose window starts >= MIN_GAP_DAYS after this
    // one's, so baseline and after share no days.
    const after = reports.find(
      (r) => r.id !== report.id && daysBetween(report.window_start, r.window_start) >= MIN_GAP_DAYS
    )

    for (const bet of bets) {
      examined++
      // Only a SETTLED verdict is terminal. Abstentions are "not yet", not
      // "never" — re-grading them every run is the whole point, because
      // `too_soon` becomes gradeable once a clean window exists and
      // `not_executed` becomes gradeable once the pipeline ships the work.
      // Treating an abstention as final would freeze the backlog after one run
      // and turn "abstain rather than fabricate" into "abstain once, never
      // grade" — a silent, permanent zero-signal loop.
      const prior = existing[bet.id]
      if (prior && TERMINAL_VERDICTS.has(prior.verdict)) {
        verdictTally.set(prior.verdict, (verdictTally.get(prior.verdict) ?? 0) + 1)
        continue
      }
      const targetPath = bet.target_page ? normalizePath(bet.target_page) : null

      // EARLY EXECUTION WITNESSING — must run BEFORE the not-yet-due skip.
      //
      // `execution_first_seen` is what gate 2b compares against the window
      // start, and it can only ever be stamped with the date the grader HAPPENED
      // TO LOOK. Before this, the only code path that called verifyExecution ran
      // after a clean 28-day window existed, and grading itself did not start
      // until `review_after` — so first-sighting was structurally >= windowStart
      // + 28 for every bet, gate 2b fired on every executed bet, and the sticky
      // stamp made it permanent. hit/miss was UNREACHABLE for any bet at any
      // traffic level. Production proved it: the only two bets ever observed
      // executed both carry first_seen 2026-08-23 — the grader's first cron run
      // — against window starts of 2026-06-24 and 2026-06-26. That date is when
      // the INSTRUMENT arrived, not when the work shipped.
      //
      // The gate's semantics are unchanged and nothing is fabricated: we simply
      // make the witness show up on time, so a bet whose work ships in week 1
      // records a first-sighting in week 1. An unwitnessed bet still abstains.
      if (!prior?.execution_first_seen && targetPath) {
        const early = await verifyExecution(targetPath, bet.action, bet.action_type ?? 'other')
        if (early.status === 'executed' || early.status === 'partially_executed') {
          witnessed[bet.id] = today
          // Persist immediately: a sighting observed and not written is a
          // sighting lost, and the whole point is that it is recorded EARLY.
          // A not-yet-due bet normally has NO stored grade, so carrying the
          // date onto an existing row is not enough — build a full abstention
          // row via gradeBet itself (never a hand-made partial object; the type
          // caught that) whose only job is to hold the sighting until the bet
          // becomes due. `ungradeable_too_soon` is NOT in TERMINAL_VERDICTS, so
          // the bet is re-graded normally on the run it comes due.
          const carriedGrade = newGrades[bet.id]
          newGrades[bet.id] = carriedGrade
            ? { ...carriedGrade, execution_first_seen: today }
            : gradeBet({
                betId: bet.id,
                expectedOutcome: bet.expected_outcome,
                targetPage: targetPath,
                targetQueries: bet.target_queries ?? [],
                baselineRows,
                afterRows: [],
                gapDays: 0,
                execution: early,
                sitewideChangePct: 0,
                sitewideBaselineClicks: 0,
                executionFirstSeen: today,
                today,
              })
          changed = true
        }
      }

      if (!bet.review_after || bet.review_after > today) continue

      if (!after && !liveRows) {
        const grade = gradeBet({
          betId: bet.id,
          expectedOutcome: bet.expected_outcome,
          targetPage: targetPath,
          targetQueries: bet.target_queries ?? [],
          baselineRows,
          afterRows: [],
          gapDays: 0,
          execution: { status: 'unverified', evidence: 'not checked — no clean after-window exists yet' },
          sitewideChangePct: 0,
          sitewideBaselineClicks: 0,
          executionFirstSeen: prior?.execution_first_seen ?? witnessed[bet.id] ?? null,
          today,
        })
        newGrades[bet.id] = grade
        verdictTally.set(grade.verdict, (verdictTally.get(grade.verdict) ?? 0) + 1)
        changed = true
        gradedNow++
        continue
      }

      const afterRows = liveRows ?? after!.gsc_snapshot?.rows ?? []
      const effectiveGap = liveRows
        ? daysBetween(report.window_start, cleanStart)
        : daysBetween(report.window_start, after!.window_start)
      // Control = the rest of the site, with the target page removed from both
      // windows so a successful bet cannot flag itself as a confound.
      const baseControl = controlClicks(baselineRows, targetPath)
      const afterControl = controlClicks(afterRows, targetPath)
      const sitewidePct = baseControl > 0 ? ((afterControl - baseControl) / baseControl) * 100 : 0

      const execution = await verifyExecution(targetPath, bet.action, bet.action_type ?? 'other')

      // The after-window's first day. Compared against first-observed-execution
      // so a window that mostly predates the edit going live cannot produce a
      // confident verdict.
      const afterWindowStart = liveRows ? cleanStart : after!.window_start

      const grade = gradeBet({
        betId: bet.id,
        expectedOutcome: bet.expected_outcome,
        targetPage: targetPath,
        targetQueries: bet.target_queries ?? [],
        baselineRows,
        afterRows,
        gapDays: effectiveGap,
        execution,
        sitewideChangePct: sitewidePct,
        sitewideBaselineClicks: baseControl,
        windowStart: afterWindowStart,
        // Carried forward so first-observation is sticky across runs.
        executionFirstSeen: prior?.execution_first_seen ?? witnessed[bet.id] ?? null,
        today,
      })

      newGrades[bet.id] = grade
      verdictTally.set(grade.verdict, (verdictTally.get(grade.verdict) ?? 0) + 1)
      changed = true
      gradedNow++
    }

    if (changed) {
      const { error: upErr } = await db
        .from('ss_seo_reports')
        .update({ grades: newGrades, graded_at: new Date().toISOString() })
        .eq('id', report.id)
      if (upErr) {
        // A console line is not observability. The price refresher wrote
        // `status: 'completed'` over ~130 nights of total failure because its
        // only tripwire was console.warn. A failed write must reach a status a
        // human or the Guardian can see.
        writeFailures++
        console.error(`[bet-grader] grade write FAILED for report ${report.id}: ${upErr.message} — this bet stays ungraded`)
      }
    }
  }

  const tally = [...verdictTally.entries()].sort((a, b) => b[1] - a[1])
  const graded = tally.reduce((s, [, n]) => s + n, 0)
  const gradeable = (verdictTally.get('hit') ?? 0) + (verdictTally.get('miss') ?? 0) + (verdictTally.get('mixed') ?? 0)

  // The abstention rate is the headline, not a footnote. A high one is the
  // honest reading of a small site, not a broken grader.
  const summary =
    `${gradedNow} newly graded; ${graded} total. ` +
    `${gradeable} produced a hit/miss verdict; ${graded - gradeable} abstained. ` +
    tally.map(([v, n]) => `${v}=${n}`).join(', ')

  if (writeFailures > 0) {
    const msg = `${writeFailures} grade write(s) FAILED — those bets remain ungraded`
    return {
      status: 'failed',
      betsExamined: examined,
      betsGraded: graded,
      gradedNow,
      summary: `${summary} | ${msg}`,
      error: msg,
    }
  }

  return { status: 'completed', betsExamined: examined, betsGraded: graded, gradedNow, summary }
}
