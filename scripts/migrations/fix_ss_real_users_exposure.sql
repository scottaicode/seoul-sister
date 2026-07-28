-- Fix: ss_real_users leaked every user's email to the `anon` role.
-- Added 2026-07-28. Closes a live, verified data exposure.
--
-- WHAT WAS WRONG
-- The Jul 23 analytics helper view (create_ss_real_users_view.sql) selects
-- `email` straight out of auth.users. Two Postgres defaults combined badly:
--   1. A view created by `postgres` runs SECURITY DEFINER by default, so it
--      reads auth.users with the OWNER's rights, not the caller's. RLS and the
--      auth-schema lockdown that normally protect auth.users are bypassed.
--   2. Supabase grants SELECT on public-schema objects to `anon`/`authenticated`
--      by default, and PostgREST exposes anything in `public` over the REST API.
-- Net effect: `GET /rest/v1/ss_real_users?select=email` with the PUBLISHABLE
-- anon key returned real subscriber emails. Verified live against production on
-- 2026-07-28 (HTTP 200, 3 rows, real addresses) before this fix. The anon key
-- ships in the browser bundle by design, so this was open to anyone.
-- Both Supabase advisors fired on it: `auth_users_exposed` (ERROR) and
-- `security_definer_view` (ERROR).
--
-- THE FIX (defense in depth — either layer alone would close it)
--   1. security_invoker = on  → the view runs with the CALLER's permissions, so
--      `anon` hits the auth.users lockdown and gets nothing.
--   2. REVOKE from anon/authenticated → the view isn't reachable over PostgREST
--      at all. Only the service role (server-side, never in the browser) reads it.
-- The view's PURPOSE is owner-facing signup analytics, so service-role-only is
-- the correct access level, not a downgrade.
--
-- NOT CHANGED: the row-filter logic is untouched and still mirrors
-- src/lib/utils/email-normalize.ts isGmailDotAbuse() exactly. This migration is
-- purely about WHO can read the view, not WHICH rows it returns.
--
-- Apply with: supabase db execute / psql against the project (MCP is read-only).

-- 1. Re-declare the view with security_invoker so it stops running as owner.
--    (CREATE OR REPLACE preserves the definition; we restate it in full so this
--    file is self-contained and the reader can see exactly what is exposed.)
CREATE OR REPLACE VIEW ss_real_users
WITH (security_invoker = on) AS
SELECT au.id AS user_id, au.email, au.created_at, au.last_sign_in_at
FROM auth.users au
WHERE NOT (
  lower(split_part(au.email, '@', 2)) IN ('gmail.com', 'googlemail.com')
  AND (
    length(split_part(split_part(au.email, '@', 1), '+', 1))
    - length(replace(split_part(split_part(au.email, '@', 1), '+', 1), '.', ''))
  ) >= 3
);

-- 2. Take the view off the public REST surface entirely.
REVOKE ALL ON ss_real_users FROM anon;
REVOKE ALL ON ss_real_users FROM authenticated;
GRANT SELECT ON ss_real_users TO service_role;

COMMENT ON VIEW ss_real_users IS
  'auth.users minus Gmail dot-abuse throwaway signups (localpart 3+ dots). Read this for real-signup counts. Mirrors email-normalize.ts. Added 2026-07-23. SERVICE-ROLE ONLY + security_invoker since 2026-07-28 — it exposes user emails and was readable by anon over PostgREST (see fix_ss_real_users_exposure.sql). Never re-grant to anon/authenticated.';
