-- Post-apply check for 20261010000002_conversation_updated_at_activity_only.sql
--
-- Runs entirely inside a transaction and ROLLS BACK: nothing is written.
-- Paste into Supabase Studio SQL editor after applying the migration.
-- Expect every row of the final SELECT to read ok = true.

BEGIN;

CREATE TEMP TABLE _uat_check (step text, before_ts timestamptz, after_ts timestamptz, expect_bumped boolean) ON COMMIT DROP;

-- Pick one real conversation and pin its updated_at in the past so a bump is visible.
WITH c AS (SELECT id FROM public.ss_yuri_conversations ORDER BY created_at LIMIT 1)
UPDATE public.ss_yuri_conversations SET updated_at = '2000-01-01T00:00:00Z' WHERE id = (SELECT id FROM c);

-- 1. Settle-only write (summary + decision_memory + settle state): must NOT bump.
WITH c AS (SELECT id, updated_at FROM public.ss_yuri_conversations ORDER BY created_at LIMIT 1),
u AS (
  UPDATE public.ss_yuri_conversations t
     SET summary = coalesce(t.summary, '') || ' ',
         summary_generated_at = now(),
         decision_memory = coalesce(t.decision_memory, '{}'::jsonb),
         memory_settled_at = now(),
         memory_settle_attempts = 0
    FROM c WHERE t.id = c.id
  RETURNING c.updated_at AS before_ts, t.updated_at AS after_ts
)
INSERT INTO _uat_check SELECT 'settle-only write', before_ts, after_ts, false FROM u;

-- 2. Real activity (title change): MUST bump.
WITH c AS (SELECT id, updated_at FROM public.ss_yuri_conversations ORDER BY created_at LIMIT 1),
u AS (
  UPDATE public.ss_yuri_conversations t SET title = coalesce(t.title, '') || ' '
    FROM c WHERE t.id = c.id
  RETURNING c.updated_at AS before_ts, t.updated_at AS after_ts
)
INSERT INTO _uat_check SELECT 'title change', before_ts, after_ts, true FROM u;

-- 3. Explicit updated_at from saveMessage: honoured.
UPDATE public.ss_yuri_conversations SET updated_at = '2000-01-01T00:00:00Z'
 WHERE id = (SELECT id FROM public.ss_yuri_conversations ORDER BY created_at LIMIT 1);
WITH c AS (SELECT id, updated_at FROM public.ss_yuri_conversations ORDER BY created_at LIMIT 1),
u AS (
  UPDATE public.ss_yuri_conversations t SET updated_at = '2030-01-01T00:00:00Z'
    FROM c WHERE t.id = c.id
  RETURNING c.updated_at AS before_ts, t.updated_at AS after_ts
)
INSERT INTO _uat_check SELECT 'explicit updated_at (saveMessage)', before_ts, after_ts, true FROM u;

SELECT step, before_ts, after_ts,
       (after_ts > before_ts) = expect_bumped AS ok
  FROM _uat_check;

ROLLBACK;
