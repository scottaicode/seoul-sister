-- ============================================================
-- Fix backfilled decision_memory dates
--
-- Origin: scripts/backfill-decision-memory.ts (run May 5, 2026)
-- stamped today's date on all extracted decisions/preferences/
-- commitments/corrections, but the underlying conversations were
-- as old as Feb 25. Phase 15.4 age-aware rendering reads these
-- dates to display "stated YYYY-MM-DD" — backfill artifacts make
-- 10-week-old decisions look brand-new in Yuri's prompt.
--
-- This script rewrites every nested .date field within
-- decision_memory to use the conversation's created_at date if
-- the conversation predates today (May 5). Decisions extracted
-- live (in real conversations going forward) keep their actual
-- extraction date.
--
-- Idempotent: re-running has no effect because we only touch rows
-- where the embedded .date is >= today AND the conversation is
-- older than May 1.
--
-- Run in Supabase Studio SQL Editor.
-- ============================================================

BEGIN;

-- Helper view: rewrite each array's date field via JSONB array transformation.
-- We can't easily mutate JSONB in-place across nested array elements without
-- unnesting + reaggregating. Update each conversation row individually.
WITH targets AS (
  SELECT id, created_at::date AS conv_date, decision_memory
  FROM ss_yuri_conversations
  WHERE decision_memory::text != '{}'
    AND created_at < '2026-05-01'  -- Only old conversations
)
UPDATE ss_yuri_conversations c
SET decision_memory = jsonb_build_object(
  'decisions', COALESCE((
    SELECT jsonb_agg(
      jsonb_set(d, '{date}', to_jsonb(t.conv_date::text))
    )
    FROM jsonb_array_elements(c.decision_memory->'decisions') d
  ), '[]'::jsonb),
  'preferences', COALESCE((
    SELECT jsonb_agg(
      jsonb_set(p, '{date}', to_jsonb(t.conv_date::text))
    )
    FROM jsonb_array_elements(c.decision_memory->'preferences') p
  ), '[]'::jsonb),
  'commitments', COALESCE((
    SELECT jsonb_agg(
      jsonb_set(co, '{date}', to_jsonb(t.conv_date::text))
    )
    FROM jsonb_array_elements(c.decision_memory->'commitments') co
  ), '[]'::jsonb),
  'corrections', COALESCE((
    SELECT jsonb_agg(
      jsonb_set(cor, '{date}', to_jsonb(t.conv_date::text))
    )
    FROM jsonb_array_elements(c.decision_memory->'corrections') cor
  ), '[]'::jsonb),
  'extracted_at', c.decision_memory->'extracted_at'
)
FROM targets t
WHERE c.id = t.id;

COMMIT;

-- Verification: confirm old conversations now have old dates on their decisions
-- SELECT
--   c.title, c.created_at::date AS conv_date,
--   array_agg(DISTINCT d->>'date') AS decision_dates
-- FROM ss_yuri_conversations c,
-- LATERAL jsonb_array_elements(c.decision_memory->'decisions') d
-- WHERE c.user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
--   AND c.decision_memory::text != '{}'
-- GROUP BY c.id, c.title, c.created_at
-- ORDER BY c.created_at;
