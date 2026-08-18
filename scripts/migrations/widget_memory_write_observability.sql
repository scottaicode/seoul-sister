-- Widget ai_memory write observability (Aug 18 2026)
--
-- THE DEFECT. `generateAndSaveMemory` (src/lib/widget/persistence.ts) had three
-- failure paths all shaped exactly like success: `if (!jsonMatch) return` on a
-- parse miss, a `.update()` whose result was discarded entirely (no `error`
-- destructure), and a throw swallowed by a catch that logged and returned void.
-- The caller received the same `void` whether the memory saved or vanished.
--
-- WHAT IT COST, measured on real production rows:
--   * visitor a7db713a (Aug 17 2026): the every-3rd-message trigger CAME DUE at
--     her message 3 (18:49 UTC) and `ai_memory` is still `{}`.
--   * visitor f7fdf10b (Aug 18 2026): a due fire in her SECOND session left zero
--     session-2 content stored, so on her return Yuri re-asked the climate and
--     burn/tan she had already answered.
--
-- WHY A COLUMN AND NOT A LOG LINE. "Fired and failed" and "never fired" left
-- IDENTICAL database state, which is the fourth of the four questions failing on
-- a live loop — and this repo has already paid for the log-only version once
-- (the Olive Young price refresher warned to console.warn for ~130 consecutive
-- nights while writing nothing, because nobody reads Vercel logs).
--
-- HOW TO READ IT:
--   memory_write_status IS NULL          -> never attempted (trigger never fired)
--   memory_write_status = 'saved'        -> healthy
--   anything else                        -> attempted and FAILED, with the reason
--   memory_write_at << last_seen_at      -> the trigger stopped firing mid-life
--
-- Safe to re-run.

ALTER TABLE ss_widget_visitors
  ADD COLUMN IF NOT EXISTS memory_write_status text,
  ADD COLUMN IF NOT EXISTS memory_write_at timestamptz;

COMMENT ON COLUMN ss_widget_visitors.memory_write_status IS
  'Outcome of the most recent generateAndSaveMemory attempt: saved | no_json_in_response | parse_failed | write_failed | threw. NULL means never attempted. Added Aug 18 2026 so "ran and failed" is distinguishable from "never ran" in DATA, not only in logs.';

COMMENT ON COLUMN ss_widget_visitors.memory_write_at IS
  'When that attempt happened. A memory_write_at far behind last_seen_at means the trigger stopped firing for this visitor.';

-- Find visitors whose memory generation is failing (the query a future session
-- should run before concluding the memory loop works):
--   SELECT visitor_id, total_messages, memory_write_status, memory_write_at, last_seen_at
--   FROM ss_widget_visitors
--   WHERE memory_write_status IS DISTINCT FROM 'saved'
--     AND total_messages >= 3
--   ORDER BY last_seen_at DESC;
