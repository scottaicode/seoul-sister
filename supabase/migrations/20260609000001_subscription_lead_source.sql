-- ============================================================
-- v10.13.2 — Subscription lead-source attribution
-- Records WHERE a paying subscriber came from, so we can read
-- visitor->paid conversion by source (the One Metric, per NORTH-STAR.md).
-- Additive, nullable, no CHECK (avoids silent-constraint bug class).
-- Companion to the already-applied ss_widget_visitors attribution columns
-- (converted_at / converted_user_id from 20260310000001) which the Stripe
-- webhook now populates by matching the new subscriber's email against
-- ss_widget_visitors.captured_email.
-- ============================================================

ALTER TABLE ss_subscriptions
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Index for the conversion-by-source breakdown query.
CREATE INDEX IF NOT EXISTS idx_subscriptions_lead_source
  ON ss_subscriptions (lead_source)
  WHERE lead_source IS NOT NULL;
