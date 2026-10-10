-- Conversation memory settle state (Oct 10 2026)
--
-- The settle job (/api/cron/settle-memory, src/lib/intelligence/memory-settle.ts)
-- re-runs summary + decision memory + treatment-phase extraction once a
-- conversation goes quiet. Keying "settled" on summary_generated_at alone meant
-- a conversation whose decision-memory step failed counted as settled, and one
-- whose summary kept failing was retried every hour forever, at the front of the
-- queue, starving newer conversations.
--
-- memory_settled_at:          set only when ALL steps succeeded for the messages
--                             present at that time. Settled ⇔ memory_settled_at
--                             ≥ the conversation's last message.
-- memory_settle_attempts:     consecutive failed attempts; reset on success.
-- memory_settle_next_at:      backoff; the job skips the row until then.
-- memory_settle_last_error:   what failed last, for the run row and audits.
--
-- Additive, nullable. Apply by hand together with the code (MCP is read-only).

ALTER TABLE ss_yuri_conversations
  ADD COLUMN IF NOT EXISTS memory_settled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS memory_settle_attempts   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_settle_next_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS memory_settle_last_error TEXT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'ss_yuri_conversations' AND column_name LIKE 'memory_settle%';  -- expect 4
