-- Signup attribution capture (Jul 13 2026)
--
-- WHY: Seoul Sister has 20 users and cannot answer "where did they come from?"
-- for a single one of them. Bailey (the founder's daughter, the product's
-- lighthouse user) opened a personal TikTok/Instagram account, posted
-- face-to-camera, and got ~10x the followers in a day — the largest
-- top-of-funnel event in the product's history — and it is completely
-- unmeasured. The link in her bio cannot tell anyone it worked.
--
-- This migration adds the ONE prerequisite that every future content /
-- creator learning loop depends on: record where a signup came from.
--
-- Deliberately NOT a learning loop. With 20 users and 1 subscription, any
-- grader built today would be calibrating on noise (cf. LGAAS Blueprint 109/110:
-- "abstain, never fabricate" — a fabricated grade propagates permanently).
-- This is the measurement substrate. The loop gets built when the numbers
-- justify it, and then it is a query rather than an archaeology project.
--
-- All columns are NULLABLE with no default. Existing rows stay untouched and
-- every existing code path keeps working — nothing reads these yet.

ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS utm_source        TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium        TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign      TEXT,
  ADD COLUMN IF NOT EXISTS utm_content       TEXT,   -- per-post granularity: which video drove this
  ADD COLUMN IF NOT EXISTS referrer          TEXT,   -- document.referrer at first landing
  ADD COLUMN IF NOT EXISTS landing_path      TEXT,   -- first page seen
  ADD COLUMN IF NOT EXISTS first_seen_at     TIMESTAMPTZ, -- when they first landed (NOT when they signed up)
  ADD COLUMN IF NOT EXISTS attribution_locked_at TIMESTAMPTZ; -- when we stamped it; first-touch is immutable

COMMENT ON COLUMN ss_user_profiles.utm_source IS
  'First-touch attribution. Set once at profile creation from the visitor''s first landing. Never overwritten — first touch is the credit-worthy one for a top-of-funnel creator link.';
COMMENT ON COLUMN ss_user_profiles.utm_content IS
  'Per-post granularity. A creator posting daily sets this per video so "which post drove signups" is answerable.';
COMMENT ON COLUMN ss_user_profiles.first_seen_at IS
  'When the visitor first landed, which can precede signup by days. NOT created_at.';

-- Answering "which channel/post produced signups" is the whole point; index it.
CREATE INDEX IF NOT EXISTS idx_ss_user_profiles_utm_source
  ON ss_user_profiles (utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ss_user_profiles_utm_content
  ON ss_user_profiles (utm_content) WHERE utm_content IS NOT NULL;
