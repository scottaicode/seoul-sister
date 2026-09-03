-- Backfill the ONLY complete widget -> registration -> paid conversion on record.
--
-- Apply with: Supabase SQL Editor (MCP is read-only).
--
-- ============================================================================
-- WHY THIS ROW READS AS ZERO TODAY
-- ============================================================================
-- Kim Wells talked to Yuri on the anonymous widget under ONE email and then
-- registered and paid under a DIFFERENT one. The conversion join is keyed on
-- email, so both widget rows have converted_at = NULL and the funnel records a
-- real, paid, same-day conversion as nothing at all.
--
--   widget visitor  1b6e969b-e98d-477e-ae14-d5690bb2c255  14 msgs, from 2026-05-17
--   widget visitor  4848fbee-a2cc-407c-93dd-74d1a911485a  12 msgs, 2026-07-21
--     both captured_email = lrwells2013@gmail.com
--   auth user       fe464145-bd26-4972-aa0f-56396e84f6f5  kimwells112192@gmail.com
--     Stripe cus_UvXTLPULjLdlVX / sub_1TvgP0E3bY1JvxExQ3yz64gS, tier pro, ACTIVE
--
-- Same-day timeline (2026-07-21, verified):
--   02:40  last of 12 widget messages
--   13:55  account created (different address)
--   16:20  paid $24.99  -> under 14 hours end to end
--
-- ============================================================================
-- IDENTITY EVIDENCE (why these two addresses are one person)
-- ============================================================================
-- Stated by the owner: Kim Wells is Lynndon's mother (Lynndon is Bailey's
-- partner). Corroborated in data: the widget transcript is an Austin-TX oily-skin
-- routine consult ending 02:40, and the paid account is created the same morning;
-- no other user matches that profile; the surname matches both addresses
-- (lrwells2013 / kimwells112192).
--
-- NOTE ON CLASSIFICATION - do not overstate this in any metric:
-- Kim is a REAL PAYING SUBSCRIBER (genuine Stripe revenue, not a comp), but she
-- is NOT a cold stranger - she is family-adjacent and arrived warm. The North
-- Star gate is specifically "will a STRANGER pay." That gate is still unmet.
-- Backfilling this makes the funnel truthful; it does not clear the gate.
--
-- ============================================================================
-- WHAT THIS DOES NOT DO
-- ============================================================================
-- It does not build automatic cross-email identity stitching. n=1 does not
-- justify that build. It corrects one row set so the recorded history is honest.
-- If a SECOND person does this, revisit - two occurrences is a pattern and the
-- measurement gap becomes worth closing properly.

BEGIN;

-- Guard: only proceed if the paid account genuinely exists and is active.
-- Fails loudly rather than writing a conversion that isn't real.
DO $$
DECLARE ok int;
BEGIN
  SELECT count(*) INTO ok
  FROM ss_subscriptions s
  WHERE s.user_id = 'fe464145-bd26-4972-aa0f-56396e84f6f5'
    AND s.status = 'active';
  IF ok <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 active subscription for the target user, found %', ok;
  END IF;
END $$;

-- Attribute BOTH widget visitor rows to the paid account. Both are hers; the
-- May session is the same person returning, which is itself the retention
-- signal worth preserving. Guarded on converted_at IS NULL so re-running is a
-- no-op and never overwrites a real later conversion timestamp.
UPDATE ss_widget_visitors
SET converted_at      = '2026-07-21 16:20:31+00',  -- Stripe subscription created
    converted_user_id = 'fe464145-bd26-4972-aa0f-56396e84f6f5'
WHERE visitor_id IN (
  '1b6e969b-e98d-477e-ae14-d5690bb2c255',
  '4848fbee-a2cc-407c-93dd-74d1a911485a'
)
AND converted_at IS NULL;

-- Suppress her from the nurture sequence. She is a PAYING SUBSCRIBER and was
-- still enrolled at step 2, i.e. queued to receive "come try Seoul Sister"
-- marketing. Guarded so re-running is a no-op.
UPDATE ss_nurture_leads
SET suppressed = true,
    suppressed_reason = 'converted',
    updated_at = now()
WHERE (email IN ('lrwells2013@gmail.com', 'kimwells112192@gmail.com')
       OR user_id = 'fe464145-bd26-4972-aa0f-56396e84f6f5')
  AND suppressed = false;

COMMIT;

-- ============================================================================
-- VERIFICATION - run separately, AFTER the block above.
-- Deliberately references no temp table (see flag_jul21_26_bot_signups.sql for
-- why: the SQL Editor runs statements in separate sessions).
-- ============================================================================

-- (1) Expect 2 rows, both with converted_at set and the same converted_user_id.
SELECT captured_email, visitor_id, total_messages,
       first_seen_at::date AS first_seen, converted_at, converted_user_id
FROM ss_widget_visitors
WHERE converted_user_id = 'fe464145-bd26-4972-aa0f-56396e84f6f5'
ORDER BY first_seen_at;

-- (2) Expect every row suppressed = true.
SELECT email, suppressed, suppressed_reason
FROM ss_nurture_leads
WHERE email IN ('lrwells2013@gmail.com', 'kimwells112192@gmail.com');

-- (3) Funnel truth after backfill. widget_conversions should now be 1.
SELECT
 (SELECT count(*) FROM ss_widget_visitors WHERE total_messages > 0)        AS visitors_ever_messaged,
 (SELECT count(*) FROM ss_widget_visitors WHERE captured_email IS NOT NULL) AS emails_captured,
 (SELECT count(*) FROM ss_widget_visitors WHERE converted_at IS NOT NULL)   AS widget_conversions,
 (SELECT count(*) FROM ss_subscriptions WHERE status = 'active')            AS active_subscriptions;
