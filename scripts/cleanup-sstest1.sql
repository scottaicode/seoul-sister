-- =====================================================================
-- Cleanup: remove the Jul 15 2026 smoke-test account
--   vibetrendai+sstest1@gmail.com
-- Run in the SEOUL SISTER Supabase (SQL editor), NOT LGAAS.
--
-- Safe by design: STEP 1 only READS (shows you exactly what exists).
-- Inspect it, confirm it's only the test row, THEN run STEP 2.
-- Everything is scoped to this one email / its auth user id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1 — INSPECT FIRST (read-only). Run this alone, read the output.
-- ---------------------------------------------------------------------
WITH u AS (
  SELECT id, email, created_at
  FROM auth.users
  WHERE email = 'vibetrendai+sstest1@gmail.com'
)
SELECT 'auth.users'        AS table_name, count(*) AS rows FROM u
UNION ALL SELECT 'ss_user_profiles',    count(*) FROM ss_user_profiles    WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'ss_yuri_conversations', count(*) FROM ss_yuri_conversations WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'ss_yuri_messages',    count(*) FROM ss_yuri_messages    WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'ss_onboarding_progress', count(*) FROM ss_onboarding_progress WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'ss_subscriptions',    count(*) FROM ss_subscriptions    WHERE user_id IN (SELECT id FROM u)
UNION ALL SELECT 'ss_nurture_leads (by email)', count(*) FROM ss_nurture_leads WHERE lower(email) = 'vibetrendai+sstest1@gmail.com';

-- Confirm the email above is EXACTLY the test address and the counts are small.
-- If anything looks wrong, STOP and do not run STEP 2.


-- ---------------------------------------------------------------------
-- STEP 2 — DELETE. Run only after STEP 1 looks correct.
-- Order matters (child rows before the auth user). Each delete is
-- scoped to the test user's id or the test email. Missing tables (if a
-- name differs in your schema) simply error harmlessly — comment out any
-- line that errors "relation does not exist" and re-run.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  test_uid uuid;
BEGIN
  SELECT id INTO test_uid FROM auth.users WHERE email = 'vibetrendai+sstest1@gmail.com';

  IF test_uid IS NULL THEN
    RAISE NOTICE 'No auth user for vibetrendai+sstest1@gmail.com — nothing to delete (email-capture row still cleaned below).';
  ELSE
    -- child rows keyed by user_id (mirror the app's account-delete order)
    DELETE FROM ss_reviews                 WHERE user_id = test_uid;
    DELETE FROM ss_yuri_messages           WHERE user_id = test_uid;
    DELETE FROM ss_yuri_conversations      WHERE user_id = test_uid;
    DELETE FROM ss_specialist_insights     WHERE user_id = test_uid;
    DELETE FROM ss_onboarding_progress     WHERE user_id = test_uid;
    DELETE FROM ss_routine_products        WHERE user_id = test_uid;
    DELETE FROM ss_user_routines           WHERE user_id = test_uid;
    DELETE FROM ss_user_scans              WHERE user_id = test_uid;
    DELETE FROM ss_user_wishlists          WHERE user_id = test_uid;
    DELETE FROM ss_user_product_reactions  WHERE user_id = test_uid;
    DELETE FROM ss_user_products           WHERE user_id = test_uid;
    DELETE FROM ss_user_product_tracking   WHERE user_id = test_uid;
    DELETE FROM ss_user_cycle_tracking     WHERE user_id = test_uid;
    DELETE FROM ss_glass_skin_scores       WHERE user_id = test_uid;
    DELETE FROM ss_counterfeit_reports     WHERE user_id = test_uid;
    DELETE FROM ss_counterfeit_scans       WHERE user_id = test_uid;
    DELETE FROM ss_user_dismissed_alerts   WHERE user_id = test_uid;
    DELETE FROM ss_routine_outcomes        WHERE user_id = test_uid;
    DELETE FROM ss_affiliate_clicks        WHERE user_id = test_uid;
    DELETE FROM ss_subscriptions           WHERE user_id = test_uid;
    DELETE FROM ss_user_profiles           WHERE user_id = test_uid;

    -- finally the auth user itself
    DELETE FROM auth.users WHERE id = test_uid;
    RAISE NOTICE 'Deleted test user % and all child rows.', test_uid;
  END IF;

  -- email-capture row (exists whether or not the account was created)
  DELETE FROM ss_nurture_leads WHERE lower(email) = 'vibetrendai+sstest1@gmail.com';
END $$;


-- ---------------------------------------------------------------------
-- STEP 3 — VERIFY (read-only). Re-run STEP 1's query; every count should
-- now be 0. If any table above errored on a wrong name, just delete from
-- that one by hand with the same WHERE clause.
-- ---------------------------------------------------------------------
