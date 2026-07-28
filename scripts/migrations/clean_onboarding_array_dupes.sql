-- Clean duplicate/near-duplicate entries in onboarding-extracted array fields.
-- Jul 28 2026. Data repair for the bug fixed in code the same day.
--
-- WHAT CAUSED THIS
-- `extractSkinProfileData` re-reads the ENTIRE transcript on every message, and
-- `mergeSkinProfileData` used to UNION each pass with the previous one:
--   [...new Set([...existingArr, ...value])]
-- Sonnet phrases the same fact slightly differently across passes, so an
-- exact-string union could never converge. Confirmed on 4 users. The union is
-- now a replace (each pass is already a complete snapshot), so NEW conversations
-- self-heal — but rows already written stay polluted until this runs.
--
-- WHY IT MATTERS: every one of these arrays is injected into Yuri's context.
-- `medical_history` reframes her whole approach; `skin_concerns` steers what she
-- treats. Listing "bad acne since teenager" twice in two phrasings does not make
-- it twice as true, it just burns context and reads as sloppy to the user whose
-- own history is being repeated back at them.
--
-- SCOPE DISCIPLINE — this migration ONLY removes redundancy. It does not
-- reclassify, reword, or invent anything. Two rules:
--   1. Only drop an entry that is a case-insensitive duplicate, or a strict
--      substring of another entry in the SAME array (e.g. "bad acne since
--      teenager" ⊂ "bad acne since teenager, re-developed in twenties").
--      Substring containment is the conservative test: the longer string
--      provably carries the shorter one's information.
--   2. Keep the LONGEST surviving variant, which retains the most detail.
-- Anything requiring judgment (is "oily" the same concern as "oiliness"? is
-- "Kheils" the same product as "Kiehl's"?) is deliberately LEFT ALONE. Those are
-- fuzzy-match decisions, and a migration that guesses at clinical text is the
-- same class of error as the bug it is repairing.
--
-- NOT TOUCHED HERE (deliberate):
--   - `allergies` holding a PRODUCT name (Caroline: "Anua Oil Cleanser";
--     vibetrendai: "innisfree green tea moisturizer"). Removing a safety entry
--     is not a dedup decision — see the note at the bottom.
--   - Caroline's `fitzpatrick_scale = 1`. A wrong clinical value must be
--     RE-ASKED, not silently rewritten by me. That is the whole lesson of
--     v11.10.0: never assert a clinical fact the user did not give.
--
-- Apply with: Supabase SQL Editor (MCP is read-only).
-- Verify with the SELECT at the bottom.

BEGIN;

-- Collapse one text[] column: drop case-insensitive dupes and any entry that is
-- a strict substring of a longer sibling, preserving first-seen order otherwise.
CREATE OR REPLACE FUNCTION _dedupe_text_array(arr text[])
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(e ORDER BY ord), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT ON (lower(btrim(e))) e, ord
    FROM unnest(arr) WITH ORDINALITY AS t(e, ord)
    ORDER BY lower(btrim(e)), length(e) DESC, ord   -- keep the longest variant
  ) uniq
  WHERE NOT EXISTS (
    -- drop when some OTHER entry strictly contains this one
    SELECT 1 FROM unnest(arr) AS other(o)
    WHERE lower(btrim(o)) <> lower(btrim(uniq.e))
      AND length(o) > length(uniq.e)
      AND position(lower(btrim(uniq.e)) in lower(btrim(o))) > 0
  );
$$;

UPDATE ss_user_profiles
SET skin_concerns   = _dedupe_text_array(skin_concerns),
    medical_history = _dedupe_text_array(medical_history),
    updated_at      = now()
WHERE (skin_concerns IS NOT NULL AND array_length(skin_concerns, 1) > 0)
   OR (medical_history IS NOT NULL AND array_length(medical_history, 1) > 0);

-- Same pollution lives in the provenance record, which future sessions read to
-- decide whether a value was stated or defaulted. Leaving it dirty there would
-- make the profile and its provenance disagree.
UPDATE ss_onboarding_progress
SET skin_profile_data = skin_profile_data
      || jsonb_build_object(
           'skin_concerns',
           to_jsonb(_dedupe_text_array(
             ARRAY(SELECT jsonb_array_elements_text(skin_profile_data->'skin_concerns'))))
         )
WHERE jsonb_typeof(skin_profile_data->'skin_concerns') = 'array';

UPDATE ss_onboarding_progress
SET skin_profile_data = skin_profile_data
      || jsonb_build_object(
           'medical_history',
           to_jsonb(_dedupe_text_array(
             ARRAY(SELECT jsonb_array_elements_text(skin_profile_data->'medical_history'))))
         )
WHERE jsonb_typeof(skin_profile_data->'medical_history') = 'array';

UPDATE ss_onboarding_progress
SET skin_profile_data = skin_profile_data
      || jsonb_build_object(
           'current_routine',
           to_jsonb(_dedupe_text_array(
             ARRAY(SELECT jsonb_array_elements_text(skin_profile_data->'current_routine'))))
         )
WHERE jsonb_typeof(skin_profile_data->'current_routine') = 'array';

UPDATE ss_onboarding_progress
SET skin_profile_data = skin_profile_data
      || jsonb_build_object(
           'product_preferences',
           to_jsonb(_dedupe_text_array(
             ARRAY(SELECT jsonb_array_elements_text(skin_profile_data->'product_preferences'))))
         )
WHERE jsonb_typeof(skin_profile_data->'product_preferences') = 'array';

DROP FUNCTION _dedupe_text_array(text[]);

COMMIT;

-- Verification: review the surviving arrays by hand. Expect Caroline's
-- medical_history to collapse 4 -> 2 ("took accutane in college" + the longer
-- acne-history sentence) and Kim's aging concerns to lose their exact dupes.
-- Remaining near-variants ("oily" vs "oiliness") are EXPECTED — left for a human
-- to judge, not for this script to guess at.
SELECT u.email, p.skin_concerns, p.medical_history
FROM ss_user_profiles p
JOIN auth.users u ON u.id::text = p.user_id::text
WHERE p.skin_concerns IS NOT NULL OR p.medical_history IS NOT NULL
ORDER BY u.created_at;

-- ---------------------------------------------------------------------------
-- STILL NEEDS A HUMAN DECISION (not automated here):
--   1. Caroline `fitzpatrick_scale=1/'stated'` — wrong AND falsely attributed.
--      Yuri now re-asks (see the onboarding.ts fix + the re-ask below).
--   2. `allergies` holding product names, 2 users:
--        cubrumitt@yahoo.com   -> "Anua Oil Cleanser"
--        vibetrendai@gmail.com -> "innisfree green tea moisturizer"
--      These are injected under "ALWAYS check for these before recommending any
--      product", so a whole product is banned rather than an ingredient. The
--      user DID react to it, so the fact is real and must not just be deleted —
--      it belongs in context as a product mismatch, not an allergen. Decide the
--      destination before moving it.
-- ---------------------------------------------------------------------------
