-- Yuri Scenario Mode — demo/internal account flag
--
-- Purpose: enable a flagged internal account (Bailey's content-studio account)
-- to invoke "Scenario Mode" — asking the REAL Yuri to answer for ANY skin type
-- or persona for marketing/demo screenshots — WITHOUT:
--   (a) writing that scenario's skin data back to the account's real profile, and
--   (b) polluting the cross-user learning loop.
--
-- Scenario Mode itself is fully ephemeral in code (no message/summary/insight/
-- profile writes happen on a scenario turn), so this flag is the GATE that
-- decides who is allowed to call it. It also serves as a belt-and-suspenders
-- exclusion key for the learning-aggregation cron and the guardian healthcheck.
--
-- Default FALSE: every real user is unaffected.

ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ss_user_profiles.is_demo IS
  'Internal/content-demo account. TRUE = may invoke Yuri Scenario Mode; excluded from the learning loop (aggregate-learning) and guardian per-user health. Never a paying/real user.';

-- Optional: index only the (rare) demo rows so exclusion filters stay cheap.
CREATE INDEX IF NOT EXISTS idx_ss_user_profiles_is_demo
  ON ss_user_profiles (user_id) WHERE is_demo = TRUE;
