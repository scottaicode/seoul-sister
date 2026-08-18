import { getServiceClient } from '@/lib/supabase'

/**
 * Durable cron run logging — the DB is the source of truth, not an inbox.
 *
 * ## Why this exists
 *
 * On July 29 2026 `capture-reddit-intel` was found to have stopped executing
 * after July 14. Nobody could tell, because that route never wrote a run row:
 * "ran and found nothing" and "never ran at all" produced the IDENTICAL database
 * state. The route even had a correct `console.error` guard for the zero-result
 * case — it fired into Vercel logs that nobody reads, for 15 days. Diagnosis
 * eventually required invoking the endpoint by hand, which immediately captured
 * 82 comments that had been sitting there the whole time.
 *
 * An audit that day found **16 of 26 crons wrote no run row at all**. Any of them
 * could go silent the same way.
 *
 * ## The rule
 *
 * A cron's health must be answerable with a SQL query. Email and push are
 * redundant notifications layered on top — nothing may depend on one arriving,
 * because an owner inbox is not a monitoring system: mail bounces, filters,
 * gets marked spam, or simply goes unread on a busy day.
 *
 * So this helper only ever writes to `ss_pipeline_runs`. It sends nothing.
 *
 * ## Contract
 *
 * - **Never throws.** Observability must not take down the job it observes.
 * - **Always logs, including zero-result and failure runs** — those are the runs
 *   that matter, and the ones that historically vanished.
 * - `expected` lets a caller declare "I should have found something." When it's
 *   set and `scraped` is 0, the row is marked `completed_with_errors` and a loud line is
 *   emitted, so the scraper-zero-result bug class (cf. the Olive Young P0, which
 *   ran green while producing nothing for two weeks) is visible in DATA rather
 *   than only in logs.
 */

/**
 * Mirrors the `ss_pipeline_runs_status_check` CHECK constraint. Inventing a new
 * value here (an earlier draft used 'stale') makes the INSERT fail, and because
 * this helper swallows its own errors that failure would be silent — producing
 * exactly the invisibility this module exists to remove. An anomalous empty run
 * is recorded as `completed_with_errors` plus a metadata flag.
 */
export type RunStatus = 'completed' | 'completed_with_errors' | 'failed' | 'running'

export interface RunLogInput {
  /** Data origin, e.g. 'reddit', 'olive_young', 'system'. */
  source: string
  /** Stable identifier for this job, e.g. 'capture_reddit_intel'. */
  runType: string
  /** ISO timestamp captured at the TOP of the handler, before any work. */
  startedAt: string
  status: RunStatus
  scraped?: number
  processed?: number
  failed?: number
  /** Set true when a zero result is anomalous — marks the row `completed_with_errors`. */
  expected?: boolean
  metadata?: Record<string, unknown>
}

export async function logPipelineRun(input: RunLogInput): Promise<void> {
  const {
    source,
    runType,
    startedAt,
    scraped = 0,
    processed = 0,
    failed = 0,
    expected = false,
    metadata = {},
  } = input

  // A run that found nothing when it should have found something is not a
  // healthy "completed". Record it as completed_with_errors (a CHECK-allowed
  // value) plus an explicit metadata flag, so a query can find it by status OR
  // by flag without re-deriving the caller's intent.
  const anomalousEmpty = expected && scraped === 0 && input.status === 'completed'
  const status: RunStatus = anomalousEmpty ? 'completed_with_errors' : input.status

  if (anomalousEmpty) {
    console.error(
      `[${runType}] expected results, got 0 — logged as completed_with_errors. ` +
        'Upstream credentials or API shape may have changed.'
    )
  }

  try {
    await getServiceClient()
      .from('ss_pipeline_runs')
      .insert({
        source,
        run_type: runType,
        status,
        products_scraped: scraped,
        products_processed: processed,
        products_failed: failed,
        metadata: anomalousEmpty ? { ...metadata, anomalous_empty: true } : metadata,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      })
  } catch (err) {
    console.error(`[${runType}] failed to write run log`, err)
  }
}

/**
 * Jobs whose health should be checked by the Guardian.
 *
 * Deliberately a plain list rather than a schedule parser: the point is to make
 * "which crons are we actually watching?" a thing a person can read and edit,
 * not something inferred. `maxAgeHours` is generous — it answers "has this gone
 * quiet?", not "did it run exactly on time".
 */
export const WATCHED_RUN_TYPES: Array<{ runType: string; maxAgeHours: number }> = [
  { runType: 'capture_reddit_intel', maxAgeHours: 48 },
  { runType: 'incremental', maxAgeHours: 48 },
  { runType: 'image_health', maxAgeHours: 48 },
  { runType: 'price_refresh_olive_young', maxAgeHours: 48 },
  { runType: 'proactive_nudge', maxAgeHours: 48 },
  // nurture_sequence runs Tue-Thu ONLY ("0 16 * * 2-4"), so Thursday's 16:00 run
  // to the following Tuesday's is 120h of DESIGNED silence — five days, not the
  // four an earlier version of this comment claimed. At 48h that crossed
  // critical (48 * CRON_CRITICAL_MULTIPLE = 96h) every single Monday, and a real
  // alert fired Aug 10 2026 at 100h against a perfectly healthy job.
  //
  // The threshold must clear the LAST guardian-watch run before Tuesday's job,
  // not the gap between the jobs themselves. guardian-watch runs 08:23/14:23/
  // 20:23 UTC, so measured from Thu 16:00 it observes the silence at:
  //     Tue 08:23 = 112.4h    Tue 14:23 = 118.4h    Tue 20:23 = 124.4h
  // 108 was picked against the wrong number and would still WARN twice every
  // Tuesday, forever — the exact weekly noise it was meant to remove. (It did
  // fix the paging: critical = 108 * 2 = 216h, and only critical emails.)
  //
  // 132 clears Tue 14:23 with ~14h of margin, and a genuinely dead cron still
  // trips by Wed 08:23 (136.4h) — one working day, which is the point.
  { runType: 'nurture_sequence', maxAgeHours: 132 },
  // NOTE: guardian-watch stores run_type 'reprocess', not 'guardian-watch' — it
  // reuses a CHECK-allowed value to avoid a migration (see its route comment).
  // Matching on the literal name produced a false "has NEVER logged a run"
  // finding on the very first live run, which is why this is keyed by the value
  // actually written. Verify against the DB before adding entries here.
  { runType: 'reprocess', maxAgeHours: 24 },
]

export interface StaleRunFinding {
  runType: string
  lastRunAt: string | null
  hoursSince: number | null
}

/**
 * Which watched jobs have gone quiet, and which last reported failed/completed_with_errors.
 *
 * Pure read. Returns findings for a caller to report; decides nothing and sends
 * nothing. A job that has NEVER logged returns `lastRunAt: null`, which is
 * itself the finding — that was the Reddit case exactly.
 */
export async function findStaleRuns(): Promise<{
  quiet: StaleRunFinding[]
  unhealthy: Array<{ runType: string; status: string; startedAt: string }>
}> {
  const db = getServiceClient()
  const quiet: StaleRunFinding[] = []
  const unhealthy: Array<{ runType: string; status: string; startedAt: string }> = []

  for (const { runType, maxAgeHours } of WATCHED_RUN_TYPES) {
    const { data } = await db
      .from('ss_pipeline_runs')
      .select('status, started_at')
      .eq('run_type', runType)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data?.started_at) {
      quiet.push({ runType, lastRunAt: null, hoursSince: null })
      continue
    }

    const startedAt = data.started_at as string
    const hoursSince = (Date.now() - new Date(startedAt).getTime()) / 3_600_000
    if (hoursSince > maxAgeHours) {
      quiet.push({ runType, lastRunAt: startedAt, hoursSince: Math.round(hoursSince) })
    }

    const status = data.status as string
    if (status === 'failed' || status === 'completed_with_errors') {
      unhealthy.push({ runType, status, startedAt })
    }
  }

  return { quiet, unhealthy }
}

/**
 * How far past its own threshold a quiet cron must drift to count as critical.
 *
 * 2, not 3. At 3x a 48h threshold the bar is 144h, and the real reading that
 * prompted this work was 142h — the escalation would have missed the very
 * incident it was written for, by two hours, after six days of silence. At 2x a
 * daily job is critical ~4 days after its last successful run, which is still
 * conservative for something that should report every 24h.
 */
export const CRON_CRITICAL_MULTIPLE = 2

/**
 * Turn cron-liveness findings into Guardian signals.
 *
 * WHY THIS EXISTS (Aug 4 2026 — the second silence on the same job)
 *
 * `findStaleRuns()` already worked. On Aug 3-4 it recorded `capture_reddit_intel`
 * quiet on five consecutive runs — 112h, 118h, 130h, 136h, 142h — and Scott was
 * never told, while the only live acquisition channel sat dead for six days.
 *
 * The findings went to `console.error` and to ss_pipeline_runs.metadata, but
 * never into `report.signals`. Alerting reads `report.signals` and fires on
 * `critical`, so a quiet cron could not reach the alarm NO MATTER HOW LONG IT
 * STAYED DEAD. Detection was complete; the wire to the bell was missing.
 *
 * Severity is graded rather than flat, to respect the charter's warn=log-only
 * rule while still letting a genuinely dead job escalate on its own:
 *   - past its threshold        -> warn     (log-only; could be one slow day)
 *   - past 3x threshold, or NEVER logged -> critical (alerts)
 * A watched job that has never logged a single run is critical immediately:
 * there is no benign reading of it, and it is the exact Reddit case twice over.
 *
 * Pure: takes findings, returns signals. Decides nothing about sending.
 */
export function staleRunSignals(findings: {
  quiet: StaleRunFinding[]
  unhealthy: Array<{ runType: string; status: string; startedAt: string }>
}): Array<{
  key: string
  severity: 'critical' | 'warn'
  summary: string
  detail: Record<string, unknown>
}> {
  const watched = new Map(WATCHED_RUN_TYPES.map((w) => [w.runType, w.maxAgeHours]))
  const signals: Array<{
    key: string
    severity: 'critical' | 'warn'
    summary: string
    detail: Record<string, unknown>
  }> = []

  for (const q of findings.quiet) {
    const maxAgeHours = watched.get(q.runType) ?? 48
    const neverRan = q.lastRunAt === null
    const critical = neverRan || (q.hoursSince ?? 0) >= maxAgeHours * CRON_CRITICAL_MULTIPLE
    signals.push({
      key: `cron_quiet_${q.runType}`,
      severity: critical ? 'critical' : 'warn',
      summary: neverRan
        ? `Cron '${q.runType}' has NEVER logged a run — it may not be reachable at all.`
        : `Cron '${q.runType}' last ran ${q.hoursSince}h ago (threshold ${maxAgeHours}h).`,
      detail: {
        run_type: q.runType,
        last_run_at: q.lastRunAt,
        hours_since: q.hoursSince,
        threshold_hours: maxAgeHours,
        never_ran: neverRan,
      },
    })
  }

  for (const u of findings.unhealthy) {
    signals.push({
      key: `cron_unhealthy_${u.runType}`,
      severity: 'warn',
      summary: `Cron '${u.runType}' last reported ${u.status}.`,
      detail: { run_type: u.runType, status: u.status, started_at: u.startedAt },
    })
  }

  return signals
}
