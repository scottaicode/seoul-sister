-- No-card 7-day trial (Nov 10 2026).
--
-- From Oct 30 the free trial needed a card. 29 accounts had reached the payment
-- page and about 1 paid; the one person who finished setup after Oct 30
-- declined the card and made a second account to ask for a routine. The trial
-- now starts with no card (Stripe `payment_method_collection: 'if_required'`)
-- and Stripe cancels it on day 7 unless a card was added.
--
-- ss_trial_starts is one row per trial ever started. It does two jobs:
--   1. "Trial started" becomes a row of its own, separate from PAID. A trial is
--      not a conversion: ss_widget_visitors.converted_user_id and the One
--      Metric are stamped only when money moves.
--   2. One trial per person that survives account deletion. The old rule keyed
--      on ss_subscriptions.user_id, which cascades away when an account is
--      deleted, so delete-and-re-register gave a fresh trial. This keys on the
--      canonical inbox (email-normalize.ts) and has no foreign key on purpose.
--
-- paid_at / lapsed_at close the loop on each trial: exactly one of them is set
-- when it ends. Both NULL = still running (or the webhook that ends it failed,
-- which the trial_end date makes visible).
-- Service role only: RLS on, no policies.

CREATE TABLE IF NOT EXISTS ss_trial_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_canonical text NOT NULL UNIQUE,
  user_id uuid,
  stripe_subscription_id text,
  card_required boolean NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_end timestamptz,
  card_added_at timestamptz,
  paid_at timestamptz,
  lapsed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ss_trial_starts_user_id_idx ON ss_trial_starts (user_id);
CREATE INDEX IF NOT EXISTS ss_trial_starts_subscription_idx ON ss_trial_starts (stripe_subscription_id);
ALTER TABLE ss_trial_starts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ss_trial_starts IS 'One row per free trial ever started, keyed on the canonical inbox so it survives account deletion. A trial is not a paid conversion.';
COMMENT ON COLUMN ss_trial_starts.card_required IS 'false = started with no card on file (Nov 10 2026 onward unless NO_CARD_TRIAL_ENABLED=false).';
COMMENT ON COLUMN ss_trial_starts.card_added_at IS 'When the member added a card during the trial (setup-mode Checkout). NULL = none added.';
COMMENT ON COLUMN ss_trial_starts.paid_at IS 'First real payment after the trial. NULL with lapsed_at NULL = trial still running.';
COMMENT ON COLUMN ss_trial_starts.lapsed_at IS 'Trial ended without becoming a paid subscription.';
