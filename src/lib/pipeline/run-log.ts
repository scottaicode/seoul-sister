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
  { runType: 'nurture_sequence', maxAgeHours: 48 },
  { runType: 'guardian-watch', maxAgeHours: 24 },
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
