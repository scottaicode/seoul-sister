# Phase 13.D — Living Skin Profile + Phase Progress Photo Gallery

> **For the AI building this**: Read this entire document before writing code. Also read `BAILEY-FEEDBACK-LOG.md` for the verbatim user quotes that drove this work. The CLAUDE.md project root has the broader codebase context. This blueprint is the result of a planning conversation between Scott and the previous AI — execute the plan, ask Scott only when a real design decision needs his input.

---

## What Bailey actually asked for (the source of truth)

On May 17, 2026, evening, Bailey (Scott's daughter, primary real-world user on Phase 2 of a hormonal-acne treatment plan with Yuri) sent Scott three iMessage texts after a deep Yuri conversation that produced this response:

> *"You're combination, Fitzpatrick 3, humid climate (Austin), but the more useful framing is what that actually means for how your skin behaves day-to-day:*
>
> *Your T-zone vs cheeks split is hormonal, not just sebum-driven. Classic combo skin runs oily T-zone / normal cheeks all the time. Yours flares on the chin and jaw on a cycle pattern (the closed comedones we're treating in Phase 2) while your cheeks lean dry-to-normal and can tip into barrier compromise fast, which is exactly what happened with the Zero Pore Pads. That's not 'two skin types fighting', that's androgen-sensitive sebaceous glands in the lower face plus a thinner lipid barrier on the cheeks. Two different problems, two different treatment zones.*
>
> *Fitzpatrick 3 is the PIH danger zone. You tan before you burn, and you pigment in response to any inflammation, pimples, picking, over-exfoliation, even aggressive actives. This is why I'm cautious about the lancet and why we built Phase 1 around barrier repair before touching brightening. Your skin punishes trauma with months of dark marks, not days.*
>
> *Humid Austin climate changes the math. You don't need heavy occlusives most of the year (Illiyoon is actually borderline-rich for your climate, we use it because your barrier needed it). Humidity means humectants like glycerin and HA pull moisture from the air into your skin, great. But it also means sweat + sebum + sunscreen sits on your face longer, which feeds chin congestion. Double cleansing matters more for you than it would in, say, Seoul winter."*

Bailey's response (texted to Scott directly):

> **Text 1:** *"I think we should make a section specific to details about your individual skin once known by Yuri. Maybe in the Routine section? or maybe in another spot? I just think it'd be a good thing to go back frequently and review. Maybe even a little more detailed than this that Yuri creates and it changes based on where in the journey you are."*
>
> **Text 2:** *"I do! Also think there should be a saved spot for photos used throughout the phases to see the progress."*
>
> **Text 3 (UX paper-cut, scope-separately):** *"Also once I send a photo to Yuri I can't click on the photo after it's sent to see it larger size. Would be nice but may not be possible. After I send them sometime I want to see them again after she gives her response but it's too small so have to go to photo album."*

**This is a user-driven feature request from the lighthouse user, NOT a backend optimization the previous AI dreamed up.** The mental model Bailey is building: *Yuri is my advisor; my Skin Profile is the living document she maintains; my Routine is the active plan; my Progress Photos are the receipts.*

Seoul Sister currently has the first piece (Yuri chat) and a thin third (Routine page) but lacks the second (Living Skin Profile) and fourth (Phase Photo Gallery). This phase builds those two.

---

## Design philosophy (read this before designing anything)

1. **User-visible, not backend-only.** Earlier internal notes called this "Treatment Plan as first-class entity table" — a hidden data layer for Yuri to read from. That framing was wrong. Bailey wants a *page she can visit*, not a faster context loader for Yuri. Build the page first, data layer in service of the page.

2. **Yuri remains the sole recommender.** Bailey's May 17 ask was *"whatever's recommended Yuri does it."* v10.5.2 killed the algorithmic Routine Intelligence widget on the routine page. Do NOT replace it with a different algorithmic recommender. The Skin Profile page surfaces what Yuri has already said — it does not generate new recommendations independently.

3. **The Profile is alive, not static.** Bailey said *"it changes based on where in the journey you are."* This means the Skin Profile reflects current treatment phase, current routine, recent Yuri observations. It is not a one-time onboarding capture.

4. **The Profile is a deeper version of what Yuri already said.** Not a parallel intelligence system. The data already exists in `ss_user_profiles` (static facts), `ss_yuri_conversations.summary` (Yuri's prose observations), `decision_memory` JSONB (structured commitments/decisions/corrections), `ss_user_routines` + `ss_user_products` (current plan + inventory), `ss_glass_skin_scores` (visual progress). The Profile page is a *consolidating view* of all of this with structure.

5. **AI-First, no templates.** Per CLAUDE.md project principles: when Yuri-style synthesis is needed for the page (e.g. "your skin in plain English"), call Sonnet/Opus to summarize — don't build template-based renderers. The deep skin breakdown Bailey screenshotted came from Yuri's actual response style; replicate that, don't compose canned strings.

6. **Photos are tied to phases AND to scores.** Don't reinvent the Glass Skin Score table. Existing `ss_glass_skin_scores` already stores photos with dates and overall scores. The Phase Photo Gallery should *tag* existing Glass Skin photos with their treatment phase context (which Bailey was in when she took it) and offer a phase-grouped visual view.

---

## The data layer

### Existing tables this feature uses (read-only or extend, do not duplicate)

| Table | Use |
|---|---|
| `ss_user_profiles` | Static facts: skin_type, skin_concerns, fitzpatrick_scale, climate, location_text, age_range, cycle_tracking_enabled, timezone |
| `ss_yuri_conversations.summary` | Yuri's prose observations across conversations |
| `ss_yuri_conversations.decision_memory` | Structured decisions/preferences/commitments/corrections |
| `ss_user_routines` + `ss_routine_products` | Current AM/PM routines (active flag, name like "Phase 2 PM Routine") |
| `ss_user_products` | What Bailey owns vs planned-only |
| `ss_glass_skin_scores` | Existing 5-dimension scores with photo references + analysis_notes + recommendations |
| `ss_user_product_reactions` | Holy Grail / Broke Me Out tags |
| `ss_user_cycle_tracking` | Cycle entries if opted in |

### One new table

**`ss_treatment_phases`** — captures the phased treatment plan Yuri runs with the user. Bailey's current data: Phase 1 (barrier repair, Feb-Apr), Phase 2 (active treatment, May 5 → present), eventual Phase 3 (brightening).

```sql
CREATE TABLE ss_treatment_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Phase identity
  phase_number INTEGER NOT NULL,           -- 1, 2, 3...
  name TEXT NOT NULL,                       -- "Barrier Repair", "Active Treatment", "Brightening"
  goal TEXT,                                -- "Restore moisture barrier after Zero Pore Pads damage"

  -- Phase lifecycle
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'paused')),
  started_at TIMESTAMPTZ,                   -- When Yuri started this phase (NULL if not yet started)
  completed_at TIMESTAMPTZ,                 -- When Yuri marked it complete

  -- Phase content (JSONB for flexibility — Yuri's phase structure varies)
  protocol JSONB DEFAULT '{}',              -- { "am_actives": [...], "pm_actives": [...], "frequency": "MWF", ... }
  decisions JSONB DEFAULT '[]',             -- Specific decisions Yuri made for this phase (subset of decision_memory filtered to this phase)
  watch_for JSONB DEFAULT '[]',             -- Yuri's "watch for X" list (PIE marks, barrier compromise, etc.)

  -- Source attribution
  created_from_conversation_id UUID REFERENCES ss_yuri_conversations(id),
  last_yuri_update_at TIMESTAMPTZ,          -- When Yuri last modified this phase's content

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, phase_number)
);

CREATE INDEX idx_treatment_phases_user_status ON ss_treatment_phases(user_id, status);
CREATE INDEX idx_treatment_phases_user_phase ON ss_treatment_phases(user_id, phase_number);

ALTER TABLE ss_treatment_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phases"
  ON ss_treatment_phases FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE happens via service_role from Yuri's extraction pipeline,
-- not directly from authenticated users. Users cannot edit phases from UI.
CREATE POLICY "Service role manages phases"
  ON ss_treatment_phases FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_treatment_phases_updated_at
  BEFORE UPDATE ON ss_treatment_phases
  FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
```

### One column added to existing table

**`ss_glass_skin_scores.treatment_phase_id`** — soft link Glass Skin photos to the phase they were taken during. Nullable (photos taken before phase tracking existed stay null).

```sql
ALTER TABLE ss_glass_skin_scores
  ADD COLUMN IF NOT EXISTS treatment_phase_id UUID REFERENCES ss_treatment_phases(id);

CREATE INDEX IF NOT EXISTS idx_glass_skin_scores_phase
  ON ss_glass_skin_scores(treatment_phase_id) WHERE treatment_phase_id IS NOT NULL;
```

When a Glass Skin photo is saved going forward, the API route should look up the user's currently-active phase and tag the photo. Existing photos can be backfilled in a one-shot script using date ranges (Phase 1 = before May 5, Phase 2 = May 5+).

---

## The phase extraction pipeline

This is the engine that keeps the Skin Profile alive without burdening Yuri with structured-output prompts.

### Approach: lazy extraction, not real-time

**DO NOT** modify Yuri's main chat prompt to require structured phase output. That would degrade her conversational quality.

**DO** add a background Sonnet job that runs after every Yuri conversation (same pattern as the existing summary generation in `src/lib/yuri/advisor.ts`). The job:

1. Reads the latest conversation messages + existing `ss_treatment_phases` rows for this user
2. Asks Sonnet: "Is the user starting a new phase, completing a phase, or continuing the current phase? If new/changing, extract the phase content."
3. Upserts `ss_treatment_phases` accordingly
4. Updates `last_yuri_update_at`

Reference implementation pattern: `src/lib/yuri/memory.ts` `extractAndSaveDecisionMemory()` is the closest existing analog. Build `extractAndSaveTreatmentPhases()` alongside it. Use the same fire-and-forget pattern (call via `void` in advisor.ts after streaming completes, never blocks user response).

### Sonnet prompt structure (write this prompt yourself, this is a hint not a copy)

The prompt should:
- Be Sonnet 4.5 (cheap, structured-output-friendly)
- Take the last ~10 messages + existing phases JSON as input
- Return JSON matching the table schema (phase_number, name, goal, protocol, decisions, watch_for, status)
- Return `{"action": "no_change"}` when conversation doesn't touch phase planning
- Never invent phases that aren't grounded in conversation text
- Use the LGAAS `detectAndUpsertSubscriberProjects()` pattern from `lgaas/api/advisor-conversation.js` lines 825+ as inspiration — but adapted for skincare phases instead of marketing projects

### Backfill for Bailey

Bailey's existing data has clear Phase 1 → Phase 2 transitions in her conversation summaries. Write a one-shot script (`scripts/backfill-bailey-phases.ts`) that reads her conversation summaries and seeds:

- Phase 1: Barrier Repair (Feb 23 → May 4, status=completed)
- Phase 2: Active Treatment (May 5 → present, status=active, protocol = {am: Goodal Vita C, pm_mwf: COSRX BHA, ...})

Run script once after migration applies. Future users get phases auto-extracted from day one.

---

## The Skin Profile page

### URL and nav placement

Bailey's question: *"Maybe in the Routine section? or maybe in another spot?"*

**My recommendation: dedicated nav item.** The Skin Profile is conceptually distinct from the Routine (the routine is what you DO; the profile is who you ARE). Squeezing it into routine page conflates two mental models.

Add to nav:
- `/profile` (currently account settings) → rename internally to `/account` or keep as is
- `/skin` ← NEW Living Skin Profile page

If `/profile` already exists for account settings, name the new page `/skin-profile` or `/me`. Pick whatever feels most natural in nav. Don't squat on `/profile` if it'll confuse settings vs skin.

### Page structure

The page is read-only from the user's perspective (no edit buttons except through Yuri conversations). It has these sections, in this order:

#### 1. Header: "Your Skin, Right Now"

- Current phase badge: "Phase 2 — Active Treatment · Day 13"
- Phase progress micro-bar (if phase has expected duration in protocol JSONB)
- Last updated timestamp ("Last Yuri check-in: 4 hours ago")

#### 2. The Skin Breakdown (the thing Bailey screenshotted)

This is the **headline section**. It's Yuri's rich qualitative read of the user's skin, rendered as prose. Generated by Sonnet from:
- Static `ss_user_profiles` facts (skin_type, fitzpatrick, climate, location_text, age_range, allergies, skin_concerns)
- Latest few `decision_memory.preferences` and `decision_memory.corrections`
- Most recent specialist insights from `ss_specialist_insights`
- Current phase context from `ss_treatment_phases`

Style: matches Bailey's screenshot. **Bolded leading sentences** introducing each paragraph, conversational tone, plain language, climate/cycle/lifestyle factored in.

**Critical implementation note**: This text is NOT static. Cache the rendered version for ~24 hours (or invalidate when underlying source data changes — phase status changes, new decision memory, new specialist insight). Regenerate via Sonnet when stale. The user should NEVER see a loading spinner here on visit — render cached prose immediately, kick off regeneration in background, update if needed via SWR or similar.

Estimated cost: ~$0.005 per regeneration × ~2 regens/user/week = $0.01/user/week. Bounded.

#### 3. Phase Journey Timeline

Visual ladder of phases:
- Phase 1: Barrier Repair · Feb 23 → May 4 · ✓ Completed
- Phase 2: Active Treatment · May 5 → Present · ● Active
- Phase 3: Brightening · (Not yet started)

Each row is expandable. Expanded view shows:
- Goal (from `ss_treatment_phases.goal`)
- Protocol summary (from `protocol` JSONB)
- Key decisions from this phase (from `decisions` JSONB)
- "Watch for" notes (from `watch_for` JSONB)
- Number of Yuri conversations during this phase (count from `ss_yuri_conversations.created_at` between phase boundaries)
- Glass Skin Scores taken during this phase (count from `ss_glass_skin_scores.treatment_phase_id = phase.id`)

#### 4. Phase Progress Photo Gallery

This is Bailey's text 2 ask. Visual grid:
- Tabs: All phases · Phase 1 · Phase 2 · ...
- Grid of Glass Skin Score photos with overall_score badge and date
- Tap to enlarge (this is what's BROKEN in the Yuri chat too — solve here, defer the chat photo fix to a separate PR)
- Within each phase: side-by-side comparison view (first photo of phase vs latest photo of phase) when 2+ photos exist

Photo source: `ss_glass_skin_scores`. No new photo storage — Glass Skin already does this.

#### 5. Current Routine Snapshot

Compact view of active AM and PM routines (from `ss_user_routines` where `is_active = true`). Read-only. Link to `/routine` for full edit.

#### 6. What Yuri Has Learned About You

- Holy Grail products (from `ss_user_product_reactions` where reaction='holy_grail')
- Products That Caused Reactions (where reaction='broke_me_out')
- Known Allergies (from `ss_user_profiles.allergies`)
- Active ingredient stacking notes (from `detectRoutineOverlap` result — already exists in `src/lib/intelligence/ingredient-overlap.ts`)

#### 7. Cycle Tracking Section (only if `cycle_tracking_enabled`)

- Current cycle phase
- Yuri's cycle-aware adjustments

---

## Migration plan

### Order of operations

1. **Migration file**: `supabase/migrations/20260518000001_add_treatment_phases.sql` — creates `ss_treatment_phases` table, adds `treatment_phase_id` to `ss_glass_skin_scores`, RLS, indexes
2. **Backfill script**: `scripts/backfill-bailey-phases.ts` — populates Bailey's Phase 1 + Phase 2 from existing conversation data
3. **Extraction module**: `src/lib/yuri/treatment-phase-extractor.ts` — Sonnet pipeline
4. **Wire into advisor.ts**: fire-and-forget call after streaming completes (same pattern as `extractAndSaveDecisionMemory`)
5. **Skin Profile page**: `src/app/(app)/skin/page.tsx` (or `/me/page.tsx` — pick one before starting)
6. **Skin Breakdown generator**: `src/lib/intelligence/skin-breakdown.ts` — Sonnet-powered prose synthesis, with 24h caching
7. **Phase Photo Gallery component**: `src/components/skin/PhasePhotoGallery.tsx`
8. **Nav update**: `src/components/layout/Header.tsx` — add Skin Profile link
9. **Backfill existing Glass Skin photos**: one-shot SQL to set `treatment_phase_id` for Bailey's 2 Feb 25 scores → Phase 1 (or null if Phase 1 wasn't yet started)

### What to ship in v10.6.0 (this feature's release)

Everything above. This is one cohesive feature shipped as one release. Don't ship piece-meal.

### What NOT to do

- Don't move the Glass Skin Score page to the new Skin Profile page. They're complementary, not duplicative. `/glass-skin` stays where it is for capture; the new Profile page links to it and embeds the photo gallery view.
- Don't kill the existing `/routine` page. Bailey only said the Routine *Intelligence widget* should go, not the routine itself. Routine page stays as the active-plan editor.
- Don't expose `ss_treatment_phases` direct edit to users. Yuri owns phase state; users see it but don't edit it directly. (If Bailey wants to manually correct a phase, she does it through Yuri conversation.)
- Don't build an algorithmic recommender section. Per v10.5.2 / Bailey's ask: Yuri is the sole recommender.

---

## Open design questions (decide before coding)

These are questions Scott should weigh in on. The previous AI deliberately left them open rather than making unilateral calls:

1. **Nav placement**: `/skin`, `/skin-profile`, `/me`, or `/profile` (renaming current `/profile` to `/account`)? My recommendation: `/skin-profile`. Reads naturally in URL, doesn't conflict with existing `/profile` settings page.

2. **Skin Breakdown regeneration cadence**: Cache for 24h vs invalidate on every Yuri conversation vs invalidate on phase change only? My recommendation: invalidate on phase change OR every 7 days, whichever comes first. Cheap, fresh enough.

3. **Photo gallery tap-to-enlarge**: Build the lightbox component in the gallery, OR build a reusable image lightbox component used by both the gallery AND the Yuri chat (fixing Bailey's text 3 paper-cut in the same release)? My recommendation: build reusable component, fix both surfaces. Marginal extra effort.

4. **Phase auto-detection trigger sensitivity**: How aggressive should the Sonnet extractor be at detecting "user is starting a new phase"? False positives (creates Phase 3 when user is still in Phase 2) are user-confusing. False negatives (misses a real Phase 3 start) are fixable in next conversation. My recommendation: high confidence threshold — Sonnet should only emit phase changes when Yuri's message literally says "Phase X starts" or "we're now in Phase X" or similar explicit language. Conservative.

5. **Display of phase protocol structure**: Render `protocol` JSONB as a structured list (am_actives, pm_actives, etc.) OR as Sonnet-rendered prose? My recommendation: structured list (it's a checklist, not narrative). Save Sonnet prose for the Skin Breakdown section.

---

## How to know when this is done

The fresh AI building this should consider it complete when:

- [ ] `ss_treatment_phases` table exists, RLS active, backfilled for Bailey with Phase 1 + Phase 2
- [ ] Skin Profile page renders for Bailey showing her actual data: combo / Fitzpatrick 3 / Austin / Phase 2 Day N / her 2 Feb 25 Glass Skin photos tagged Phase 1
- [ ] Skin Breakdown section renders Sonnet-generated prose that matches the style of Bailey's screenshot (bolded leading sentences, climate/cycle/lifestyle factored in)
- [ ] Phase Photo Gallery shows existing Glass Skin photos grouped by phase
- [ ] Tap-to-enlarge lightbox works on gallery photos (and ideally on Yuri chat photos in same PR)
- [ ] Nav link added, Header.tsx updated
- [ ] Background extraction fires after Yuri conversations and upserts phase state
- [ ] `tsc --noEmit` and `next build` pass clean
- [ ] CHANGELOG entry added to CLAUDE.md with origin + files + verification

When all boxes check, ship as v10.6.0 — "Phase 13.D: Living Skin Profile + Phase Progress Photos".

---

## Estimated effort

For an AI building cleanly from this blueprint: 6-10 hours of focused work across migration, extraction pipeline, page, components, gallery, and verification. Some of that is Sonnet prompt engineering for the Skin Breakdown synthesis — budget time for prompt iteration.

For Scott reviewing: 30-45 minutes to test the page on Bailey's account and verify the Skin Breakdown reads naturally.
