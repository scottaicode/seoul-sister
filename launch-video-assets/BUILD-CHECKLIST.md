# "Meet Yuri" Launch Video — Build Checklist

> The hands-on production guide. Strategy/script live in `../SEOUL-SISTER-LAUNCH-VIDEO-BRIEF.md`.
> Format: **9:16 vertical, ~45s.** Option (b) chosen: chat shown as clean recreated bubbles (`yuri-chat-bubbles.html`), NOT a screen-recording of the live app and NOT Bailey on camera. Bailey's real verbatim words only; she is never filmed.
> Voice = **original locked `Yuri.mp3`** (the Creative re-render was a motion experiment that didn't pan out — not canonical).
> Avatar = believability-5 HeyGen Photo Avatar — used ONLY as short bookends so the bobblehead/frozen-shoulder ceiling barely shows. The chat bubbles + VO carry the trust.

---

## THE 5 ASSETS YOU PRODUCE

### Asset 1 — Yuri avatar bookend clips (HeyGen)
Two SHORT clips (open + close). Short = avatar weakness hidden.
- **Open line** (render in ElevenLabs, original voice/Natural/v3, → HeyGen): `[warm] Hi, I'm Yuri.`
- **Close line**: `[soft smile] Korean skincare... finally making sense. Come ask me. I've got you...`
- HeyGen: AI Studio → Avatar=Yuri → Upload audio (each MP3) → **Avatar V** (motion engine — LOCKED Jun 17 2026) → 1080p, watermark OFF → download. (Per the validated flow in `../YURI-VOICE-PRODUCTION-PACKAGE.md` §5.)
- **Avatar V vs IV (Gemini eval, open clip, Jun 17 2026):** V scored 6/5/6/5/6 (believability/motion/lipsync/eye/overall) vs IV's ~5-ceiling. Motion 4→5; head rotation now "smooth, avoids rigid feel." Tell shifted from *bobblehead/mechanical sway* (IV) to *static torso / slight float* (V) — a better class of tell. Gemini: "sufficient for a 2-3 second bookend." Avatar V locked for both bookends.

### Asset 2 — Chat-bubble footage (the proof)
Open `yuri-chat-bubbles.html` in Chrome. **5 scenes (A–E)**, each a 9:16 frame with Bailey's real words. Capture each:
- **Best: screen-record** each scene (QuickTime → screen recording → crop to the scene), so you can animate a subtle scroll / a bubble appearing in the editor.
- **Or: screenshot** each scene and use as stills with a gentle zoom (Ken Burns) in the editor.
- Crop out the tiny grey scene-label (top-left) — it's a guide, not for the video.

### Asset 3 — Voiceover (the narrator)
The connective VO. Record yourself, OR generate a separate warm-narrator voice in ElevenLabs (do NOT use Yuri's voice for the VO — the narrator is a different role). Lines in the sequence below.

### Asset 4 — Cold-open B-roll (optional for v1)
A phone-at-the-mirror / skincare-shelf shot. Can skip for v1 and open on Scene A instead.

### Asset 5 — Music
One soft piano/synth pad, "morning light," low in mix. ElevenLabs Music or a licensed track.

---

## THE TIMELINE (assemble in CapCut or Descript, 9:16)

| t | Visual | Audio | Source |
|---|--------|-------|--------|
| 0–4s | (optional cold-open B-roll, or straight to Scene A) | **VO:** "You found it on TikTok. The reviews are in Korean. You're not even sure it's real... and the last dupe broke you out." | Asset 3/4 |
| 4–7s | **Yuri bookend — OPEN** (avatar clip) | **YURI:** "Hi, I'm Yuri." | Asset 1 |
| 7–11s | **Chat Scene A** (photo read) | **VO:** "She's not an influencer. She's read every ingredient list." | Asset 2 |
| 11–15s | **Chat Scene B** (buy-less) | (let bubble read, soft type-SFX) OR VO continues | Asset 2 |
| 15–19s | **Chat Scene C** (cycle-aware) | VO: "She knows your skin. Your routine. Your cycle." | Asset 2 |
| 19–23s | **Chat Scene D** (counterfeit honesty) | VO: "And she tells you the truth — even when it costs her a sale." | Asset 2 |
| 23–30s | **Chat Scene E** (the proof quote) | VO: "A real subscriber. Four months in." (let the quote land in silence) | Asset 2 |
| 30–36s | **Yuri bookend — CLOSE** (avatar clip) | **YURI:** "Korean skincare... finally making sense. Come ask me. I've got you..." | Asset 1 |
| 36–40s | End card: logo + URL on glass gradient | music resolves | make |

**Captions:** burn in over the VO/Yuri lines, clean Inter font, glass-skin styling. Most watch muted — captions are mandatory. Add in CapCut/Descript, not HeyGen.

**Runtime control:** target ~40s. If long, trim Scene B or C (keep A photo-read, D honesty, E proof — those are the strongest).

---

## ASSEMBLY ORDER (do in this sequence)
1. ☐ Render Yuri's 2 bookend MP3s (ElevenLabs, original voice) → HeyGen → 2 avatar clips
2. ☐ Capture the 5 chat scenes from the HTML (record or screenshot)
3. ☐ Record/generate the VO lines
4. ☐ Get/make the music bed + end card
5. ☐ Drop everything on a 9:16 timeline in CapCut/Descript
6. ☐ Add burned-in captions
7. ☐ Export 9:16 (and a 16:9 version for the landing page if wanted)
8. ☐ HOLD for Bailey's distribution green-light → deploy: landing hero + glass_skin_atx Reddit warm-link + TikTok/Reels/Shorts

---

## WHAT'S BUILT vs WHAT'S ON YOU
- ✅ BUILT (this session): the chat-bubble asset (`yuri-chat-bubbles.html`) with Bailey's real verbatim words, the shot-by-shot timeline, the bookend scripts, the styling, this checklist.
- ⏳ ON YOU (hands-on): render the 2 Yuri bookend clips in HeyGen, capture the bubbles, record VO, assemble in CapCut/Descript. (Claude can't render MP4s or drive a video editor.)

---

## ✅ ALL 14 ASSETS PRODUCED — Jun 17 2026 (in this folder, ready for CapCut)
| File | What | Note |
|------|------|------|
| `yuri-open.mp4` | Yuri OPEN bookend | HeyGen Avatar V, vertical, "Hi, I'm Yuri." (~1.6s) |
| `yuri-close.mp4` | Yuri CLOSE bookend | HeyGen Avatar V, vertical, "Korean skincare... finally making sense..." (~5s) |
| `scene-A-photo-read.png` … `scene-E-proof.png` | 5 chat scenes | 1080×1920, Bailey's real words |
| `scene-F-endcard.png` | End card | gold star + "Seoul Sister" Playfair + "Korean skincare, finally making sense." + seoulsister.com |
| `vo-1-coldopen.mp3` … `vo-5-subscriber.mp3` | 5 VO lines | Kimberly (ElevenLabs Library), Eleven v3, Natural stability |
| `music-bed.mp3` | Music bed | ElevenLabs "Morning Light" CINEMATIC take (`-ALT-minimalist.mp3` = fallback) |

**Avatar engine locked = Avatar V** (Gemini eval: 6/5/6/5/6, motion 4→5 vs Avatar IV; "sufficient for 2-3s bookend").
**VO voice = Kimberly** (chose over Victoria — Victoria too ubiquitous at 176K users). v3 + Natural. Keeper takes are the `_1` renders.
**Music = cinematic** (Scott's ear over the minimalist default; DUCK it under every VO line in the edit).

**Remaining = CapCut assembly only** (timeline above) → burn captions → export 9:16 → **HOLD for Bailey's distribution green-light.**

---

## v2 PUNCH-UP — Jun 19 2026 (canonical script = brief §3B)

v1 (`SeoulSister_MeetYuri_v1.mp4`) was exported + Gemini-graded 6/10 ("competent, not must-have"). v2 raises stakes + adds a relief/moat beat + real measured proof + honest identity close. Grounded in Bailey's real 358 messages + her real Glass Skin Score (48→62, +14). **Bigger bubble text already baked into `yuri-chat-bubbles.html` (15→19px) + scenes re-rendered Jun 18.**

### v2 AUDIO — RE-RECORDED Jun 19 2026 (new voice + new method) ✅ DONE
All VO re-recorded with the **SS Narrator** custom voice (replaced Kimberly — Kristy recognized it from TikTok) using the tagged-block method (see `ELEVENLABS-TTS-PLAYBOOK.md`). Yuri's 2 bookend lines also re-recorded to the higher level. **Stability = Creative** for everything (tags land harder; reject any word-drift take and regenerate). Recorded as 4 long narrator BLOCKS, split into clips in CapCut at the sentence gaps:

| Recorded block (paste into ElevenLabs) | Splits into clips | Voice |
|---|---|---|
| `[warm] You found it on TikTok. The reviews are in Korean. You're not even sure it's real… [sighs] and the last dupe broke you out. [empathetic] You've spent hundreds. Tried everything. Still standing at the mirror… guessing.` | `vo-1-coldopen` + `vo-1b-pain` (split after "broke you out.") | SS Narrator |
| `[sincere] She's not an influencer. She's read every ingredient list… all fourteen thousand of them. [warm] Then someone finally knew your skin. Remembered every product. Every reaction. For months.` | `vo-2-notinfluencer` + `vo-4b-relief` (split after "fourteen thousand of them.") | SS Narrator |
| `[warm] She knows your skin. Your routine. Your cycle. [matter-of-fact] And she'll tell you the truth. [knowing] She'll even talk you out of a sale.` | `vo-3-knows` + `vo-6-truth` (split after "Your cycle.") | SS Narrator |
| `[reassuring] The expertise of fourteen thousand ingredient lists… in your pocket. [warm] Twenty-four seven.` | `vo-8b-identity` (standalone) | SS Narrator |
| `[warm] [softly] Hi… I'm Yuri. I'm so glad you're here. Let's figure your skin out together.` | Yuri OPEN — trim to just "Hi… I'm Yuri." (breathy-warm intentional; the [softly] gives intimacy) | Yuri |
| `[warm] [reassuring] Korean skincare… finally making sense. Come ask me anything. I've got you… I really do.` | Yuri CLOSE — NO [softly] (solid/dependable, not breathy) | Yuri |

**Voice split rule (locked):** narrator = warm but NON-breathy (clarity grabs the muted scroll); Yuri = breathy-warm on the open (intimacy converts). Tags are per-block, not per-voice — no forward burden.
**`vo-5-subscriber` is DROPPED** — the proof beat is text cards (below) over near-silence, stronger than narration.

### Text cards to ADD in CapCut (v2)
| Text card: buy-less | "She'll tell you to buy *less*." | CapCut text, over scene-B |
| Text card: quote | *"I've invested so much over the years… now I just stick with what's actually working." — a real subscriber, 4 months in* | CapCut text, beat 7 |
| Text card: score | "Glass Skin Score: 48 → 62 in 4 months." | CapCut text, beat 7b (over scene-E) |

### v2 build order (FRESH CapCut project — do NOT edit the tangled v1 timeline)
1. ☐ Record the 4 new VO lines in ElevenLabs (settings above). Keep warmer of 2 takes.
2. ☐ New 9:16 / 30fps CapCut project. **Lock the text track(s) from the start** to prevent the v1 caption-drift tangle.
3. ☐ Lay video track in order: black(cold open) → Yuri_open_hold_AvatarV → scene-A → scene-B → scene-C → scene-D → scene-E → yuri-close → scene-F endcard. Use VO clips as the alignment ruler; no gaps.
4. ☐ Lay VO: vo-1 → **vo-1b** → (Yuri intro) → vo-2 → **vo-4b** → vo-3 → **vo-6** → (proof, silent) → vo-close embedded in yuri-close → **vo-8b** over endcard.
5. ☐ Music bed at 0:00, −18dB, 1s fade-in / 2s fade-out. All VO + Yuri = 0dB.
6. ☐ Captions (plain TEXT clips, NOT Pro auto-captions — avoids export gate): dark pill, white, size 15, X=0 Y=−1450, synced to spoken line + ~0.3s tail. Add the 3 text cards (buy-less / quote / score).
7. ☐ Export 9:16 1080p MP4, **Audio box CHECKED**, Format=mp4. Name `SeoulSister_MeetYuri_v2`.
8. ☐ Gemini re-grade → then HOLD (Bailey trusts the research per Scott Jun 19; no separate approval ask needed, but it does not post until the distribution gate opens).

**Claims guardrail (brief §3B):** honest AI advisor, never "dermatologist/medical." Dramatize the real, never inflate.

---

## v3 — "PROUD AI" REFRAME — Jun 19 2026 (canonical fix)

**v2 (`SeoulSister_MeetYuri_v2.mp4`, 57s) Gemini-graded 4.2/10 "scroll past."** The decisive note: TRUST 2/10 — *"selling Honesty using a synthetic AI human; the medium contradicts the message."* **Diagnosis: Gemini graded an UNLABELED synthetic human.** The video never said Yuri is AI, so a stranger tried to read her as a real person, hit the uncanny tells, and felt "off." The fix is NOT to cut the avatar (Scott: keep the Yuri clips) — it's to **declare she's AI, loud and proud** (the AriaStar precedent: Kristy's agent names herself AI in her intro and it works). A *labeled* AI advisor flips every uncanny tell from "this person is wrong" → "wow, that's an AI?" — and **honest-because-AI is STRONGER than honest-human** (an AI has no sales commission, so "buy less" is more credible, not less). Gemini had the trust logic backwards for this positioning.

### v3 changes (build on the v2 CapCut project)
1. **Re-record Yuri's OPEN to name herself as AI** (ElevenLabs, Yuri voice, Creative). New line:
   `[warm] Hi — I'm Yuri. I'm an AI… and I've read every K-beauty ingredient list there is. [softly] Let's figure your skin out.`
   → HeyGen re-render (Yuri avatar, Upload this MP3 as Recorded voice, Avatar V, portrait, 1080p watermark off) → replaces `yuri-open-NEW.mp4`. (Yuri CLOSE stays as-is.)
2. **Add "100% AI. 0% commission." card** on her reveal (the trust-flip — AI can't earn a kickback, so honesty is believable). Bold sans, lower third, ~1.5s.
3. **Add one reinforcing caption** on the buy-less beat: *"An AI with no reason to upsell you."*
4. **Tighten the cold open's first second** (Gemini's other legit note, same as v1/v2): first text card hits at 0:00 with a push-in/motion so it's alive immediately — not 3s of static text-on-black.
5. **Swap the music** — current bed reads "corporate lo-fi / LinkedIn ad." Pick something warmer or cooler (less corporate-neutral). Keep −18dB + fades.

**KEPT (Gemini noise — do NOT action):** "start with grainy real-girl UGC footage" — we have none, Bailey isn't filmed, and it's generic UGC-beats-polish advice that ignores this is a branded explainer genre. The proud-AI reframe is the real fix.

**Re-grade target:** the same rubric, but expect TRUST to jump once she's labeled AI. If still <7, read "the one change" and tune that. Then HOLD for Bailey's distribution gate.

---

## v3.1 — HOOK SURGERY — Jun 20 2026 (the last real change)

**v3 (proud-AI) Gemini-graded 6.9/10** — huge jump from v2's 4.2. PROUD-AI angle scored **10/10**, emotional arc 9/10, CTA 8/10. **Strategy validated.** The ONLY thing holding it back (flagged all 3 grades — v1/v2/v3): **the cold open is too slow.** v3 spent ~14s on problem-setup text-on-black before Yuri appeared; Gemini: *"Kill the first 14 seconds… lead with the differentiator, not the setup,"* verdict flips to "would send to a friend" if the hook is fixed. Also: 68s is ~25s too long; music reads "corporate/luxury-car," wants lo-fi/clinical-chill.

### The v3.1 hook redesign (RE-ORDER, not re-shoot — all assets exist)
**New first 5 seconds lead with the differentiator:**
1. **0:00–~1.5s** — open on Yuri (AI) immediately: trim `yuri-open-NEW-v3` so it OPENS on "I'm an AI." Card flashes: **"100% AI. 0% commission."** (Hook = the surprising de-influencing flex, not the problem.)
2. **~1.5–4s** — the buy-less differentiator FAST: jump to the punchline — text **"She'll tell you to buy LESS."** (the de-influencing hook Gemini loved). Can pull scene-B forward or use a text card.
3. **~4s on** — THEN the compressed problem beat: keep only the 2 strongest cold-open cards (**"Not even sure it's real."** + **"Still standing at the mirror… guessing."**), drop the other 4. ~3s total, not 14.
4. Then resume the validated arc: relief → cycle/truth → proof (48→62) → close → endcard.

**Other v3.1 fixes:**
- Total length 68s → target ~48-50s (the hook cut does most of this).
- Swap music → lo-fi / "clinical chill" (K-beauty aesthetic), not corporate-stock. Keep −18dB + fades.
- Lip-sync "mushy on long sentences" — Gemini says acceptable since she's openly AI. Ignore.

**Re-grade target:** 8+ / "send to a friend." Then HOLD for Bailey's distribution gate.

---

## ✅ v3.1 FINAL — Gemini-graded 8.6/10, "WOULD SEND TO A FRIEND" — Jun 20 2026 (LOCKED, pending Bailey's gate)

**Journey: v2 4.2 → v3 6.9 → v3.1 8.6.** The hook surgery + proud-AI reframe worked. Gemini's v3.1 grade:
- HOOK 9.5 (*"leading with the AI/commission angle is a masterstroke — a direct attack on the de-influencing trend"*)
- RETENTION 8.5, EMOTIONAL ARC 8.0, CLARITY 9.0
- **PROUD-AI ANGLE 9.5** (*"you turn a potential uncanny-valley weakness into a moral high ground… positioned Yuri as the only 'real' thing in a sea of paid human influencers"*)
- PRODUCTION 7.5, CTA 8.0
- **Avatar PASSED** (lip-sync stable, esp. the "fourteen thousand" line — no drift). Pacing FIXED. Claims CREDIBLE (the 48→62 score adds objective proof).
- Verdict: *"Would actually watch to the end / send to a friend. Feels like a 'life hack' tool rather than an advertisement — the gold standard for Gen Z engagement."*

**Final opening card sequence (ambiguity fix included):**
1. Yuri's face + **"100% AI. 0% commission."** (+ her VO "Hi — I'm Yuri. [confident] I'm an AI…")
2. **"She'll tell you to buy less."**
3. **"Is it even authentic?"** ← reworded from "Not even sure it's real" — that phrasing was ambiguous coming right after Yuri's AI reveal (viewer could read "is *she* real?"). "Authentic" can only mean a product, and it sets up the counterfeit scene. (Note: VO still says "not even sure it's real" under it — card paraphrases VO, which is fine.)
4. **"Still standing at the mirror… guessing."**
Then: rest of yuri-open-v3 (ingredient flex, no 2nd greeting) → scene-A → C → D → proof (48→62, silent) → yuri-close → endcard.

**DEFERRED Gemini recommendations (add later IF we revisit — NOT blocking, marginal 8.6→~9 gains, real re-edit risk):**
1. **Black text cards at 0:04–0:08 feel "PowerPoint-y"** — Gemini's "one change": overlay "Is it even authentic?" etc. over Yuri or a K-beauty product montage instead of full-screen black cards, to keep visual energy/"personhood" on Yuri. **BLOCKER: we have no product/extra Yuri footage to overlay; would require new assets + risks re-tangling the clean opening.** Defer until we have b-roll.
2. **Music = "neutral / premium-tech"** — the lo-fi swap stopped it *hurting* (no longer corporate/luxury-car), but it's not a *trending audio*. Gemini: doesn't hurt, doesn't add "cool factor." **Best fix is distribution-time:** on TikTok specifically, layer a TRENDING SOUND under/over the bed at post time (boosts reach + adds the cool factor). This is a post-day move, not an edit-now task. Scott wants to get the music more right — option for v-next: audition warmer/cooler lo-fi or a licensed track with more character; but the highest-ROI music move is trending-audio at TikTok post time.
3. **The "breath after I'm an AI" pause** — attempted (ellipsis didn't pause in v3; stretching revealed extra words; dissolve hit gap errors). Gemini did NOT flag the open as rushed at 8.6, so the pause proved unnecessary. If ever wanted: use a FROZEN STILL frame (screenshot her face, drop as a silent PNG hold) — the only method that works in this CapCut build.

**STATUS: v3.1 is the LOCKED final cut. HOLDS for Bailey's distribution green-light before posting anywhere ([[project_distribution_gate]]).** At TikTok post time, layer a trending sound (rec #2).
