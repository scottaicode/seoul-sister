-- Signup integrity: the Jul 21-26 2026 scripted-signup cohort (13 accounts).
--
-- Apply with: Supabase SQL Editor (MCP is read-only).
-- Verify with the SELECTs at the bottom; both must return the expected counts.
--
-- ============================================================================
-- WHY FLAG AND NOT DELETE (differs deliberately from delete_jul28_bot_signups.sql)
-- ============================================================================
-- The Jul 28 migration DELETED 4 accounts because all four were provably Tor-
-- origin spam-relay signups on harvested addresses. This cohort is NOT that
-- clean, so the disposition is different:
--
--   * 5 of 13 are Gmail dot-abuse (already excluded by the ss_real_users view,
--     added Jul 23) and are unambiguously synthetic.
--   * 8 of 13 are ordinary-looking addresses on aol/icloud/hotmail/gilead/
--     tmomail/setwright. The ss_real_users dot-rule CANNOT catch these.
--   * limyongxin03@gmail.com returned 8 HOURS after signup (28,784s), unlike
--     the other 12 whose last_sign_in_at is 0s after created_at. That is not a
--     bot signature. It is flagged for metrics but is the most likely real
--     human in the set — do not delete it.
--
-- Deleting would also destroy the evidence of the attack window and lose the
-- record of which addresses must never be mailed again. Flagging is reversible;
-- deletion is not.
--
-- ============================================================================
-- EVIDENCE THIS COHORT IS SYNTHETIC (verified against live data 2026-07-30)
-- ============================================================================
--   * All 13 created in one 6-day window, Jul 21-26. Zero signups since Jul 26.
--   * 0 user messages across all 13: 13 accounts -> 13 conversations -> 13 Yuri
--     greetings -> not one character of human input. Real humans vary; zero
--     variance across 13 accounts is a machine signature.
--   * 12 of 13 have last_sign_in_at exactly 0s after created_at.
--   * 0 subscriptions, 0 non-free plans, 0 routines, 0 scans, 0 glass-skin scores.
--
-- The v11.18.0 authenticated-Yuri outage was FALSIFIED as the cause: that bug's
-- fingerprint is USER messages with NO assistant reply (it threw before the
-- Anthropic call). Here it is the exact inverse - 1 assistant greeting, 0 user
-- messages. Yuri worked; nobody typed.
--
-- Root cause is closed: Cloudflare Turnstile + Supabase Bot-and-Abuse shipped
-- Jul 28. Verified live 2026-07-30 - a tokenless POST /auth/v1/signup returns
-- 400 captcha_failed. This cohort predates that gate.
--
-- ============================================================================
-- PART 1 IS THE URGENT PART: STOP MAILING THEM
-- ============================================================================
-- All 13 are enrolled in ss_nurture_leads with suppressed = false, and mail was
-- sent as recently as 2026-07-29 16:00 UTC. This is the SAME defect the Jul 28
-- migration called out ("nurture runs on Resend and never consulted auth state")
-- - that fix deleted its own 4 rows but nothing swept THIS cohort. The cron is
-- `0 16 * * 2-4` (Tue/Wed/Thu 16:00 UTC), so absent this migration these
-- addresses - several of which appear to belong to real people who never signed
-- up - get mailed again on the next tick. Sending unsolicited mail to harvested
-- addresses is also precisely what damages the sender reputation that the
-- pending SPF/DKIM/DMARC work exists to protect.

BEGIN;

-- Pin exact user ids so a later legitimate signup reusing one of these
-- addresses is never caught by this script.
DROP TABLE IF EXISTS _jul21_bot_ids;
CREATE TEMP TABLE _jul21_bot_ids (id uuid, email text);
INSERT INTO _jul21_bot_ids (id, email) VALUES
  ('cd711f62-e586-4c09-b9d8-a7d595d06b46', 'aza.mu.he.c.o.gi.0.0.2@gmail.com'),
  ('badea12d-ea09-4dbd-a0b4-7d46334fc1be', 'arronkh@aol.com'),
  ('e1909efc-36c1-4e78-9f1a-22c0c87198e8', 'natalielewis@icloud.com'),
  ('dcdabdaa-05c8-4622-944b-d51b63cb5b73', 'limyongxin03@gmail.com'),
  ('5bfae82c-dcbe-48d8-b410-b319c67fc148', 'he.y.m.a.nt.a.e.l.o.r2.704@gmail.com'),
  ('31f8d982-b4f5-4113-abda-1bfccc5f1b92', 'ha.van.naji.l.l.ene@gmail.com'),
  ('2538a5a6-d3ea-425c-a826-f92518deb0cd', 'j.w.i.l.lbr.98@gmail.com'),
  ('3dc10a3c-3b9a-4dbb-9d1a-67e250f9ed25', 't.ani.s.ha.z.d.o.ssa@gmail.com'),
  ('e86ba4bd-0376-42f7-9e41-d67879d94e20', 'yvette.ceragioli@gilead.com'),
  ('157ff8c6-6c99-4470-a0e9-0c27e4592e26', '2404988533@tmomail.net'),
  ('9bb785e3-4926-453a-9af0-73caa6f8769a', 'bnlselix@hotmail.com'),
  ('ffeb238a-15a2-4013-a489-d3c28473747a', 'rells@setwright.com'),
  ('000e01c7-e5c1-40aa-9bd9-f0c37418361f', 'jeffreywhited@hotmail.com');

-- Safety interlock: abort loudly rather than touch a real customer. Mirrors the
-- Jul 28 migration's interlock. Cheaper to fail than to suppress a paying user.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM _jul21_bot_ids b
  WHERE EXISTS (SELECT 1 FROM ss_subscriptions s WHERE s.user_id::text = b.id::text)
     OR EXISTS (
       SELECT 1 FROM ss_yuri_messages m
       JOIN ss_yuri_conversations c ON c.id::text = m.conversation_id::text
       WHERE c.user_id::text = b.id::text AND m.role = 'user'
     );
  IF bad > 0 THEN
    RAISE EXCEPTION 'ABORT: % targeted account(s) have a subscription or real user messages', bad;
  END IF;
END $$;

-- PART 1 - stop the mail. Guarded on suppressed = false so re-running is a no-op.
UPDATE ss_nurture_leads n
SET suppressed = true,
    suppressed_reason = 'bot_signup_jul21_26',
    updated_at = now()
FROM _jul21_bot_ids b
WHERE (n.user_id::text = b.id::text OR n.email = b.email)
  AND n.suppressed = false;

-- PART 2 - remove them from every funnel denominator.
-- Default false so existing and future rows are unaffected; only an explicit
-- update opts a row out. Complements the ss_real_users view, which catches only
-- Gmail dot-abuse (5 of these 13) and cannot see the other 8.
ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS excluded_from_metrics boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ss_user_profiles.excluded_from_metrics IS
  'True = synthetic/bot/test account. MUST be filtered out of funnel, conversion '
  'and retention metrics, and MUST NOT be sent marketing or nurture email. Set '
  '2026-07-30 for the 13 bot signups of Jul 21-26. Complements the ss_real_users '
  'view (Gmail-dot-abuse only). See scripts/migrations/flag_jul21_26_bot_signups.sql.';

-- Partial index: the flagged set is tiny and every read is "exclude these".
CREATE INDEX IF NOT EXISTS idx_ss_user_profiles_excluded_from_metrics
  ON ss_user_profiles (user_id) WHERE excluded_from_metrics;

UPDATE ss_user_profiles p
SET excluded_from_metrics = true
FROM _jul21_bot_ids b
WHERE p.user_id::text = b.id::text
  AND p.excluded_from_metrics = false;

COMMIT;

DROP TABLE IF EXISTS _jul21_bot_ids;

-- ============================================================================
-- VERIFICATION - run separately, AFTER the block above.
-- ============================================================================
-- These deliberately do NOT reference _jul21_bot_ids. The Supabase SQL Editor
-- runs statements in their own session, so the temp table is already gone by
-- the time these execute and any reference raises
--   42P01: relation "_jul21_bot_ids" does not exist
-- which LOOKS like the migration failed when in fact every write committed.
-- (Hit for real on the first run, 2026-07-30 - the same trap
-- delete_jul28_bot_signups.sql documented at its own line 32. Anchoring on the
-- durable suppressed_reason / excluded_from_metrics values instead makes these
-- re-runnable at any time.)

-- (1) Expect 13 rows, every one suppressed = true.
SELECT n.email, n.suppressed, n.suppressed_reason, n.sequence_step
FROM ss_nurture_leads n
WHERE n.suppressed_reason = 'bot_signup_jul21_26'
ORDER BY n.email;

-- (2) Expect column_exists = 1, profiles_flagged = 13, nurture_suppressed = 13.
SELECT
 (SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'ss_user_profiles'
     AND column_name = 'excluded_from_metrics')                       AS column_exists,
 (SELECT count(*) FROM ss_user_profiles WHERE excluded_from_metrics)  AS profiles_flagged,
 (SELECT count(*) FROM ss_nurture_leads
   WHERE suppressed_reason = 'bot_signup_jul21_26')                   AS nurture_suppressed;

-- (3) Safety re-check. BOTH must be 0 - no flagged account has money or a real
--     human message behind it.
SELECT
 (SELECT count(*) FROM ss_user_profiles p
    JOIN ss_subscriptions s ON s.user_id = p.user_id
   WHERE p.excluded_from_metrics)                     AS flagged_with_subscription,
 (SELECT count(*) FROM ss_yuri_messages m
    JOIN ss_yuri_conversations c ON c.id = m.conversation_id
    JOIN ss_user_profiles p ON p.user_id = c.user_id
   WHERE p.excluded_from_metrics AND m.role = 'user') AS flagged_with_real_messages;

-- RESULT (applied 2026-07-30): column created; 13 profiles flagged; 13 nurture
-- leads suppressed; 0 with a subscription; 0 with real user messages. 21
-- legitimate leads remain mailable. The 42P01 seen on the first run was the
-- verification block only - all writes had already committed.

-- ============================================================================
-- FOLLOW-UP (not done here - separate concerns, each needs its own decision)
-- ============================================================================
-- 1. The nurture enrollment path should consult excluded_from_metrics (or an
--    auth-state check) at SEND time. This migration suppresses the 13 rows that
--    exist; it does not stop a future bot cohort from being enrolled. The
--    Turnstile gate makes that much less likely but is not the same guarantee.
-- 2. Analytics/funnel queries should read ss_real_users AND filter
--    excluded_from_metrics. Neither alone covers this cohort.
-- 3. limyongxin03@gmail.com may be a real person (returned 8h later). If they
--    ever engage, clear both flags rather than deleting the account.
