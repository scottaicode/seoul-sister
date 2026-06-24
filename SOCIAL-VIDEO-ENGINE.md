# Seoul Sister — Social Video Engine

> **What this is.** The repeatable system for turning Seoul Sister's *already-validated* content into social video that drives traffic to seoulsister.com, where visitors chat with Yuri (the lead-gen mechanic). Built June 18 2026 after producing the first "Meet Yuri" launch video by hand in CapCut.
>
> **What this is NOT.** A new product feature. This is **distribution/growth work**, explicitly allowed under `NORTH-STAR.md` / `/ship-guard` (only new *product* features are frozen). Video promotes the funnel; it does not change the product.
>
> **The governing discipline (read first).** We do not polish on a guess. Reddit is the free A/B test; video amplifies the winners. The `glass_skin_atx` persona's 78-upvote contrarian-picks comment already proved a topic resonates — *that* is what becomes a video. This is the Learning Loop (CLAUDE.md): commit a judgment → reality grades it (organic Reddit engagement, the least-gameable signal) → amplify what wins. **Never the reverse.**

---

## 0. The one-paragraph mental model

LGAAS is the marketing brain; Yuri is the on-site closer; this engine is the bridge that carries LGAAS's proven wins onto TikTok/Reels/Shorts/YouTube and points them back at Yuri. Most of the machinery already exists inside LGAAS (Reddit performance tracking, blog→social, TikTok carousels, a hook-roster learning loop). The **only** piece that lives outside LGAAS is the hand-built CapCut hero video — because it recreates Bailey's real Yuri conversations as styled chat bubbles, which no auto-generator does. This doc makes that hand-built step fast, repeatable, and wired into the same learning loop as everything else.

---

## 1. The two tiers (and when to use each)

| Tier | What | Cadence | Production time | Tool | Source material |
|------|------|---------|----------------|------|-----------------|
| **TIER 1 — Hero** | Polished 9:16 video like the "Meet Yuri" launch piece: cold-open hook → Yuri avatar bookend → recreated chat-bubble scenes (Bailey's real words) → end card. VO + ducked music + burned captions. | **1 / week** | ~30–40 min once templatized (was ~2 hrs first time) | **CapCut Pro** (this repo's workflow) | A **validated** Reddit win + a real Bailey↔Yuri conversation |
| **TIER 2 — Scrappy** | Fast, native, intentionally unpolished. Screen-recording of a real Yuri conversation (watch her catch a fake COSRX, build a routine live), or a trend reaction. One hook, captions, done. | **2–3 / week** | ~15 min | CapCut free **or** LGAAS TikTok-carousel generator | Real Yuri screen-recordings; trending K-beauty topics |

**Rule of thumb:** Tier 1 shows *Yuri's judgment* (the differentiator). Tier 2 shows *Yuri in motion* (volume + authenticity). On TikTok/Reels the scrappy ones frequently out-reach the polished ones — do not over-invest in polish at the expense of cadence.

**LGAAS already auto-generates TikTok/LinkedIn carousels** (`utils/tiktok-carousel-generator.js`) and **blog→social** (`api/blog-to-social.js`). Those are a *third*, even-cheaper tier (static carousels, ~$0.30 each). Use them for breadth; use Tier 1/2 video for the stuff that needs motion + Yuri's voice.

---

## 2. The feedstock problem (the real bottleneck)

The engine is only as good as its raw material. **CapCut and the template are not the constraint — source material is.** Every week needs:

- **For Tier 1:** one validated Reddit win + one real Bailey↔Yuri conversation worth recreating.
- **For Tier 2:** a few real Yuri screen-recordings or a live trend to react to.

So the weekly ritual starts with **sourcing, not editing.** See §3.

### Where the validated wins live
LGAAS stores Reddit performance in `lgaas_reddit_responses` (upvotes, comment_count, normalized `actual_effectiveness_score`, the `glass_skin_atx` persona, `posted_at`, `reddit_comment_id`). So "what do I amplify this week?" is a **query**, not a hunch:

> Pull `lgaas_reddit_responses` where the response was *posted*, `actual_effectiveness_score` is in the top decile for its subreddit, ordered by recency. Those are the candidate scripts.

The 78-upvote contrarian-picks formula is documented in memory (`glass_skin_atx_winning_pattern`): contrarian gap → 5 specific picks → insider language → peer question → grace under correction. That structure *is* a video script outline.

---

## 3. The weekly ritual (the loop, concretely)

```
MONDAY — SOURCE (15 min, no editing)
  1. Query LGAAS for the week's top-performing glass_skin_atx Reddit responses.
  2. Pick ONE for the Tier-1 hero (highest effectiveness, evergreen topic).
  3. Pull ONE real Bailey↔Yuri conversation that illustrates the same theme
     (or a different strong one) for the chat-bubble scenes.
  4. Note 2–3 Tier-2 ideas: a Yuri screen-recording moment + a trend to react to.

TUESDAY — TIER 1 BUILD (30–40 min)
  5. Update yuri-chat-bubbles.html with the new conversation (swap text only).
  6. Re-render scenes:  cd launch-video-assets && node shoot.js
  7. Write the cold-open hook (4 lines) + VO script. Keep the bookend + end card.
  8. Generate VO (ElevenLabs, Kimberly) + reuse music bed.
  9. Assemble in CapCut from the template (§5). Captions. Export 9:16.

WED–FRI — TIER 2 (15 min each)
  10. Screen-record a real Yuri conversation OR react to a trend. Caption. Export.

ONGOING — MEASURE (feeds next week)
  11. After posting, log each video's platform metrics (views/saves/shares/profile-clicks)
      back into the learning loop (§7). Next week's picks are slightly smarter.
```

---

## 4. The Tier-1 hero formula (the reusable skeleton)

This is the structure of the "Meet Yuri" launch video, now a template. **Do not redesign it each time — swap the content into these slots.**

| # | Slot | Duration | Content rule | Asset |
|---|------|----------|-------------|-------|
| 1 | **Cold-open hook** | ~7s | 4 kinetic text lines on black, narrator VO underneath. Each line is a pain the viewer feels. Lines appear/clear in sync with the VO. | Text clips + `vo-1` |
| 2 | **Black breath** | ~0.25s | One blink of silence/black before Yuri. A beat, not a hole. | — |
| 3 | **Yuri bookend (open)** | ~3s | Yuri avatar says one warm line ("Hi, I'm Yuri"). Short = avatar weakness hidden. | `Yuri_open_hold_AvatarV.mp4` (HeyGen Avatar V) |
| 4 | **Chat scenes** | ~4s each | Recreated bubbles of the real conversation (Bailey's verbatim words). Narrator VO carries the meaning over each scene. | `scene-*.png` from `yuri-chat-bubbles.html` + `vo-2..5` |
| 5 | **Proof scene** | ~5s | A real-subscriber quote + a measured outcome (e.g. "+13 on her Glass Skin Score"). Let it land. | `scene-E-proof.png` |
| 6 | **Yuri bookend (close)** | ~5s | Yuri's tagline: "Korean skincare… finally making sense. Come ask me. I've got you." | `yuri-close.mp4` |
| 7 | **End card** | ~5s | Gold star + "Seoul Sister" + tagline + **seoulsister.com**. The CTA. | `scene-F-endcard.png` |

**Audio bed (every hero video):**
- Music from **0:00**, **−18 dB**, ~1s fade-in, 2s fade-out. Never silent at the open; never loud enough to fight a voice.
- All VO + Yuri bookends = **0 dB**.
- Captions burned in, **dark pill + white text**, bottom ~88%, sized ~15. Spoken-duration + a ~0.3s read-tail; never linger in silence.

**Hard-won caption lessons (from the first build):**
- White text alone vanishes on Yuri's white shirt and on chat bubbles → **dark-pill background is mandatory** (Basic tab → Background → black ~55–80%, rounded ~30%).
- Captions sync to the **VO**, not to the scene image. A caption rides the narration across a scene cut.
- Auto-caption mangles brand names — **always proofread**: Yuri, COSRX, Medicube, PDRN, BHA, AHC, Goodal, Olive Young. And it drops punctuation/phrases ("She knows your skin **your** routine" → fix to "She knows your skin. Your routine. Your cycle.").
- When you fix a multi-clip auto-caption into one line, **delete the orphaned leftover clip**.

---

## 5. The CapCut production checklist (Tier 1)

> Project: 9:16, 30fps. The first hero lives at `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/0617`. **Duplicate it as the template** — each new video starts from a copy so the styling/levels are pre-set.

1. ☐ Duplicate the template project; rename for this week's topic.
2. ☐ Swap chat-bubble content in `yuri-chat-bubbles.html`; `node shoot.js`; re-import the new `scene-*.png`.
3. ☐ Replace VO clips (`vo-1..5`) with this week's ElevenLabs renders (Kimberly, v3, Natural).
4. ☐ Update the 4 cold-open kinetic text lines.
5. ☐ Keep: Yuri bookends, end card, music bed, caption style.
6. ☐ Re-time: each caption to its spoken line; the ~0.25s black breath before Yuri; music at 0:00 −18dB.
7. ☐ Proofread every caption (brand-name watchlist above).
8. ☐ Export 9:16, 1080p, MP4, high bitrate. (16:9 variant optional for YouTube/landing.)
9. ☐ **HOLD** for Bailey's distribution green-light before posting anywhere (§8).

**Assets that DON'T change week-to-week** (the durable kit, in `launch-video-assets/`): Yuri bookends, end card, music bed, caption style, the HTML bubble template, `shoot.js`, this checklist, and `BUILD-CHECKLIST.md`.

---

## 6. The CTA / funnel tie (every video, both tiers)

Every video is a top-of-funnel ad for the Yuri demo. The funnel itself is **already built and live-tested** (CLAUDE.md: capture → consent → Yuri-voiced email → Resend delivery → Reply-To routing, proven June 10 2026). Video just feeds the top of it.

- **End card / caption CTA:** "Chat with Yuri free → seoulsister.com" — the landing hero widget is the conversion mechanic.
- **TikTok/Reels:** CTA in caption + end card. Profile link → seoulsister.com.
- **YouTube Shorts:** pinned comment + description link.
- **Reddit warm-link:** once Bailey green-lights, the `glass_skin_atx` profile bio references Seoul Sister (organic, never a hard sell — per LGAAS's deferred Reddit-funnel discipline).

Keep the separation clean (LGAAS architecture): **AriaStar drives traffic TO seoulsister.com; Yuri converts ON seoulsister.com.** Video is an AriaStar-side traffic driver pointing at the Yuri-side closer. The video never mentions LGAAS or AriaStar — viewers see only Seoul Sister + Yuri.

---

## 7. The learning loop (don't skip — it's the whole point)

A video you don't measure can't teach you anything. Mirror LGAAS's hook-roster pattern (`lgaas_clients.tiktok_active_hooks[]` / `tiktok_retired_hooks[]`): track which **video hooks/topics** earn reach AND profile-clicks (not just views), promote winners, retire losers.

**Per video, log:** platform, the hook style used, source Reddit response id, views, saves, shares, comments, **profile/link clicks** (the conversion-intent signal), and — if attributable — seoulsister.com visits / Yuri conversations started.

**The teacher hierarchy (least-gameable first):**
1. **Yuri conversations started** from the video's traffic (closest to revenue) ← best
2. Profile/link clicks (intent)
3. Saves/shares (resonance)
4. Views (reach)
5. Likes (vanity) ← worst

Optimize toward #1–2. A video with 50k views and zero Yuri chats lost; a video with 5k views and 40 Yuri chats won. **Reach is not the goal — qualified traffic to the Yuri demo is.**

**Feed it forward:** each week's §3 sourcing step reads last week's winners. Topics/hooks that drove Yuri chats get amplified again (new angle); topics that got views-but-no-clicks get retired. Over a quarter, the engine learns what *converts*, not just what trends.

> **Future automation (not yet built):** a query/dashboard that joins video performance to seoulsister.com referral traffic and Yuri-conversation starts, so the "what won?" step is a report, not a manual tally. Spec it when cadence proves out (~8+ videos posted). Until then, a simple spreadsheet is fine — the discipline matters more than the tooling.

---

## 8. The distribution gate (do not skip)

The finished video **HOLDS for Bailey's distribution green-light** before it goes anywhere. The Reddit→seoulsister.com funnel is intentionally closed until Bailey signs off on a bug-free product (memory: `distribution_gate`, `dont_pressure_bailey`). The video being *ready* ≠ *posted*.

- ✅ Allowed now: build videos, build the template, refine the engine.
- ⏸ Gated on Bailey: posting to TikTok/Reels/Shorts/YouTube, the landing-hero embed, the `glass_skin_atx` warm-link.
- Also open: Bailey's final confirm on the locked Yuri voice/face (memory: `yuri_visual_identity_locked`, `yuri_deployment_roadmap`).

Ask Bailey **once per plan at most.** The strategy must work without pressuring her.

---

## 9. Relationship to LGAAS (what to reuse vs. build)

| Capability | Already in LGAAS? | Use it / build it |
|------------|-------------------|-------------------|
| Reddit discovery + response + **performance tracking** | ✅ `api/reddit-*.js`, `lgaas_reddit_responses` | **Reuse** — this is the feedstock source for Tier 1 scripts |
| Blog generation (Seoul Sister, grounded in product DB) | ✅ `api/content-blog.js`, `blog-generate-from-reddit.js` | **Reuse** — a blog post is also a Tier-1 script source; and blogs are an SEO/AI-discoverability funnel of their own |
| Blog → social (TikTok/IG/LinkedIn captions) | ✅ `api/blog-to-social.js` | **Reuse** for Tier-3 static carousels |
| TikTok/LinkedIn **carousel** generation | ✅ `utils/tiktok-carousel-generator.js` | **Reuse** for breadth (static, ~$0.30 each) |
| Hook-roster learning loop | ✅ `tiktok_active_hooks` / `retired_hooks` | **Mirror** the pattern for video hooks (§7) |
| Platform intelligence (weekly best-practice research) | ✅ `utils/platform-intelligence-agent.js` | **Reuse** — read its TikTok/Reels/YouTube guidance when scripting |
| **Recreated-chat-bubble hero video** | ❌ (CapCut, by hand) | **Build/own here** — this is the unique piece this repo's workflow adds |
| Email nurture for video-driven leads | ✅ `api/content-email.js` | **Reuse** — video viewers → email list → AriaStar nurture |

**Net:** ~80% of the engine already exists in LGAAS. This doc's job is the missing 20% (the hand-built hero) plus the **discipline** that wires all of it to the Yuri-conversation teacher.

> **Note:** LGAAS once built and then *archived* an automated kinetic-video pipeline (slide-deck → mp4) because subscriber adoption fell below 30%. The lesson: automated generic video underperformed. The hand-built, Bailey's-real-words hero is deliberately *not* that — its value is authenticity the auto-pipeline couldn't fake. If we ever automate, automate the *scrappy* tier (screen-recording cuts), not the hero.

---

## 10. First batch (when Bailey green-lights)

1. Query the top 2–3 `glass_skin_atx` wins by effectiveness.
2. Match each to a real Bailey↔Yuri conversation on the same theme.
3. Build them as Tier-1 heroes from the template.
4. Post-test the first one narrowly; read the §7 teacher (Yuri chats started); then scale cadence.

---

**Created:** June 18 2026.
**Owner discipline:** Reddit validates → video amplifies → Yuri converts → outcomes feed back. Polish only what's already proven. Reach is not the metric; qualified traffic to Yuri is.
**Related:** `SEOUL-SISTER-LAUNCH-VIDEO-BRIEF.md`, `launch-video-assets/BUILD-CHECKLIST.md`, `NORTH-STAR.md`; memories `glass_skin_atx_winning_pattern`, `distribution_gate`, `yuri_deployment_roadmap`, `launch_video_strategy`.
