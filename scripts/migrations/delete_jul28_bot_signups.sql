-- Delete the 4 bot accounts from the Jul 27-28 2026 spam-relay attack.
--
-- WHO THESE ARE
-- Four signups from Tor exit nodes (185.220.101.14, 185.220.101.53,
-- 171.25.193.78) that registered as HARVESTED VICTIM addresses, waited ~60s,
-- then fired three /recover calls in 15 seconds from a different range
-- (45.84.107.x) to make seoulsister.com mail those victims. All 12 recovery
-- attempts were blocked (429 over_email_send_rate_limit) and every
-- confirmation_sent_at / recovery_sent_at is NULL — no mail ever went out.
-- Full account in CHANGELOG v11.13.0.
--
-- The emails belong to real people who never signed up for anything. Deleting
-- the rows is the correct disposition: we hold data on strangers who never
-- consented and never used the product.
--
-- WHY IT IS SAFE (verified against live data 2026-07-28 before writing this):
--   user_msgs = 0   — not one of them ever replied to Yuri's greeting
--   subs      = 0   — no subscription, no Stripe customer, no revenue impact
-- Each has exactly 1 auto-created profile, 1 empty onboarding conversation
-- (Yuri's opening line only), and 1 onboarding_progress row.
--
-- ORDER MATTERS: children before parents. ss_yuri_messages references
-- ss_yuri_conversations, which references the user. auth.users last.
--
-- Apply with: Supabase SQL Editor (MCP is read-only).
-- Verify after: the SELECT at the bottom must return 0 rows.

BEGIN;

-- Pin the exact 4 ids so a later signup reusing one of these addresses is
-- never caught by this script.
-- NOT `ON COMMIT DROP`: the verification SELECT at the bottom runs AFTER
-- COMMIT, and dropping the temp table at commit made that final query fail
-- with `relation "_bot_ids" does not exist` — which reads like the migration
-- failed when in fact every DELETE had already succeeded. Dropped explicitly
-- at the end instead. (Hit for real on the first run, 2026-07-28.)
DROP TABLE IF EXISTS _bot_ids;
CREATE TEMP TABLE _bot_ids (id uuid);
INSERT INTO _bot_ids (id) VALUES
  ('a78d3acc-b94c-4fc6-91a2-ecc02065c0b5'),  -- allaboutmom2@icloud.com
  ('617ad864-cd7b-4b27-b51d-69729f20b973'),  -- gsdhil.lon6.9@gmail.com
  ('9b9e5cc5-2fbf-4e5b-b6b0-5a043b5d81af'),  -- tmartin@locumtenens.com
  ('5e818022-19a4-4fd2-af8f-09b11003861c');  -- sheliaashcraft79@yahoo.com

-- Safety interlock: abort if any of these somehow has real activity or money.
-- Cheaper to fail loudly than to delete a customer.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM _bot_ids b
  WHERE EXISTS (SELECT 1 FROM ss_subscriptions s WHERE s.user_id::text = b.id::text)
     OR EXISTS (
       SELECT 1 FROM ss_yuri_messages m
       JOIN ss_yuri_conversations c ON c.id::text = m.conversation_id::text
       WHERE c.user_id::text = b.id::text AND m.role = 'user'
     );
  IF bad > 0 THEN
    RAISE EXCEPTION 'ABORT: % of the targeted accounts has a subscription or real user messages', bad;
  END IF;
END $$;

-- Nurture enrollment FIRST. This is the path that actually reached the
-- victims: the registered-cohort sequence enrolled 3 of the 4 bot accounts and
-- sent them a Yuri nurture email at 2026-07-28 16:01 UTC. Supabase Auth mail
-- was fully blocked, but nurture runs on Resend and never consulted auth
-- state — so leaving these rows means the victims keep receiving mail on the
-- next cron tick. Delete before the parent rows so nothing is orphaned.
DELETE FROM ss_nurture_leads
WHERE user_id::text IN (SELECT id::text FROM _bot_ids)
   OR email IN ('allaboutmom2@icloud.com','gsdhil.lon6.9@gmail.com',
                'tmartin@locumtenens.com','sheliaashcraft79@yahoo.com');

DELETE FROM ss_yuri_messages
WHERE conversation_id::text IN (
  SELECT c.id::text FROM ss_yuri_conversations c
  JOIN _bot_ids b ON c.user_id::text = b.id::text
);

DELETE FROM ss_yuri_conversations
WHERE user_id::text IN (SELECT id::text FROM _bot_ids);

DELETE FROM ss_onboarding_progress
WHERE user_id::text IN (SELECT id::text FROM _bot_ids);

DELETE FROM ss_user_profiles
WHERE user_id::text IN (SELECT id::text FROM _bot_ids);

DELETE FROM auth.users
WHERE id IN (SELECT id FROM _bot_ids);

COMMIT;

-- Verification — must return 0 rows from BOTH tables.
SELECT 'auth.users' AS src, email FROM auth.users
WHERE email IN ('allaboutmom2@icloud.com','gsdhil.lon6.9@gmail.com',
                'tmartin@locumtenens.com','sheliaashcraft79@yahoo.com')
UNION ALL
SELECT 'ss_nurture_leads', email FROM ss_nurture_leads
WHERE email IN ('allaboutmom2@icloud.com','gsdhil.lon6.9@gmail.com',
                'tmartin@locumtenens.com','sheliaashcraft79@yahoo.com');

DROP TABLE IF EXISTS _bot_ids;

-- RESULT (applied 2026-07-28): all 4 accounts and their satellite rows gone,
-- 0 orphaned messages, users 41 -> 37. The 2 active subscriptions were
-- untouched (one is Kim Wells, one is Scott's own glassskinatx persona).
