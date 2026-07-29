-- July 29 2026 — two profile-capture gaps found while reading a live
-- subscriber's onboarding transcript end to end.
--
-- Run this whole file once against production. Both statements are idempotent.

-- ---------------------------------------------------------------------------
-- 1. first_name — what the user wants to be called
-- ---------------------------------------------------------------------------
-- There was no name column anywhere in ss_user_profiles, the onboarding prompt
-- never asked, and the extraction schema had no field for it. Yuri advised a
-- paying subscriber across a full onboarding AND a returning next-day session
-- without ever knowing her name.
--
-- Rapport data, not clinical data: written only when the user volunteers it,
-- never inferred from an email address, never required to finish onboarding.

ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS first_name text;

COMMENT ON COLUMN ss_user_profiles.first_name IS
  'Preferred given name. Captured only when volunteered during Yuri onboarding or conversation; never inferred from email. Nullable by design.';

-- ---------------------------------------------------------------------------
-- 2. Backfill coordinates for existing subscribers who have a location but no
--    lat/lon
-- ---------------------------------------------------------------------------
-- Onboarding captured `location_text` and stopped there. latitude/longitude
-- were populated by exactly ONE path: the browser-geolocation button on
-- /profile, which the user has to find and click. So the two newest paying
-- subscribers had a location on file and no coordinates:
--
--   Caroline (cubrumitt@yahoo.com)   "Kansas City"  → no lat/lon
--   Kim Wells (kimwells112192@...)   "Iowa"         → no lat/lon
--
-- Consequence: get_current_weather fell through to "Could not determine
-- location", and every UV / humidity-driven surface was dark for them. Yuri
-- told Caroline that Kansas City's seasonal humidity swing was half of why her
-- skin seesaws, while being unable to read the weather there.
--
-- Coordinates below are the EXACT values `geocodeLocation()` returns for each
-- user's stored location_text, verified by running it (see
-- src/lib/geo/__tests__/geocode.test.ts). They are what the code path would
-- have written, so backfilled rows are indistinguishable from newly-onboarded
-- ones. Weather and UV are regional; city-level precision is sufficient.
--
-- "Iowa" is worth a note: Open-Meteo has no entry for the US STATE, and a naive
-- lookup returns Ness City, KANSAS — ~450 miles away, in the wrong state. The
-- geocoder now rejects a bare region name unless the candidate actually sits in
-- a region of that name, which yields Iowa City, Iowa. This backfill uses that
-- verified value, NOT the naive one.
--
-- Guarded with `IS NULL` so this can never overwrite device-level coordinates
-- from the /profile geolocation button.

-- Caroline — location_text "Kansas City" → Kansas City, Missouri
UPDATE ss_user_profiles p
SET latitude  = 39.09973,
    longitude = -94.57857,
    timezone  = COALESCE(timezone, 'America/Chicago'),
    updated_at = now()
FROM auth.users u
WHERE u.id = p.user_id
  AND u.email = 'cubrumitt@yahoo.com'
  AND p.latitude IS NULL
  AND p.longitude IS NULL;

-- Kim Wells — location_text "Iowa" → Iowa City, Iowa
UPDATE ss_user_profiles p
SET latitude  = 41.66113,
    longitude = -91.53017,
    timezone  = COALESCE(timezone, 'America/Chicago'),
    updated_at = now()
FROM auth.users u
WHERE u.id = p.user_id
  AND u.email = 'kimwells112192@gmail.com'
  AND p.latitude IS NULL
  AND p.longitude IS NULL;

-- Verification — every profile with a location but still no coordinates.
-- Expect zero rows for the two subscribers above after this runs.
--
--   SELECT u.email, p.location_text, p.latitude, p.longitude, p.timezone
--   FROM ss_user_profiles p
--   JOIN auth.users u ON u.id = p.user_id
--   WHERE p.location_text IS NOT NULL AND p.latitude IS NULL;
--
-- NOTE for any future audit of this table: ss_user_profiles has a surrogate
-- `id` primary key AND a separate `user_id` foreign key. Join on user_id. A
-- July 29 audit joined on `id` and concluded all 37 users were missing
-- profiles, which was false.
