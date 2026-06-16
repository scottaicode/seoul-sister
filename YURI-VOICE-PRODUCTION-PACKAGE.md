# Yuri Voice & Avatar — ElevenLabs + HeyGen Production Package

> Everything to paste into ElevenLabs to make Yuri's voice real, the "Meet Yuri" debut film scripts, and the HeyGen avatar + Gemini image-prompt workflow.
> Created June 14 2026. Merged with the AriaStar build playbook June 15 2026.
> Status: **VOICE LOCKED June 15 — "Yuri" V1 @ Natural stability, Eleven v3. Pending only Bailey confirm. Next: render production MP3s → HeyGen.**
> Face is LOCKED (K-Beauty Insider #1). See `project_yuri_visual_identity_locked` memory + deployment roadmap.

> **Path decision (settled):** Yuri uses **Path B (Voice Design — fully synthetic)**, NOT Path A (clone a real human). The AriaStar playbook leans toward cloning Scott's daughter Bailey's voice, but Yuri is a synthetic persona with a locked synthetic face — she gets a synthetic voice to match, and the strategy is built to NOT depend on Bailey. **Do not record anyone.** The "Instant/Professional Voice Clone" screen in ElevenLabs is Path A — ignore it.

> **VOICE LOCKED (June 15 2026, pending Bailey confirm): "Yuri" V1 at NATURAL stability, Eleven v3.** This is the original stronger-accent Voice-Design voice (the plain "Yuri" in My Voices, NOT "Yuri (New)"). Rubric scores via Google AI Studio (Gemini): Comprehension 10, Naturalness 8.5, Warmth 9.5, Age 10, Accent 8 (total 46).
>
> **How it was chosen — the full bracketing exercise (don't redo this):** Ran ~5 Voice-Design rolls spanning the accent spectrum (too-soft → too-strong/unintelligible) + multiple Gemini rubric evals on the same six-register script. Key findings that are now SETTLED:
> - **Accent ceiling = 8/10 in v3.** Every voice + every setting renders the accent to the same "soft but present, 1.5-gen Korean-American" zone. v3's expressive English rendering sands down heavy accents no matter how hard you push them in Voice Design. More re-rolls will NOT move this. (Proven across ~8 evals.)
> - **"Yuri (New)" (a stronger-accent re-roll) LOST to V1** — same accent (8), but lower naturalness (7) and warmth (8). Re-rolling for accent traded away quality and didn't gain accent.
> - **Creative stability did NOT beat Natural** — tied/slightly lower (45 vs 46), didn't fix the "metronomic firm-warning" it was meant to, and was less consistent take-to-take (one Creative take drifted to age-30s). Natural was already right.
> - **The "preview sounds accented, production sounds neutral" effect is the v3 expressiveness trade-off, not a bug.** Judge accent on the PRODUCTION (tagged-script) render, never the Voice-Design preview.
> - **Per-word phonetic misspelling is the surgical accent lever** (e.g. spell a casual word slightly Korean) for when a specific line needs more lilt — use in scripts, don't re-roll the whole voice.
> - Do NOT "combine" voices — ElevenLabs has no merge feature.
>
> **Still open: Bailey confirm.** Send her V1 (the locked one) + optionally "Yuri (New)" (slightly-more-Korean flavor) so she settles the only remaining taste question: warm-vs-authentic-accent. Her ear is load-bearing. After she picks, DELETE the reject voices from My Voices (4+ are cluttering it). The validated reasoning (Kristy "uncanny proximity"): a distinct characterful accent reads authentic; near-neutral on Yuri's Korean face is uncanny — but comprehension is the hard gate, and 8/10 soft-present clears it.

---

## LESSONS FROM KRISTY'S ARIASTAR BUILD (LGAAS, applied to Yuri)
*Source: `lgaas-blueprint/AVATAR-VOICE-PRODUCTION-PATTERNS.md` (10 platform patterns from Kristy's end-to-end May-18 voice/avatar session). These four most directly shape Yuri:*

1. **Uncanny proximity (Pattern 1) → validates the stronger accent.** Kristy's near-miss was making her advisor sound *almost like her*; the brain reads almost-real as "off." The fix is a clearly-distinct, intentional voice. For Yuri the parallel: a distinct Korean accent = authentic & intentional; near-neutral American on a Korean face = uncanny. Scott's stronger-accent instinct is correct.
2. **Convergence beats one ear (Patterns 2 & 9) → upgrade the gate.** Kristy locked via 5-way convergence (her ear + independent listener + Gemini rubric-scored + ChatGPT rubric-scored blind + advisor self-assessment). **Decision rule: wait for 2-of-3 agreement on a SPECIFIC failure mode before touching a slider.** Divergent reads = noise to resolve, not data to act on. Applied below in §1.
3. **Stability is an audio AND visual decision (Pattern 6).** Lower-stability (looser) audio makes the HeyGen avatar read as a *captured moment*; higher stability makes it read as a *rendered animation*. Worth knowing when watching the first HeyGen renders — if Yuri reads as "rendered animation," the Natural setting is the lever. (We tested Creative for exactly this and it didn't beat Natural on audio; revisit only if the *video* looks stiff.)
4. **HeyGen API trap (Pattern 5) — the #1 landmine.** HeyGen's ElevenLabs *API integration* silently reverts to default stability and erases all tuning, with NO error. ALWAYS: generate in ElevenLabs → download MP3 → upload to HeyGen as custom audio. (See §5.)

**One variable per tuning run (Pattern 3):** when adjusting sliders, change exactly ONE thing per generation, listen, then move the next. If you change two and it improves, you don't know which fixed it.

**Biographical attribution — MUST LOCK before the intro video ships (Pattern 4):** every video after the intro inherits whatever the intro establishes, so this is a conscious lock, not a drift. Yuri's three options: (a) first-person human backstory — uncanny/impersonation risk, implies she's real; (c) fictional advisor backstory — a fabrication the skincare-literate audience may sense, cuts against Yuri's honesty architecture; **(b) honest AI advisor — RECOMMENDED & already what the scripts do** ("I'm not an influencer with a discount code. I've actually read the ingredient list"). Option B is the only one that coheres with the Yuri Sole-Authority + tool-call-honesty principles. **LOCK = Option B.**

---

## 0. The locked settings (use these EVERY render)

| Setting | Value | Why |
|---|---|---|
| **Voice** | **"Yuri" V1** (the plain "Yuri" in My Voices — NOT "Yuri (New)") | Highest rubric score (46): warmth 9.5, naturalness 8.5, comprehension 10, age 10, accent 8 |
| **Model** | **Eleven v3** | v2 sounded AI-ish; v3 cleared Scott's bar |
| **Stability** | **Natural** (the middle of v3's Creative/Natural/Robust) | Tested: Natural beat Creative (46 vs 45) and was more consistent take-to-take. v3 snaps to 3 named zones, not a %. |
| **Similarity** | High | Keeps her consistent across renders |
| **Style Exaggeration** | Low / off | Exaggeration makes her sound forced |
| **Output Format** | MP3 44.1kHz 128kbps (or higher for final) | Fine for web + HeyGen |

### v3 formatting rules (load-bearing — this is what makes her not sound AI)
- **Audio tags in brackets** drive emotion: `[warm]`, `[light laugh]`, `[soft smile]`, `[gentle]`, `[reassuring]`. Place them at the START of the line they color.
- **Ellipses (`...`)** create natural pauses and thinking beats.
- **Sentence fragments** are good. Real people don't speak in full sentences.
- **Spell acronyms phonetically:** `B.H.A.`, `P.H.A.`, `S.P.F.`
- **Spell tricky brand names phonetically:** `Cosryx` (COSRX), `Hwa-hae` (화해), `Ol-yeong` (올영 / Olive Young Korean).
- **Korean terms** get a light authentic lilt automatically if spelled how they sound: `yuri pibu` (유리 피부 / glass skin).

### Punctuation control tricks (from AriaStar tuning — English-validated, light-test in any Korean line)
| Mark | What it does |
|------|--------------|
| `...` (ellipsis) | Contemplative pause. Use for emotional beats / "letting it land." |
| `—` (em-dash) | Mid-sentence breath, faster than an ellipsis. (Note: em-dashes are an AI tell in *written* Reddit/DM copy — fine here because this is *spoken* audio scripting, never published as text.) |
| `,` (comma) | Shortest natural breath. |
| `CAPS` | Emphasis — use sparingly, too much reads aggressive. |
| `"quotes"` | Slight mock-cadence on quoted phrases — good for distancing language (e.g. a "dupe," "expensive water"). |
| **Trailing `...` at END of every script** | Gives ElevenLabs AND HeyGen breathing room so the final word never cuts off. **Always end scripts with `...`** |

### Stability — SETTLED: Natural
Eleven v3's stability slider snaps to three named zones (Creative / **Natural** / Robust), not a percentage. **Yuri = Natural, locked by testing:** Natural scored 46 vs Creative's 45 on the same six-register script, Creative didn't fix the "metronomic firm-warning" it was meant to, and Creative was less consistent (one take drifted to age-30s). (The AriaStar playbook's 44–46% is a v2-era percentage; ignore — different model.) When tuning anything in future, change ONE variable at a time, listen, then move the next.

---

## 1. THE GATE — Bailey confirm (the voice is already chosen; this is her sign-off)

**The voice selection is DONE** (V1/Natural, via the bracketing + Gemini-rubric process in the top banner). The convergence methodology below was already run by Scott + Gemini across ~8 evals. **All that remains is Bailey's confirm** — her ear is K-beauty-native and load-bearing, so she's the final sign-off on the only open taste question (warm-vs-authentic accent).

**Send Bailey:** the locked **V1** render of the audition script below (and optionally "Yuri (New)" as a slightly-more-Korean B-option). One question: *"Does she sound like a Korean skincare expert you'd trust — and can you understand her easily?"*
- If Bailey says yes → fully locked, delete the reject voices, proceed to render the production MP3s (§2/§3).
- If Bailey says "needs more Korean accent" → note that v3's accent ceiling is 8/10 (proven); the lever is per-word phonetic spelling in scripts (§0), NOT another voice re-roll.

### Audition script (paste into Text to Speech, V1 @ Natural)
```
[warm] Hi... I'm Yuri.

So you found a Cosryx Snail Mucin and you're not sure it's real? [light laugh] Smart to check.

The real one has a slightly textured cap, and the batch code starts with a letter.

If yours doesn't... we should talk. [soft smile]

Honestly? I've read the ingredient list so you don't have to. I've got you...
```

### Reference: the convergence methodology that was used (Kristy/AriaStar — archived, already executed)
This is how the voice was locked (kept for the record + for future voice work, e.g. a second persona). Multi-evaluator convergence: rubric (Conversational Humanity 30% · Warmth 25% · Authentic-Insider read 20% · Comprehension 15% · Distinctiveness 10%) scored independently by Gemini + Scott's ear across multiple candidates, **2-of-3 agreement on a specific point before acting.** Divergence = noise to resolve, not data to act on. The six-register script below was the test instrument.

**Six-register test script (the instrument used; reuse for any future voice eval):**
```
[warm] Hi... I'm Yuri.

Here's the science: a B.H.A. like salicylic acid is oil-soluble, so it actually gets down into the pore and clears it out. That's why it works when a surface scrub doesn't.

[gentle] And hey — if your skin's been freaking out lately? That's not you doing something wrong. Barriers get stressed. We fix it together.

[warm] Okay, real talk — that twelve-step routine you saw on TikTok? You don't need it. Most of it is "expensive water." Let's build you four products that actually do something.

[firm] One thing though — do not mix that retinol with your acids on the same night. I mean it. Your face will not thank you.

So my grandmother... she never owned more than three skincare products in her life. [light laugh] And her skin was glass. That's the whole philosophy, right there.

Anyway — what's confusing you right now? Come ask me. I've got you...
```

---

## 2. THE INTRODUCTION VIDEO — "Meet Yuri" debut film (45–60s) ⭐ THE FIRST VIDEO

**This IS Yuri's introduction-to-the-public script.** "Debut film" / "Meet Yuri" / "intro video" all = this one asset. Per Kristy's AriaStar build, the intro is the canonical establishing shot — every later video inherits the tone, accent, energy, and biographical-attribution (Option B, honest AI advisor) it sets. Build this FIRST.

This is the asset (landing-page hero, Reddit warm-link, "Meet Yuri" module, social anchor). Render the voice track in ElevenLabs, then it feeds HeyGen for the talking-head segments. Hold the public "premiere" until Bailey green-lights distribution — but build the asset now.

### Voice track — paste this as ONE generation (so pacing flows)
```
[warm] Hi... I'm Yuri.

You found something on TikTok. Everyone swears by it. [light laugh] But the label's in Korean, you're not sure it's even real... and you've already been burned by a "dupe" that broke you out.

[gentle] I know that feeling.

[warm] I'm not an influencer with a discount code. I've actually read the ingredient list — all of it. I know what's in your routine, what fights what... and what's just expensive water.

Ask me anything about Korean skincare, and I'll tell you the truth. [soft smile] Even when the truth is "save your money."

So... what's confusing you right now?

[warm] Come ask me. I've got you...
```

**Render note:** if 60s feels long, cut the "expensive water" sentence — it's the most disposable line. Keep "save your money," it's the trust-earning beat.

### On-screen captions (burn in — most watch muted)
Match the spoken lines, clean type, glass-skin brand. Break captions at the ellipses and tag boundaries for natural rhythm.

### Visual / cutaway plan (for HeyGen + editor)
- **Talking-head segments:** HeyGen avatar (locked portrait + Yuri V1 voice), looking at camera. Hold 1 beat of eye contact before the first "Hi."
- **Cutaways** (generate as Nano Banana 2 stills + light motion): Korean product shelves; a phone scanning a label; an ingredient list close-up; bright Seoul-apartment aesthetic. Cut to cutaways during the "problem" section (5–20s), back to her face for the trust lines.
- **End card:** logo + "Yuri — your K-beauty advisor at seoulsister.com" hold 2s.
- **Make a 9:16 vertical cut too** — TikTok/Reels/Shorts is where the audience actually is.

---

## 3. THE 15-SECOND HERO CLIP (autoplay-muted "Meet Yuri" module)

Shorter, low-motion — stays in HeyGen's strong zone. This is the AriaStar conversion mechanic for the landing-page hero.
```
[warm] Hi... I'm Yuri.

I help women like you make sense of Korean skincare — without the marketing noise. [light laugh]

Got a product you're not sure about? A routine that just... isn't working?

Ask me. I've actually read the ingredient list. [soft smile]

I've got you...
```

---

## 4. REUSABLE LINE BANK (for widget intro, onboarding greeting, social)

Render these once, keep the MP3s as brand assets.

**Widget / first-touch greeting:**
```
[warm] Hey — I'm Yuri. Ask me anything about Korean skincare. Real answers, no marketing noise. [soft smile]...
```

**Onboarding welcome (post-signup):**
```
[warm] Okay, you're in. [light laugh] Let's figure out your skin together — tell me the one thing that drives you crazy about it...
```

**Counterfeit-check signature line:**
```
[gentle] Send me a photo of the label. I'll tell you if it's the real thing... and exactly what to look for next time...
```

---

## 5. HEYGEN — THE NON-NEGOTIABLE AUDIO RULE

**Do NOT let HeyGen generate Yuri's audio.** HeyGen has an ElevenLabs integration, but it uses DEFAULT settings — which throws away all your stability tuning and the v3 audio tags, and she'll sound AI again. This was AriaStar's single most important production lesson.

**The correct workflow every time:**
1. Write/finalize the script (with audio tags + trailing `...`)
2. Generate in **ElevenLabs** on the locked settings (§0): V1 voice, v3, Natural
3. **Download the tuned MP3**
4. In HeyGen → select the Yuri avatar → **"Upload Custom Audio"** → upload your MP3
5. HeyGen lip-syncs the avatar to YOUR audio
6. Render in the aspect ratio you need (one avatar → 16:9, 9:16, 1:1 from one script)

The avatar source frame is the locked K-Beauty Insider #1 portrait. It already has a soft closed-lip, front-facing composition — likely usable as-is. Only do a Nano Banana image-edit ("same woman, soft closed-lip resting mouth, facing camera") if HeyGen's lipsync drifts on the resting mouth.

---

## 6. PRODUCTION SEQUENCE (where each piece goes)

1. ✅ Voice LOCKED — V1 @ Natural, v3 (via bracketing + Gemini rubric, ~8 evals).
2. ⏳ **Bailey confirm** (§1) — her sign-off on the locked voice. Can run in parallel with step 3.
3. Render §2 + §3 voice tracks on locked settings → download MP3s. **(← NEXT ACTION)**
4. HeyGen: upload Yuri avatar (locked portrait), **upload tuned MP3 as custom audio** (§5 — never HeyGen's default audio), render talking-head segments.
5. Generate cutaway B-roll (Nano Banana 2, using the §8 DNA + variation prompts) + burn captions + add soft music (ElevenLabs Music tool or licensed track — single piano/synth pad, "morning light," low in mix).
6. Assemble in CapCut/Descript. Export 16:9 + 9:16.
7. **Hold** until Bailey green-lights distribution → deploy as landing-page hero + Reddit warm-link + social.
8. (Optional) YouTube "premiere" is just one distribution of the finished asset — only worth it once there's traffic. Reels/Shorts/TikTok + landing hero will out-convert it for this audience.

---

## 7. COST NOTE
ElevenLabs Creator/Pro ($22–99/mo) covers the voice. HeyGen runs $24–89/mo by minutes needed. Voice Design is free; voice generations are ~240–350 credits each and Scott has ~297k. No marginal-cost concern for iterating. (Total Yuri infra ~$70–210/mo; each $39.99 Pro sub pays it back in 1–2 subs.)

---

## 8. WORKING WITH GEMINI (NANO BANANA 2) ON YURI AVATAR VARIATIONS

For every avatar scene beyond the locked master (vanity, bedroom, outdoors, holding product…), use Gemini image-edits anchored to a reusable "Yuri DNA prompt." Post-lock, ALL variations are image-edits of the master — never fresh text prompts (a text re-roll produces a DIFFERENT woman).

### The five rules for Gemini image prompts
1. **Lead with the hardest constraint, stated twice.** If face preservation is the goal, the FIRST and LAST sentences should both say it. Gemini weights the opening heaviest and the close as a reinforcement check.
2. **Paragraphs for instructions, bullets only for lists** (wardrobe colors, props, background elements). Long bullet stacks make Gemini weight every item equally and lose priority.
3. **Name the failure modes explicitly:** "Do not add additional people. Do not change ethnicity. Do not alter facial structure." Naming the failure is how you prevent it.
4. **Extract the visual DNA once, reuse it.** Decode the canonical image into one detailed paragraph (the "DNA prompt"), then paste that block at the top of every variation. It's the consistency lock.
5. **Test one variation before scaling.** Generate one, evaluate, refine, then do the rest. One-shot attempts waste credits and drift.

### Step 1 — Extract the Yuri DNA prompt (do once)
Upload the **locked master** (K-Beauty Insider #1) to Gemini with:
> Describe this woman in detail for image generation purposes. Be specific enough that another AI could recreate her exact identity in a different scene. Include: facial features (eye shape, mouth, jaw, skin tone, nose, age range); hair (length, color, texture, parting, styling); expression (mouth position, eye direction, energy); wardrobe (specific colors, fabric, fit, neckline); lighting quality (direction, color temperature, softness); background style (setting, props, color palette). Write it as a single reusable paragraph I can paste into future prompts.

Save the output. **That paragraph is the Yuri DNA prompt.** Every future Yuri image starts with it.

### Step 2 — Variation template (reuse for any scene)
> [PASTE YURI DNA PROMPT]
>
> Generate one photorealistic image of this exact woman in a new setting: [scene in 1–2 sentences]. Keep her facial structure, hair, age, ethnicity, and overall identity exactly the same as described above. Only change the setting, pose, and any specified wardrobe color while keeping wardrobe style consistent.
>
> Setting details: [lighting, props, mood]
>
> Critical constraints:
> - Preserve facial identity exactly
> - Do not add additional people
> - Do not change ethnicity or age
> - Single subject only, photorealistic (no illustration/stylization)
>
> Portrait orientation, 3:4 aspect ratio, her face and shoulders filling most of the frame. *(pin aspect ratio every time — Nano Banana is non-deterministic without it)*

### Step 3 — Worked example: "Yuri applying serum at her vanity"
> [Yuri DNA paragraph]
>
> Generate one photorealistic image of this exact woman seated at a soft-lit vanity, gently applying skincare serum to her cheek with her fingertips, looking into the mirror with a calm, focused expression. Keep her facial structure, hair, age, ethnicity, and overall identity exactly the same as described above.
>
> Setting details:
> - Cream and warm-wood vanity with a round mirror
> - Soft morning light from a window on the left
> - 3–4 minimalist skincare bottles on the surface
> - Warm cream/beige palette, cozy lived-in feel (not a stark studio)
>
> Critical constraints:
> - Preserve facial identity exactly
> - Do not add additional people
> - Do not change ethnicity or age
> - Single subject only, photorealistic

### Honest limits to expect
- **Face preservation degrades with each generation** — the first variation off the master is closest; by ~variation 10 drift accumulates. Re-anchor to the locked master, don't chain edits off edits.
- **Group shots break** — never put Yuri in a scene with other AI-generated people. Composite into a real photo in post if ever needed.
- **Korean text in images is unreliable** — Gemini hallucinates Hangul on labels/signage. Leave product labels blank or composite in post. **Zoom-check any background labels** before using — the skincare-literate audience will.
- **One canonical image, locked early** — the master is already locked (do not drift to a "better" image later; consistency builds trust).
