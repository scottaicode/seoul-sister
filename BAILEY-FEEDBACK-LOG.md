# Bailey Feedback Log

> **Purpose**: Bailey is Seoul Sister's lighthouse user — Scott's daughter, in Austin, mid-Phase 2 of a real hormonal-acne treatment plan with Yuri. Her real-world feedback is the highest-signal product input we have. This log captures her actual quotes, dates, status, and resolution so context doesn't get lost between AI sessions.
>
> **For future AI sessions**: When Scott shares new Bailey feedback, append to this log with date + verbatim quote + initial AI read. Don't rewrite her words. Don't summarize her feelings. She has earned the right to be quoted directly.

---

## Convention

Each entry includes:
- **Date** (US/Central, Bailey's timezone)
- **Source** (iMessage to Scott / Yuri conversation / app screenshot)
- **Verbatim quote** (do not paraphrase)
- **Bailey's context** at the time (what phase, what she was looking at)
- **Status** (open / resolved / planned / wontfix / observation)
- **Resolution** (release version + 1-line summary)

---

## May 17, 2026 (evening) — Living Skin Profile feature request [PLANNED]

**Source**: iMessage to Scott, ~10 PM Central

**Verbatim quote** (text 1):
> "I think we should make a section specific to details about your individual skin once known by Yuri. Maybe in the Routine section? or maybe in another spot? I just think it'd be a good thing to go back frequently and review. Maybe even a little more detailed than this that Yuri creates and it changes based on where in the journey you are."

**Verbatim quote** (text 2):
> "I do! Also think there should be a saved spot for photos used throughout the phases to see the progress"

**Bailey's context**: Day 13 of Phase 2 BHA treatment. Had just had a long Yuri conversation that produced a deep, climate/cycle/Fitzpatrick-aware skin breakdown ("You're combination, Fitzpatrick 3, humid climate Austin...T-zone vs cheeks split is hormonal not just sebum-driven...Fitzpatrick 3 is the PIH danger zone...Humid Austin climate changes the math..."). The response was screenshot-worthy and made Bailey want to capture/revisit it outside the chat window.

**Status**: PLANNED — blueprinted for v10.6.0 in `PHASE-13D-LIVING-SKIN-PROFILE.md`

**Resolution**: Not yet shipped. Next AI session to implement.

---

## May 17, 2026 (evening) — Tap-to-enlarge photo in Yuri chat [OPEN — small UX fix]

**Source**: iMessage to Scott, same evening

**Verbatim quote**:
> "Also once I send a photo to Yuri I can't click on the photo after it's sent to see it larger size. Would be nice but may not be possible. After I send them sometime I want to see them again after she gives her response but it's too small so have to go to photo album"

**Bailey's context**: Sent 3 photos of her chin to Yuri for a Phase 2 check-in assessment. Wanted to review them after Yuri responded but couldn't enlarge in-chat.

**Status**: OPEN

**Recommended scope**: 1-2 hour UI fix. Add a lightbox component to Yuri's chat photo display. Per Phase 13.D blueprint, the SAME lightbox component should be built and reused for the Phase Photo Gallery. Worth shipping in same release.

**Resolution**: Bundled into v10.6.0 implementation.

---

## May 17, 2026 (afternoon, ~3 PM) — Kill the algorithmic recommender [RESOLVED in v10.5.2]

**Source**: iMessage to Scott

**Verbatim quotes**:
> "Also think we need to change this," (with screenshot of Routine Intelligence widget recommending Arginine, Candelilla Wax, Stearalkonium Hectorite)
>
> "Also doesn't look like this is working right" (with screenshot of broken Glass Skin Progress chart — two floating dots, no line between them)
>
> "I think we just get rid of the 'recommended' part all together. Whatevers recommended Yuri does it"

**Bailey's context**: Opened her routine page. The Routine Intelligence widget was recommending pH buffers, waxes, and clay viscosity agents as "high-value missing ingredients" for combination skin/pores concern. She then asked Yuri about it. Yuri herself diagnosed the widget as broken: *"that Routine Intelligence panel runs on a separate algorithm from me. It scans your routine's ingredient list against a database of 'pores' ingredients and flags what's missing by frequency. It doesn't know your full context, your phase plan, or why I built what I built."*

**Status**: RESOLVED in v10.5.2 (shipped May 17, 2026, commit `2552a96`)

**Resolution**:
- Widget removed from `src/components/routine/RoutineEffectiveness.tsx`
- `getMissingHighValueIngredients` call removed from `/api/routine/effectiveness/route.ts`
- 87 bootstrap effectiveness rows deleted via `supabase/migrations/20260517000001_clean_bootstrap_effectiveness_data.sql` (waxes, glycols, thickeners, silicones, surfactants, preservatives, pH buffers, colorants — preserving legit hydrators/soothers/botanicals)
- Glass Skin Progress chart bug fixed in `src/components/glass-skin/ProgressTimeline.tsx` (SVG path was using percentage strings, which is invalid syntax — switched to viewBox numeric units)

---

## May 8, 2026 — Proactive ingredient overlap detection [RESOLVED in v10.4.0]

**Source**: Direct conversation with Scott

**Verbatim quote** (paraphrased — original was verbal):
> "I want Yuri to recognize problems like that without me having to bring it up."

**Bailey's context**: Bailey had asked Yuri whether stacking niacinamide across 5 products was wasteful. Yuri agreed it was. Bailey's complaint was that she shouldn't have had to ask — Yuri should have noticed and surfaced it.

**Status**: RESOLVED in v10.4.0

**Resolution**: New `src/lib/intelligence/ingredient-overlap.ts` module. Yuri now sees stacked actives across user routine + inventory and can flag redundancy proactively. `is_active = true` gate filters out fillers. Wired into Yuri's context, system prompt Quick Reminders, scan enrichment, and product detail enrichment.

---

## May 4, 2026 — Date/day-of-week confusion [RESOLVED in v10.5.0]

**Source**: Yuri conversation, observed during audit

**Verbatim quote** (from Yuri, May 4, 03:01 UTC = May 3, 10:01 PM Austin):
> Yuri said: "Yes, tomorrow (Tuesday May 5th) is Phase 2 Day 1."
> Bailey responded: "Tomorrow is monday?"

**Bailey's context**: Bailey was Sun May 3 evening Austin time. Yuri's server clock was UTC, where it was already Mon May 4. The pre-computed "tomorrow" was therefore wrong from Bailey's timezone perspective.

**Status**: RESOLVED in v10.5.0

**Resolution**: New `timezone` column on `ss_user_profiles`. Bailey backfilled to `America/Chicago`. Date injection rewritten using `Intl.DateTimeFormat` with IANA timezone. RIGHT NOW block placed at end of system prompt with authoritative framing.

---

## Pattern observations

Looking across Bailey's feedback over time, a few patterns are worth tracking:

### Pattern 1: Bailey identifies architectural seams before users do

When Bailey says *"this should be saved somewhere I can review"* (May 17) or *"do you not communicate with the routine section?"* (May 17 to Yuri), she's identifying the architectural seam between Yuri-as-conversation and Yuri-as-persistent-intelligence. These are the moments where Seoul Sister needs to evolve from "AI chat with side panels" to "AI advisor whose intelligence is captured and surfaceable."

### Pattern 2: Bailey trusts Yuri, wants Yuri to be the source of truth

*"Whatever's recommended Yuri does it"* is a mandate. Don't build parallel recommender systems that compete with Yuri. Yuri should be the sole authority. Other surfaces consolidate or display what Yuri already knows — they don't generate independent recommendations.

### Pattern 3: Bailey wants visual receipts

Photo galleries, progress charts, before/after — Bailey repeatedly asks for visual progress tracking. Glass Skin Score is the foundation; the Phase Photo Gallery extension lives in the v10.6.0 blueprint.

### Pattern 4: Bailey corrects, doesn't complain

Her tone is consistently constructive. "I think we should..." not "this is broken." That's a high-signal user behavior — she's invested in the product getting better, not just venting.

---

## Future AI session note

If Scott shares new Bailey feedback in your session, **append to this file with the same structure**. Do not modify existing entries (they're historical record). Place new entries at the TOP under the convention header, descending date order.

If a Bailey ask spans multiple releases or evolves over time, keep separate entries with cross-references rather than rewriting history.

If you're the AI building v10.6.0 from `PHASE-13D-LIVING-SKIN-PROFILE.md`, when you complete it: update the "Living Skin Profile feature request" entry above to `RESOLVED in v10.6.0` and add the release commit hash.
