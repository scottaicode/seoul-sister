-- What a member has told Yuri about who they are, so she can use it and never
-- has to guess it (Nov 15 2026).
--
-- Incident: told "late 50s", Yuri answered "after menopause... at 57" to a
-- 59-year-old man. The profile had nowhere to hold either fact, so his
-- correction lived only in that conversation's text.
--
-- gender: the word the member uses for themselves. NULL = they have not said.
--   Never defaulted and never inferred (not from a name, a product, a
--   pregnancy or a period). Hormonal facts are separate and live in
--   medical_history in the member's own words.
-- age_years + age_stated_on: an exact age only when they gave a number, with
--   the day they gave it, so a current age can be worked out later instead of
--   a stale one being read back. Both NULL or both set.

ALTER TABLE public.ss_user_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age_years integer,
  ADD COLUMN IF NOT EXISTS age_stated_on date;

ALTER TABLE public.ss_user_profiles
  DROP CONSTRAINT IF EXISTS ss_user_profiles_gender_check,
  ADD CONSTRAINT ss_user_profiles_gender_check
    CHECK (gender IS NULL OR gender IN ('woman', 'man', 'nonbinary'));

ALTER TABLE public.ss_user_profiles
  DROP CONSTRAINT IF EXISTS ss_user_profiles_age_years_check,
  ADD CONSTRAINT ss_user_profiles_age_years_check
    CHECK (age_years IS NULL OR (age_years >= 13 AND age_years <= 110));

ALTER TABLE public.ss_user_profiles
  DROP CONSTRAINT IF EXISTS ss_user_profiles_age_stated_paired,
  ADD CONSTRAINT ss_user_profiles_age_stated_paired
    CHECK ((age_years IS NULL) = (age_stated_on IS NULL));

COMMENT ON COLUMN public.ss_user_profiles.gender IS 'woman | man | nonbinary, only as the member stated it about themselves. NULL = not stated. Never inferred.';
COMMENT ON COLUMN public.ss_user_profiles.age_years IS 'Exact age the member gave as a number. NULL when they gave a range or nothing.';
COMMENT ON COLUMN public.ss_user_profiles.age_stated_on IS 'The day age_years was given, set by code when it first appears or changes.';
