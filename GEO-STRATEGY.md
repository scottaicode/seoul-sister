# GEO Strategy — AI Citation → Lead Conversion

**Status as of July 27 2026.** Companion to `SEOUL-SISTER-GEO-AUDIT.md` (catalog/indexing state) and `project_seo_guardian` (the weekly learning loop). This file is the *strategy* record: what we know, what shipped, and what is deliberately NOT built yet.

---

## The situation

Bing Webmaster Tools → AI Performance, 7 days ending Jul 24 2026:

| Metric | Value |
|---|---|
| Total Copilot citations | **525** (prior baseline: 369 over *3 months*) |
| Avg. cited pages | 34 |
| `best korean cleanser` | 20 citations, **33.33% share** |
| `best korean eye cream` | 4 citations, **66.67% share** |
| `4% niacinamide` | 12 citations, 24.49% share |
| `best lemongrass skincare for blemishes` | 5 citations, **100% share** |

Long-tail product-research queries (`torriden cleansing milk`, `COSRX snail mucin disadvantages`, `ANUA Rice 70`, `how to spot fake Korean skincare products`) confirm the free-database bet: Copilot cites Seoul Sister because **no competing English structured source exists**.

Meanwhile: ~3-4 Bing sessions/week, ~1 widget conversation/day, 0 cold-stranger paid conversions attributable to AI citations.

### The citation-to-click ratio is NORMAL — do not treat it as a defect

Published benchmarks run **44:1 to 1,200:1** citations-to-clicks. Seoul Sister is ~150:1, mid-band. Pew (68,879 real searches): links inside AI summaries are clicked in **1% of visits**. Otterly estimates **99.6% of AI content influence is invisible** to click tracking.

**Implication:** the goal is not to close that gap — nobody has. It is (a) to change *what Copilot says about us* (recommend a destination, not just quote a fact), and (b) to capture influence that never appears as a click (branded search, direct traffic, email).

---

## What shipped (Tier 1, Jul 27 2026)

1. **`/products/[id]` free-Yuri routing.** This page — the type AI traffic lands on ~80% of the time — was the ONLY public content surface with no `?ask=` link. Its "Ask Yuri About This Product" panel was a **locked** `GatedTeaser` whose only action was `/register` at full price. A stranger arriving from a Copilot citation about a specific product was shown exactly what they wanted, locked, before meeting Yuri. Now a real free-Yuri card (`?ask=…&from=product`).
2. **AI-referrer attribution** (`src/lib/widget/ai-referrer.ts`). AI-citation arrivals carry no `utm` and no `?from=`, so every one was tagged `'landing'` — the top discovery channel was invisible in first-party data. Now detected from `document.referrer` (bing, copilot, chatgpt, perplexity, claude, gemini…). **This raises the attribution floor; it is not a census** — `document.referrer` is empty for many AI surfaces.
3. **"What you can check here" block** on `/best/[category]`, server-rendered so assistants read it. Names the things an AI answer structurally cannot contain: retailer pricing, counterfeit markers, free Yuri. **Describes and routes — never advises** (Yuri Sole Authority).
4. **Real price-freshness stamps.** Only ~45 of ~5,114 price rows are fresh in a given week, so a blanket "refreshed daily" claim would be false. Renders the true `last_checked` date or **nothing**.

Guard tests: `tests/geo-citation-funnel.test.mjs` (12), each verified to fail when its bug is reintroduced.

---

## The evidence base (what to trust, what not to)

**Strong.** A controlled 252,000-trial study across 6 LLMs ([arXiv 2605.25517](https://arxiv.org/abs/2605.25517)) found topical relevance to the exact grounding query and retrieval position dominate citation selection; **explicit pricing and recent timestamps give consistent boosts; formatting-only changes did almost nothing.** Princeton GEO (KDD 2024): citing sources, statistics, and quotations lift visibility up to +40%; keyword stuffing and fluff fail.

**Directional.** AI referrals probably convert better, but the range is wide and contested: Ahrefs 23x (own site, tiny base), Semrush 4.4x, WebFX ChatGPT 15.9%, Visibility Labs +31% — but Amsive found *no significant difference* (p=0.794) and a peer-reviewed 973-site study found AI traffic converting **13% worse**. **Never quote a single multiplier.** Measure our own funnel.

**Structural risk.** Jan–Mar 2026: brand queries on ChatGPT lost an average **41% of citations**; HubSpot 70-80%. Partial rebound in May. GPT-5.3 Instant surfaces ~2 sources where 5.2 surfaced 10-12. Zero-click is 83% on AI Overview queries, 93% in AI Mode. Cloudflare blocks mixed-use AI crawlers by default from **Sept 15 2026**.

> **The citation is a RENTED asset. The email list and the Yuri relationship are OWNED.** Work that converts citations into captured leads is durable; work that earns more citations is not.

**Dead ends — do not invest.** `llms.txt` showed **zero** correlation with citations across a 300K-domain study; Google confirmed it does nothing for Search. Keep ours (free, Perplexity/Claude-relevant), invest nothing further.

**Forbidden.** Hidden LLM-targeted text, prompt injection, fabricated statistics, corroborating content farms. **Google added AI-answer manipulation to its spam policies May 15 2026**, penalties up to removal. Seoul Sister's moat is honesty — this is not a close call.

---

## NOT built yet — deferred with reasons

### Deferred because it produces MORE CITATIONS, not more leads

Citations are already working (525/week). Adding page types optimizes the number that is *not* the bottleneck, on a substrate that dropped 41% industry-wide in a single model update. **Revisit only once a citation reliably becomes a lead** (see the gate below).

All backed by real row counts queried Jul 27 2026:

| Opportunity | Scale | Query shape | Notes |
|---|---|---|---|
| **Ingredient × category pages** | 2,332 pairs ≥8 products; **1,242 ≥15**; 602 ≥30 | "best korean niacinamide moisturizer" | Largest surface. Matches the `4% niacinamide` shape we already win at 24%. Examples: Niacinamide×moisturizer 412, Centella×mask 250, Salicylic×cleanser 133. |
| **Subcategory best-of** | **63 pages**, 3,020 verified products | "korean toner pad", "best korean sun stick" | *Cheapest win* — template + data both exist. sheet mask 516, foam cleanser 198, toner pad 143, cleansing oil 116, sun stick 67, acne patch 67. |
| **Brand pages** | **214** (131 brands ≥10 products, 75 ≥20) | "torriden cleansing milk" | *Highest confidence* — Copilot already cites us for brand+product queries with no brand hub to catch the rest of the line. Anua 223, Mediheal 133, Torriden 89, COSRX 65. |
| **Sunscreen attribute pages** | ~15-25 | "korean sunscreen no white cast", "PA++++ sunscreen" | *Most defensible*: 613 products with PA rating, 611 with white_cast — Korean-market attributes with **no structured English equivalent anywhere**. Note `sunscreen_type='mineral'` returns 0 and `water_resistant` only 14 — those axes unusable. |
| **Comparison / dupe pages** | 2,064 candidate pairs (≥5 shared actives, same category, different brand) | "X vs Y", "dupe for X" | Highest-CTR citation shapes. Gate on ≥100 reviews (466 products qualify). |
| **Free-from filter pages** | ~6-10 | "fragrance-free korean skincare" | 2,115 fragrance-free; 3,268 with no ingredient comedogenic ≥3. |
| **Olive Young live rankings** | 1 flagship page | "what's trending in korean skincare" | Nothing in English publishes live OY rankings. **Only 3 snapshot dates exist** — launch and let accrue, not a deep archive yet. |

**Suggested order if/when unfrozen:** subcategory (template exists) → brand (citations already proven) → ingredient×category (largest) → sunscreen attributes → comparison/dupes.

### Deferred but arguably more valuable than any new page type

- **Ingredient cluster is mostly thin.** 7,665 ingredient URLs in the sitemap; **only 588 have `rich_content`**. 462 active ingredients link to **zero** products (empty pages); 441 unenriched ingredients appear in ≥10 products each. Enriching the 441 and de-listing the 462 raises the whole cluster's quality signal *without adding a page type*. Realistic enrichment ceiling is the ≥3-product tier (3,607), not 7,665.
- **Korean-name coverage is 11%.** Only **591 of 5,311** verified products have `name_ko`. Seoul Sister's founding premise is the Korean→English bridge; the single most on-brand uncontested asset is 89% empty. Nobody else maps 토너 패드 → toner pad across 5,000 products.

### Deferred — data too thin to support a page type

- **Counterfeit pages**: only **11 marker rows** across 5 brands. The narrative blog posts cover this better. Don't build a data-driven page type until the table grows. (The `/best` block above only *names* the capability where data exists.)
- **Ingredient-conflict pages**: 5 rows. Not viable.
- **Community review pages**: 20 own reviews. Use Olive Young `rating_avg`/`review_count` instead (958 products ≥100 reviews).
- **Multi-retailer price comparison as a page type**: only **143 products have ≥2 retailers**, 73 rows fresh in 30 days outside Olive Young. The "compare across 6 retailers" promise does not hold up as an indexable page yet.
- **Price-history pages**: 231,865 rows but **only 95 products show actual price movement**. Better as a "lowest price in 5 months" module on existing pages than a page type.

### Deferred process work

- **Mine Bing Grounding Queries monthly** into the SEO Guardian as a second teacher alongside GSC. These are the machine-phrased fan-out queries Copilot actually runs (3-5 per user question) — first-party Microsoft data showing exactly which retrieval queries we nearly win. Highest-value *non-code* lever available.
- **Power-law check.** In both published case studies **~3 pages drove ~70% of citations**. Our 34 cited pages likely follow. Use BWT's "Pages" tab to find the head and optimize *those*, rather than spreading effort.
- **Multi-engine diversification.** All measured signal is Bing Copilot, which is a *minority* of AI referral volume (ChatGPT ~62% of B2B AI referrals, Claude 18.5%, Gemini 10.6%, Perplexity 7.3%). Copilot concentration is a single point of failure. `robots.ts` already allows the others; we simply have no telemetry for them — the new referrer capture is the first step.
- **Anthropic spend alert** (owner-only, console.anthropic.com). Not automatable.

---

## The productization question ("teach this to others")

**Verdict: premature as a standalone service; credible as an LGAAS module once ONE number exists.**

The market is real — Profound raised ~$155M at ~$1B valuation; agency retainers run $2-8K/mo. It is also full of junk: Digiday documented a VC-funded vendor selling 30+ AI-written articles/month at $299/mo ("a surefire way to tank your domain"), and a case where a GEO vendor reported visibility gains while the client **lost 66% of organic traffic**. That credibility vacuum is the opening.

Three honest gaps:

1. **The case study is missing its last number.** Citations → visits → conversations exist. Citations → *paid subscriber* does not, yet. Selling "citations become customers" before demonstrating it is exactly the vendor behavior the research flags as snake oil.
2. **The moat prerequisite doesn't generalize.** Our citation share exists because we published ~5,900 products × ingredients × prices. Most LGAAS-sized subscribers have no such dataset. For them the playbook degrades to "comparison pages + FAQ schema" — legitimate AEO, but not the data-moat play. It transfers only to businesses that *have or can assemble* proprietary structured data.
3. **The substrate is unstable** (41% citation swings, Cloudflare Sept 15, 83-93% zero-click). Any productized promise must be scoped as "AI visibility + owned lead capture," never "AI traffic."

**The defensible version we already accidentally own:** not "get cited by ChatGPT" (uncontrollable) but **the SEO Guardian loop sold as a service** — measure weekly against first-party citation telemetry, make dated falsifiable bets, grade against reality. That is the Learning Loop principle applied to GEO, it is controllable, and the junk vendors cannot offer it.

### The gate

> **Do not productize, and do not build the deferred page types, until at least one cold stranger arriving from an AI citation becomes a paying subscriber — attributable in first-party data.**

The Tier 1 referrer capture exists specifically to make that measurable. When it fires, the case study closes and both decisions unlock.

---

## How to measure this (the teacher)

Per the Learning Loop principle, GA4 is **not** the teacher here — it is bot-inflated (see `project_ga4_bot_traffic_vs_db_truth`; 346 phantom users with zero DB activity on Jul 27). Use:

1. **Bing AI Performance** — citations, cited pages, grounding queries, citation share. The only first-party AI citation telemetry any major engine offers.
2. **Google Search Console** — via the SEO Guardian's weekly pull.
3. **`ss_widget_sessions.source`** — now carries `bing`/`copilot`/`chatgpt`/`perplexity`. **The honest conversion denominator remains `ss_widget_visitors WHERE total_messages > 0`.**
4. **Branded search + direct traffic growth** — Microsoft's own recommended proxy, since click metrics are "a bit broken" for AI surfaces.
