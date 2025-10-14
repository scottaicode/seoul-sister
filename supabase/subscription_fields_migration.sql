-- Add subscription fields to user_profiles table for Stripe subscriptions
-- Migration for Seoul Sister Premium Membership

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bypass_subscription BOOLEAN DEFAULT false;

-- Create indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status ON user_profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_end ON user_profiles(trial_end);
CREATE INDEX IF NOT EXISTS idx_user_profiles_bypass ON user_profiles(bypass_subscription);

-- Update existing user_profiles with stripe_customer_id if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- Comments for documentation
COMMENT ON COLUMN user_profiles.stripe_subscription_id IS 'Stripe subscription ID for premium membership';
COMMENT ON COLUMN user_profiles.subscription_status IS 'Stripe subscription status: active, trialing, past_due, canceled, etc.';
COMMENT ON COLUMN user_profiles.trial_end IS 'End date of the 7-day free trial';
COMMENT ON COLUMN user_profiles.current_period_start IS 'Current billing period start date';
COMMENT ON COLUMN user_profiles.current_period_end IS 'Current billing period end date';
COMMENT ON COLUMN user_profiles.cancel_at_period_end IS 'Whether subscription will cancel at period end';
COMMENT ON COLUMN user_profiles.bypass_subscription IS 'Allows user to bypass subscription requirements for orders';