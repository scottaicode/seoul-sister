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

## May 20, 2026 (morning) — Duplicate user-message bubble + Glass Skin recommender lives + bad catalog-match prose [RESOLVED in v10.7.1]

**Source**: 10 iMessage screenshots to Scott across the morning

**Verbatim quotes**:
> "This kinda stuff that's not Yuri I think we need to get rid of" (re: Glass Skin Score Recommendations panel showing PHA toner / niacinamide / vitamin C / humectant essence — Yuri herself tore them apart point-by-point because they conflicted with her Phase 2 protocol)
>
> "On the bright side she said my skins the best it's been since we started and I scored 13 points higher on glass skin 😏"
>
> "If you can see if you can send Richard my last conversation with Yuri. It keeps sending, then says she's tying then just retyped it in the box like I need to resend it"
>
> "This response also confuses me." (re: Yuri saying "Closest catalog match was 'NEEDLY Mild Enzyme Cleansing Powder', but the names don't fully overlap" when Bailey had said she used Ma:nyo Pure Cleansing Oil before Medicube)
>
> "Twice in a row (first time I thought was on me cause I left the app but then it kept happening)... She also forgot about a past conversation but I reminded her... Every since message it twice"

**Bailey's context**: Day 23 of Phase 2 (her score went up 13 points — Phase 2 is working). Was trying to swap out her Medicube PDRN cleanser. Hit three independent product issues in one session: (1) every message sent appeared as a duplicate user bubble with the textarea visually retaining the text, making her tap Send twice; (2) the Glass Skin Score recommendations panel was rendering algorithmic advice that conflicted with her treatment phase; (3) when Yuri tried to save Ma:nyo Pure Cleansing Oil to her library, the resolver returned NEEDLY Mild Enzyme Cleansing Powder as "closest match" — cross-brand false positive that Yuri surfaced honestly but Bailey found confusing.

**Status**: RESOLVED in v10.7.1 (shipped May 20, 2026, commit `a79c860`)

**Resolution context — parallel sessions**: Scott's primary PC failed to boot during this period, forcing him to a second machine where another Claude Opus 4.7 session shipped v10.7.0 on May 19 (9 coordinated fixes covering library mutation hardening, comedogenic data accuracy, holy-grail auto-detection, photo cadence, polish — addressing different Bailey iMessages from May 18-19). v10.7.0 included a strictly-better architectural fix for issue (3) above (the Ma:nyo→NEEDLY catalog-match confusion) — `resolveProductByName` extended with `match_quality` enum, new `resolveProductByNameStrict` for write paths, `executeUpdateUserProduct` rewritten with full Tool-Call Honesty. When the May 20 audit started, the working draft v10.6.6 had its own Issue C fix that returned null on cross-brand fallback — lossy by comparison. The right move on merge was to DROP the Issue C draft entirely in favor of v10.7.0's superior architecture (preserves match_quality information for Yuri to reason about — more AI-First). Issues (1) and (2) plus a proactive sweep finding had no v10.7.0 equivalent and shipped as v10.7.1 on top.

**Resolution**:

**Issue A — Duplicate user-message bubble (iOS Safari ghost-click race)**: Root cause was a synchronous double-trigger of `handleSubmit` on iOS Safari — touchend → click can fire twice on keyboard dismiss — layered on top of React state lag. Both `useYuri.sendMessage` and `ChatInput.handleSubmit` checked async React state (`isStreaming`, `canSend`) but those states don't update synchronously between two events in the same tick. Fix: added `useRef`-based synchronous guards at both layers (`isSendingRef.current` in useYuri, `submittingRef.current` in ChatInput) that flip BEFORE any work and block duplicate calls. Also force-clear `textareaRef.current.value = ''` synchronously after submit so iOS Safari's redraw lag doesn't visually retain the text and trick Bailey into re-tapping. Files: `src/hooks/useYuri.ts`, `src/components/yuri/ChatInput.tsx`.

**Issue B — Glass Skin Score Recommendations panel killed**: Fourth instance of the Yuri Sole Authority Principle being earned through a Bailey-caught violation (after Routine Intelligence v10.5.2, Weather v10.6.2, Cycle Adjustment v10.6.2). v10.6.2 explicitly deferred this fix; Bailey caught what was punted. Fix mirrors v10.6.2 weather widget pattern: KEPT the score, radar chart, dimension breakdown, analysis_notes prose, ShareCard, photo. KILLED the Recommendations bullet list on both the main results panel AND the historic-recommendations accordion in ProgressTimeline. Replaced with single CTA: *"Ask Yuri what this score means"* with `?ask=` prefill carrying overall score + lowest dimension. The Vision endpoint still generates recommendations server-side; no surface renders them. Files: `src/app/(app)/glass-skin/page.tsx`, `src/components/glass-skin/ProgressTimeline.tsx`.

**Issue C (superseded by v10.7.0, not part of v10.7.1)**: My v10.6.6 draft included a `resolveProductByName` null-on-cross-brand fix for the Ma:nyo→NEEDLY confusion. v10.7.0 shipped a strictly-better architectural fix (`match_quality` enum + `resolveProductByNameStrict` for write paths + `executeUpdateUserProduct` Tool-Call Honesty rewrite) that supersedes it. Draft dropped in merge.

**Proactive sweep — Dashboard "Yuri's Insights" widget killed**: Audit of all UI surfaces for additional Yuri Sole Authority Principle violations surfaced the worst-class instance — a widget literally named "Yuri's Insights" with a Lightbulb icon that rendered 3 product cards from `/api/learning/recommendations` as if Yuri had generated them. Pure `ss_product_effectiveness` skin-type sort. Empty state copy actively lied: *"Yuri is learning."* — fifth instance of the principle being violated, this one with explicit Yuri impersonation. Found and killed BEFORE Bailey reached it. Files: `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/YuriInsightsWidget.tsx` (deleted).

**Memory miss (Bailey's "she forgot a past conversation")**: Image 8 — Yuri said *"Hold up, I don't have a Medicube PDRN face wash swap in our conversation history"* but Bailey had discussed this previously. Logged as observation, NOT fixed this release. Yuri's behavior was actually correct per the v10.2.1 Tool-Call Honesty rule — she refused to confabulate, admitted the memory gap, accepted Bailey's reminder, and immediately gave great advice (the Zero Pore line / Phase 1 cheek-compromise callback proves she had broader phase memory intact). The miss was a Sonnet summary extraction quality issue.

**Pattern observation**: This is now the FIFTH instance of Yuri Sole Authority Principle being earned through Bailey-caught violations. The principle in CLAUDE.md is now backed by five supporting incidents. The proactive sweep added the dimension of *finding violations before Bailey does* — a discipline worth repeating each release.

---

## May 18–19, 2026 — Library mutation bugs + comedogenic false positives + subscriber detection + photo cadence [RESOLVED in v10.7.0]

**Source**: Two-day iMessage testing session with Scott (May 18–19), screenshots + verbatim quotes captured in v10.7.0 commit message (`3bf8a5d`).

**Verbatim quotes** (excerpted from v10.7.0 commit context):
> Hero Mighty Patches save came back as "Dr.ppae Honey Heel Patch" — wrong product silently substituted by fuzzy resolver
>
> COSRX Acne Pimple Master Patch never destashed — Yuri only made one of the two needed update_user_product calls during a swap
>
> Skin&Lab Retinol Lifting Roller Cream persistently tagged as Holy Grail — auto-extraction false positive from Feb 14 survived months
>
> Comedogenic warnings on SoonJung pH 5.6 Cleansing Milk: Glycerin (3/5), Carbon Black (3/5) — both false positives from bidirectional substring matching against the ss_ingredients table
>
> "This section doesn't look like its loading" — Pro subscriber Bailey was being mis-read as non-subscriber on /products/[id], shown gated teaser cards
>
> "Currently, Yuri hasn't asked for many photos, seems like every time it's me just sending them... I think Yuri should be asking for a weekly photo the start of each week"
>
> "I LOVE the ingredients sections and how there's the 'ask Yuri how it fits in your routine' much more personalized... we should have 'ask Yuri if this specific product would be good for you' once they choose a product"
>
> "can you scoot Seoul sister over its bugging me how close they are 🥺" (Yuri page header spacing)

**Status**: RESOLVED in v10.7.0 (shipped May 19, 2026, commits `3bf8a5d` + `b0eff2b`)

**Resolution**: Nine coordinated fixes across nine phases (A through I) — see CLAUDE.md v10.7.0 changelog entry for the full per-phase detail. High-level summary:
- **Phase A**: Library mutation hardening — `resolveProductByName` extended with `match_quality` (exact/all_terms/partial), new `resolveProductByNameStrict` for write paths, `executeUpdateUserProduct` rewritten with Tool-Call Honesty, DELETE cascade on library destash, two new tools (`mark_product_reaction` + `clear_product_reaction`) with ownership cross-references.
- **Phase B**: Comedogenic warning rewrite — bidirectional substring matching against `ss_ingredients` replaced with proper `ss_product_ingredients` JOIN. Glycerin and Carbon Black false positives fixed at the matching logic.
- **Phase C**: Manual reaction controls in Library UI — Heart / AlertTriangle toggle buttons on Owned cards, Untag X buttons on Tagged cards.
- **Phase D**: Holy grail auto-detection hardening — Sonnet prompt rewritten as creative brief with Skin&Lab incident as anti-example, required `supporting_quote` field, soft reactions dropped, three runtime gates (hardened reaction set + strict product resolution + ownership cross-reference).
- **Phase E**: Correction feedback loop — Sonnet extraction now produces `cleanup_actions` on corrections, automatically scrubs underlying bad data (Principle 3 closure).
- **Phase F**: Subscriber detection fix on /products/[id] — new `/api/me/subscription` endpoint using canonical `hasActiveSubscription` helper, eliminates RLS-via-anon-client path.
- **Phase G**: Product detail subscriber enrichment — Yuri CTA at top of `ProductEnrichment` with `?ask=` prefill carrying product brand + name.
- **Phase H**: Photo cadence (lite) — staleness threshold dropped from 30 to 7 days, system prompt teaches Yuri to suggest photos organically on momentum-positive moments.
- **Phase I**: Polish — LazyImage onError + fallback prop, Yuri page header spacing fix, Bailey's data cleanup via migration `v10_7_0_bailey_library_cleanup`.

**Cross-cutting principle encodings** (per Pattern 4): Tool-Call Honesty is now the rule for ALL library mutation tools, not just save_routine. Bidirectional substring matching against the master ingredients table is the wrong primitive — JOINs are the right primitive. Corrections without cleanup loops are half-built. Auto-extraction features need supporting_quote + confidence floor + cross-reference checks.

---

## May 18, 2026 (12:28 PM Central) — Browse-by-Category cards don't navigate [RESOLVED in v10.6.3]

**Source**: iMessage to Scott, ~12:28 PM Central after exploring /products page

**Verbatim opening**:
> "Amazing!!!"

**Verbatim critique** (with screenshot of /products showing the Browse-by-Category grid):
> "Hm this area isn't letting me pick one"

**Bailey's context**: After receiving Scott's v10.6.2 update summary, Bailey was exploring the app and ended up on the public marketing /products page (got there via the dashboard "Your Top Ingredients" widget's Browse button, which was incorrectly linking to /products instead of /browse). She tapped the category cards (Serums 547, Sunscreens 672, etc.) expecting them to filter to that category. Nothing happened — the cards linked to /products?category=X but /products is a static SEO page that doesn't read the query param.

**Status**: RESOLVED in v10.6.3 (shipped May 18, 2026, commit `bf39765`)

**Resolution**: Investigation surfaced a bigger architectural seam than the immediate bug. Scott brainstormed with Richard about whether the public surfaces could deliver MORE value to both subscribers AND non-subscriber friends/family being shared content. Established the **auth-aware shared surfaces** pattern:
- Same page content for both audiences (preserves SEO for unauthenticated bots)
- Nav chrome swaps based on auth (PublicNav for visitors, Header for subscribers) — new `AuthAwareNav` component
- Subscriber-shared URLs work for non-subscribers via fallback redirects (e.g., shared /browse?category=cleanser routes friends to /products?category=cleanser instead of bouncing through /login)
- Web Share API buttons on product + ingredient detail pages turn every subscriber into a potential brand ambassador with no referral-system infrastructure

7 items shipped covering: broken card fix, subscriber-link repoints (dashboard + community), /browse URL state initialization, auth-aware nav on 8 public surfaces, AppShell fallback redirect system, native share buttons. AI-First audit performed before AND after build — all changes are pure routing + display work, no AI logic touched, no recommendations generated, Yuri Sole Authority Principle preserved.

Files: new `AuthAwareNav.tsx` + `ShareButton.tsx`, modified 8 public page files + `IntelligenceWidgets.tsx` + `CommunityInsights.tsx` + `browse/page.tsx` + `AppShell.tsx` + 2 product/ingredient detail pages.

---

## May 18, 2026 (morning, 7:58 AM) — Weather widget recommendations are generic [RESOLVED in v10.6.2]

**Source**: iMessage to Scott after opening Seoul Sister for the first time post-v10.6.0 ship

**Verbatim opening reaction**:
> "Amazing!!!!!"
>
> "I LOVE it if it is Yuri!"

**Verbatim critique** (after screenshotting the dashboard "Weather & Skincare" widget showing *"9 routine adjustments suggested"* with bullets like "Switch to a lighter gel or water-based moisturizer", "Skip face oils today or use only a drop", "Apply niacinamide toner to your T-zone"):
> "Also love this idea but are they recommended by Yuri or generic based on location alone. I think all recommendations should be from Yuri at this point. Similar to how we removed the other sections since Yuri disagreed on it all based on my specific skin and journey. Would just get confusing and would be misleading if not communicating with Yuri."

**Bailey's context**: First morning waking up to v10.6.0's Skin Profile + Phase Gallery shipped overnight. Loved the new page. Opened the dashboard and immediately spotted the same anti-pattern she'd corrected three days earlier on the Routine Intelligence widget (v10.5.2). The weather widget was generating recommendations from a hardcoded `humidity > 70% → "use BHA"` rule engine (`src/lib/intelligence/weather-routine.ts` ADJUSTMENT_RULES) with zero awareness of her Phase 2 protocol (COSRX BHA already on MWF, Goodal Vita C in AM, barrier-protective Illiyoon at night).

**Status**: RESOLVED in v10.6.2 (shipped May 18, 2026, commit `99620ff`)

**Resolution**: This was the third instance of the same architectural class — algorithmic recommender competing with Yuri's authority. Beyond fixing the specific widget, this release **encoded the Yuri Sole Authority Principle as load-bearing architecture in CLAUDE.md** so future AI sessions don't reintroduce competing recommenders. Specific changes:
- Weather widget's 9-item recommendation list → "Ask Yuri how today's weather affects your routine" CTA with weather context prefilled via new `?ask=` URL parameter mechanism on /yuri. Weather DATA display retained.
- Cycle Adjustment widget on /routine: hardcoded "Routine Adjustments" + "Tips for This Phase" sections removed. Phase header and "Your Skin Right Now" skin behavior paragraph stay (observational). Yuri CTA added.
- Sunscreen page "Yuri's Picks for {skinType} skin" renamed to "Top matches for {skinType} skin" — the underlying algorithm was never Yuri-curated; the label was claiming authorship she didn't have.
- AI-First audit performed before coding, verified all changes honor Principle 2 (trust model intelligence, not rules engines) from `vibetrendai/principles.md`.

Files: `CLAUDE.md` (Yuri Sole Authority Principle section), `src/components/dashboard/WeatherRoutineWidget.tsx`, `src/components/routine/CycleAdjustment.tsx`, `src/app/(app)/sunscreen/page.tsx`, `src/app/api/sunscreen/picks/route.ts`, `src/app/(app)/yuri/page.tsx`.

---

## May 17, 2026 (evening) — Living Skin Profile feature request [RESOLVED in v10.6.0]

**Source**: iMessage to Scott, ~10 PM Central

**Verbatim quote** (text 1):
> "I think we should make a section specific to details about your individual skin once known by Yuri. Maybe in the Routine section? or maybe in another spot? I just think it'd be a good thing to go back frequently and review. Maybe even a little more detailed than this that Yuri creates and it changes based on where in the journey you are."

**Verbatim quote** (text 2):
> "I do! Also think there should be a saved spot for photos used throughout the phases to see the progress"

**Bailey's context**: Day 13 of Phase 2 BHA treatment. Had just had a long Yuri conversation that produced a deep, climate/cycle/Fitzpatrick-aware skin breakdown ("You're combination, Fitzpatrick 3, humid climate Austin...T-zone vs cheeks split is hormonal not just sebum-driven...Fitzpatrick 3 is the PIH danger zone...Humid Austin climate changes the math..."). The response was screenshot-worthy and made Bailey want to capture/revisit it outside the chat window.

**Status**: RESOLVED in v10.6.0 (shipped May 18, 2026, commit `157e763`)

**Resolution**: New `/skin-profile` page with 7 sections: header with active phase + day count, Skin Breakdown (Opus 4.7-generated prose in Yuri's voice, regenerated on phase change or 7-day floor), Phase Journey Timeline (expandable phase cards with protocol/decisions/watch-for/outcomes), Phase Photo Gallery, Current Routine Snapshot, What Yuri Has Learned (Holy Grail / Broke-Me-Out / allergies), thin-profile footer hint. New `ss_treatment_phases` and `ss_skin_breakdown_history` tables. Bailey backfilled with her actual Phase 1 + Phase 2 data. Phase extraction pipeline runs Sonnet 4.5 fire-and-forget after each Yuri conversation to keep the page alive going forward. Files: `src/app/(app)/skin-profile/page.tsx`, `src/lib/intelligence/skin-breakdown.ts`, `src/lib/yuri/treatment-phase-extractor.ts`, `src/components/skin-profile/PhasePhotoGallery.tsx`, `src/app/api/skin-profile/route.ts`, `supabase/migrations/20260518000001_add_treatment_phases_and_skin_breakdown.sql`, `scripts/backfill-bailey-phases.ts`.

---

## May 17, 2026 (evening) — Tap-to-enlarge photo in Yuri chat [RESOLVED in v10.6.0]

**Source**: iMessage to Scott, same evening

**Verbatim quote**:
> "Also once I send a photo to Yuri I can't click on the photo after it's sent to see it larger size. Would be nice but may not be possible. After I send them sometime I want to see them again after she gives her response but it's too small so have to go to photo album"

**Bailey's context**: Sent 3 photos of her chin to Yuri for a Phase 2 check-in assessment. Wanted to review them after Yuri responded but couldn't enlarge in-chat.

**Status**: RESOLVED in v10.6.0 (shipped May 18, 2026, commit `157e763`)

**Resolution**: New reusable `<ImageLightbox />` component (`src/components/ui/ImageLightbox.tsx`) with portal-mounted modal, ESC + click-outside close, left/right arrow navigation, captions. Wired into TWO surfaces in the same release: (a) the new Phase Photo Gallery on /skin-profile, (b) `src/components/yuri/ChatMessage.tsx` photo thumbnails — Bailey can now tap any photo in any Yuri conversation to view it full-size. One component, two surfaces, both fixes shipped together.

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
