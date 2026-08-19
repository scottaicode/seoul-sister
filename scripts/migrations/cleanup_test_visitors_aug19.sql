-- Remove the 3 synthetic test visitors created Aug 19 2026 while verifying the
-- "milky cleanser" search fix against the LIVE production chat route.
--
-- Why they exist: the repo's own rule is that a green build proves nothing —
-- only the served surface counts — so the fix was verified by POSTing real
-- messages to https://www.seoulsister.com/api/widget/chat. That mints real
-- visitor/session/message rows.
--
-- Why they must go: ss_widget_visitors is the honest conversion denominator
-- (project_ga4_bot_traffic_vs_db_truth). Three fake visitors against a lifetime
-- base of ~79 is a ~4% inflation of the ONE metric the build freeze is keyed
-- to. Left in place they would quietly make the funnel look better than it is.
--
-- The ids are deliberately shaped 00000000-0000-4000-8000-... so they can never
-- collide with a real client-generated UUIDv4 visitor id.
--
-- Verified before writing this: exactly 3 visitors, 5 sessions, 10 messages.
-- Safe to re-run — the WHERE clauses simply match nothing the second time.

BEGIN;

-- Children first (message -> session -> visitor), so no FK is ever orphaned.
DELETE FROM ss_widget_messages
WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%';

DELETE FROM ss_widget_intent_signals
WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%';

DELETE FROM ss_widget_sessions
WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%';

DELETE FROM ss_widget_visitors
WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%';

-- Expected after commit: 0, 0, 0.
SELECT
  (SELECT count(*) FROM ss_widget_visitors WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%') AS visitors_left,
  (SELECT count(*) FROM ss_widget_sessions WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%') AS sessions_left,
  (SELECT count(*) FROM ss_widget_messages WHERE visitor_id::text LIKE '00000000-0000-4000-8000-%') AS messages_left;

COMMIT;
