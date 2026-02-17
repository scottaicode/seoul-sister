-- Phase 7: Subscriptions & Monetization
-- ss_subscriptions, ss_subscription_events, ss_affiliate_clicks, plan column on ss_user_profiles

-- 1. Subscriptions table
CREATE TABLE IF NOT EXISTS ss_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro_monthly', 'pro_annual', 'student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(stripe_subscription_id)
);

-- 2. Subscription events table (webhook audit log)
CREATE TABLE IF NOT EXISTS ss_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES ss_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Affiliate clicks tracking
CREATE TABLE IF NOT EXISTS ss_affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES ss_products(id) ON DELETE SET NULL,
  retailer_id UUID REFERENCES ss_retailers(id) ON DELETE SET NULL,
  affiliate_url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add plan column to ss_user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ss_user_profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE ss_user_profiles ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
      CHECK (plan IN ('free', 'pro_monthly', 'pro_annual', 'student'));
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ss_subscriptions_user_id ON ss_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_subscriptions_stripe_customer ON ss_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_ss_subscriptions_status ON ss_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ss_subscription_events_subscription ON ss_subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_ss_subscription_events_stripe_event ON ss_subscription_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_ss_affiliate_clicks_user ON ss_affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_affiliate_clicks_product ON ss_affiliate_clicks(product_id);

-- 6. RLS policies
ALTER TABLE ss_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription"
  ON ss_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages subscriptions (webhooks)
CREATE POLICY "Service role manages subscriptions"
  ON ss_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Service role manages subscription events
CREATE POLICY "Service role manages subscription events"
  ON ss_subscription_events FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own affiliate clicks
CREATE POLICY "Users can read own affiliate clicks"
  ON ss_affiliate_clicks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own affiliate clicks
CREATE POLICY "Users can insert own affiliate clicks"
  ON ss_affiliate_clicks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role manages affiliate clicks
CREATE POLICY "Service role manages affiliate clicks"
  ON ss_affiliate_clicks FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION ss_update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ss_subscriptions_updated_at ON ss_subscriptions;
CREATE TRIGGER ss_subscriptions_updated_at
  BEFORE UPDATE ON ss_subscriptions
  FOR EACH ROW EXECUTE FUNCTION ss_update_subscription_timestamp();
