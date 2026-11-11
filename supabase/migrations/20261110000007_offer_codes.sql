-- Creator offer codes (Nov 10 2026). First use: code BAILEY, 50% off the first
-- paid month for the first 50 people (Stripe enforces the cap).
--
-- These columns make "N people used Bailey's code, M started a trial, K paid"
-- readable from our own data:
--   ss_trial_starts.offer_code / offer_percent_off : the code a trial started
--     with, and its discount (so every later notice about what a card will be
--     charged can state it without asking Stripe again). paid_at on the same
--     row says whether that trial became a paying member.
--   ss_subscriptions.offer_code : the code on the subscription, including for
--     someone who joined with no trial.
-- NULL = no code. All additive.
ALTER TABLE ss_trial_starts ADD COLUMN IF NOT EXISTS offer_code text;
ALTER TABLE ss_trial_starts ADD COLUMN IF NOT EXISTS offer_percent_off numeric;
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS offer_code text;
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS offer_percent_off numeric;
CREATE INDEX IF NOT EXISTS ss_trial_starts_offer_code_idx ON ss_trial_starts (offer_code) WHERE offer_code IS NOT NULL;
COMMENT ON COLUMN ss_trial_starts.offer_code IS 'Creator code the trial started with (e.g. BAILEY). NULL = none.';
COMMENT ON COLUMN ss_trial_starts.offer_percent_off IS 'Percent off the first paid month that code carried when the trial started.';
COMMENT ON COLUMN ss_subscriptions.offer_code IS 'Creator code on the current subscription. NULL = none.';
COMMENT ON COLUMN ss_subscriptions.offer_percent_off IS 'Percent off the first paid month for that code.';
