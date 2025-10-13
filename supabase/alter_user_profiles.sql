-- Add missing columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS name VARCHAR(255);