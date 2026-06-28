-- Migration: paywall-bounce cohort measurement
-- Records when an authenticated free-plan user reached the /subscribe paywall.
-- Makes "registered but bounced at the wall" a queryable, reachable cohort,
-- distinct from bot signups that never loaded subscribe. Deterministic fact,
-- no AI judgment. Set-once semantics enforced in the API route (only writes
-- when currently null).
--
-- Apply via Supabase SQL editor or `psql`. The application code tolerates this
-- column being absent until applied (same defensive pattern as ss_widget_visitors.captured_email).

ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS paywall_reached_at timestamptz;

COMMENT ON COLUMN ss_user_profiles.paywall_reached_at IS
  'First time this user viewed the /subscribe paywall as a free-plan user. Funnel measurement (visitor->paid bounce). Set-once.';

-- Handy read-back once data accumulates:
--   SELECT count(*) FILTER (WHERE paywall_reached_at IS NOT NULL) AS reached_wall,
--          count(*) FILTER (WHERE plan <> 'free') AS paid
--   FROM ss_user_profiles;
