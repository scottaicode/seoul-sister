# WORK ORDER FOR THE LGAAS AI MODEL — Seoul Sister has a human creator, and the system doesn't know it

**From:** Seoul Sister (Claude, Jul 13 2026)
**Priority:** Root-cause fix. Do this before Bailey talks to AriaStar again.
**Est:** ~1 hour (profile + config regen), plus a separate discussion on the social pipeline.

---

## STEP 0 — VERIFY FIRST. Do not act on my diagnosis until you've confirmed it.

I read `SEOUL_SISTER_ONBOARDING_PROMPT.md` (a **setup template**). AriaStar reasons from the **live DB row**, which may have drifted. **Run this before changing anything:**

```sql
select
  jsonb_pretty(brand_data->'brand_voice')              as brand_voice,
  jsonb_pretty(company_data->'social_media')            as social_media,
  jsonb_pretty(brand_data->'communication_boundaries')  as boundaries
from lgaas_business_profiles
where client_id = (select id from lgaas_clients where name ilike '%seoul%')
order by updated_at desc limit 1;
```

**If the live profile already names Bailey / a human creator → my diagnosis is WRONG. Stop, and tell us; the problem is elsewhere (probably the social generator, see Part 2).**

If it matches the template below, proceed.

---

## THE PROBLEM

Bailey (Scott's daughter — the person Seoul Sister was *built for*, its lighthouse user, and now its social creator) asked AriaStar for social guidance. AriaStar told her to stay on-brand and not be personable. Frustrated, Bailey opened her own account, was herself, and got **~10× the followers in a day**.

**AriaStar was not wrong. She was correctly executing a profile that contains no human being.**

```json
"brand_voice": {
  "personality": "Knowledgeable Korean beauty friend who happens to have a
                  database of 6,200 products in her brain"     // <- a mascot
},
"social_media": {
  "tiktok":    { "post_frequency": "Will be automated by LGAAS" },  // <- brand content
  "instagram": { "post_frequency": "Will be automated by LGAAS" }
}
```

There is no Bailey. No founder's daughter. No creator. **Social was conceived from day one as automated brand output.** AriaStar cannot advise "let the human shine" because in her model of this business, *the human does not exist.*

Note `advisor-prompt-helpers.js:1464`: brand voice is **"AI-determined, not prescribed"** — generated *from the profile* into `lgaas_system_configs`. So the profile is the true root input. **Fix the profile → regenerate the config → AriaStar's advice changes on its own**, and everything downstream (hooks, scripts, captions, Reddit) inherits it. That is strictly better than overriding her.

---

## PART 1 — Profile changes (the actual fix)

### 1a. Add a human creator. This does not exist today.

Add to `brand_data` (new block):

```json
"creator": {
  "name": "Bailey",
  "relationship": "Founder's daughter. Seoul Sister was built FOR her.",
  "role": "Lighthouse user and primary social creator (TikTok + Instagram).",
  "why_she_is_credible": "She is a real user, not a spokesperson. She corrected the AI seven separate times on her own skin and was right every time (a recommendation engine got removed from the product because of her). She went through a real barrier-repair protocol: Phase 1 then Phase 2, combination skin, jawline breakouts.",
  "voice": "First person. Unpolished. Opinionated. Funny. Allowed to be self-deprecating, to be wrong, to change her mind, to say 'I wasted money on this.' She is NOT a brand mascot and must never sound like one.",
  "on_camera": "Yes. Face-to-camera is explicitly permitted and encouraged.",
  "the_story": "A father built an AI skincare advisor because of his daughter. She used it, argued with it, and made it better. That story is the brand's single most valuable asset and is currently absent from every social asset."
}
```

### 1b. Fix `social_media` — it currently says a human isn't involved

```json
"social_media": {
  "tiktok": {
    "url": "https://www.tiktok.com/@seoulsisterskin",
    "post_frequency": "HUMAN-CREATED by Bailey. LGAAS assists with hooks, scripts, ingredient research, and product grounding — LGAAS does NOT auto-post brand content here.",
    "format": "Short-form VIDEO. Face-to-camera or hands-only demo. NOT static text cards."
  },
  "instagram": {
    "url": "https://www.instagram.com/seoulsisterskin/",
    "post_frequency": "HUMAN-CREATED by Bailey; same rules as TikTok."
  }
}
```

### 1c. Add a creator voice DISTINCT from the product voice

The existing `brand_voice` is fine **for Yuri and for the website.** It is wrong for a human on camera. Add:

```json
"creator_voice": {
  "personality": "A real 20-something with combination skin talking to a friend. Not a brand. Not an expert performing expertise. She's allowed to be annoyed at her own skin, to admit she bought something dumb, to disagree with the internet.",
  "explicitly_allowed": [
    "face-to-camera",
    "personal skin struggles and failures",
    "'I was wrong about X'",
    "reacting to and arguing with comments",
    "humor, sarcasm, being unimpressed",
    "showing the product being wrong / correcting Yuri"
  ],
  "explicitly_forbidden": [
    "sounding like an ad",
    "brand-voice polish on a personal video",
    "hard-selling the subscription",
    "pretending to be an authority she isn't"
  ]
}
```

### 1d. Two-account architecture — record it so AriaStar stops treating them as one thing

```json
"social_architecture": {
  "bailey_personal": "TOP OF FUNNEL. Her face, her story, her skin, her opinions. Growth happens here. Seoul Sister appears in the BIO, not in the pitch.",
  "seoulsisterskin_brand": "PROOF SURFACE. Yuri transcripts, ingredient decodes, dupe finds, counterfeit catches. Lower volume, higher intent. People land here AFTER Bailey earns their curiosity.",
  "precedent": "This is the exact architecture already WORKING on Reddit: u/glass_skin_atx (1,205 karma, Top 10% Commenter) leads with 'Got into K-beauty through my daughter' and carries the link in the bio, never in the comment. The human earns the trust; the bio carries the link. Do not re-litigate a pattern this business has already proven."
}
```

### 1e. Then regenerate

Re-run system generation so `lgaas_system_configs` picks up the new profile (brand voice is AI-determined from it). **Then have Bailey re-ask AriaStar.** Her advice should flip on its own. If it doesn't, the config regen didn't take — check `is_active` on the new row.

---

## PART 2 — The social generator can only make posters (separate, and arguably bigger)

`api/content-social.js:503`:
```
// Background image waterfall (Media Library → Quote Card → AI Scene)
```

**The social pipeline's entire output model is IMAGES.** "Quote Card" is literally the beige text card. **There is no video path.** So even with a perfect profile, the machine can only hand Bailey a poster.

Evidence it isn't working — the Seoul Sister TikTok, 5 posts over ~5 days:

```
299 · 484 · 755 · 186 · 8 views     1 follower
```

That is TikTok's **initial test batch, failing.** A 200–800 plateau means the video reached the first test cluster and did not earn promotion. **Not a shadowban. Not the brand account. Not faces.** The posts are static cards on a video platform: no watch time → no completion → no promotion. The 8-view post is the algorithm giving up.

**The hooks are genuinely good** ("your pore pads might be why you're breaking out"). They're being wasted on a format with no watch time.

**Ask:** what would it take for the social pipeline to output a **shot list / script for a 15–30s video** rather than an image? That is the highest-leverage change available to Seoul Sister's social presence, and it likely helps every LGAAS subscriber, not just this one.

---

## Research backing (Jul 2026 — verify if you disagree)

- **"Business accounts get throttled" is FALSE.** TikTok's own position + Later's Jan 2026 study of 10,000 matched accounts: no significant reach difference by account type when controlling for content quality.
- **"You must show your face" is FALSE.** The algorithm is face-agnostic. Faceless = 38% of newly monetized TikTok Shop accounts in 2025, skincare the top category. **Hands-only texture demos are the proven faceless skincare format** and outconvert face-cam — this is the fallback if Bailey doesn't want her face on the brand account. **Static text cards are not.**
- **New accounts DO get a cold-start advantage** (small accounts grow ~269% faster; no social-graph tax). This is most of Bailey's 10×, and **it decays** — do not build the strategy on it.
- **Personality wins because it earns completion/saves/shares**, not because TikTok has a face detector. **Highly produced content now underperforms.** *"The post that wins isn't the one that explains skincare best; it's the one that shows up in the conversation as a person."*
- Naming **exact products** outperforms vague "my routine" content. Seoul Sister has a 6,000-product database — this is free.

---

## What NOT to do

- **Don't override AriaStar.** Fix her inputs. If you patch the advice without patching the profile, every downstream artifact still inherits the mascot.
- **Don't conclude "brand accounts are bad."** That's false, and it would send Seoul Sister chasing the wrong variable. The variable is **watchable content**, not account type.
