# Onboarding Improvements Plan

**Created**: April 9, 2026
**Source**: Founder's live onboarding test (glassskinatx@gmail.com, April 7-8, 2026)
**Status**: Planned

## Context

Scott (59M, skin cancer history, Sacramento, K-beauty beginner) went through Yuri's conversational onboarding. The experience was excellent overall — Yuri handled demographic mismatch, medical boundaries, sunscreen fears, and founder identity reveal gracefully. However, 5 improvement areas were identified.

---

## Fix 1: Gate "See My Personalized Recommendations" Button on Quality Score

**Problem**: The button appears as soon as 3 required fields are extracted (`skin_type`, `skin_concerns`, `age_range`), which can happen after just 2-3 messages. This tempts users to skip before Yuri has built a rich profile. Scott noticed this during his onboarding and correctly identified it as a UX issue — clicking early produces generic recommendations instead of precise ones.

**Current Logic** (`src/app/(app)/onboarding/page.tsx`, line 402):
```tsx
{isComplete && !isStreaming && (
  <button>See My Personalized Recommendations</button>
)}
```

`isComplete` is set when `checkOnboardingComplete()` returns true, which only checks that `REQUIRED_FIELDS` (`skin_type`, `skin_concerns`, `age_range`) are all non-null.

**Fix**: Gate on quality score, not just field completion. The quality scoring system (Phase 13.5) already exists in `onboarding.ts` — `calculateOnboardingQuality()` scores each field for specificity and returns `overallScore` (0-100). Use it.

**Implementation**:

1. **Server**: In `src/app/api/yuri/onboarding/route.ts`, include `quality_score` in the progress SSE event alongside `is_complete`:
   ```typescript
   // In the progress event sent to client
   {
     is_complete: result.isComplete,
     quality_score: result.qualityScore,  // Add this
     percentage: result.percentage
   }
   ```

2. **Client**: In `src/app/(app)/onboarding/page.tsx`:
   - Add `qualityScore` state: `const [qualityScore, setQualityScore] = useState(0)`
   - Update from progress events: `if (typeof progressData.quality_score === 'number') setQualityScore(progressData.quality_score)`
   - Gate button on quality: `{isComplete && qualityScore >= 65 && !isStreaming && (...)}` 
   - Below the threshold, show a softer message instead: "Yuri is still learning about your skin..."

3. **Quality threshold**: 65 is the right bar. This means Yuri needs at least skin_type + concerns + age + one of (climate/location, budget, current routine, allergies) with reasonable specificity before the button appears.

**Files to modify**:
- `src/app/api/yuri/onboarding/route.ts` — Include quality_score in progress event
- `src/app/(app)/onboarding/page.tsx` — Add qualityScore state, gate button visibility

**Complexity**: Low. ~15 lines changed across 2 files.

---

## Fix 2: Onboarding Response Brevity

**Problem**: Several of Yuri's onboarding responses are 200+ words. In a chat interface, these read as walls of text. The main advisor prompt got brevity/pacing rules in v8.2.2 and v8.5.0, but the onboarding system prompt in `src/lib/yuri/onboarding.ts` never received equivalent guidance.

**Current State**: The onboarding prompt (lines 69-123 of `onboarding.ts`) says "React with genuine insight and K-beauty tips to each answer" and "Ask ONE question at a time" but has no length guidance.

**Fix**: Add pacing rules to the onboarding system prompt, adapted for the onboarding context where slightly longer responses are appropriate (since Yuri is teaching and building trust).

**Implementation**:

Add to the onboarding system prompt after the "Ask ONE question at a time" rule:

```
## Pacing
- Lead with your reaction (1-2 sentences), then your insight (2-3 sentences), then your next question (1-2 sentences)
- Total response: 4-7 sentences max. If you're going longer, you're lecturing
- Save the deep dives for after onboarding — right now you're getting to know them, not teaching a course
- Exception: medical/safety topics (allergies, reactions, medication interactions) deserve thorough responses
```

**Files to modify**:
- `src/lib/yuri/onboarding.ts` — Add pacing section to system prompt

**Complexity**: Low. ~8 lines added to prompt.

---

## Fix 3: Voice Cleanup — Catch "Let me break this down"

**Problem**: "Let me break this down" appeared in the onboarding (Image 4) despite existing voice cleanup. The current patterns in `voice-cleanup.ts` include `"let me break it down"` (mid-sentence, line ~55) but NOT the full opener form `"Let me break this down."` at the start of a response.

**Current Pattern** (catches mid-sentence only):
```typescript
{ pattern: /,?\s*let me break it down[.:,]?\s*/gi, replacement: '' }
```

**Fix**: Add the opener variant:

```typescript
{ pattern: /^Let me break this down[.:]?\s*/i, replacement: '' },
```

Also add these common variants seen in Claude's output:
```typescript
{ pattern: /^Let me walk you through this[.:]?\s*/i, replacement: '' },
{ pattern: /^Let me unpack this[.:]?\s*/i, replacement: '' },
{ pattern: /^Here's what's going on[.:]?\s*/i, replacement: '' },
```

**Files to modify**:
- `src/lib/yuri/voice-cleanup.ts` — Add 4 new opener patterns

**Complexity**: Trivial. 4 lines.

---

## Fix 4: Climate Extraction Precision

**Problem**: Sacramento was classified as `climate: "dry"` but it's Mediterranean (hot dry summers, cool wet winters). This affects seasonal routine advice — "dry climate" year-round will recommend heavy occlusives in winter when Sacramento actually gets rain and moderate humidity.

**Root Cause**: The extraction prompt in `onboarding.ts` asks for `climate` as a simple string. Sonnet maps "Sacramento" → "dry" based on the general reputation, missing the seasonal variation.

**Fix**: Update the extraction prompt to request more specific climate classification.

**Implementation**:

In the extraction prompt (within `extractOnboardingData()` function in `onboarding.ts`), update the climate field description:

```
climate: string | null  // Climate classification. Use specific types: 
// "hot_humid" (tropical, subtropical), "hot_dry" (desert, arid), 
// "mediterranean" (hot dry summer + cool wet winter, e.g. California),
// "temperate_humid" (moderate with humidity, e.g. mid-Atlantic), 
// "cold_dry" (northern winters), "cold_humid" (Pacific NW, UK)
// Be specific — "Sacramento, CA" is "mediterranean", not just "dry"
```

Also update the seasonal learning patterns to handle "mediterranean" climate type — currently `ss_learning_patterns` has data for "humid", "dry", "temperate" etc. but may not have "mediterranean" as a valid skin_type value.

**Files to modify**:
- `src/lib/yuri/onboarding.ts` — Update climate field in extraction prompt
- May need to seed `ss_learning_patterns` rows for "mediterranean" climate

**Complexity**: Low-medium. Prompt change is easy; ensuring downstream seasonal patterns handle the new climate type needs verification.

---

## Fix 5: Medical History Field in Extraction

**Problem**: "Skin cancer history" was stored in the `allergies` array because the extraction schema has no `medical_history` field. This is semantically wrong — skin cancer isn't an allergy. While it doesn't cause functional issues (Yuri still flags sun protection), it could mislead ingredient conflict checking that looks at allergies.

**Fix**: Add a `medical_history` field to the extraction schema and the `ss_user_profiles` table.

**Implementation**:

1. **Database**: 
   ```sql
   ALTER TABLE ss_user_profiles ADD COLUMN medical_history TEXT[];
   ```

2. **Extraction prompt**: Add field:
   ```
   medical_history: string[] | null  // Medical conditions relevant to skincare: 
   // skin cancer history, eczema, psoriasis, rosacea diagnosis, diabetes, 
   // autoimmune conditions, current medications (Retin-A, Accutane, etc.)
   // These are NOT allergies — separate from the allergies field
   ```

3. **Profile type**: Update `ExtractedSkinProfile` interface to include `medical_history: string[] | null`

4. **Yuri context**: Update `formatContextForPrompt()` in `memory.ts` to display medical history in the skin profile section

**Files to modify**:
- `src/lib/yuri/onboarding.ts` — Add medical_history to extraction schema
- `src/lib/yuri/memory.ts` — Display in context prompt  
- `src/types/database.ts` or `src/types/yuri.ts` — Update interface
- Database migration for new column

**Complexity**: Medium. New column + extraction field + context display + type update.

---

## Implementation Priority

| # | Fix | Impact | Complexity | Priority |
|---|-----|--------|-----------|----------|
| 1 | Button quality gate | HIGH | Low | P0 — Do first |
| 2 | Onboarding brevity | MEDIUM | Low | P1 |
| 3 | Voice cleanup patterns | LOW | Trivial | P1 (bundle with #2) |
| 4 | Climate precision | MEDIUM | Low-Med | P2 |
| 5 | Medical history field | LOW | Medium | P3 (nice to have) |

**Recommended build order**: Fix 1 + 2 + 3 in one session (~30 min). Fix 4 in a follow-up. Fix 5 when convenient.

**Relationship to YURI-FIX-PLAN.md**: These fixes are independent of the 7 routine-quality fixes in YURI-FIX-PLAN.md. That plan addresses routine accuracy (layering order, device placement, texture data). This plan addresses onboarding UX. Both can be implemented in parallel.

---

## Existing Improvement Plans

The following improvement document also exists and should be implemented:

- **YURI-FIX-PLAN.md** (667 lines, Feb 28, 2026): 7 fixes for Yuri's routine accuracy based on Bailey's 10 conversations. Covers verify_routine tool, device placement rules, texture data, user products table, save_routine tool, date reasoning, and system prompt reinforcement. ~680 lines of new code + 2 migrations. Not blocking for onboarding but important for post-onboarding routine building quality.
