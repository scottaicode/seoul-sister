-- Funnel repair (Nov 10 2026): record the steps between the free chat and a
-- card that had no row.
--
-- Measured before this: 148 people had chatted in the landing preview, 13 used
-- all 12 messages, 10 of those left an email, and no step between "chatted" and
-- "paid" was visible in data except paywall_reached_at. The only sign-up link
-- inside the chat appeared at 12 of 12 messages.
--
-- ss_widget_visitors.register_clicked_at: first time this visitor clicked a
--   sign-up link inside the chat. NULL = never clicked (not "click lost": the
--   click endpoint writes a console error on failure).
-- ss_widget_visitors.register_click_messages: how many messages they had sent
--   when they first clicked.
-- ss_widget_visitors.registered_user_id / registered_at: the account that
--   confirmed this preview was theirs during onboarding. Deliberately separate
--   from converted_user_id, which means PAID and feeds the One Metric.
-- ss_user_profiles.checkout_clicked_at: first time they pressed the paywall
--   button and the server started a Stripe checkout. Until now this was GA4
--   only, which is bot-inflated.
-- All additive and nullable.

ALTER TABLE ss_widget_visitors ADD COLUMN IF NOT EXISTS register_clicked_at timestamptz;
ALTER TABLE ss_widget_visitors ADD COLUMN IF NOT EXISTS register_click_messages integer;
ALTER TABLE ss_widget_visitors ADD COLUMN IF NOT EXISTS registered_user_id uuid;
ALTER TABLE ss_widget_visitors ADD COLUMN IF NOT EXISTS registered_at timestamptz;
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS checkout_clicked_at timestamptz;

COMMENT ON COLUMN ss_widget_visitors.register_clicked_at IS 'First click on a sign-up link inside the landing chat. NULL = never clicked.';
COMMENT ON COLUMN ss_widget_visitors.register_click_messages IS 'Messages sent by the visitor at the time of that first click.';
COMMENT ON COLUMN ss_widget_visitors.registered_user_id IS 'Account that confirmed this preview as theirs in onboarding. Not a payment: see converted_user_id for paid.';
COMMENT ON COLUMN ss_widget_visitors.registered_at IS 'When registered_user_id was set.';
COMMENT ON COLUMN ss_user_profiles.checkout_clicked_at IS 'First time the server started a Stripe checkout for this user (paywall button pressed).';
