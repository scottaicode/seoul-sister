# Seoul Sister — Changelog

All notable changes to Seoul Sister are documented here.

---

## v10.3.7 (May 5, 2026) — Routine Page Polish: Missing Steps Phase-Awareness, BHA Aliasing, updated_at Eviction Fix

### Origin
Visual review of Bailey's `/routine` page (browser screenshots) surfaced four issues we couldn't see from DB queries alone:

1. **"Missing Steps — Cleanser" warning fired on AM and PM routines** even though her treatment plan deliberately uses cool water rinse (AM) and shower-cleansing (PM). `detectMissingSteps` only saw DB-backed products, not custom steps.
2. **"Missing High-Value Ingredients" still recommended Salicylic Acid (BHA)** for the PM routine that already has COSRX BHA Blackhead Power Liquid. The product contains Betaine Salicylate; the effectiveness table flags "Salicylic Acid" (separate ingredient_id). No alias check.
3. **`ss_user_products` corrupted from May 3 broken save**. Custom names ("Ice roller", "Cool water rinse") had product_id pointers pointing at random DB products. Routine page's ownership join surfaced wrong custom names on real products (step 9 sunscreen showed "Ice roller or cold spoon" as heading).
4. **Caught during fix verification**: the v10.3.4 backfill date repair had bumped `updated_at` to a single timestamp on 7 historical conversations. `loadCurrentlyExcludedIngredients` ordered by `updated_at DESC LIMIT 5`, which evicted Bailey's recent decisions when Postgres broke the timestamp tie in favor of older rows. v10.3.6's phase filter silently regressed for any user who'd had a backfill run.

### Changed
- **`detectMissingSteps` is now phase-aware** (`src/lib/intelligence/layering-order.ts`):
  - Accepts optional `customStepNotes: string[]` so null-product routine steps count toward category-present detection. New `inferCategoryFromNotes` helper maps note text to category (e.g., "Shower / cleanse" → cleanser, "Cool water rinse" → cleanser, "LED mask" → device).
  - Accepts optional `excludedCategories: Set<string>` for explicit treatment-plan exclusions (placeholder for future use; wired into the call chain now).
  - Routine page (`src/app/(app)/routine/page.tsx`) passes notes from null-product steps so the warning correctly suppresses on Bailey's PM (shower step) and AM (cool water rinse).

- **Ingredient alias filter for missing-ingredients widget** (`src/lib/intelligence/routine-effectiveness.ts`):
  - When checking which high-value ingredients are already covered by the routine, the function now collects normalized name tokens from all linked ingredients ('salicylic', 'hyaluronic', 'niacinamide', 'retinol', 'vitamin_c').
  - A second filter pass drops candidate ingredients whose name matches a routine-token alias. Bailey's COSRX BHA contains Betaine Salicylate, which now blocks "Salicylic Acid (BHA)" from showing as missing. Same family relationships caught for HA (Sodium Hyaluronate), retinol (retinal/retinyl), vitamin C (ascorbic/ascorbyl).

- **`loadCurrentlyExcludedIngredients` and `loadDecisionMemory` order by created_at, not updated_at** (`src/lib/intelligence/routine-effectiveness.ts`, `src/lib/yuri/memory.ts`):
  - Backfill scripts (decision memory backfill, date repair) bulk-touch `updated_at` on historical rows. With `updated_at` ordering, those mass-touches can evict recent conversations from the LIMIT N window. `created_at` is immutable on conversation rows, so "most recently created" is always the right signal of recency.
  - Caught when the verify-phase-aware-widget script started returning HA/Tranexamic/Salicylic instead of the expected Snail Mucin fallthrough. Bailey's 7 February conversations all had identical updated_at timestamps from this evening's date-repair SQL, evicting her May 4 Phase 2 decisions from the window.

- **Bailey's `ss_user_products` cleaned up** (`scripts/fix-bailey-user-products.sql`): NULLed product_id on 5 device/action rows that had wrong DB pointers from the May 3 broken save. Fixed product_id mappings on Acwell Toner, Medicube PDRN Pink Peptide Serum, Illiyoon Ceramide Ato Concentrate Cream. NULLed product_id on Anua Heartleaf 70% Rice Ceramide Serum and Medicube PDRN Pink Peptide Eye Cream (no exact DB matches; preserved as custom inventory entries). One Supabase Studio paste, idempotent.

### Verification
- `npx tsc --noEmit` passes clean
- `scripts/verify-phase-aware-widget.ts` against AM routine: filters HA, Retinol, Tranexamic correctly. Returns Snail Mucin fallthrough.
- `scripts/verify-bailey-pm.ts` against PM routine: filters Retinol, Tranexamic, Vitamin C correctly. Returns Snail Mucin fallthrough.
- Production confirmed live: Vercel deploy hash dpl_ALwsYVsJ35b8uUeS6m65CGBT13TF responds 200. The screenshot of cached state was 9-minute-old CDN cache; hard-refresh would have shown the v10.3.6 fix.

### Files modified
- `src/lib/intelligence/layering-order.ts` — phase-aware detectMissingSteps + inferCategoryFromNotes helper
- `src/lib/intelligence/routine-effectiveness.ts` — alias filter, created_at ordering on excluded-ingredients load
- `src/lib/yuri/memory.ts` — created_at ordering on decision memory load
- `src/app/(app)/routine/page.tsx` — pass customStepNotes to detectMissingSteps
- `scripts/fix-bailey-user-products.sql` (new) — one-off data fix
- `scripts/verify-bailey-pm.ts` (new) — PM routine verification harness
- `scripts/debug-bailey-exclusions.ts` (new) — exclusion-token debugger (kept for future regression checks)
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

### Bailey-specific impact
After this release + the SQL paste:
- "Missing Steps — Cleanser" warning suppresses correctly on Phase 2 AM/PM routines
- "Missing High-Value Ingredients" returns Snail Mucin (single fallthrough, not three excluded items)
- Step 9 sunscreen shows correct "Beauty of Joseon Relief Sun" heading instead of "Ice roller or cold spoon"
- Custom step entries display their notes-as-content correctly (already worked from v10.3.3)
- Yuri's next conversation will load her actual recent decisions, not get evicted by the date-repair side-effect

### Known limits / future work
- Alias-token list is hardcoded for the 5 highest-frequency K-beauty active families. Adding more families (peptides, ceramides, AHA) would extend coverage. Current scope is what affects Bailey's specific routine.
- `inferCategoryFromNotes` uses keyword matching, not semantic detection. "Shower / cleanse" works; an unusual phrasing like "splash twice" wouldn't infer cleanser. Conservative defaults (returns null) are safer than aggressive false positives.

---

## v10.3.6 (May 5, 2026) — Phase-Aware Routine Recommendations: Stop Telling Users to Add What Yuri Excluded

### Origin
On May 4, Bailey opened a conversation with Yuri because the routine page told her she was missing tranexamic acid, retinol, and hyaluronic acid. All three were ingredients Yuri had explicitly excluded from her current treatment plan: HA was redundant with her existing Anua serum, tranexamic was deferred to Phase 3 to avoid stacking actives with Goodal Vita C, and retinol was already covered by her prescription tretinoin (paused during Phase 1 barrier repair). Yuri had to spend three messages overriding the dashboard's confident recommendations because the widget was contradicting her own treatment plan.

This is the same class of issue v8.5.0 fixed for Glass Skin scoring (which was recommending actives during barrier repair). The Glass Skin fix added `loadTreatmentPlanContext()` to read decision memory and inject phase guidance into the Vision prompt. The same gap existed on the routine page; this release closes it.

The fix was unblocked by v10.3.4 — without working decision memory, there was no source-of-truth to filter against. v10.3.4 made decision memory actually persist; v10.3.6 makes the routine widget honor it.

### Changed
- **`getMissingHighValueIngredients` is now phase-aware** (`src/lib/intelligence/routine-effectiveness.ts`):
  - New optional `userId` parameter. When provided, the function loads the user's 5 most recent conversations with non-empty `decision_memory` and extracts a token list of currently-excluded ingredients.
  - **Exclusion detection**: scans `decisions[]`, `preferences[]`, and `corrections[]` for any text containing one of 22 phase-marker phrases (`skip`, `defer`, `phase 2`, `phase 3`, `pause`, `wait`, `until`, `revisit`, `not yet`, `discontinue`, `on hold`, etc.). Text matching one of these markers contributes its meaningful tokens (4+ chars, not stop words) to the exclusion set.
  - **Filter logic**: each candidate ingredient's name is tokenized; the candidate is dropped if any of its name tokens appears in the exclusion set. "Tranexamic Acid" tokenizes to `[tranexamic, acid]`; if decision memory says "skip tranexamic acid for now," `tranexamic` is in the exclusion set, the row is dropped.
  - **Over-fetch from 20 to 40** so phase filtering still leaves enough candidates to return a meaningful top 3.
  - **Backward compatible**: `userId` is optional. Callers that don't pass it get the unfiltered behavior.

- **API route passes `user.id`** (`src/app/api/routine/effectiveness/route.ts`): one-line change adding `user.id` to the `getMissingHighValueIngredients` call so the filter activates for every authenticated request.

### Verification
- `npx tsc --noEmit` passes clean
- End-to-end test against Bailey's actual Phase 2 AM routine (`scripts/verify-phase-aware-widget.ts`):
  - Pre-fix (without userId): returns Hyaluronic Acid (84%), Retinol (84%), Tranexamic Acid (83%) — exactly what Bailey saw on May 4
  - Post-fix (with userId): returns Snail Mucin (78%) — an ingredient Yuri has not excluded
  - All three excluded ingredients correctly filtered

### What this does NOT do
- **No AI call to detect exclusions.** Keyword matching is sufficient for Yuri's standard phrasing and avoids ~$0.005 + ~1s latency on every routine page load. False positives (over-filtering) are guarded by the conservative marker list. False negatives (missing an exclusion) degrade to pre-fix behavior, which is acceptable.
- **No global treatment-plan abstraction.** v8.5.0 has its own `loadTreatmentPlanContext` for Glass Skin. This release reads the same source (`decision_memory`) but with a different extraction shape (token list vs. prompt context). If a third surface needs the same data later, that's the time to extract a shared helper.
- **No UI changes.** The `RoutineEffectiveness` component already handles empty `missingIngredients` gracefully — when filtering removes all candidates, the section just doesn't render.

### Deferred (documented for later)
- **Apply same filter to other recommendation surfaces.** Products page (`/api/products?sort_by=recommended`), dupe finder, scan enrichment all use the same effectiveness data. They'd benefit from the same filter. This release scopes to the most user-visible surface (routine widget) and the one Bailey actually saw broken.
- **Surface the filter as a hint to the user.** When the system filters out an ingredient, it could optionally show "Yuri's plan currently excludes: tranexamic acid (revisits in Phase 3)" so the user understands why the recommendation isn't there. Better UX, but adds complexity. Holding for now.

### Files modified
- `src/lib/intelligence/routine-effectiveness.ts` — phase-aware filter + new private helper `loadCurrentlyExcludedIngredients`
- `src/app/api/routine/effectiveness/route.ts` — pass user.id through
- `scripts/verify-phase-aware-widget.ts` (new) — verification harness, kept on disk for future regression checks
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

---

## v10.3.5 (May 5, 2026) — Fire-and-forget Audit: Add Error Logging to High-Risk Background Tasks

### Origin
The v10.3.4 incident — three months of lost decision memory hidden by `.catch(() => {})` — exposed a class of risk: every fire-and-forget background task in the codebase that did meaningful work but swallowed errors silently. This release audits the codebase for that pattern and adds `console.error` (visible in Vercel function logs) to the high-risk subset, so the next silent failure announces itself instead of accumulating for months.

### Audit scope
- 184 catch sites total in `src/` (160 bare `} catch {`, 22 explicit `.catch(() => {...})`, 2 `void`-prefix fire-and-forget)
- Filtered to **HIGH-RISK**: fire-and-forget background tasks that do meaningful work (DB writes, paid Sonnet/Opus API calls, external service calls). 10 sites identified.
- LOW-RISK sites (UI fallbacks, JSON parse defaults, Playwright selector timeouts, retry-strategy paths) intentionally left silent — those are correct silence patterns, not silent failures.

### Anomaly investigation (no bugs surfaced)
Two suspicious data signals investigated before changing code:
- **`ss_ai_usage` Apr 9 cutoff**: explained by the AI usage logger feature shipping Apr 7 (commit `3fbbcc8`). Pre-Apr 7 conversations weren't logged because the logger didn't exist. Not a bug. No backfill (we'd be inventing fake usage data).
- **`ss_specialist_insights` 24:2 ratio**: misleading initial framing. Insights are tagged by *detected specialist mode* (which can rotate within a single conversation as topics shift), not by the top-level `conversation.specialist_type` field which is only set when a user opens a specialist via the picker UI. Insights spread across 14 distinct conversations with reasonable distribution (routine_architect 25, ingredient_analyst 14, trend_scout 5, others 4). Working as designed.

### Changed
Added `console.error` logging to fire-and-forget catch sites where silent failure would hide real bugs:

| File:Line | Before | After |
|---|---|---|
| `src/lib/yuri/advisor.ts:801` | `.catch(() => {})` | logs `[advisor] extractAndSaveInsight failed:` |
| `src/lib/yuri/advisor.ts:809` | `.catch(() => {})` | logs `[advisor] extractContinuousLearning failed:` |
| `src/lib/yuri/advisor.ts:825` | `.catch(() => {})` | logs `[advisor] generateAndSaveSummary failed:` |
| `src/lib/yuri/advisor.ts:838` | `.catch(() => {})` | logs `[advisor] extractAndSaveDecisionMemory failed:` |
| `src/lib/ai-usage-logger.ts:75` | bare `catch {}` | logs `[logAIUsage] threw:` AND surfaces Supabase insert errors via `[logAIUsage] insert failed:` |
| `src/app/api/widget/chat/route.ts:268` | bare `catch {}` | logs `[widget/chat] saveUserMessage failed:` |

Two additional `streamPromise.catch(() => {})` sites left as-is at `src/app/api/widget/chat/route.ts:458` and `src/app/api/yuri/chat/route.ts:171`. Their inner streams already log to `console.error`; the outer catch only suppresses unhandled-rejection warnings. Added clarifying comments.

`logAIUsage` flows through to two void-prefix call sites (`advisor.ts:766`, `widget/chat:378`), so fixing it once benefits both.

### What this does NOT do
- **No structural refactoring of error handling.** Just adding visibility. Replacing `try/catch` with `Result<T, E>` patterns or migrating to a centralized error tracking service is out of scope.
- **No periodic health checks.** "If Yuri ran X messages but only Y summaries got generated, alert" is a real engineering investment worth doing eventually but not in this sweep. Documented as future work.
- **No fix for the bug class itself.** A future contributor could still write `.catch(() => {})` and ship a silent failure. A lint rule catching empty arrow catches would prevent regressions but isn't shipped here.

### Verification
- `npx tsc --noEmit` passes clean
- All 6 changed catch sites preserve the original "non-blocking" semantics — the application path can still continue even when the background task fails

### Files modified
- `src/lib/yuri/advisor.ts` — 4 catch sites now log to console.error
- `src/lib/ai-usage-logger.ts` — internal try/catch logs failures; insert error path explicitly checked
- `src/app/api/widget/chat/route.ts` — saveUserMessage catch logs; clarifying comment on stream wrapper catch
- `src/app/api/yuri/chat/route.ts` — clarifying comment on stream wrapper catch (no behavior change)
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

### Future work (documented for later sessions)
- **Lint rule**: forbid `.catch(() => {})` and `.catch(() => undefined)` patterns. Force callers to either log or explicitly accept silence with an inline comment.
- **Periodic health metric**: cron job that compares (conversations with N messages) vs (conversations with summary) vs (conversations with decision_memory) and alerts when ratios diverge. Catches future v10.3.4-class regressions before they accumulate for months.
- **Audit medium-risk catches**: 7 sites in `memory.ts` swallow Sonnet errors but fall back to "Yuri runs without that data." User-visible degradation rather than silent loss; lower urgency.

---

## v10.3.4 (May 5, 2026) — Decision Memory Crash: Three Months of Lost Cross-Session Memory

### Origin
A diagnostic of Bailey Donmartin's account surfaced that `decision_memory` was empty (`{}`) on every one of her 17 conversations. A follow-up DB query confirmed the same was true across all 30 conversations from all 3 users in the system — Phase 13.3 (shipped Feb 23 in v8.1.0) and Phase 15.1 corrections memory (shipped Apr 26 in v10.2.0) had produced exactly zero successful writes in three months of production. Conversation summaries (which run alongside decision-memory extraction in the same fire-and-forget block of `streamAdvisorResponse`) had populated correctly 17/30 times, so the issue was specific to the decision-memory path.

### Root cause
A direct end-to-end test of `extractAndSaveDecisionMemory` against Bailey's onboarding conversation surfaced the bug:

```
TypeError: base.decisions is not iterable
    at mergeDecisionMemory (src/lib/yuri/memory.ts:1022)
    at extractAndSaveDecisionMemory (src/lib/yuri/memory.ts:1295)
```

The merge function read existing `decision_memory` from the DB. The schema default is JSONB `{}` — an empty object, NOT null. Line 1018's `existing || EMPTY_DECISION_MEMORY` only swapped to the empty-default constant when `existing` was null/undefined. For every "first write" call, `base` was therefore `{}`, and `base.decisions` was `undefined`. Iterating undefined threw, the fire-and-forget `.catch(() => {})` in `advisor.ts:838` silently swallowed it, and the summary path next to it succeeded so the system *appeared* healthy.

The v10.2.0 corrections memory release noticed this exact pattern for `corrections` specifically (`base.corrections || []` at the old line 1064) but missed that `decisions`, `preferences`, and `commitments` had the same issue from the original v8.1.0 ship.

### Changed
- **`mergeDecisionMemory` defensive defaults** (`src/lib/yuri/memory.ts`): Added explicit `|| []` defaults for all four arrays (`decisions`, `preferences`, `commitments`, `corrections`) before iteration. Now correctly handles three input shapes: (1) `existing === null`, (2) `existing === {}` (the schema-default first-write case that was broken), and (3) `existing` is a fully populated `DecisionMemory`. Inline comment documents the failure mode so a future contributor doesn't re-introduce the regression.
- **`extracted_at` fallback**: Returned object's `extracted_at` now defaults to `''` if both incoming and base are missing it. Was previously assuming `base.extracted_at` was always defined.

### Backfill
Created `scripts/backfill-decision-memory.ts` that re-runs the (now-fixed) extraction against all conversations with ≥4 messages and missing `decision_memory`. Cost estimate ~$1 in Sonnet 4.5 to backfill ~19 affected conversations. Operationally safe to re-run; idempotent via topic-keyed merge.

### Verification
- `npx tsc --noEmit` passes clean
- Direct end-to-end test (`scripts/diagnose-decision-memory-2.ts`) re-run against Bailey's onboarding conversation: pre-state `{}`, post-state populated with 5 decisions, 6 preferences, 4 commitments. Function returned without throwing.
- Three input shapes verified by code review: null, `{}`, fully populated.

### Impact
- Going forward, every Yuri conversation will populate `decision_memory` correctly at the same cadence as summary generation (every 5 messages after initial exchange)
- Yuri's system prompt will start receiving the structured `## Your Decisions & Preferences` and `## Corrections That Stick` sections that have been silently empty for three months
- Phase 13.3 (Decision Memory), Phase 15.1 (Corrections Memory), Phase 15.4 (Age-Aware Memory Rendering — the date fields it expects on preferences) all begin actually working

### Files modified
- `src/lib/yuri/memory.ts` — `mergeDecisionMemory` defensive defaults
- `scripts/backfill-decision-memory.ts` (new) — operational backfill
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

### Lesson
Fire-and-forget `.catch(() => {})` patterns are silent failure traps. The summary path next to the broken extraction succeeded loudly enough that nobody noticed half the system was dead. Worth a future audit pass to add at least a `console.error` (visible in Vercel logs) to every fire-and-forget catch in the codebase, and ideally a periodic health metric for the table writes these tasks are supposed to produce.

---

## v10.3.3 (May 5, 2026) — Schema Fix: Allow Null product_id on Routine Steps

### Origin
Discovered while attempting to apply Bailey Donmartin's manual routine correction (the data follow-up to v10.3.2). The `ss_routine_products.product_id` column was `NOT NULL`, which forced every device step (LED mask, ice roller) and action step (cool water rinse, shower / cleanse) to point at *some* `ss_products` row. The routine save path (`executeSaveRoutine` in `src/lib/yuri/tools.ts`) was reaching `resolveProductByName` with non-product strings and getting fuzzy matches that produced exactly the wrong-product symptom v10.3.2 set out to fix. **The schema was the root cause; v10.3.2 was a partial mitigation that couldn't fully work until this column was made nullable.**

### Changed
- **`ss_routine_products.product_id` is now nullable** (`supabase/migrations/20260505000001_routine_products_allow_null_product_id.sql`). Routine steps that have no product (devices, actions, custom-named items not in the catalog) save with `product_id = NULL` and the step content lives in the `notes` column. The existing `executeSaveRoutine` logic from v10.3.2 already passed `product_id: null` for unmatched names — it just hit the schema constraint and rolled back. Now those inserts succeed.
- **Routine page UI patched for nullable product_id** (`src/app/(app)/routine/page.tsx`):
  - Reorder up/down and remove buttons hide on null-product rows. The routine API addresses rows by `product_id` (POST/DELETE/PUT all key on it), so null rows are unaddressable until a future refactor migrates the addressing key to `ss_routine_products.id`.
  - When `rp.product` is null and `rp.notes` is populated, the notes render as the step content instead of the "Product removed" fallback. This is what surfaces "Cool water rinse" / "Ice roller" / "LED mask Blue/Red" in the UI.
  - `RoutineProduct.product_id` typed as `string | null`.
  - `handleMoveProduct` and `handleRemoveProduct` accept null and early-return; reorder builds `productIds` from the filtered (non-null) array so positions stay aligned.
  - `existingProductIds` passed into the Add Product modal is filtered to drop nulls.

### Read-path audit (no changes required)
All other consumers of `ss_routine_products` were verified safe before the migration:
- `src/app/api/routine/route.ts` — already had `.filter(Boolean)` on the productIds array
- `src/app/api/routine/[id]/route.ts` — pass-through GET, page handles null products
- `src/app/api/routine/[id]/products/route.ts` — addresses by product_id; null rows are immutable through this API but won't crash. Future work: migrate addressing key to `ss_routine_products.id`.
- `src/lib/intelligence/{conflict-detector,routine-effectiveness,reformulation-detector}.ts` — `.in('product_id', [...with nulls])` silently drops null entries; doesn't crash.
- `src/lib/yuri/{memory,actions,tools}.ts` — already null-safe (`if (product?.name_en)` patterns).
- `src/app/api/{cycle,scan}/route.ts` — null-safe via existing guards.
- `src/lib/learning/recommendations.ts` — uses Set lookups; null in the set is harmless because no real product_id equals null.

### Verification
- `npx tsc --noEmit` passes clean
- Type narrowing verified: `RoutineProduct.product_id: string | null` propagates correctly through handlers; reorder API still receives only valid UUIDs.
- Migration is reversible: `ALTER TABLE ss_routine_products ALTER COLUMN product_id SET NOT NULL` would re-add the constraint (would require deleting null rows first).

### Files modified
- `supabase/migrations/20260505000001_routine_products_allow_null_product_id.sql` (new)
- `scripts/fix-bailey-phase2-routines.sql` (combined: migration + Bailey's data fix in one transaction for one-paste Supabase Studio run)
- `src/app/(app)/routine/page.tsx` — null-safe rendering and handlers
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

### Deferred
- **Routine API addressing refactor**: `/api/routine/[id]/products/route.ts` should eventually key by `ss_routine_products.id` (the row UUID) instead of `product_id`, so null-product steps can be reordered/removed through the UI. Current behavior: null-product steps display in the routine but can only be modified via Yuri (rebuilding the routine). Acceptable interim state.

---

## v10.3.2 (May 5, 2026) — Routine Save Honesty: Resolver Fix + Mismatch Reporting + Optional product_id

### Origin
Diagnostic of Bailey Donmartin's account on May 5 surfaced that her active Phase 2 AM and PM routines did not match what Yuri promised in chat. On May 4, Yuri described a 9-step Phase 2 AM routine including Goodal Green Tangerine Vita C in slot 4 and a PM routine with COSRX BHA Blackhead Power Liquid in slot 4 (Mon/Wed/Fri). The actual `ss_routine_products` rows showed Torriden DIVE-IN HA Serum and COSRX Advanced Snail 96 Mucin Essence in those slots — wrong products, with Phase 2 notes attached. Yuri's "Saved ✨" message claimed success without acknowledging any mismatch.

Investigation traced this to three stacked failures in the save path. This release addresses the two most leveraged ones.

### Changed
- **`resolveProductByName` tiebreaker (`src/lib/yuri/tools.ts`)**: When multiple products match every query term, the resolver now sorts candidates by combined `brand_en + name_en` length ascending (closer-fitting names first), then by `rating_avg` descending. The previous behavior — sort by rating only — actively penalized products without ratings and routinely picked the wrong variant. Concretely: a query for "Goodal Green Tangerine Vita C" used to resolve to the highest-rated *Cream* (4.50 stars) over the more specific *Serum* (no rating). Now the resolver prefers names that don't overshoot the query.
- **`executeSaveRoutine` user-facing message (`src/lib/yuri/tools.ts`)**: The tool now classifies each step into one of three buckets — `matched` (every query term appears in the chosen product's brand+name), `matched_loose` (DB row found but query terms don't all appear, so the match is dangerous), and `no_db_match` (no row at all, saved as a custom entry). The returned `message` field explicitly names every loose match and unmatched entry inline so a user can never be told "Saved ✨" while a wrong product silently sits in their routine.

### Added
- **Optional `product_id` on `save_routine` steps (`src/lib/yuri/tools.ts` + `advisor.ts` system prompt)**: The save tool input schema now accepts an optional `product_id` per step. When provided, save bypasses name-based resolution entirely and uses the ID directly. Tool description and the advisor system prompt teach Yuri the search-first pattern: search_products → grab the product_id → pass it on the save call. Falling back to product_name alone is reserved for items genuinely outside the database (devices like "ice roller", actions like "shower / cleanse").
- **Two new system-prompt rules** (`src/lib/yuri/advisor.ts`): (1) Yuri must pass `product_id` on save_routine steps unless the item isn't in the DB, (2) after save_routine returns, Yuri's reply MUST quote the tool's `message` field verbatim — paraphrasing or omitting the loose-match warning is forbidden. The reply rule is the structural fix that prevents Bailey's class of failure: Yuri cannot tell the user "Saved ✨" without surfacing the tool's authoritative report on what actually happened.

### Not changed (deliberately deferred)
- **No automatic chat-history coupling**: Considered enforcing that every `product_name` in a save_routine call must appear in Yuri's immediately preceding chat message. Rejected because it requires fragile parsing and creates tight coupling between presentation and persistence layers. The "quote the tool message verbatim" rule achieves the same trust goal without the parsing cost.
- **No ambiguity surfacing on `resolveProductByName`**: Considered returning all candidates when 2+ products match every query term so Yuri can disambiguate explicitly. Deferred — adds chattiness to common cases. Revisit if the length tiebreaker proves insufficient.
- **Bailey's existing routine rows are NOT corrected by this release**: Her active Phase 2 AM/PM rows in `ss_routine_products` still reflect the pre-fix mismatch. A separate manual data correction (or asking Yuri to redo the save with the new code) is required.

### Verification
- `npx tsc --noEmit` passes clean
- Bug reproduction: simulated `resolveProductByName("Goodal Green Tangerine Vita C")` against the live DB. Pre-fix matched the Cream (rating 4.50) over the more specific Serum. Post-fix matches the shortest-name candidate.
- Tool-execution logic verified: a save with one in-DB product (clean match), one ambiguous product (loose match), and one nonexistent product (no DB match) produces a single `message` string with three labeled sections that Yuri must quote.

### Files modified
- `src/lib/yuri/tools.ts` — `resolveProductByName` tiebreaker + `SaveRoutineStep` interface (added `product_id`) + `save_routine` schema + `executeSaveRoutine` rewrite
- `src/lib/yuri/advisor.ts` — two new system-prompt rules under `**save_routine**`
- `CHANGELOG.md` — this entry
- `CLAUDE.md` — version line + cross-reference

---

## v10.1.0 (Apr 16, 2026) — Claude Opus 4.7 Migration

### Changed
- **Model upgrade**: All user-facing AI calls migrated from Claude Opus 4.6 (`claude-opus-4-6`) to Claude Opus 4.7 (`claude-opus-4-7`). Released by Anthropic April 14, 2026
- **Single source of truth**: `MODELS.primary` in `src/lib/anthropic.ts` and 8 contexts in `src/lib/ai-config.ts` (YURI_CHAT, WIDGET_CHAT, SCAN_ANALYSIS, GLASS_SKIN_SCORE, SHELF_SCAN, ROUTINE_GENERATION, DUPE_FINDER_AI, CONTENT_GENERATION) updated
- **Pricing map updated**: Opus 4.7 is $5/MTok input, $25/MTok output — 3x cheaper than Opus 4.6's $15/$75. `estimateCost()` and `pricing` map in `ai-config.ts` reflect new rates
- **Unit economics improved**: Per-Pro-user variable cost drops from ~$7.71/mo to ~$4.11/mo. Margin per Pro user improves from 81% to 90%
- **Quality gains**: Better literal instruction following, adaptive reasoning depth (model decides on the fly), better response calibration, +13% on coding benchmarks

### Removed
- **`temperature: 0` parameter on Glass Skin Score**: Opus 4.7 rejects `temperature`, `top_p`, and `top_k` parameters with 400 errors. Removed from `src/app/api/skin-score/route.ts`. NOTE: this reverts the v8.5.0 deterministic-scoring fix — Opus 4.7's improved calibration should make scoring more consistent than 4.6 even without temperature locking, but worth re-validating Glass Skin Score photo consistency in production

### Verification
- Pre-migration curl test against `claude-opus-4-7` with adaptive thinking returned 200
- Post-migration curl test with EXACT request shape Yuri uses (system prompt + cache_control + tools + cache_control) returned 200
- `tsc --noEmit` passes clean
- No `top_p`/`top_k`/`budget_tokens`/`thinking.type: 'enabled'` usage existed in the codebase (nothing to strip)

---

## v10.0.1 (Mar 11, 2026) — All Development Phases Complete

### Changed
- **Phase 13 confirmed COMPLETE**: All 6 conversation engine hardening features built and deployed — prompt caching (20-30% token cost reduction), API retry with exponential backoff, structured decision memory, intent-based context loading, onboarding quality scoring, voice quality post-processing
- **Deferred Phase 8 features confirmed COMPLETE**: All 4 previously deferred features built and deployed — Feature 8.1 (Product Detail Page Enrichment), Feature 8.2 (Routine Builder Intelligence), Feature 8.5 (Expiration/PAO Tracking), Feature 8.6 (Reformulation Tracker). Phase 8 now 11/11 features complete
- **All 14 development phases now COMPLETE**: Phases 1-14 representing 60+ features across product intelligence, AI conversation engine, community, monetization, trend intelligence, widget conversion, and platform-wide personalization
- **Remaining work**: Only future items remain — push notifications, scan-counterfeits cron, community-digest cron, Supabase attack protection (all deferred until traffic/revenue justifies)

---

## v10.0.0 (Mar 10, 2026) — Phase 14: Widget Conversation Intelligence

### Added
- **4 new database tables**: `ss_widget_visitors` (persistent anonymous identity, AI memory, lifetime stats), `ss_widget_sessions` (per-conversation tracking with specialist domains, intent signals), `ss_widget_messages` (full message storage with tool call JSONB), `ss_widget_intent_signals` (15 consumer intent signals across 4 categories)
- **Feature 14.1: Ghost-Free Session Management**: Sessions created on first message, not page load. Client-generated visitor UUID via `crypto.randomUUID()` in localStorage + 365-day cookie
- **Feature 14.2: Message Persistence**: Every user and assistant message saved with tool call JSONB logging. Fire-and-forget persistence, never blocks SSE stream
- **Feature 14.3: Specialist Preview**: `detectSpecialist()` identifies specialist domains in anonymous conversations, injects one-line FOMO into system prompt
- **Feature 14.4: Intent Signal Detection**: 15 regex/keyword-based consumer skincare signals across 4 categories (purchase_intent, routine_building, skin_concern_urgent, product_comparison)
- **Feature 14.5: Admin Widget Dashboard**: Full admin page at `/admin/widget` with analytics tab (overview stats, intent signals, specialist domains, recent visitors) and conversations tab (paginated session list, full message thread detail with tool calls)
- **Cross-session AI memory**: Sonnet-generated structured JSON merged cumulatively on `ss_widget_visitors.ai_memory`

### Changed
- **Architecture shift**: Widget converted from completely stateless (conversations streamed and forgotten) to fully persistent system with visitor tracking, message storage, intent signals, and admin observability
- Both `TryYuriSection.tsx` and `YuriBubble.tsx` send `visitor_id`/`session_id` and capture returned `session_id` from SSE done events
- "Widget Intel" link added to admin dropdown menu in Header

---

## v9.5.0 (Mar 10, 2026) — Hero Widget Redesign: Yuri Above the Fold

### Changed
- **Homepage hero redesign**: Yuri chat widget is now 50% of the hero section (50/50 grid layout) instead of buried mid-page as section 6 of 11. Matches the proven Softcom/myweekendceo "widget-as-hero" pattern that drives actual chat engagement
- **Hero layout**: Left column = value proposition + quick stats + CTAs. Right column = live Yuri chat with demo conversation, quick prompts, and full streaming support
- **Stats moved to hero**: Key metrics (5,800+ products, 14,400+ ingredients, 6 specialists, 550+ brands) now visible above the fold in a compact grid
- **Removed duplicate mid-page TryYuriSection**: Yuri is now in the hero only (plus floating bubble globally)

### Added
- `TryYuriSection` `variant` prop: `"hero"` renders as embedded card without section wrapper, `"section"` preserves original full-width layout for standalone use
- 4 quick prompt buttons in hero widget demo state: "Is my COSRX Snail Mucin real?", "Best serum for glass skin?", "Build me a routine", "Find me a sunscreen dupe"
- Chat header with "Live" badge in hero variant
- Shared `chatContent` between both variants to eliminate code duplication

---

## v9.4.1 (Mar 7, 2026) — Bug Fixes: Ingredient Filters, Multi-Term Search

### Fixed
- **Ingredient include/exclude filters returning 500**: `handleIngredientFilteredQuery()` passed all 5,838 product IDs in a single Supabase `.in()` call, exceeding PostgREST URL length limits. Fixed by batching in chunks of 500 (same pattern already used in `handleRecommendedQuery`). Affects `?include_ingredients=` and `?exclude_ingredients=` query params on `/api/products`
- **Multi-term product search returning 0 results**: Searching "cosrx snail" (brand + product name) returned empty because the products API used single-column `ilike` matching. Ported the `smartProductSearch()` term-splitting pattern from Yuri's `tools.ts` — new `applySmartSearch()` helper splits queries into terms, matches ANY term against both `name_en` and `brand_en`, then post-sorts results so ALL-term matches rank first

### Notes
- Comprehensive API test suite run across all endpoints: Products (7 tests), Trending (4 tests), Sunscreen (4 tests), Ingredients (2 tests), Weather (1 test), SEO files (4 tests), Database health (10 checks). 3 bugs found and 2 fixed in this release
- Dupe finder returns empty for original 56 seed products (pre-pipeline) because they lack `ingredients_raw` data. Works correctly for 5,500+ pipeline products with full ingredient links. Not a code bug — data limitation of manually-seeded products
- 3 `not_skincare` products identified for manual cleanup (Round Lab set, 2x So Natural makeup setting spray)

---

## v9.4.0 (Mar 6, 2026) — SEO & AI Discoverability: Ingredient Encyclopedia, Best-of Pages, Enhanced Structured Data

### Added
- **Ingredient Encyclopedia** (`/ingredients`, `/ingredients/[slug]`): Searchable directory of 8,200+ active cosmetic ingredients with individual detail pages. Each page includes safety rating, comedogenic score, function description, effectiveness by skin type (from `ss_ingredient_effectiveness`), known ingredient interactions, products containing the ingredient, and a CTA to ask Yuri. JSON-LD: Article, FAQPage, BreadcrumbList per page
- **Ingredient Search API** (`/api/ingredients/search`): New endpoint for typeahead ingredient search with ILIKE injection prevention, active-first sorting, accepts both `q` and `query` params
- **Ingredient Search Component** (`IngredientSearch.tsx`): Client-side debounced search with dropdown results showing INCI name, English name, function, and active badge
- **Best-of Category Landing Pages** (`/best`, `/best/[category]`): 12 category pages targeting "best Korean [category]" search queries with ranked product lists, real Olive Young ratings/reviews, price data, FAQ sections, and cross-category navigation. JSON-LD: CollectionPage, ItemList (top 20 products with prices/ratings), FAQPage, BreadcrumbList per page. `generateStaticParams()` pre-generates all 12 pages
- **Best-of Index Page** (`/best`): Hub page linking to all 12 categories with live product counts and top product per category
- **Enhanced Product Page JSON-LD** (`products/[id]/layout.tsx`): Server-rendered Product schema with AggregateRating, FAQPage (auto-generated from ingredient data and pricing), BreadcrumbList, and `robots: { index: true, follow: true }` + canonical URL
- **`generate-content` cron enabled**: Daily 10 AM UTC content generation targeting AI-discoverability topics (ingredient deep-dives, seasonal guides, brand spotlights, product comparisons, routine building)
- **Slug utility** (`lib/utils/slug.ts`): `toSlug()` function for INCI name → URL-safe slug conversion

### Changed
- **Sitemap expanded** (`sitemap.ts`): Now includes `/ingredients`, `/best`, 12 best-of category pages, and ~8,200 active ingredient detail pages alongside existing product and blog pages. All queries run in parallel via `Promise.all`. Slug deduplication prevents duplicate URLs. Total sitemap: ~14K URLs
- **llms.txt updated**: Added Best-of category links (12 URLs), Ingredient Encyclopedia section with example URLs, Blog section, and updated database statistics (8,200+ active ingredient pages)

### Files Created
- `src/app/ingredients/page.tsx` — Ingredient listing page with featured ingredients and search
- `src/app/ingredients/[slug]/page.tsx` — Ingredient detail page with full structured data
- `src/app/ingredients/IngredientSearch.tsx` — Client-side ingredient search component
- `src/app/best/page.tsx` — Best-of index page
- `src/app/best/[category]/page.tsx` — Dynamic best-of category pages (12 categories)
- `src/lib/utils/slug.ts` — INCI name to URL slug utility

### Files Modified
- `src/app/(app)/products/[id]/layout.tsx` — Added server-rendered Product + FAQ JSON-LD
- `src/app/sitemap.ts` — Added ingredient pages, best-of pages, parallel queries
- `public/llms.txt` — Added best-of links, ingredient encyclopedia, blog section
- `vercel.json` — Enabled `generate-content` cron schedule

---

## v9.3.0 (Mar 5, 2026) — Monetization Overhaul: Payment-First Registration + AI-First Widget Conversion

### Changed
- **Free tier eliminated**: Seoul Sister is now a paid-only platform. No free accounts can be created. All users must subscribe ($39.99/mo) before accessing the app
- **Payment-first registration flow**: Register → `/subscribe` payment gate → Stripe Checkout → `/onboarding` → app access. New `src/app/(auth)/subscribe/page.tsx` page placed under `(auth)` route group to avoid AppShell redirect loops
- **Email verification removed**: Registration no longer requires email confirmation. Account is created instantly, user redirected straight to payment. Requires "Confirm email" disabled in Supabase dashboard (Authentication > Providers > Email)
- **AppShell subscription enforcement**: `src/components/layout/AppShell.tsx` now checks `ss_user_profiles.plan` — redirects to `/subscribe` if no active plan, redirects to `/onboarding` if not onboarded
- **Auth callback redirect**: Email verification now redirects to `/subscribe` (was `/dashboard`)
- **Stripe checkout URLs**: Success URL changed from `/dashboard?subscription=success` to `/onboarding`. Cancel URL changed to `/subscribe?canceled=true`
- **Widget system prompt rewritten AI-First**: Replaced message-by-message conversion playbook with identity/context/values/business-reality framework. Claude Opus given creative freedom to build trust naturally through genuine K-beauty expertise, not scripted conversion tactics
- **Widget message limit increased**: 5 → 20 preview messages per session. Server-side: IP+UA hash tracking with 30-day window. Client-side: localStorage counter. Rate limit increased 10 → 25/IP/day, history limit 10 → 40 messages
- **Widget conversion CTAs**: Both `YuriBubble.tsx` and `TryYuriSection.tsx` updated with value-first messaging: "This is just the preview" + feature highlights + "$39.99/mo" subscribe CTA
- **Onboarding prompt updated**: `buildOnboardingSystemPrompt()` now acknowledges subscriber status — "This person just subscribed... proving the subscription is worth it by showing real expertise"

### Removed
- **Free tier references**: "Create a free account" → "Create an account" on login page. Terms of Service updated: "Free tier features are available at no charge" → "Seoul Sister requires a paid subscription". Register page comment updated
- **Free/Pro/Annual/Student pricing tiers**: Single tier only ($39.99/mo Seoul Sister Pro)
- **Email verification UI**: Removed `verificationSent` state, "Check your email" screen, and conditional branching from register page. `signUp()` now always redirects to `/subscribe`. `/auth/callback` route kept for password recovery only

### Fixed
- **AppShell variable mismatch**: `onboardingChecked` → `ready` (stale reference from previous refactor would have caused ReferenceError)

### Files Created
- `src/app/(auth)/subscribe/page.tsx` — Payment gate page with Stripe checkout integration

### Files Modified
- `src/app/api/widget/chat/route.ts` — Full system prompt rewrite, limits increased
- `src/lib/utils/widget-session.ts` — MAX_FREE_MESSAGES 5 → 20
- `src/app/page.tsx` — "Try Yuri free — 20 preview messages"
- `src/components/pricing/PricingCards.tsx` — "Try 20 free preview messages"
- `src/components/widget/YuriBubble.tsx` — Value-first conversion CTA
- `src/components/widget/TryYuriSection.tsx` — Value-first conversion CTA
- `src/app/auth/callback/route.ts` — Redirect to `/subscribe`
- `src/components/layout/AppShell.tsx` — Subscription + onboarding gating
- `src/app/(auth)/register/page.tsx` — Redirect to `/subscribe`, remove "free" language
- `src/app/api/stripe/checkout/route.ts` — Updated success/cancel URLs
- `src/app/(auth)/login/page.tsx` — "Create an account" (removed "free")
- `src/app/(legal)/terms/page.tsx` — Updated subscription billing language
- `src/lib/yuri/onboarding.ts` — Subscriber-aware onboarding prompt

---

## v9.2.0 (Mar 2, 2026) — Google Analytics 4 Integration + Vercel Analytics

### Added
- **Google Analytics 4**: Measurement ID `G-L3VXSLT781` integrated via Next.js `<Script>` component with `afterInteractive` strategy in `src/app/layout.tsx`
- **Vercel Analytics**: `@vercel/analytics/next` added to root layout for automatic page view and Web Vitals tracking
- **Vercel SpeedInsights**: `@vercel/speed-insights/next` added for Core Web Vitals monitoring (LCP, FID, CLS)
- **Organization JSON-LD**: Structured data with `SearchAction` for Google sitelinks search box

### Context
This was set up as part of the LGAAS Performance Marketing Playbook (see `lgaas-blueprint/21-PERFORMANCE-MARKETING-PLAYBOOK.md`). Seoul Sister was the first application to receive GA4 integration on March 2, 2026. The same playbook is now used for LGAAS subscriber landing pages.

---

## v9.1.0 (Feb 28, 2026) — Cosmetics Pass-2 Cleanup + Extractor Hardening

### Fixed
- **ILIKE pattern sweep**: Pass-1 cleanup (v9.0.0) used exact `.in('subcategory', [...])` matching, missing variant subcategories like "volume mascara", "cream blush", "pencil eyeliner", "under eye concealer", "foundation SPF"
- **Pass-2 ILIKE cleanup**: `scripts/cleanup-cosmetics-pass2.ts` using ILIKE patterns for broader matching. KEEP_SUBCATEGORIES whitelist preserves legitimate skincare: makeup remover, eye makeup remover, makeup sun cream, makeup base sunscreen. Result: 92 matched, 18 kept, 74 deleted. Products: 5,926 to 5,852
- **Extractor prompt hardened** (`src/lib/pipeline/extractor.ts`): Expanded `EXTRACTION_SYSTEM_PROMPT` with exhaustive cosmetic rejection categories
- **Product counts updated across 6 files**: "5,900+" to "5,800+"

---

## v9.0.0 (Feb 28, 2026) — Data Quality Hardening + Skincare-Only Filter

### Fixed
- **Cron health audit**: Verified all 12 active crons healthy (13th `generate-content` intentionally disabled)
- **Price scraping coverage expanded**: Soko Glam batch size 10 to 25 products per run. YesStyle removed from cron (Playwright cold start consumed too much budget)
- **Skincare-only extraction filter** (3 files): Category gating added to prevent makeup, hair care, and body care from leaking into `ss_products`
- **Existing non-skincare cleanup**: 299 non-skincare products removed. 28 subcategories identified as non-skincare
- **Failed staging row reprocessed**: GA260136975 correctly classified as `not_skincare`
- **Database impact**: 6,222 to 5,926 products

---

## v8.9.0 (Feb 27, 2026) — Pre-Launch Audit Session 3: Cron Pipeline Fix (CRITICAL)

### Fixed
- **ALL 13 cron jobs silently failing since deployment** — two compounding bugs:
  - Auth header mismatch: `verifyCronAuth()` only checked `x-cron-secret` but Vercel sends `Authorization: Bearer`
  - HTTP method mismatch: All 13 routes only exported `POST` but Vercel cron sends `GET`
- Updated `cron-auth.ts` to try `Authorization: Bearer` first, fall back to legacy header
- Added `export { POST as GET }` to all 13 cron route files

---

## v8.8.0 (Feb 27, 2026) — Pre-Launch Audit Session 2: Database Performance

### Fixed
- **auth.uid() InitPlan optimization**: Wrapped in `(select auth.uid())` across 69 RLS policies on 25 tables
- **auth.role() InitPlan optimization**: Same pattern on 5 service-role-only policies
- **Missing FK indexes**: 3 btree indexes on foreign key columns
- **Ghost functions dropped**: 3 functions referencing tables dropped in v5.5.0
- **Duplicate index dropped**: `idx_ss_product_ingredients_ingr`
- Supabase Performance Advisor: 0 remaining warnings

---

## v8.7.0 (Feb 27, 2026) — Pre-Launch Audit Session 1: Security Hardening

### Fixed
- RLS on `ss_pipeline_runs` and `ss_product_staging` (previously unprotected)
- Cron job `statement_timeout` for long-running queries
- Search input sanitization to prevent SQL injection

---

## v8.6.0 (Feb 26, 2026) — SEO Implementation

### Added
- **Canonical URLs**: `metadataBase` set to `https://www.seoulsister.com`
- **www normalization**: All URLs updated across 8 files to use `www.` prefix
- **Product page metadata**: `generateMetadata` with unique titles, descriptions, OG/Twitter cards
- **Blog listing JSON-LD**: `CollectionPage` + `BreadcrumbList`
- **Blog post BreadcrumbList**: Home > Blog > Post Title
- **Blog author E-E-A-T**: `Person` type for named authors, `Organization` fallback

---

## v8.5.0 (Feb 25, 2026) — Yuri Quality Hardening (Bailey Feedback)

### Fixed
- **Glass Skin phase-awareness**: Recommendations now align with Yuri's phased treatment plan
- **Glass Skin result persistence**: Expandable accordion for past scores
- **Yuri date/timeline reasoning**: Injected `Today's date` for accurate day counting
- **Glass Skin score consistency**: `temperature=0` for deterministic scoring

### Changed
- Voice quality: Brevity as expertise, emoji placement, multi-part question handling, tool-result pacing
- Feature knowledge audit across all 6 specialist prompts

---

## v8.4.0 (Feb 25, 2026) — Streaming Engine Hardening

### Added
- **Streaming retry with exponential backoff**: 3 retries on transient failures (529, 502/503)
- **Real-time streaming during tool-use**: Two-mode system (BUFFER first round, STREAM post-tool)
- **Widget real streaming**: Replaced fake 50-char chunking with real `messages.stream()`

---

## v8.3.0 (Feb 25, 2026) — Application-Wide Prompt Refactor

### Changed
- **Philosophy**: "Trust the model more, constrain it less"
- **advisor.ts**: ~6,800 to ~3,800 tokens (~44% reduction)
- **specialists.ts**: ~3,180 to ~2,030 tokens (~36% reduction)
- **widget prompt**: ~1,000 to ~950 tokens
- Merged tool sections, replaced prose app knowledge with reference table, cut redundant guidelines

---

## v8.2.3 (Feb 25, 2026) — Yuri Personality Edge

### Added
- `## Your Edge` section: Bold, opinionated, occasionally contrarian (Anthony Bourdain energy for skincare)
- Widget prompt updated with condensed boldness directives

---

## v8.2.2 (Feb 25, 2026) — Yuri Persona Refinement

### Changed
- Conversational pacing replaces rigid word count tiers
- Emoji guidance: 1-2 per response, zero feels cold
- Third-party advice handling (boyfriend/mom/friend skincare questions)

---

## v8.2.1 (Feb 25, 2026) — Smart Product Search

### Fixed
- Cross-column term splitting: `smartProductSearch()` with 3-strategy cascade
- `resolveProductByName()` shared helper for all 6 tool functions
- Stop-word filtering for K-beauty generic terms

---

## v8.2.0 (Feb 24, 2026) — Fix Yuri Tool Usage

### Fixed
- **Root cause**: Claude Opus answered from training knowledge instead of calling tools
- `shouldForceToolUse()` intent detector with `tool_choice: { type: 'any' }` forcing
- 60+ K-beauty brand detection, price/trending/product queries
- Widget parity with `shouldWidgetForceToolUse()`

---

## v8.1.3 (Feb 25, 2026) — Streaming Fix + Response Length

### Fixed
- Thinking text leak: Unified streaming strategy across all tool-loop iterations
- Response length softened to AI-First directional guidance

---

## v8.1.2 (Feb 24, 2026) — Post-Bailey Review

### Fixed
- Mandatory tool usage rules (7 explicit triggers, 3 prohibitions)
- Response length control (later softened in v8.1.3)
- Feature repetition prevention (Glass Skin mentioned in ALL 4 conversations)
- Voice tightening (9 new banned filler patterns)
- Decision memory truncation (400 to 1200 chars)

---

## v8.1.1 (Feb 24, 2026) — Real-Time Weather Tool

### Added
- `get_current_weather` tool (8th tool): Open-Meteo API, city geocoding, seasonal learning context
- Widget access for anonymous visitors
- 3-tier location resolution (explicit coords > city name > profile)

---

## v8.1.0 (Feb 23, 2026) — Phase 13 Blueprint

### Added
- Cross-application audit (LGAAS vs Seoul Sister)
- 6 features documented (13.1-13.6): Prompt Caching, API Retry, Decision Memory, Intent-Based Context, Onboarding Quality Scoring, Voice Quality Post-Processing

---

## v8.0.1 (Feb 23, 2026) — Cross-Session Memory Trust Fix

### Fixed
- Yuri denied making recommendations that WERE in conversation summaries
- System prompt memory trust rules (5 explicit rules)
- Structured product recommendation extraction from summaries
- Pinned onboarding summary + expanded limits (5 to 7)

---

## v8.0.0 (Feb 23, 2026) — Phase 12 COMPLETE: Platform-Wide Intelligence

### Added
- All 13 features (12.0-12.12) built and deployed
- Shared intelligence context helper (`loadIntelligenceContext()`)
- Widget intelligence (3 database tools for anonymous visitors)
- Scan, Glass Skin, Shelf Scan, Sunscreen, Products, Trending, Dupe, Weather, Routine, Dashboard, Community intelligence
- 12 cron jobs configured

---

## v7.0.0 (Feb 22, 2026) — Phase 12 Blueprint

### Added
- 13 features (12.0-12.12) documented with full implementation plans
- Phase 11 features deployed to production (location awareness, learning engine bootstrap)

---

## v6.0.0 (Feb 22, 2026) — Phase 11 Blueprint + Memory Improvements

### Added
- 4 critical intelligence gaps documented (11.1-11.4)
- Cross-session memory improvements (richer summaries, message excerpts, smart truncation)
- Location awareness via reverse geocoding
- Bailey's contradictory summary fixed

---

## v5.9.0 (Feb 22, 2026) — Phase 10 Blueprint: Real-Time Trend Intelligence

### Added
- Phase 10 documented: Olive Young Bestseller Scraper, Reddit Scanner, Trend Gap Detector
- LGAAS Reddit OAuth pattern referenced

---

## v5.8.3 (Feb 21, 2026) — Database Stats Sync

### Changed
- Ingredients 14,200+ to 14,400+, links 219,000+ to 221,000+, linked products 88% to 89%

---

## v5.8.2 (Feb 21, 2026) — Database Stats Sync

### Changed
- Ingredients 11,700+ to 14,200+, links 189,000+ to 219,000+, linked products 76% to 88%

---

## v5.8.1 (Feb 21, 2026) — Yuri Conversation Management

### Added
- Conversation delete and rename endpoints
- Auto-title propagation via `__TITLE__` sentinel
- ConversationList rewritten with inline edit, delete confirmation, specialist badges

---

## v5.8.0 (Feb 21, 2026) — Full Ingredient Linking Pass

### Changed
- Ingredients 10,369 to 11,700+, links 180,125 to 189,000+, linked products 72% to 76%

---

## v5.7.0 (Feb 21, 2026) — Extended Enrichment + Ingredient Linking

### Changed
- Products 5,516 to 6,222 (+706 from enrichment), brands 454 to 593, ingredients 9,228 to 10,369
- `ingredients_raw` coverage: 4,107 to 5,509 products
- Cumulative pipeline cost: $55.97

---

## v5.6.0 (Feb 20, 2026) — Cron Pipeline Hardening

### Added
- Olive Young CATEGORY_MAP expanded (6 to 11 categories)
- Active price scraping (Soko Glam API + YesStyle Playwright)
- Dedicated `link-ingredients` cron at 7:30 AM UTC
- PipelineAlerts component with 6 failure conditions
- Price freshness indicators per retailer

---

## v5.5.0 (Feb 20, 2026) — Production Readiness Audit

### Fixed
- Dropped 76 ghost tables, 1 ghost view, 13 ghost functions
- Fixed `handle_new_user` trigger (was inserting into dropped table)
- Subscription enforcement on 6 AI endpoints
- Usage tracking wired in (500 msg/30 scan caps)
- Billing portal, error boundaries, SSE stream hardening
- Stripe webhook secret configured

---

## v5.4.0 (Feb 20, 2026) — Phase 9.5 + Admin Auth + Yuri Knowledge

### Added
- 3 new cron jobs for daily automation
- Centralized admin auth system with 3-layer auth
- Yuri system prompt updated with ALL feature knowledge
- llms.txt updated with missing features

---

## v5.3.0 (Feb 21, 2026) — Phase 9.4: Multi-Retailer Price Integration

### Added
- 4 retailer scrapers (YesStyle, Soko Glam, Amazon, StyleKorean)
- Price matcher with 3-strategy fuzzy matching
- Price pipeline orchestrator
- 52 total price records across 6 retailers

---

## v5.2.0 (Feb 20, 2026) — Phase 9.6: Detail Enrichment + Full Linking Pass

### Changed
- Third ingredient linking pass: 3,025 to 4,137 linked products
- 5,516 products, 9,228 ingredients, 166,252 links, 454 brands

---

## v5.0.0 (Feb 20, 2026) — Phase 9.1-9.3 + 9.6: Automated Pipeline

### Added
- Olive Young Global Scraper (5,656 listings)
- Sonnet AI Extraction (5,530 products, $49.15)
- Ingredient Auto-Linking Pipeline (4,137 linked, $6.82)
- Total pipeline cost: $55.97

---

## v4.0.0 (Feb 19, 2026) — Phase 9 Blueprint + Product Expansion

### Added
- Phase 9 blueprint (6 features: 9.1-9.6)
- Product database 151 to 626 products, 82 brands

---

## v3.10.0 (Feb 19, 2026) — Shelf Scan: Collection Analysis

### Added
- Claude Opus 4.6 Vision multi-product identification
- RoutineGrade (A-F), CollectionStats, CollectionGrid components

---

## v3.9.0 (Feb 19, 2026) — Weather-Adaptive Routine Alerts

### Added
- Open-Meteo API integration (free, no key)
- WeatherRoutineWidget on dashboard
- 6 weather triggers with skin-type adjustments

---

## v3.8.0 (Feb 19, 2026) — Glass Skin Score: Photo Tracking

### Added
- Claude Opus 4.6 Vision skin analysis (5 dimensions)
- ScoreRadarChart (SVG pentagon), ProgressTimeline, ShareCard
- Dashboard widget with score ring and trend

---

## v3.7.0 (Feb 19, 2026) — Hormonal Cycle Routine Adjustments

### Added
- 4-phase cycle tracking (menstrual/follicular/ovulatory/luteal)
- Yuri context injection for cycle-aware advice
- Sensitivity Guardian specialist routing

---

## v3.6.0 (Feb 18, 2026) — Phase 8 Blueprint: 11 Value Features

### Added
- Implementation plans for 11 features across 3 priority tiers

---

## v3.5.0 (Feb 18, 2026) — Scan Enrichment Pipeline + Mobile Fix

### Added
- 5 parallel post-scan enrichment queries (personalization, pricing, community, counterfeit, trending)
- ScanResults component with 7 enrichment sections
- Client-side image compression for mobile

---

## v3.4.0 (Feb 18, 2026) — AI Discoverability, PWA, Performance

### Added
- robots.ts with AI crawler allowances
- Dynamic sitemap.ts, llms.txt
- JSON-LD structured data
- Service worker, PWA install prompt
- Code splitting, bundle analyzer
- Stripe pricing ($39.99/mo)

---

## v3.3.0 (Feb 17, 2026) — All Build Phases Complete + Deployment

### Added
- 7 build phases + Phase 3B schema complete
- Vercel deployment live, DNS configured
- Next.js upgraded to 15.5.12

---

## v3.2.0 (Feb 17, 2026) — Three-Layer Yuri Widget Architecture

### Changed
- Replaced generic widget with three-layer approach (floating bubble, inline Try Yuri, full post-signup)

---

## v3.1.0 (Feb 17, 2026) — Yuri Conversational Onboarding + Landing Page Widget

### Added
- Yuri onboarding replaces form wizard
- Pre-signup AI demo on landing page

---

## v3.0.0 (Feb 17, 2026) — Complete Rebuild as "Hwahae for the World"

### Added
- 7 development phases, 30 database tables, 6 specialist agents, glass skin design system

---

**Created**: February 2026
**Author**: Scott Martin + Claude
