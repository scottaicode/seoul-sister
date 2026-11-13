# Known Issues — Investigated & Dismissed

This file records issues that were investigated and found to be **NOT Seoul Sister
bugs**, so a future session doesn't burn time re-chasing the same ghost. For real
open work, see the "Remaining Work" sections in `CLAUDE.md` and `CHANGELOG.md`.

---

## DISMISSED — Console CSS parse errors (`Unknown property 'cron'`, `filter:CHEMICAL/HYBRID/PHYSICAL/UNVERIFIED`)

**Reported:** June 22 2026, from a live homepage smoke test (browser console open).
**Symptom:** Firefox console on `www.seoulsister.com` shows repeated warnings:
- `Unknown property 'cron'. Declaration dropped.` (~15×, various line numbers of `ffd3bd8e987a9a13.css`)
- `Expected 'none', URL, or filter function but found 'CHEMICAL' / 'HYBRID' / 'PHYSICAL' / 'UNVERIFIED'. Error in parsing value for 'filter'.`
- `Error in parsing value for '-webkit-text-size-adjust'. Declaration dropped.`

**Verdict: NOT a Seoul Sister bug. Do not "fix" the CSS — there is nothing to fix.**

**Why (evidence gathered June 22 2026):**
1. The error file `ffd3bd8e987a9a13.css` IS one of the site's real stylesheets (HTTP 200,
   referenced by the homepage), so the errors are *attributed* to our CSS.
2. BUT the production CSS was fetched and grepped — it contains **zero** occurrences of
   `cron`, `chemical`, `hybrid`, `physical`, or `unverified`. The tokens the parser claims
   to have "found" are not in the file. A stylesheet cannot drop a declaration for a token
   it does not contain — unless something injects those rules into the parse context **in the
   browser after load**. That is the signature of a **browser extension** (privacy / reader /
   dark-mode / a tool literally named or themed "cron") rewriting page styles on the user's
   normal profile.
3. The `[filter:CHEMICAL]` / `[filter:PHYSICAL]` / `[filter:HYBRID]` / `[filter:UNVERIFIED]`
   tokens existed in the codebase ONLY in `src/app/api/routine/generate/route.ts` (deleted Nov 11 2026 with the one-shot routine generator) — as plain
   **text inside Yuri's AI prompt** (server-side), never rendered to the DOM or emitted as CSS.
   `cron` appears only in legitimate server/comment contexts. `globals.css` is clean,
   standard Tailwind. None of these reach a `className` or inline `style`.

**Confirm-it-yourself (30s):** open the homepage in a private/incognito window (extensions
off) with the console open. The `cron` / `filter:CHEMICAL` errors disappear → confirmed
extension, not us.

**Harmless either way:** the browser *drops* the unparseable declarations; nothing on the
page or in the Yuri widget is affected. Verified the widget streams end-to-end the same day
(`POST /api/widget/chat` → streamed answer, counter decremented).

**The genuinely-ours, harmless-standard warnings in the same console** (ignore — every
Next.js + GA4 site logs these): font `preload was not used within a few seconds`, the
`_ga_*` cookie `expires` overwrite, and the GTM `Referrer Policy` notice.

---

## DISMISSED — Console CSS errors: `Dangling combinator` / `Ruleset ignored due to bad selector` / `Expected attribute name but found 'x('`

**Reported:** June 22 2026, surfaced in a Firefox **private-window** test (extensions OFF,
so NOT the extension issue above — this is a separate, real-looking error class).
**Symptom:** repeated warnings against `ffd3bd8e987a9a13.css`:
- `Dangling combinator. Ruleset ignored due to bad selector.` (many)
- `Selector expected. Ruleset ignored due to bad selector.`
- `Expected attribute name or namespace but found 'x('. Ruleset ignored due to bad selector.`

**Verdict: NOT a Seoul Sister bug. The CSS is valid; the local Firefox build is too old to
parse it. Do not change the CSS.**

**Why (evidence gathered June 22 2026):**
1. Fetched the real production `ffd3bd8e987a9a13.css` (96 KB) and inspected it directly:
   - **Zero dangling combinators** (no selector ends in `>`, `+`, or `~` before `{`).
   - **Zero malformed `x(` attribute selectors.** The `'x('` the parser quoted is just a
     fragment of a longer VALID token (inside a `:where(...)`) that the old engine bailed on
     mid-parse.
2. The file contains **237 `:is()` / `:where()` selectors** — emitted by the official
   `@tailwindcss/typography` plugin for the blog `prose` classes (`:where([class~=not-prose])`,
   `:where([class~=lead])`, etc.). This is standard, spec-valid modern CSS.
3. `:is()` / `:where()` shipped in Firefox 78+ (2020). When an OLDER Firefox hits one it can't
   parse, it emits exactly this symptom set ("dangling combinator", "selector expected",
   "expected attribute name but found 'x('") because it bails mid-selector and misreads the
   tail. No `@property`, `@container`, `:has()`, or `&`-nesting is present (none of the truly
   bleeding-edge stuff) — so the only candidate is `:is()`/`:where()` on an old engine.
4. The page renders **fully styled** in the same normal-window screenshots — proof the CSS
   parses correctly on a current engine. Real visitors on current Chrome/Safari/Firefox see
   none of these.

**If you ever want a true-zero console** (cosmetic only, not worth it now): `@tailwindcss/typography`'s
`:where()` wrapping is intentional (keeps `prose` specificity low so it's easy to override).
Removing it isn't advisable. The right move is simply to update the local Firefox; do NOT
hand-edit generated CSS.

---

## Remaining work and pipeline audit, moved from CLAUDE.md (Nov 11 2026)

### Remaining Work

**Future Work** (when traffic/revenue justifies)
- [ ] **Push Notifications** — Requires service worker push events, web-push library, subscription management
- [ ] **Remaining Cron Jobs** — scan-counterfeits, community-digest
- [ ] **Supabase Attack Protection** — Captcha on auth endpoints (requires captcha widget), leaked password protection (requires custom SMTP). Enable when traffic justifies it.

**Product Image Health** (see `PRODUCT-IMAGE-HEALTH.md` for the full system-of-record — pipeline, three blank-image causes, wrong-product discipline, reusable audit/backfill tooling). State after v10.8.13 catalog-wide backfill (May 26 2026): 5,417 products on reliable Olive Young CDN images, 153 on drift-prone brand-direct URLs (some dead), 354 null. New products auto-capture images via the daily `scan-korean-products` cron (verified working), so the problem is NOT growing — it's the legacy Feb-2026 cohort + URL drift. Remaining work, priority order:
- [x] **Image-health cron** — DONE v10.8.15 (May 26 2026). `/api/cron/image-health` daily 4:15 AM UTC, backed by `src/lib/pipeline/image-health.ts`. Reachability-checks non-OY URLs, re-points dead/null to own Olive Young image from staging (strict matcher), keyset cursor sweeps the catalog continuously, logs unfixable products to `ss_pipeline_runs.metadata` + `console.warn`. Verified dry-run against live DB: correctly detects dead+null, finds 0 fixable now (v10.8.13 backfill already swept staging-matchable products) — its forward value is catching NEWLY-dead URLs before users see them.
- [ ] **Live-scrape backfill for ~507 no-staging-match blank products** (~1 day). Extend `OliveYoungScraper` with search-by-name (Playwright — OY search is JS-rendered), confidence-gate the match per the wrong-product discipline, write OY images. Closes the "all products eventually have photos" promise for real catalog products.
- [ ] **Live Olive Young price refresher + daily cron** (~1 day, deferred from v10.8.19 B). Currently 4,917 Olive Young price records have only 2 distinct `last_checked` dates (Feb 17 + April 7) — no live refresher exists; the daily `refresh-prices` cron only handles Soko Glam, and `refresh-prices-yesstyle` only YesStyle. Build a Playwright-based scraper that hits the 4,908 valid `prdtNo=GA...` URLs and refreshes `price_usd` + `last_checked`. 5-10s per page → multi-day rolling refresh (similar to image-health cron's keyset-cursor sweep pattern). Until built, Yuri's price-staleness honesty rule covers the UX. v10.8.19 cleared the 25 fake-URL price records that 404'd, so the visible-bug surface is fixed; this is the deeper data-freshness fix.
- [ ] **Custom-entry relink sweep** (~few hours). Find real products mis-saved as custom entries (NULL product_id) across all users; relink EXACT matches only (restores images AND catalog enrichment/pricing). Strict matching per `scripts/relink-bailey-custom-entries.ts`.
- [ ] **(Optional) image reliability tier column** on `ss_products` so `/browse` ordering + health checks don't re-derive reliability from the hostname each run.

**Cron Pipeline Improvements** (deferred — system is healthy, these are efficiency/UX upgrades not bug fixes)
- [ ] **Olive Young price refresh frequency boost** (~1-2 hours of work). Current state per Apr 26 2026 audit: 4,917 Olive Young price records, 0 fresh in last 7 days, 4,908 fresh in last 30 days. Daily `refresh-prices` cron uses 150 products/day batch size, which means full catalog cycles every ~33 days. Increase batch size to 400-500/day so full cycle completes in ~10 days. Trade-off: more Vercel function time per run — must be tested carefully against the 60s cron timeout. Trigger condition: when Yuri starts citing Olive Young prices that turn out to be wrong, OR when user feedback specifically mentions stale Olive Young pricing.
- [ ] **Price staleness UX warning** (~30 min of work). When `compare_prices` tool returns a price with `last_checked > 14 days ago`, append "(price last verified X days ago)" to the response. Same honesty pattern as v10.2.1 tool-call honesty rule. Trigger condition: when traffic grows to the point where stale price citations become a noticeable share of conversations.
- [ ] **Trend signal generation at scale** (no work needed yet — this is monitoring). `ss_trend_signals` table currently has 8 rows from Feb 23. The `scan-trends` cron runs daily but produces 0 signals because Seoul Sister has ~2 active users — there's no community activity to detect trends from. Working as designed for current scale. Re-audit when monthly active users exceed 100 — at that point the cron should start producing signals. If it doesn't, investigate the detection thresholds in `src/lib/learning/trends.ts`.

**Cron Pipeline Health** (verified Apr 26 2026, NOTE: superseded by May 5 2026 audit below — cron health has degraded since)
- All 14 crons in `vercel.json` are running on schedule. Most recent successful runs visible in `ss_pipeline_runs` and via downstream table writes (`ss_price_history` showed 14,001 snapshots in the last 7 days across 6 retailers).
- Pricing pipeline writing to `ss_price_history` daily for Soko Glam, YesStyle, Stylevana, Amazon, iHerb. Olive Young also writing daily but on a slow rolling cycle.
- Reddit + Olive Young bestseller scrapers actively populating `ss_trending_products` (670 Reddit + 76 Olive Young entries, 126+45 updated last 7 days).
- Aggregate-learning + update-effectiveness writing to `ss_ingredient_effectiveness` daily.

---

### Database & Pipeline Health Audit — May 5 2026 (post-Bailey diagnostic)

Captured at the end of a 7-release session focused on Bailey's account. Surfaced multiple silent regressions that the Apr 26 audit didn't catch because they happened *after* that audit. **Do these in priority order when next session opens.**

**Database snapshot (May 5 2026):**
- Products: 5,901 (588 verified — only 10%)
- Brands: 569
- Ingredient links: 209,230 across 5,204 products (~88% linked)
- Ingredients master: 14,468
- Price records: 5,047 across 6 retailers
- Trending: 411 Reddit rows + 82 Olive Young bestsellers, both fresh in last 7 days
- Ingredient effectiveness: 143 rows total

**P0 — Olive Young scrapers silently broken**
- **Olive Young product scraper has been zero-result for 2+ weeks**. Apr 22-30 returned 96 products/run all duplicates (no NEW products); May 1-4 returns 0 products. Either Olive Young changed their HTML structure, hit rate-limit/CAPTCHA, or the scraper script is silently failing. Pipeline fires, looks "completed" in `ss_pipeline_runs`, but produces nothing. **This is a v10.3.4-class silent failure** — the v10.3.5 fire-and-forget logging audit did NOT cover scraper success-with-zero-results paths.
- **Olive Young price scraping stopped Apr 7** (~28 days stale). 4,917 Olive Young price rows, ZERO fresh in last 7 days. Soko Glam (Shopify API) and YesStyle (Playwright) ARE still updating, so the working-scraper paths function. Olive Young is the largest pricing source — when Yuri quotes Olive Young prices via `compare_prices`, she's quoting month-old data. K-beauty prices fluctuate monthly.
- **Action**: 30-60 min investigation of `src/lib/pipeline/sources/olive-young.ts` and `olive-young-bestsellers.ts`. Check what response Olive Young is actually returning. Look for HTML structure changes, IP blocks, or selector-mismatch silent failures. Add `console.error('[olive-young scrape] expected products, got 0')` so future regressions surface in Vercel logs.

**P1 — Verification rate suppressing search visibility — ✅ RESOLVED (verified Jun 22 2026)**
- ~~Only 588 of 5,901 products have `is_verified = true`...~~ **STALE (May 5 figure). The auto-promotion below HAS SINCE BEEN RUN.** Live DB Jun 22 2026: **5,311 of 5,946 products verified (~89%)** — the catalog is discoverable, not 90%-invisible. Of the 635 still-unverified, only 153 are complete-with-price / 557 complete-without — the genuine long tail (missing price or INCI); do NOT force-promote (thin records hurt AI-citation quality). Daily `translate-and-index`/`link-ingredients` crons enrich the tail at $0 marginal cost. See `SEOUL-SISTER-GEO-AUDIT.md` for the full GEO context.
- Historical action (already executed): `UPDATE ss_products SET is_verified = true WHERE name_en IS NOT NULL AND brand_en IS NOT NULL AND category IS NOT NULL AND ingredients_raw IS NOT NULL AND id IN (SELECT product_id FROM ss_product_prices)`. No further action needed — kept here as the record of what fixed it.

**P2 — Combination skin effectiveness data is sparse**
- `ss_ingredient_effectiveness` skin-type distribution: dry 85 rows, sensitive 31, oily 12, **combination 9**, normal 6.
- Bailey is combination. The "Missing high-value ingredients" widget rotates the same 5 ingredients (HA / Tranexamic / Retinol / Salicylic Acid / Snail Mucin) because that's effectively all the combination-skin data available. Once those are excluded by phase filter or already in routine, the widget runs out.
- Phase 11.4 originally bootstrapped this; combination got under-seeded.
- **Action**: Run a research-backed seed script adding 30-40 combination-skin effectiveness rows covering more concerns (sebum control, pore visibility, T-zone shine, combination dehydration). Estimated cost ~$1 in Sonnet. Pattern is already in `scripts/seed-learning-data.ts` (Phase 11.4 reference).

**P3 — `not_skincare` cleanup**
- 18 products tagged `category = 'not_skincare'` (8 with ingredients_raw). Either contamination from the Olive Young scraper or correctly-classified makeup/hair/body. Quick query to inspect, then delete or recategorize.
- **Action**: 10 min. Query: `SELECT id, name_en, brand_en, description_en FROM ss_products WHERE category = 'not_skincare' ORDER BY created_at`. Manually classify and either recategorize or delete.

**P4 — Stale price retailers (Amazon, Stylevana, iHerb)**
- Amazon: 10 rows, all from Feb 17 seed, never updated.
- Stylevana: 4 rows, same.
- iHerb: 1 row, same.
- These retailers never had working scrapers. Either build them, mark them as "unsupported retailer" in the price-quoting logic, or remove the rows so Yuri stops citing 3-month-old prices.
- **Action**: Lower priority. Either build scrapers (~half-day per retailer) or delete the rows and remove from `ss_retailers` allowlist.

**Cross-cutting observation: scraper-zero-result is its own bug class.**
The Olive Young silent failure (P0) is structurally the same shape as the v10.3.4 decision memory crash — fire-and-forget with success-on-empty masking real failures. The v10.3.5 logging audit added `console.error` to fire-and-forget catches but did NOT add "expected non-zero, got zero" alerts. Worth adding a generic pattern: any scraper job that returns 0 rows when historical baseline is >0 should log a warning. ~2 hours of work, prevents another 2-week silent regression.
