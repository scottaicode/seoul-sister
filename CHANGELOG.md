# Seoul Sister — Changelog

All notable changes to Seoul Sister are documented here.

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
