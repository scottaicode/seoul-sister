import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Error-visible run logging for ss_pipeline_runs.
 *
 * Every cron that logged with a bare `await db.from('ss_pipeline_runs').insert(...)`
 * was silently losing its run history — the table's run_type CHECK constraint
 * rejected all six post-launch run types with 23514 and nobody saw it (July 2 2026;
 * image-health's keyset cursor never advanced because of this). Same silent-failure
 * shape as the v10.3.4 decision-memory crash and the May 5 scraper-zero-result bug.
 *
 * This helper surfaces the failure instead of swallowing it. It never throws —
 * a broken log write must not fail the cron's real work.
 */
export interface PipelineRunLog {
  run_type: string
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed'
  source?: string
  products_scraped?: number
  products_processed?: number
  products_failed?: number
  completed_at?: string
  metadata?: Record<string, unknown>
}

export async function logPipelineRun(db: SupabaseClient, entry: PipelineRunLog): Promise<void> {
  const { error } = await db.from('ss_pipeline_runs').insert({
    source: entry.source ?? 'system',
    ...entry,
  })
  if (error) {
    console.error(
      `[pipeline-run-log] insert FAILED for run_type=${entry.run_type}: ${error.message} — run history for this job is being lost`
    )
  }
}
