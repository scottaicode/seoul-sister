# Seoul Sister — Video Playbook (READ FIRST before making any Yuri video)

**Created:** June 21, 2026
**Purpose:** The canonical craft rules for producing ANY Seoul Sister video (launch/hero, scrappy
social, Yuri clips). A fresh AI session helping Scott make a video should read this FIRST so it knows
the proven rules without Scott having to re-explain them. These were earned by hand on the "Meet Yuri"
launch video (graded 4.2 → 6.9 → 8.6/10 by an objective critic) and validated against real Reddit
wins + a billion-view practitioner. The generalized cross-app version lives in LGAAS Blueprint 94
(`lgaas/lgaas-blueprint/94-SHORT-FORM-HERO-VIDEO-AND-TTS-PLAYBOOK.md`); THIS file is the Seoul-Sister-
local copy so it's discoverable from inside this repo.

---

## ⛔ THE NON-NEGOTIABLES (read these even if you read nothing else)

1. **Honesty is the moat. Never fabricate.** Do NOT invent narratives, inflate outcomes, or "fill
   gaps that aren't there." Seoul Sister's entire edge is honest AI advice — the corpus proved it
   (>99.6% AI-non-detection on AI-banning Reddit subs; the "buy less" thesis converts on cold
   strangers). One fabricated claim breaks the moat. Only true + specific claims.
2. **CLAIMS GUARDRAIL.** Yuri is an honest AI beauty advisor — NEVER "dermatologist-level," medical,
   diagnostic, or harm-prevention claims. Deceptive, off-brand, and legal risk (Scott has skin-cancer
   history). Allowed because true+specific: "reads 14,000+ ingredient lists," "flags ingredient
   conflicts," "knows your routine for months," "24/7." Dramatize the REAL (e.g. a real subscriber's
   measured Glass Skin arc), never inflate.
3. **The metric is conversions, NOT views.** Teacher hierarchy: **Yuri-conversations-started > link
   clicks > saves/shares > views > likes.** A 50K-view video with 0 Yuri chats is a LOSS. Optimize
   for the chat, not the reach. (North Star + `SOCIAL-VIDEO-ENGINE.md`.)
4. **HOLD for Bailey's distribution gate.** No video posts anywhere until Bailey green-lights
   (`project_distribution_gate`). Building/assembling is fine; posting is gated.
5. **Bailey's name/face never appear.** Her words may be used, attributed to "a real subscriber."
6. **No em-dashes in any drafted copy/captions/script** (AI tell).

---

## THE HERO/SHORT-FORM FORMULA (what made the launch video score 8.6)

1. **HOOK = lead with the DIFFERENTIATOR in the first 3 seconds, not the problem setup.** The single
   biggest score-mover (slow problem-intro graded "scroll past" 3/10 → leading with the surprise
   jumped HOOK to 9.5). Whatever is most surprising/contrarian goes at 0:00. The launch video led with
   **"100% AI. 0% commission." → "She'll tell you to buy less."**
2. **Compress the pain beat to ~3s, AFTER the hook** (lands as "that's me," not a boring intro).
3. **Arc:** hook → pain → relief → proof → close → endcard with URL. **Total ≤ ~50s.** Tight wins.
4. **Proof beat in near-silence** — let a real, measured number land without narration (the launch
   video used the real **48 → 62 Glass Skin Score** arc). Objective proof > narration.
5. **Swipe rate is the metric that decides everything** — the first 2-3s retention (hook + first
   visual), not the title. Aim to make the viewer not swipe in 2 seconds. (Practitioner-validated,
   BP94 §A5.)

## THE PROUD-AI PRINCIPLE (load-bearing — Yuri is openly AI)

Declare Yuri is AI, loud and proud. Never let a viewer try to read her as a real human and hit the
uncanny valley unprimed. The launch video scored TRUST 2/10 until it SAID she's AI; once she says
"I'm an AI" + a card states the honest-because-AI advantage ("no sales commission"), every uncanny
tell flips from "this person is wrong" → "wow, that's an AI" (then scored 9.5). **Honest-BECAUSE-AI
is a STRONGER trust signal than honest-human** — an AI has no commission motive. Embrace it; never
try to pass Yuri off as human.

## THE OBJECTIVE GRADING LOOP (don't skip — it's how we got from 4.2 to 8.6)

Grade every video with an **independent** critic (Gemini via Google AI Studio), prompted as a
"brutally honest short-form critic who swipes in 1.5s." Score fixed dimensions (Hook / Retention /
Emotional Arc / Clarity / Trust / Production / CTA), demand 1-10 + "the one change" + ship/no-ship.
**CRITICAL: tell the grader the brand's intentional choices** ("the AI avatar is deliberate, do NOT
penalize it") — otherwise it pattern-matches generic advice and grades the wrong thing (that exact
error cost a misleading 2/10 until corrected). Iterate to "would send to a friend" (~8.5+). The
canonical rubric prompt + the full build log are in `launch-video-assets/BUILD-CHECKLIST.md`.

## VOICE / VO

Use the **ElevenLabs TTS Playbook** (`launch-video-assets/ELEVENLABS-TTS-PLAYBOOK.md`) — the canonical
method for ALL Seoul Sister VO. Summary: 250+char blocks (not single lines), audio tags in [brackets],
punctuation IS direction, Creative stability for emotional narration, reject any take with word-drift.
Voice is LOCKED (see `project_launch_video_strategy` memory). For Yuri's avatar clips: HeyGen with the
ElevenLabs MP3 as custom audio — NEVER let HeyGen generate the audio (erases voice tuning silently).

## TOPIC SELECTION — amplify VALIDATED winners, don't guess

Reddit/organic is the free A/B test; video amplifies what ALREADY worked. The prioritized,
upvote-ranked shot list is `REDDIT-VALIDATED-VIDEO-QUEUE.md` (water sheeting test, the 89-upvote
insider listicle, PDRN de-influencing, etc.). Reverse-engineer proven-viral concepts and improve them
(3 levers: longer / higher-quality / better concept). Each video = ONE idea, ends in "ask Yuri."

## DISTRIBUTION-TIME FINISH

Layer a **trending sound** at platform post-time (boosts reach + cool factor) over the rendered music
bed. Coaching step at publish, not a re-render.

---

## What to REJECT (inoculation — from BP94 §A5, the Daniel Bitton review)

Real billion-view operators optimize for VIEWS (faceless AdSense/RPM). Seoul Sister optimizes for
CONVERSIONS + honesty. So reject, even when it would "work" for reach:
- ❌ Fabricating narratives / inventing drama (breaks the honesty moat — see Non-Negotiable #1)
- ❌ Views-over-conversions optimization (our metric is downstream of views)
- ❌ Platform-gaming (faceless volume, "for-kids" RPM-label tricks) — irrelevant + reputational risk

## Related
- `launch-video-assets/BUILD-CHECKLIST.md` (the hero video build log + rubric) ·
  `launch-video-assets/ELEVENLABS-TTS-PLAYBOOK.md`
- `REDDIT-VALIDATED-VIDEO-QUEUE.md` · `SOCIAL-VIDEO-ENGINE.md` · `SEOUL-SISTER-LEAD-GEN-PLAN.md`
- `NORTH-STAR.md` (the One Metric) · LGAAS `lgaas-blueprint/94-...` (cross-app source)
- Memory: `project_launch_video_strategy`, `project_social_video_engine`, `project_reddit_dm_proof_corpus`
