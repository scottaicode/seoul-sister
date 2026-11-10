-- When Stripe created the subscription on file (Nov 10 2026).
--
-- ss_subscriptions holds ONE row per user. With a free trial that can lapse
-- and be followed by a paid subscription, events for two different Stripe
-- subscriptions now arrive for the same row, and Stripe does not guarantee
-- their order. Knowing which subscription is newer is the only exact way to
-- drop a late event about the old one (isStaleSubscriptionEvent in
-- src/lib/trial.ts). NULL on rows written before this; those fall back to a
-- status rule.
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS stripe_created_at timestamptz;
COMMENT ON COLUMN ss_subscriptions.stripe_created_at IS 'Stripe''s creation time of the subscription this row currently describes. Used to ignore late events about an older subscription.';
