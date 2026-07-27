-- Tool-call observability for the AUTHENTICATED Yuri surface (July 27 2026).
--
-- WHY: the anonymous free widget has logged every tool call since Phase 14
-- (ss_widget_messages.tool_calls jsonb), but the paid $24.99/mo surface logged
-- NONE. When a fuzzy matcher wrote a routine step ("Shower / cleanse") into a
-- user's library as a product she owned, save_routine computed the exact
-- mismatch record — requested_name, matched_name, status='matched_loose' —
-- handed it to the model, and discarded it. The only surviving trace was Yuri's
-- paraphrase in prose ("the same matching gremlin bit two steps"), which nobody
-- audited, so the bad rows lived seven weeks until the user hit them.
--
-- Diagnosing that required reading chat transcripts and hand-joining tables.
-- With this column it is one query:
--   SELECT * FROM ss_yuri_messages
--   WHERE tool_calls @> '[{"name":"save_routine"}]';
--
-- Same shape as the widget's ToolCallLog: [{name, input, result_summary}].
-- Nullable, no default, no backfill — historical rows stay NULL honestly rather
-- than pretending to be "no tools fired".

ALTER TABLE ss_yuri_messages
  ADD COLUMN IF NOT EXISTS tool_calls JSONB;

COMMENT ON COLUMN ss_yuri_messages.tool_calls IS
  'Tool calls fired while producing this assistant message: [{name, input, result_summary}]. NULL = not recorded (pre-2026-07-27) or no tools fired. Mirrors ss_widget_messages.tool_calls.';

-- Partial index: only assistant rows that actually fired tools. Keeps the index
-- small while making "which conversations used save_routine / had loose
-- matches" cheap to answer.
CREATE INDEX IF NOT EXISTS idx_ss_yuri_messages_tool_calls
  ON ss_yuri_messages USING GIN (tool_calls)
  WHERE tool_calls IS NOT NULL;
