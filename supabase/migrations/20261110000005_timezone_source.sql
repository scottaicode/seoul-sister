-- Where a profile's timezone came from (Nov 10 2026).
-- 'browser' = the member's device reported it (POST /api/me/timezone, only into
-- an empty field). NULL = set before this column existed, by geocoding a stated
-- location or the /profile location button. Weekly check-ins need a timezone to
-- know the member's Sunday; most new profiles had none.
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS timezone_source text;
COMMENT ON COLUMN ss_user_profiles.timezone_source IS '''browser'' when the device reported the timezone into an empty field; NULL for values set earlier from a stated location or GPS.';
