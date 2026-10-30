-- Pricing relaunch, Phase A (Oct 30 2026): record what we need to MEASURE
-- trials and the landing email gate before any price changes.
--
-- ss_subscriptions.stripe_price_id: which Stripe price the subscriber is on, so
--   plan mix (and the one grandfathered "unlimited" subscriber) is readable from
--   data instead of inferred.
-- ss_subscriptions.trial_end: when a free trial ends; NULL = no trial.
-- ss_widget_visitors.email_gate_shown_at: first time the landing chat asked this
--   visitor for an email to continue. Without it the gate's pass rate (shown vs
--   gave an email) is only visible in GA4.
-- All additive and nullable.

ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz;
ALTER TABLE ss_widget_visitors ADD COLUMN IF NOT EXISTS email_gate_shown_at timestamptz;

COMMENT ON COLUMN ss_subscriptions.stripe_price_id IS 'Stripe price id of the subscription item. NULL on rows written before Oct 30 2026.';
COMMENT ON COLUMN ss_subscriptions.trial_end IS 'End of the Stripe free trial, if any. NULL = no trial.';
COMMENT ON COLUMN ss_widget_visitors.email_gate_shown_at IS 'First time the landing chat required an email to continue. Measures the gate pass rate.';
