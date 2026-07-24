-- Real-users view — excludes Gmail dot-abuse throwaway signups.
-- Added 2026-07-23. Non-destructive: the rows stay in auth.users; this view is
-- what "real signup" analytics should read instead of raw auth.users.
--
-- Context: 11 of ~30 lifetime signups were Gmail dot-abuse accounts
-- (ha.van.naji.l.l.ene@gmail.com, ...). Gmail ignores dots in the localpart, so
-- one inbox mints unlimited "unique" accounts. All 11 were dead-on-arrival
-- (0 messages, onboarding never completed, free plan, 0 subscriptions) and were
-- inflating GA4 + the signup tables so real-signup counts stopped being
-- readable.
--
-- The rule mirrors src/lib/utils/email-normalize.ts isGmailDotAbuse() EXACTLY:
--   domain in (gmail.com, googlemail.com) AND localpart (before any +tag) has
--   3+ dots. On every other domain a dot is a normal character (e.g.
--   first.last@company.com, yvette.ceragioli@gilead.com — a real human) so it is
--   never excluded. Verified against live data: excludes exactly the 11 bots,
--   keeps all 19 real accounts (Bailey, Kim, etc.).
--
-- Apply with: supabase db execute / psql against the project (MCP is read-only).

CREATE OR REPLACE VIEW ss_real_users AS
SELECT au.id AS user_id, au.email, au.created_at, au.last_sign_in_at
FROM auth.users au
WHERE NOT (
  lower(split_part(au.email, '@', 2)) IN ('gmail.com', 'googlemail.com')
  AND (
    length(split_part(split_part(au.email, '@', 1), '+', 1))
    - length(replace(split_part(split_part(au.email, '@', 1), '+', 1), '.', ''))
  ) >= 3
);

COMMENT ON VIEW ss_real_users IS
  'auth.users minus Gmail dot-abuse throwaway signups (localpart 3+ dots). Read this for real-signup counts. Mirrors email-normalize.ts. Added 2026-07-23.';
