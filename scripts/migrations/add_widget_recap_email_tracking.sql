-- Migration: lead-email send/delivery observability (July 15 2026)
--
-- The DB previously recorded only that a recap email was CAPTURED
-- (captured_email / email_captured_at on ss_widget_visitors), never whether
-- the recap actually SENT or DELIVERED. Answering "did this lead get their
-- email?" required ss_ai_usage archaeology or a Resend dashboard login, and
-- bounces were completely invisible. These columns persist the send outcome
-- plus provider delivery events, making the whole capture->send->deliver
-- lifecycle a one-line query.
--
-- recap_status lifecycle:
--   suppressed         -- Yuri judged no send warranted (should_send=false)
--   not_their_address  -- Yuri judged the address wasn't the visitor's own
--   sent               -- accepted by Resend for delivery
--   send_failed        -- Resend rejected / transport error
--   delivered          -- Resend delivery webhook confirmed inbox delivery
--   bounced            -- Resend bounce webhook (hard/soft bounce)
--   complained         -- recipient marked the email as spam
--
-- Transport/observability ONLY — no AI judgment lives in these columns. The
-- consent (should_send) and ownership (address_is_visitors_own) judgments stay
-- with Yuri in lib/email/lead-email.ts; we only record the RESULT of them.
--
-- Apply via Supabase SQL editor or `psql`. The application code tolerates
-- these columns being absent until applied (same defensive pattern as
-- ss_widget_visitors.captured_email — see recordRecapStatus in lib/widget/visitor.ts).

ALTER TABLE ss_widget_visitors
  ADD COLUMN IF NOT EXISTS recap_status text,
  ADD COLUMN IF NOT EXISTS recap_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recap_provider_id text,
  ADD COLUMN IF NOT EXISTS recap_status_updated_at timestamptz;

-- Webhook events map back to the visitor by the Resend message id.
CREATE INDEX IF NOT EXISTS idx_ss_widget_visitors_recap_provider_id
  ON ss_widget_visitors (recap_provider_id)
  WHERE recap_provider_id IS NOT NULL;

-- Operational queries filter by status ("how many bounced this week").
CREATE INDEX IF NOT EXISTS idx_ss_widget_visitors_recap_status
  ON ss_widget_visitors (recap_status)
  WHERE recap_status IS NOT NULL;

COMMENT ON COLUMN ss_widget_visitors.recap_status IS
  'Lead recap email outcome: suppressed|not_their_address|sent|send_failed|delivered|bounced|complained. Transport/observability, not AI judgment.';
COMMENT ON COLUMN ss_widget_visitors.recap_provider_id IS
  'Resend message id — ties a later delivery/bounce webhook event back to this visitor.';

-- Backfill today's two known captures from confirmed ss_ai_usage breadcrumbs
-- (both had a content_generation send fire ~9s after capture). Marked 'sent',
-- NOT 'delivered' — delivery is left to the webhook / manual Resend check so we
-- never fabricate a delivery status we haven't observed.
UPDATE ss_widget_visitors
  SET recap_status = 'sent',
      recap_sent_at = email_captured_at,
      recap_status_updated_at = now()
  WHERE captured_email IN ('meyer.greg.pro@gmail.com', 'vibetrendai+sstest1@gmail.com')
    AND recap_status IS NULL;

-- Read-backs once data accumulates:
--   -- Did a specific lead get their email?
--   SELECT captured_email, recap_status, recap_sent_at, recap_status_updated_at
--   FROM ss_widget_visitors WHERE captured_email = 'someone@example.com';
--
--   -- Recap health over the last 7 days:
--   SELECT recap_status, count(*)
--   FROM ss_widget_visitors
--   WHERE email_captured_at > now() - interval '7 days'
--   GROUP BY recap_status ORDER BY count(*) DESC;
