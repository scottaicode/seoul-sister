-- Create bypass users for Seoul Sister Premium
-- These users can place orders without requiring active subscriptions

-- First, ensure the subscription fields exist in user_profiles
-- (This should already be done by the previous migration)

-- Insert admin user: baileydonmartin@gmail.com
INSERT INTO user_profiles (
  id,
  email,
  name,
  created_at,
  updated_at,
  subscription_status,
  bypass_subscription
) VALUES (
  'admin-bailey-bypass-001',
  'baileydonmartin@gmail.com',
  'Bailey Don Martin',
  NOW(),
  NOW(),
  'bypass_admin',
  true
) ON CONFLICT (email) DO UPDATE SET
  subscription_status = 'bypass_admin',
  bypass_subscription = true,
  updated_at = NOW();

-- Insert admin user: vibetrendai@gmail.com
INSERT INTO user_profiles (
  id,
  email,
  name,
  created_at,
  updated_at,
  subscription_status,
  bypass_subscription
) VALUES (
  'admin-vibetrend-bypass-002',
  'vibetrendai@gmail.com',
  'VibeTrend AI Admin',
  NOW(),
  NOW(),
  'bypass_admin',
  true
) ON CONFLICT (email) DO UPDATE SET
  subscription_status = 'bypass_admin',
  bypass_subscription = true,
  updated_at = NOW();

-- Insert test user: test@email.com
INSERT INTO user_profiles (
  id,
  email,
  name,
  created_at,
  updated_at,
  subscription_status,
  bypass_subscription
) VALUES (
  'test-user-bypass-003',
  'test@email.com',
  'Test User',
  NOW(),
  NOW(),
  'bypass_test',
  true
) ON CONFLICT (email) DO UPDATE SET
  subscription_status = 'bypass_test',
  bypass_subscription = true,
  updated_at = NOW();

-- Add bypass_subscription column if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bypass_subscription BOOLEAN DEFAULT false;

-- Create index for bypass lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_bypass ON user_profiles(bypass_subscription);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.bypass_subscription IS 'Allows user to bypass subscription requirements for orders';