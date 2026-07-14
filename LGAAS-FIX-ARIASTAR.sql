-- =============================================================================
-- FIX ARIASTAR — Seoul Sister has a human creator and the profile doesn't know it
-- Run in: LGAAS Supabase SQL Editor (NOT Seoul Sister's)
-- Date: Jul 13 2026
-- =============================================================================
--
-- VERIFIED DIAGNOSIS (from the live row, not a template):
--
--   brand_has_bailey     = false   <- not in the brand voice
--   presence_has_bailey  = false   <- not in social
--   business_has_bailey  = false   <- not in the business story
--   customer_has_bailey  = false
--   proof_has_bailey     = TRUE    <- she exists in EXACTLY ONE PLACE
--   has_reddit_persona   = TRUE    <- a working human persona ALREADY EXISTS
--   tiktok_enabled       = false   <- LGAAS is NOT auto-posting; Bailey posts by hand
--   locked_identity      = NULL    <- nothing frozen, clean to update
--
-- WHAT THIS MEANS:
-- Bailey is filed ONLY in proof_data — as a TESTIMONIAL. A customer to be quoted.
-- She is not in the brand voice, not in social, not in the business story. So when
-- she asks AriaStar how to post, AriaStar sees a testimonial asking to be a marketer
-- and correctly tells her to stay on-brand. AriaStar was never wrong. She was given a
-- world in which the creator does not exist.
--
-- AND THE FIX ALREADY EXISTS IN THIS DATABASE:
-- `reddit_account_persona` is populated and it WORKS — u/glass_skin_atx opens with
-- "Got into K-beauty through my daughter" and has 1,205 karma / Top 10% Commenter /
-- comments pulling 1,300 views. LGAAS already knows how to model a human voice. That
-- capability was simply never extended to social. We are not inventing anything here;
-- we are applying a proven in-house pattern to the platform that lacks it.
--
-- SAFETY: every statement below MERGES (||) into existing JSON. Nothing is replaced.
-- Run the SELECTs at the bottom to verify before/after.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Add the CREATOR to brand_data. This is the block that does not exist today.
-- -----------------------------------------------------------------------------
update lgaas_business_profiles p
set brand_data = coalesce(p.brand_data, '{}'::jsonb) || jsonb_build_object(
  'creator', jsonb_build_object(
    'name', 'Bailey',
    'relationship', 'The founder''s daughter. Seoul Sister was built FOR her — she is the reason the product exists.',
    'role', 'Lighthouse user AND the primary social creator (TikTok + Instagram). She is NOT a spokesperson and NOT a testimonial. She is the person making the content.',
    'why_she_is_credible', 'She is a real user, not a brand voice. Since Feb 22 2026 she has sent Yuri 450 messages across 51 conversations, owns 22 products in her tracked routine, and has 4 Glass Skin Score photos. She corrected the AI seven separate times about her own skin and was right every time — an entire recommendation feature was DELETED from the product because she called it garbage. She lived a real barrier-repair protocol (Phase 1 then Phase 2), combination skin, jawline breakouts.',
    'voice', 'First person. Unpolished. Opinionated. Funny. Allowed to be self-deprecating, to be wrong, to change her mind, to say "I wasted money on this." She is NOT a brand mascot and must never be asked to sound like one.',
    'on_camera', 'YES. Face-to-camera is explicitly permitted and encouraged. Highly produced content UNDERPERFORMS on TikTok in 2026; polish reads as advertising.',
    'the_story', 'A father built an AI skincare advisor because of his daughter. She used it, argued with it, and made it better. This is the single most valuable asset the brand has and it is currently absent from every social asset.'
  )
)
from lgaas_clients c
where c.id = p.client_id
  and c.business_name ilike '%seoul%'
  and p.status = 'confirmed';


-- -----------------------------------------------------------------------------
-- 2. Add a CREATOR VOICE distinct from the product voice.
--    The existing brand_voice is FINE for Yuri and the website. It is wrong for a
--    human being on camera. Both must coexist.
-- -----------------------------------------------------------------------------
update lgaas_business_profiles p
set brand_data = coalesce(p.brand_data, '{}'::jsonb) || jsonb_build_object(
  'creator_voice', jsonb_build_object(
    'personality', 'A real 20-something with combination skin talking to a friend. Not a brand. Not an expert performing expertise. She is allowed to be annoyed at her own skin, to admit she bought something dumb, to disagree with the internet.',
    'explicitly_allowed', jsonb_build_array(
      'face-to-camera video',
      'personal skin struggles and failures',
      '"I was wrong about X"',
      'reacting to and arguing with commenters',
      'humor, sarcasm, being unimpressed',
      'showing the PRODUCT being wrong, and correcting Yuri on camera'
    ),
    'explicitly_forbidden', jsonb_build_array(
      'sounding like an ad',
      'brand-voice polish on a personal video',
      'hard-selling the subscription in a video',
      'pretending to be an authority she is not'
    ),
    'note_to_ariastar', 'When Bailey asks for social guidance, do NOT steer her toward brand voice. Her personal, unpolished voice IS the strategy. She proved it: she got ~10x the followers in a day by being herself. Help her turn her real 5-month conversation history into content.'
  )
)
from lgaas_clients c
where c.id = p.client_id
  and c.business_name ilike '%seoul%'
  and p.status = 'confirmed';


-- -----------------------------------------------------------------------------
-- 3. Fix presence_data.social_media — it currently says a human is not involved.
--    Current value: url "TBD — to be created", post_frequency "Will be automated by
--    LGAAS". Both are now false.
-- -----------------------------------------------------------------------------
update lgaas_business_profiles p
set presence_data = coalesce(p.presence_data, '{}'::jsonb) || jsonb_build_object(
  'social_media', coalesce(p.presence_data->'social_media', '{}'::jsonb) || jsonb_build_object(
    'tiktok', jsonb_build_object(
      'url', 'https://www.tiktok.com/@seoulsisterskin',
      'handle', '@seoulsisterskin',
      'post_frequency', 'HUMAN-CREATED by Bailey. LGAAS assists with hooks, scripts, ingredient research and product grounding. LGAAS does NOT auto-post brand content here (tiktok_enabled = false).',
      'format_requirement', 'SHORT-FORM VIDEO. Face-to-camera, or hands-only texture demo. NOT static text cards — those are failing (299/484/755/186/8 views = TikTok initial test batch not passed; a static card has no watch time, so no completion, so no promotion).'
    ),
    'instagram', jsonb_build_object(
      'url', 'https://www.instagram.com/seoulsisterskin/',
      'handle', '@seoulsisterskin',
      'post_frequency', 'HUMAN-CREATED by Bailey. Same format rules as TikTok.'
    ),
    'creator_personal_account', jsonb_build_object(
      'owner', 'Bailey',
      'purpose', 'TOP OF FUNNEL. Her face, her story, her skin, her opinions, her regrets. This is where growth happens. Seoul Sister appears in the BIO, never in the pitch.',
      'evidence', 'She opened it and got ~10x the followers in a day by being personable.'
    )
  ),
  'social_architecture', jsonb_build_object(
    'bailey_personal', 'TOP OF FUNNEL. The human earns the trust.',
    'seoulsisterskin_brand', 'PROOF SURFACE. Yuri transcripts, ingredient decodes, dupe finds, counterfeit catches. Lower volume, higher intent. People land here AFTER Bailey makes them curious.',
    'precedent', 'This is the EXACT architecture already working on Reddit: u/glass_skin_atx (1,205 karma, Top 10% Commenter) leads with "Got into K-beauty through my daughter" and carries the link in the BIO, never in the comment. The human earns the trust; the bio carries the link. Do not re-litigate a pattern this business has already proven.'
  )
)
from lgaas_clients c
where c.id = p.client_id
  and c.business_name ilike '%seoul%'
  and p.status = 'confirmed';


-- -----------------------------------------------------------------------------
-- 4. Record the TikTok handle on the client row (it was NULL).
--    Leave tiktok_enabled = false — Bailey posts manually, and that is correct.
-- -----------------------------------------------------------------------------
update lgaas_clients
set tiktok_account_handle = '@seoulsisterskin'
where business_name ilike '%seoul%';


-- =============================================================================
-- VERIFY — Bailey should now appear in brand AND presence, not just proof.
-- =============================================================================
select
  (p.brand_data::text    ilike '%bailey%') as brand_has_bailey,     -- expect TRUE now
  (p.presence_data::text ilike '%bailey%') as presence_has_bailey,  -- expect TRUE now
  (p.proof_data::text    ilike '%bailey%') as proof_has_bailey,     -- was already TRUE
  (p.brand_data ? 'creator')               as has_creator_block,    -- expect TRUE
  (p.brand_data ? 'creator_voice')         as has_creator_voice,    -- expect TRUE
  (p.brand_data ? 'brand_voice')           as brand_voice_intact,   -- MUST still be TRUE
  c.tiktok_account_handle
from lgaas_business_profiles p
join lgaas_clients c on c.id = p.client_id
where c.business_name ilike '%seoul%' and p.status = 'confirmed'
order by p.updated_at desc limit 1;


-- =============================================================================
-- AFTER THIS RUNS — one more step, and it is REQUIRED:
--
-- AriaStar's brand voice is "AI-determined, not prescribed" — it is GENERATED from
-- this profile into lgaas_system_configs (advisor-prompt-helpers.js:1464). Updating
-- the profile alone will NOT change her advice until the config is regenerated.
--
--   -> Re-run system generation for Seoul Sister
--   -> Confirm the new lgaas_system_configs row has is_active = true
--   -> THEN have Bailey re-ask her
--
-- Her advice should flip on its own, and every downstream artifact (hooks, scripts,
-- captions, Reddit) inherits it. That is strictly better than overriding her.
-- =============================================================================
