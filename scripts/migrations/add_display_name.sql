-- Display name — what the app calls you on screen.
--
-- WHY (July 29 2026)
--
-- Bailey, about to screen-record for TikTok: "can you please change the username
-- to baileyydonn to match TikTok. I don't need everyone knowing EVERYTHING 😂 /
-- Even tho they'll figure it out... I want consistency"
--
-- Her dashboard read "Good evening, baileydonmartin". Nobody ever typed that.
-- Three surfaces fell back to `email.split('@')[0]` when no name was on file, so
-- ANY user whose address is firstnamelastname@provider had their full legal name
-- printed on screen — and in Bailey's case, into a video for a public audience.
--
-- That fallback also contradicted a rule the codebase had already written for
-- itself: the onboarding extraction prompt says "NEVER infer a name from their
-- email address, and never guess." The AI path honoured it; the UI did not.
--
-- `first_name` already exists and is CLINICAL-ADJACENT provenance data — captured
-- only when volunteered during onboarding (see the honesty rules in CLAUDE.md).
-- It is deliberately NOT reused here: what Yuri calls you in conversation and
-- what a public creator wants rendered on a screen recording are different
-- fields with different consent. Bailey wants "baileyydonn" on screen and
-- "Bailey" from Yuri, and both should be true at once.
--
-- Nullable on purpose. NULL means "we were never told", and the UI must degrade
-- to a neutral greeting rather than guessing from an email.

ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN ss_user_profiles.display_name IS
  'User-chosen public-facing handle shown in the app UI (greetings, profile). Set by the user, never derived from their email address. NULL = never provided; render a neutral greeting instead of guessing. Distinct from first_name, which is what Yuri calls them conversationally and is only captured when volunteered.';

-- Length guard: this renders in a heading, and it is user-supplied.
ALTER TABLE ss_user_profiles
  DROP CONSTRAINT IF EXISTS ss_user_profiles_display_name_len;
ALTER TABLE ss_user_profiles
  ADD CONSTRAINT ss_user_profiles_display_name_len
  CHECK (display_name IS NULL OR char_length(trim(display_name)) BETWEEN 1 AND 32);

-- Bailey's own row, so her screen recording is correct immediately rather than
-- after she goes and finds the setting. She asked for this value explicitly.
UPDATE ss_user_profiles
SET display_name = 'baileyydonn'
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND display_name IS NULL;
