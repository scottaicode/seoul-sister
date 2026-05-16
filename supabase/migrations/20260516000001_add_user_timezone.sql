-- Add IANA timezone column to user profiles for accurate date/weekday handling.
-- Required so Yuri's "Today is..." injection reflects the user's local clock,
-- not Vercel server UTC. Bailey hit this on May 4 2026 when she messaged at
-- 10:01 PM Austin time (Sun May 3 locally) but server saw Mon May 4 UTC and
-- told her "tomorrow is Tuesday May 5" -- wrong from her perspective.
--
-- Pattern: IANA tz strings (e.g. 'America/Chicago'). Nullable; null falls back
-- to UTC at the application layer. Pattern adopted from LGAAS clients.timezone
-- column which has been working in production.
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Backfill known users from their location_text
UPDATE ss_user_profiles SET timezone = 'America/Chicago'
  WHERE location_text = 'Austin, Texas' AND timezone IS NULL;

UPDATE ss_user_profiles SET timezone = 'America/Los_Angeles'
  WHERE location_text = 'Elk Grove, California' AND timezone IS NULL;
