-- Demote a falsely-attributed Fitzpatrick so Yuri RE-ASKS it.
-- Jul 28 2026. Caroline (cubrumitt@yahoo.com, user b6decb40-...).
--
-- WHAT WENT WRONG
-- She said only "I do burn easily in the sun initially". The extractor mapped
-- "burns easily" to its own anchor text "1 = very fair / always burns" and
-- stored `fitzpatrick_scale = 1`, while `finalizeOnboardingProfile` hardcoded
-- `fitzpatrick_source = 'stated'` for any extracted value. So a model inference
-- from HALF an answer was recorded as the user's own declaration.
--
-- Type 1 means always burns and NEVER tans. "Burns initially" implies she then
-- tans, which is type 2-3. The stored value is very likely wrong, and it drives
-- retinoid strength, acid aggressiveness and skin-cancer caution.
--
-- Worse, it was self-sealing: `buildOnboardingTurnState` lists captured fields,
-- and the system prompt says "NEVER repeat a question for information you
-- already have" — so the premature value SILENCED the clarifying question that
-- would have corrected it. Transcript-confirmed: Yuri never asked the tan half.
--
-- WHY NOT JUST SET IT TO 2 OR 3
-- Because I would be doing exactly what the bug did — asserting a clinical fact
-- the user never gave. The v11.10.0 rule is that an unknown clinical value must
-- render as unknown and be ASKED. Guessing "2" is more plausible than 1 and
-- still a guess.
--
-- THE FIX
-- Keep the number as a working estimate but tell the truth about where it came
-- from. `memory.ts` (~line 730) already renders an 'estimated' Fitzpatrick as:
--   "(ESTIMATED, never confirmed by them — if it matters for what you're about
--    to recommend, confirm it: 'do you burn or tan?')"
-- So flipping the provenance is sufficient: Yuri will surface the doubt and ask
-- Caroline herself, in conversation, the next time it bears on a recommendation.
-- She gets the answer from the user instead of from me. The mechanism to do this
-- correctly already existed — it was just never reachable, because the writer
-- could only ever produce 'stated'.
--
-- Apply with: Supabase SQL Editor (MCP is read-only).

BEGIN;

UPDATE ss_user_profiles
SET fitzpatrick_source = 'estimated',
    updated_at = now()
WHERE user_id = 'b6decb40-5861-4b4f-baa1-a10c3d629a33'
  AND fitzpatrick_scale IS NOT NULL;

COMMIT;

-- Verify: expect fitzpatrick_scale = 1 with fitzpatrick_source = 'estimated'.
-- Yuri will now flag the uncertainty and ask rather than assert.
SELECT u.email, p.fitzpatrick_scale, p.fitzpatrick_source
FROM ss_user_profiles p
JOIN auth.users u ON u.id::text = p.user_id::text
WHERE p.user_id = 'b6decb40-5861-4b4f-baa1-a10c3d629a33';

-- NOTE ON THE OTHER 'stated' VALUES — deliberately NOT touched.
-- Four other profiles carry fitzpatrick_source='stated' under the same
-- hardcoding bug, so the label is unverified for all of them. They are left
-- alone because, unlike Caroline's, their stored numbers are consistent with
-- what those users actually said in their transcripts:
--   glassskinatx (1): Central Valley sun history + ~25 skin cancers — coherent.
--   skilback22 (3):  "used to lay in the sun for hours, rarely burned" — coherent.
--   kimwells112192 (3), vibetrendai (2): no contradicting statement on record.
-- Demoting a correct value to 'estimated' would make Yuri re-ask a question the
-- user already answered, which is its own kind of disrespect. Only the value
-- with evidence AGAINST it is being corrected.
