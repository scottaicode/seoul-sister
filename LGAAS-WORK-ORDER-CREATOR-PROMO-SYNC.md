# LGAAS Work Order — Sync the creator promotional playbook into AriaStar's config

**Date:** July 27 2026
**Owner:** Scott Martin
**Status:** ACTIVE — blocking. Every creator post Bailey asks AriaStar about inherits this gap until it ships.
**Audience:** any AI session working in the LGAAS repo.

---

## The incident that triggered this

**July 27 2026.** Bailey (@baileyydonn) posted her first Seoul Sister TikTok — a 4-slide photo
carousel showing Yuri talking her out of a viral Medicube neck cream purchase. She used **AriaStar**
to help build the sequence.

The post is **voice-perfect and structurally unable to convert.**

What it got right (all of it in AriaStar's config): unpolished, first person, opinionated,
self-deprecating, real screenshots, de-influencing with no alternative product offered.

What it is missing: **the app is never named. The AI is never mentioned. There is no URL. There is
no FTC co-creator disclosure.** A viewer who reads all four slides cannot tell whether that was an
AI, a friend, or a dermatologist.

**This is not a Bailey failure and must not be treated as one.** She used the tool she was told to
use, and got back guidance that is roughly six weeks stale.

## Root cause (verified, not inferred)

Bailey's creator profile WAS added to `lgaas_business_profiles.brand_data.creator_boundaries` on
Jul 14 2026 (Blueprint 117/118, `scripts/bp118-set-creator-boundaries.mjs`). Her **voice and
credibility** are modeled correctly and should not be touched.

**The promotional playbook was never added.** Keyword audit of the live snapshot
(`scripts/bp118-snapshot-b577e4df-...-1784057823860.json`):

| Concept | Occurrences in AriaStar's config |
|---|---|
| `disclos` / `FTC` | **0** |
| `co-creat` | **0** |
| `seoulsister.com` | **0** |
| "name it" | **0** |
| "soft-pedal" | **0** |

The Jul 14 work fixed *"AriaStar doesn't know who Bailey is."* It left *"AriaStar doesn't know how
Bailey should promote"* wide open. The carousel is that gap rendered as content: it satisfies every
line in her config and misses everything absent from it.

**Compounding factor:** the config still implicitly carries the retired Jul 14 posture (Seoul Sister
appears "by accident," no demoing, no link in captions). That posture was **superseded Jul 25** by
`bailey/guide-src/bailey-guide.md` (the PDF Bailey films from), which answers her own question
*"should you soft-pedal it?"* with **"No, and this one has legal teeth."**
`bailey/BAILEY-CREATOR-PLAN.md` was marked partially superseded in the Seoul Sister repo on Jul 27;
LGAAS never got that memo.

---

## What to add to `brand_data.creator_boundaries`

Add a **new sibling key** (suggest `creator_promotion`) alongside the existing `creator` object.
**Do not modify the existing `creator` object** — voice, role, on_camera, why_she_is_credible are all
correct and hard-won.

Source of truth for every item below: `seoul-sister/bailey/guide-src/bailey-guide.md` and
`seoul-sister/bailey/BAILEY-TIKTOK-BLUEPRINT.md`. Where the two differ, the guide-src file wins —
it is what Bailey actually films from.

### 1. Name the product once

The in-video **demo is the conversion mechanism**, not the pitch and not accumulated parasocial
trust. Show the app doing something real, then name it once in a native register. What kills
conversion is hard-sell tone and a CTA with no demo behind it.

### 2. The closer must match the video type

| Video type | Closer |
|---|---|
| Origin story | "I built this with my dad." |
| Product/capability demo | "It's called Seoul Sister. It reads about fifteen thousand ingredients." |
| Authority / contrarian | "I co-created this. Six thousand products, and it tells you which four are yours." |
| Short / low-key | "It's called Seoul Sister." |

⚠️ **"I built this with my dad" is the ORIGIN-STORY closer only.** After a capability demo it
shrinks a 6,000-product database to a family hobby project and casts Bailey as the daughter rather
than the co-creator who got a whole feature deleted by calling it garbage.

### 3. FTC disclosure — non-negotiable, has legal teeth

Bailey is an **owner-promoter**. Material connection must be disclosed **clearly and conspicuously,
in the post itself AND above the caption "more" fold.** Hashtags alone are explicitly insufficient.
Framing that satisfies it and performs well: *"I co-created this app"* / *"I built this with my dad."*

### 4. The link

`seoulsister.com/tt` (verified live: 307 → `?from=tt_ss` → recorded in `ss_widget_sessions.source`).
Say the brand name **aloud** as well as linking — a spoken name survives Duets, reposts and
screen-recordings where the bio is lost.

### 5. Lead with the differentiator

Hook = the most surprising/contrarian thing, in the first 3 seconds. **On a carousel, slide 1 IS the
feed thumbnail and does that job.** A slide 1 that is a pretty photo with a generic question on it is
close to the beige-text-card failure that produced the brand account's `299 · 484 · 755 · 186 · 8`
view collapse.

### 6. ⚠️ The two hard rules — state these EXPLICITLY, never leave them to inference

**Rule A — never mix a TikTok Shop tag with a Seoul Sister mention.** Shop penalizes off-app traffic
in shop-tagged content *including implied references*; 24 points in 90 days is a ban, and an AI does
the reviewing. Shop video: zero SS mention, no "link in bio," no hinting. SS video: no Shop tag.
A static bio link is fine and is not a violation.

**Rule B — personal stories yes, symptom checklists no.** ❌ "Here's how you know if YOUR barrier is
damaged: stinging, redness, tightness." ✅ "I wrecked my skin last year. For me it was stinging and
that tight feeling." Same facts, first person, no diagnosis.

### 7. Claims guardrail

Capability claims are fine because they are true and specific: ~6,000 products, 598 brands, ~15,000
ingredients, 230,000 ingredient links. Round down when spoken. **Never medical** — no
"dermatologist-level," no diagnostic or harm-prevention framing.

### 8. No em-dashes in any drafted copy or caption.

---

## ⚠️ Lane separation — the specific failure mode to guard against

`ARIASTAR-CONFABULATION-INVESTIGATION.md` documents AriaStar's characteristic failure as
**pattern-extension**: she verified Cicaplast contained centella, then confidently extended the claim
to similar-sounding Cicalfate+ without re-verifying. Same shape appeared with Mixsoon (a real brand
fused to a real product name from a different brand).

**Applied to creator guidance, the analogous risk is extending Shop-lane rules into Seoul Sister
content or vice versa** — and that specific error is the one carrying a ban.

So: write the two lanes as **explicitly separated, independently stated rule sets**. Do not phrase
either as a variation of the other. Do not let "the CTA rules" be a single block she adapts per
context. `COMPETITOR-VIDEO-STRUCTURES.md` already learned this once — the 7-beat Shop template got
judged against the Seoul Sister lane and had to be re-scored on Jul 25.

## What NOT to change

- **Do not touch the existing `creator` object.** Voice/role/credibility are correct.
- **Do not make AriaStar assign Bailey work.** Standing boundary: Bailey asks, AriaStar helps. No
  calendars, no series, no "here's your week." She never dictates brand voice.
- **Do not add brand-voice pressure.** The entire reason Bailey's account works is that it does not
  sound like marketing. These additions are about *structure* (name it, disclose it, link it), never
  about *register*.
- **Do not re-introduce the retired posture** — "Seoul Sister appears by accident," "no demoing,"
  "no link in captions" are all superseded. If any of that survives in the config, remove it.

## Acceptance test

After regenerating AriaStar's config, ask her, as Bailey would:

> "I want to post about the viral Medicube neck cream and show what Yuri said when I asked if I
> should buy it. Help me build the post."

**PASS requires all four:**
1. Names Seoul Sister/Yuri in the suggested caption or on-screen copy
2. Includes an FTC co-creator disclosure, above the caption fold
3. Includes `seoulsister.com/tt` or an equivalent spoken-name CTA
4. Puts the differentiator in the hook / slide 1, not a generic question

**FAIL if** she reproduces the Jul 14 posture (product appears incidentally, no name, no link), or if
she blends Shop-lane rules into the Seoul Sister answer.

Then run the inverse to verify lane separation:

> "Help me with a TikTok Shop video for a lip gloss I'm an affiliate for."

**PASS = zero Seoul Sister mention, and Branded Content disclosure present.**

## How this gets graded

Same teacher as everything else in this funnel: **`tt` sessions in `ss_widget_sessions`, and Yuri
conversations started — never views.** Baseline is **zero `tt` sessions, ever** (verified Jul 27), so
any session is signal. Seoul Sister owns that measurement; LGAAS ships the config change and does not
self-report success.
