-- Add admin role to user profiles
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Add is_admin column (defaults to false for all existing users)
ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
  ON ss_user_profiles(user_id) WHERE is_admin = TRUE;

-- Set vibetrendai@gmail.com as admin
-- (finds their user_id from auth.users and updates ss_user_profiles)
UPDATE ss_user_profiles
SET is_admin = TRUE
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'vibetrendai@gmail.com' LIMIT 1
);

-- Verify: should show 1 row with is_admin = true
SELECT up.user_id, au.email, up.is_admin
FROM ss_user_profiles up
JOIN auth.users au ON au.id = up.user_id
WHERE up.is_admin = TRUE;
