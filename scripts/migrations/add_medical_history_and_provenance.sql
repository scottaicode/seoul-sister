-- Medical history + clinical provenance (July 21 2026)
--
-- WHY THIS EXISTS
--
-- Scott's live profile stored "skin cancer history" inside `allergies`, because
-- that was the only array the schema offered. `memory.ts` injects allergies
-- under "ALWAYS check for these before recommending any product" — so Yuri read
-- a 25-excision cancer history as a CONTACT ALLERGEN, something not to put on
-- his face, rather than a standing medical fact that should reframe her whole
-- approach (protection first, photosensitizer caution, low threshold for "see a
-- dermatologist"). The extraction did the best it could with nowhere to put it.
--
-- Separately: `finalizeOnboardingProfile` wrote hardcoded defaults
-- (fitzpatrick_scale=3, age_range='25-30', climate='temperate') for anything a
-- user never answered, and memory.ts printed them to Yuri as bare fact. A
-- fabricated Fitzpatrick III is indistinguishable from a stated one — the same
-- fake-confidence class as the v10.2.1 "I checked our database" incident. For a
-- Fitzpatrick I user with skin cancer, guessing III is not a small error.
--
-- This migration adds a home for medical facts and a provenance marker so
-- "stated" and "estimated" can never again be confused.

-- 1. Medical history — distinct from allergies. Free-text entries, e.g.
--    "skin cancer history (25+ excisions since early 30s)", "rosacea",
--    "currently seeing a dermatologist", "on tretinoin".
ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS medical_history TEXT[];

-- 2. Cumulative sun exposure history. Photoaging is driven by DECADES of UV,
--    not today's weather — someone who grew up outdoors in the Central Valley
--    and now lives in Seattle still has Central Valley skin. The existing
--    `climate` + live weather answer "should today's moisturizer be lighter";
--    this answers "what am I actually treating".
ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS sun_history TEXT;

-- 3. Provenance for the clinical fields that were being silently defaulted.
--    'stated'    — the user actually told us
--    'estimated' — Yuri inferred it from context (usable, but hedge it)
--    NULL        — unknown; Yuri must say she doesn't know, never guess aloud
ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS fitzpatrick_source TEXT
    CHECK (fitzpatrick_source IN ('stated', 'estimated'));

COMMENT ON COLUMN ss_user_profiles.medical_history IS
  'Standing medical facts (skin cancer history, rosacea, eczema, dermatologist care, prescriptions). NOT allergies — these reframe advice rather than exclude ingredients.';
COMMENT ON COLUMN ss_user_profiles.sun_history IS
  'Cumulative lifetime UV exposure (where they grew up, outdoor years, burn history). Drives photoaging assessment independently of current climate.';
COMMENT ON COLUMN ss_user_profiles.fitzpatrick_source IS
  'How fitzpatrick_scale was obtained. NULL = unknown; Yuri must not assert a value she was never given.';

-- 4. Backfill provenance for existing rows.
--    Any non-null Fitzpatrick predates this column. We cannot retroactively
--    know whether it was stated or defaulted, so mark it 'estimated' — the
--    conservative read. A wrongly-cautious hedge is recoverable; a fabricated
--    certainty is not.
UPDATE ss_user_profiles
  SET fitzpatrick_source = 'estimated'
  WHERE fitzpatrick_scale IS NOT NULL
    AND fitzpatrick_source IS NULL;

-- 5. Migrate medical facts out of `allergies`.
--    Scott's account (authorized July 21 2026) is the known case. The pattern
--    match is deliberately narrow — only entries that are plainly medical
--    conditions, never anything that could be a genuine contact allergen.
UPDATE ss_user_profiles
  SET medical_history = ARRAY(
        SELECT a FROM unnest(allergies) AS a
        WHERE a ~* '(cancer|melanoma|carcinoma|rosacea|eczema|psoriasis|dermatitis|keratosis)'
      ),
      allergies = ARRAY(
        SELECT a FROM unnest(allergies) AS a
        WHERE a !~* '(cancer|melanoma|carcinoma|rosacea|eczema|psoriasis|dermatitis|keratosis)'
      )
  WHERE allergies IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(allergies) AS a
      WHERE a ~* '(cancer|melanoma|carcinoma|rosacea|eczema|psoriasis|dermatitis|keratosis)'
    );

-- Verify:
--   SELECT id, allergies, medical_history, fitzpatrick_scale, fitzpatrick_source
--   FROM ss_user_profiles WHERE medical_history IS NOT NULL;
