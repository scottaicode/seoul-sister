-- Feature 11.3: Location Capture During Onboarding
-- Add location_text column to ss_user_profiles for storing
-- user-stated location (e.g., "Austin, Texas") from onboarding conversation

ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS location_text TEXT;

-- Optional index for future geographic queries
CREATE INDEX IF NOT EXISTS idx_profiles_location_text
  ON ss_user_profiles(location_text) WHERE location_text IS NOT NULL;
