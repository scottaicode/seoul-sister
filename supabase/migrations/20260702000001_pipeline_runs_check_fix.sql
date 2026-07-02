-- Fix: ss_pipeline_runs CHECK constraints silently rejected six crons' run logs
-- (July 2 2026). The run_type CHECK only allowed the four original pipeline
-- values (full_scrape, incremental, reprocess, quality_check), so every cron
-- added since — image_health, memory_health_audit, durable_memory_rollup,
-- nudge_outcome_grading, proactive_nudge, nurture_sequence — had its
-- fire-and-forget log insert rejected with 23514. Consequences:
--   * image-health re-scanned the same first catalog slice daily (its keyset
--     cursor lives in the previous run's metadata, which never existed)
--   * memory-health tripwire, nudge grading, and nurture sends left no trail
--
-- run_type is a log discriminator, not a referential value; the CHECK provides
-- no integrity worth six silent failures, and every future cron would have to
-- remember to extend it. Drop it. Keep the status CHECK (small closed set) but
-- add completed_with_errors, which the nurture cron writes on partial failure.

ALTER TABLE ss_pipeline_runs DROP CONSTRAINT IF EXISTS ss_pipeline_runs_run_type_check;

ALTER TABLE ss_pipeline_runs DROP CONSTRAINT IF EXISTS ss_pipeline_runs_status_check;
ALTER TABLE ss_pipeline_runs ADD CONSTRAINT ss_pipeline_runs_status_check
  CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text]));
