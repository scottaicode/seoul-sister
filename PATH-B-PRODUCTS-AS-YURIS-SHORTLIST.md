# Path B — Products as Yuri's Shortlist

> Status: BLUEPRINT (awaiting Scott approval). Target release: v10.8.0.
> Authored: May 22 2026.
> Bailey-driven, audit-verified, AI-First compliant.

## Origin

On May 20 2026, Bailey told Scott via iMessage that she loves Seoul Sister's Ingredients feature but doesn't like the Products feature. She went further — she suggested hiding Products from paying subscribers entirely and only letting Yuri access it on the backend.

Scott proposed an alternative on May 20 8:04 PM: a paying subscriber could search a product, the catalog would be run against her profile, and the only products displayed would be "Yuri Certified" for her skin profile, current phase, and routine. A toggle would reveal products Yuri would *skip* — with her reasoning shown per product, so she's educating, not just filtering. Bailey responded May 22 1:31 PM: *"Hmmmm I do like that better than the current way at least."*

A deep audit on May 22 confirmed her instinct is correct, and that Scott's proposal moves in the right direction. This blueprint codifies a refined version.

## What's actually wrong with Products today

Three findings from the May 22 audit:

1. **The /browse surface is generic e-commerce dressed up as intelligence.** "For You" sort and the "Loved by Combination Skin" carousel rank products by ingredient effectiveness × skin type — a pure algorithmic rank that has **zero awareness** of Bailey's active treatment phase, her decision memory (what Yuri has explicitly excluded for her), or her current routine ingredients. That makes it the same shape as the Routine Intelligence widget (v10.5.2 kill), the Weather widget recommendations (v10.6.2 kill), the Glass Skin Recommendations panel (v10.7.1 kill), and the Dashboard "Yuri's Insights" widget (v10.7.1 kill). **It's the sixth instance of the Yuri Sole Authority Principle violation about to be earned by a Bailey-caught miss.**

2. **The product catalog is the cognitive load Yuri exists to eliminate.** Subscribers came for an advisor, not a 5,917-product catalog to sort and filter. Browsing puts Bailey in the position of weighing effectiveness scores and ratings against her own state — exactly what Yuri's conversational layer does better because Yuri has phase + decision memory + corrections + routine context that no algorithmic rank captures.

3. **The Ingredients feature works for Bailey because it's reference material she owns, not a sales funnel.** The subscriber enrichment panel (v10.6.4 Phase 13.G) shows her *her data* ("you use this in 3 products"), *her phase context* (watch_for items verbatim from Yuri's conversations), and *one Yuri CTA*. Zero algorithmic recommendations. That's the pattern to copy.

## Philosophical commitment

This blueprint is anchored to two load-bearing principles. Both stand throughout the build:

**Principle 2 — AI-First Reasoning.** No `if skin_type X && phase Y then "use Z"` rule engines. No hardcoded template strings for Yuri's per-product reasoning output. No regex over user input. The Sonnet reasoning generator receives a creative brief (skin profile + active phase watch_for + decision memory exclusions + scanned ingredients + routine overlap) and reasons dynamically about whether the product fits or conflicts. The deterministic SQL pre-filter is **structural data filtering** (removes products that contain declared allergens, or contain ingredients the user's decision memory has explicitly excluded) — it does not rank, judge, or recommend.

**Yuri Sole Authority Principle (CLAUDE.md, lines 231-287).** Products surface labels stay observational: *"Filtered against your Phase 2 protocol"*, *"Why Yuri would skip this"* — never *"Yuri Certified"* (a stamp/endorsement framing Bailey already pushed back on twice). The reasoning shown per product is **Yuri's actual reasoning surfaced**, not an algorithm impersonating her. The single recommendation surface remains the Yuri chat itself, accessible from every card via "Ask Yuri about this" CTA with prefilled context.

## Architecture — two-layer

### Layer 1: Deterministic phase-aware filter (zero AI cost, fast)

When Bailey hits /browse, the existing candidate query runs (filtered by her search/category/price/etc.) but is then split into `fits` and `skip` based on **pure structural checks** against her current state:

- **Skip if**: any product ingredient name matches her declared allergens list (already in `ss_user_profiles.allergies`)
- **Skip if**: any product ingredient name matches a substance her decision memory has explicitly excluded for the current phase. Decision memory already has the `corrections`, `decisions`, `preferences`, and `commitments` arrays from Phase 13.3 + Phase 15.1. The phase-relevance keyword detection from v10.3.6 (`getMissingHighValueIngredients`) is already proven and can be reused
- **Skip if**: any product ingredient name matches a substance her active treatment phase `watch_for` list flags as something to avoid (the phase row's `watch_for JSONB` already exists from Phase 13.D / v10.6.0)
- **Otherwise**: product goes in `fits`

This filter is **fast** (joins against `ss_user_products` ownership, `ss_routine_products`, and ingredient name matching — all SQL-native, no AI). It cuts ~5,900 catalog products to ~20-40 candidates that don't structurally conflict with her current state. The split happens for every product returned, so the toggle "Show products Yuri would skip" can flip immediately without re-fetching.

**What this filter does NOT do**: rank, score, judge stylistically, or generate any reasoning text. It's data filtering, like the SQL `WHERE` clause. Pure structural removal of products that conflict with declared user state.

### Layer 2: On-demand Sonnet reasoning (small cost, cached)

When Bailey expands "Why Yuri would skip this" on a specific product card, the UI lazily fetches `/api/products/curated/[id]/reasoning`. The endpoint:

1. Computes a `cache_key_hash` over the load-bearing inputs (skin profile fingerprint + active phase ID + decision_memory hash + allergens hash + product ID)
2. Checks `ss_product_curation_reasoning` for an existing row matching that hash
3. **Cache hit (common case)**: returns the cached reasoning instantly
4. **Cache miss**: calls Sonnet 4.5 with a creative-brief prompt, persists the result, returns it

Same pattern works for "Ask Yuri why this fits" on the curated side (rarer expansion, same caching model).

The cache invalidates **automatically** when the user's phase changes or decision_memory updates (because the hash changes). The cache invalidates **slowly over time** via a `generated_at` TTL (e.g., 60 days) so reformulation drift is caught — same age-aware discipline as Phase 15.4 corrections rendering.

### Cost projection (verified against AI config)

- **Browse view itself**: $0 — pure SQL.
- **Per-card "Ask Yuri about this" button**: $0 — static `<Link>` with prefilled `?ask=` URL. No AI call, no API call. Only fires Opus if the subscriber actually clicks through to /yuri.
- **Per-reasoning Opus 4.7 call**: input ~1,500-2,500 tokens × $5/1M + output ~150 tokens × $25/1M ≈ **$0.011-0.016 per generation**.
- **Cache hit rate after first week of subscriber use**: estimated 80%+ (her phase doesn't change daily, her decision_memory grows incrementally, and most browsed products are re-encounters).
- **Per-subscriber monthly cost**: assuming 30 browse sessions × 5 expansions per session × 20% new generations = 30 fresh reasonings/month → **~$0.40/month/subscriber**. Negligible against the $35.88 margin per Pro subscriber.
- **At 100 subscribers**: ~$40/month total. At 1,000: ~$400/month. Less than what Olive Young price scraping costs to run.

For context: a typical /yuri Opus chat session costs ~$0.05-0.10. One Yuri conversation ≈ ~5 browse expansions. The browse expander is bounded (single product INCI + her context, no multi-turn streaming, no tool calls) which is why it's so much cheaper than chat.

### Why Opus 4.7 for the reasoning step

Per Principle 1 ("Most Powerful Model, Every Time"). Scott's explicit call May 22 2026.

The original blueprint draft proposed Sonnet 4.5 on a bounded-task argument (similar shape to `decision_extraction`, `summary_generation`). Scott overrode this: *"Claude Opus 4.7 now. Let's provide the best possible experience possible."* That decision is consistent with how Principle 1 has been applied since v10.1.0 — when the cost gap is small and the surface is user-facing, the better model wins.

The voice-consistency argument that made Sonnet attractive in the draft is the same argument that makes Opus correct: the reasoning shown on browse cards is Yuri's voice surfaced into a different UI shape. If the chat surface uses Opus, the browse surface should match. A subscriber who expands skip reasoning on /browse, then opens /yuri and asks "tell me more," should not hear two different versions of Yuri.

**Cost delta from Sonnet to Opus is ~$0.10/sub/month** — negligible. Same margin math holds.

## Database changes

**One migration: `supabase/migrations/20260522000001_add_product_curation_reasoning.sql`**

```sql
-- v10.8.0 Path B — Products as Yuri's shortlist
-- Caches Sonnet 4.5 reasoning for product fit/skip verdicts, keyed by user + product + state hash

CREATE TABLE ss_product_curation_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,

  -- Deterministic hash over: skin_type + allergens + active_phase_id +
  -- decision_memory.corrections + decision_memory.decisions(phase-relevant) +
  -- watch_for items. When user's state changes meaningfully, this changes,
  -- and the cache row becomes a no-match for future lookups (invalidation).
  cache_key_hash TEXT NOT NULL,

  verdict TEXT NOT NULL CHECK (verdict IN ('fits', 'skip', 'neutral')),
  reasoning_text TEXT NOT NULL,
  -- Which watch_for items, allergens, or excluded substances this product touched.
  -- Pure observational metadata for telemetry + future learning.
  matched_items JSONB DEFAULT '[]'::jsonb,

  model TEXT NOT NULL DEFAULT 'claude-opus-4-7',
  input_tokens INTEGER,
  output_tokens INTEGER,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft TTL for reformulation drift safety. Cron can periodically clear
  -- rows older than this when a new run will catch reformulations.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),

  UNIQUE (user_id, product_id, cache_key_hash)
);

CREATE INDEX idx_curation_lookup ON ss_product_curation_reasoning(user_id, product_id, cache_key_hash);
CREATE INDEX idx_curation_user_recent ON ss_product_curation_reasoning(user_id, generated_at DESC);
CREATE INDEX idx_curation_expires ON ss_product_curation_reasoning(expires_at);

ALTER TABLE ss_product_curation_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own curation reasoning"
  ON ss_product_curation_reasoning FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role manages curation reasoning"
  ON ss_product_curation_reasoning FOR ALL
  USING ((select auth.role()) = 'service_role');
```

**No other schema changes.** Decision memory, treatment phases, allergens, profile, ingredient links all already exist.

## Code changes

### New files

- `src/lib/intelligence/product-curation.ts` (~250 lines) — phase filter + cache hash + Sonnet reasoning generator
- `src/app/api/products/curated/route.ts` (~150 lines) — GET endpoint, returns `{ fits: Product[], skipped: Product[] }`
- `src/app/api/products/curated/[id]/reasoning/route.ts` (~120 lines) — GET endpoint, returns cached or freshly-generated reasoning
- `src/components/products/CuratedProductCard.tsx` (~120 lines) — wraps ProductCard with optional inline skip reasoning expansion
- `supabase/migrations/20260522000001_add_product_curation_reasoning.sql` — table + indexes + RLS

### Modified files

- `src/app/(app)/browse/page.tsx` — rewrite to use `/api/products/curated` as default; kill the "For You" sort, the Loved-by-Skin-Type carousel, the recommended-sort indicator; add "Show products Yuri would skip" toggle
- `src/components/products/ProductFilters.tsx` — remove the `isAuthenticated` "For You" button (subscriber browse no longer needs a sort dropdown choice; it's curated by default)
- `src/app/api/products/route.ts` — leave intact for public /products surface and anonymous queries (the public AI-discoverability surface stays as-is per Yuri Sole Authority Principle compatibility)
- `src/lib/ai-config.ts` — add `PRODUCT_CURATION_REASONING` context (Opus 4.7, max_tokens 400, caching false, streaming false)
- `CLAUDE.md` — version bump to v10.8.0, full changelog entry, document the Strategic Open Question about Sonnet vs Opus for reasoning
- `package.json` — version 10.8.0

### Files explicitly NOT modified

- `src/app/products/page.tsx` (public SEO surface — anonymous visitors still see featured-by-rating-and-trending grid)
- `src/app/products/[id]/page.tsx` and `src/components/products/ProductEnrichment.tsx` (subscriber detail page already follows the Yuri Sole Authority pattern via v10.7.0 Phase G; not part of this work)
- `src/lib/yuri/tools.ts` (Yuri's `search_products` tool stays intact — it's how she does her own catalog reasoning, and we don't want to change the substrate Layer 2 depends on)

## System prompts

### Opus 4.7 reasoning generator — creative brief, not template

The Opus prompt is a brief, not a script. It establishes:

- **Identity**: You are surfacing Yuri's reasoning into a subscriber-facing UI. The subscriber is browsing the catalog; this is your structured read on whether a specific product fits their current treatment phase.
- **Voice**: Yuri's existing voice carries through — observational, specific, occasionally sharp when something would conflict. Korean K-beauty insider perspective. Never hedge with "everyone's skin is different" filler. Never use "Yuri Certified" or stamp language.
- **Inputs you're given**: the user's full skin profile, their active treatment phase (number, name, goal, watch_for items), the specific corrections and decisions from their decision memory relevant to the current phase, their declared allergens, the current scanned product's name, brand, and full INCI list, and what ingredients in this product overlap with their current routine.
- **Your output**: a JSON object with three fields. `verdict` ('fits' | 'skip' | 'neutral'). `reasoning_text` (2-3 sentences in your voice, naming specific ingredients and specific watch_for matches when they apply — no generic skincare advice). `matched_items` (array of which specific watch_for / allergen / decision_memory items this product touched, for telemetry).
- **Hard constraints**: If you don't have enough information to judge, return verdict='neutral' with a one-line acknowledgment. Don't claim her skin will react a specific way; speak in terms of what conflicts with what she's told you. If she has explicitly excluded a substance and the product contains it, that's verdict='skip' with the supporting quote in your reasoning.

This is a creative brief in the same shape as Yuri's main system prompt (Phase 13 hardening) — establishes identity and context, refuses to script output structure.

### Updates to Yuri's main system prompt

Add ONE line to the `## Quick Reminders` section in `src/lib/yuri/advisor.ts`:

> *"The /browse page is now your shortlist. When subscribers reach out from a product card, they've already seen your structured reasoning on whether it fits — pick up the conversation from there, don't re-explain what they already saw."*

This is a 2-line addition. No major prompt rewrite needed.

## UI behavior

The new /browse page renders three things in sequence:

1. **Header** — title + observational subtitle: *"Products filtered against your [Phase N: name] protocol, your allergens, and your current routine. Want a deeper read? Ask Yuri."*. Single "Ask Yuri about my browse" CTA at the top (same prefill pattern as Library).

2. **Curated list** — `fits` products only. Each card shows the standard product info + one inline button: *"Ask Yuri about this"* (routes to /yuri with `?ask=` prefill summarizing product + phase context). No "Yuri Certified" badges. No effectiveness percentages on the card itself. Pure data + Yuri entry point.

3. **Toggle: "Show products Yuri would skip (N)"** — collapsed by default. When expanded, renders the `skipped` array. Each skipped card has an additional inline expander: *"Why Yuri would skip this"*. On expand, lazily fetches `/api/products/curated/[id]/reasoning`. Shows loading shimmer for ~1-2s on first generation, then renders the reasoning text + matched_items as small pills. This is the educational moment — Bailey is reading *why* something would conflict with her Phase 2, not just being shown a black-box filter.

The toggle is the killer feature. Without it, this is just a hidden algorithm. With it, this is Yuri's reasoning made visible.

## What gets killed

- **"For You" sort button** on /browse — the algorithmic ingredient-effectiveness rank that has no phase awareness. Bailey would have caught this eventually; we're catching it first (proactive sweep discipline, v10.7.1).
- **"Loved by Combination Skin" carousel** on /browse — same algorithmic rank in a different UI shape. Cohort effectiveness without phase awareness or decision memory.
- **Recommended-sort indicator** ("Sorted by ingredient effectiveness for your skin type") — the label that made the algorithmic sort look like an authority surface.

All three are removed in Phase 4. The endpoints they consumed (`/api/products?sort_by=recommended`, `/api/products/discovery`) can stay for now (other surfaces may use them; killing them is a separate audit). But /browse no longer renders any of their output.

## Telemetry — measure if Bailey uses it

Two events logged to `ss_ai_usage` with `feature_area='product_curation'`:

1. `curated_browse_view` — fires on every `/api/products/curated` GET. Captures: user_id, filters applied, fits_count, skipped_count, has_active_phase. Tells us: are subscribers actually using the curated view, or do they still hit /yuri directly?
2. `skip_reasoning_expanded` — fires on every `/api/products/curated/[id]/reasoning` GET. Captures: user_id, product_id, was_cached, generation_tokens (if not cached). Tells us: **expansion rate** (% of curated browse sessions that expand at least one skip reasoning). This is the leading indicator.

**The metric to watch**: if expansion rate is > 30%, the educational toggle is working — Bailey and future subscribers want to understand the *why*. If expansion rate is < 10% after a month, Path A (just hide /browse entirely for subscribers and redirect to Yuri) becomes the next call. We have the data to decide.

Both events use fire-and-forget with `console.error` on failure (v10.3.5 audit discipline — never let logging break the request).

## AI-First pre-build audit (Principle compliance)

Verified in writing before code starts. Will be re-verified post-build (Phase 7).

| Check | Plan |
|------|------|
| **P1 — Most Powerful Model** | Opus 4.7 for both Yuri's chat AND the reasoning surface. Scott's explicit call May 22 2026 — voice consistency between /browse skip reasoning and /yuri chat matters more than the ~$0.10/sub/month delta over Sonnet. |
| **P2 — AI-First Reasoning** | Sonnet prompt is a creative brief, not a template. Layer 1 phase filter is structural data filtering (allergen + decision_memory + watch_for substring matching), explicitly NOT a rule engine that judges product quality. No `if condition then "use X"` logic anywhere. No regex over Sonnet's output. |
| **P3 — Moat Through Learning** | Reasoning cache invalidates on user-state hash change (closes Pattern 4 loop — corrections drive cleanup). Telemetry on expansion rate feeds the decision to escalate to Path A if needed. `matched_items` JSONB on every reasoning row creates a future signal for cross-user learning ("which watch_for items most often surface in browse skips"). |
| **P4 — Perception Before Information** | Browse page header acknowledges where Bailey is (*"filtered against your Phase 2 protocol"*) BEFORE showing the catalog. Per-product skip reasoning leads with verdict + specific watch_for match before generic chemistry. Inline "Ask Yuri about this" carries phase context so the conversation lands without re-explanation. |
| **Yuri Sole Authority Principle** | No surface labeled "Yuri's Picks" or "Yuri Certified". Header says "filtered against your protocol" (observational). Per-product label says "Why Yuri would skip this" (the actual reasoning, in her voice, on demand). The CTA to Yuri herself remains the single recommendation surface. |
| **Cost-Aware Architecture (Pattern 11)** | Cost projected at $0.30-0.40/sub/month. Layer 1 is $0. Layer 2 is bounded by lazy expansion (only when user opts in). Cache hit rate expected 80%+ after week one. Negligible against $35.88/sub margin. |

## Build order

| Phase | Work | Dependencies |
|------|------|--------------|
| 1 | DB migration (`ss_product_curation_reasoning` + RLS + indexes) | None |
| 2 | `src/lib/intelligence/product-curation.ts` (filter + cache + Sonnet generator) + `ai-config.ts` entry | Phase 1 |
| 3 | API routes (`/api/products/curated` + `/api/products/curated/[id]/reasoning`) | Phase 2 |
| 4 | UI rewrite (`/browse` page + ProductFilters + new CuratedProductCard) | Phase 3 |
| 5 | Verify public `/products` untouched | None (verification only) |
| 6 | Telemetry wiring | Phase 3 |
| 7 | AI-First post-build re-audit | Phases 1-6 |
| 8 | `tsc --noEmit` + `next build` clean | Phase 7 |
| 9 | CLAUDE.md changelog + v10.8.0 version bump | Phase 8 |

Each phase has its own task in the task list (TaskList shows the full breakdown). Phases ship in order; later phases depend on earlier ones.

## What this release is NOT

- **NOT a redesign of Yuri's chat surface.** /yuri stays exactly as it is (Opus 4.7, all 16 tools, all the v10.6.0 → v10.7.5 hardening intact).
- **NOT a kill of the public /products surface.** Public marketing/AI-discoverability landing page is preserved for anonymous visitors. AuthAwareNav (v10.6.3) continues to route subscribers to /browse and anonymous to /products.
- **NOT a kill of `/api/products` or `/api/products/discovery`.** These endpoints may have other consumers (sitemap, future tools, public surfaces). Killing them is a separate audit. This release only rewires what /browse renders.
- **NOT a change to ingredient pages, library, or skin profile.** Those are working correctly per Bailey's positive feedback on Ingredients (v10.6.4) and Library (v10.6.5).
- **NOT a structural change to decision memory or treatment phases.** Path B reads from existing structures.

## Resolved at blueprint approval (no open questions)

The Sonnet-vs-Opus question raised in the draft is resolved: **Opus 4.7** per Scott's May 22 2026 decision and Principle 1. Documented above. No deferred A/B test.

## Approval

This blueprint requires Scott's sign-off before Phase 1 (DB migration) executes. Pattern 12: Pause-and-Verify Before Destructive Actions. The migration is reversible (DROP TABLE + remove the auto-promote-related indexes), but the UI rewrite + system prompt changes are consequential enough that an approval gate is warranted.

After approval, execution proceeds Phase 1 → Phase 9 in order, with `tsc --noEmit` clean at each phase before moving to the next.
