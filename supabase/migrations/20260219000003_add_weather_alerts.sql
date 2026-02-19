-- Feature 8.10: Weather-Adaptive Routine Alerts
-- Add location and weather preference columns to ss_user_profiles

ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS weather_alerts_enabled BOOLEAN DEFAULT FALSE;

-- Index for finding users with weather alerts enabled (for future cron push notifications)
CREATE INDEX IF NOT EXISTS idx_user_profiles_weather_enabled
  ON ss_user_profiles(user_id) WHERE weather_alerts_enabled = TRUE;
