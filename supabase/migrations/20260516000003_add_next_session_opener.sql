-- Add next_session_opener column for cross-session continuity.
-- When the user opens a fresh conversation, Yuri sees the pre-stored opener
-- from the prior conversation's summary generation, giving her a natural,
-- specific way to pick up where the last thread left off (instead of
-- starting cold or guessing from prose summaries).
--
-- Pattern ported from LGAAS advisor-conversation.js generateAdvisorHandoffSummary,
-- which has a `next_session_opener` field in handoff_summary JSON. Adapted for
-- Yuri as a flat column for simpler retrieval.
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS next_session_opener TEXT;
