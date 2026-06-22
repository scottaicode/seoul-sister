# Seoul Sister — GEO (Generative Engine Optimization) Audit

**Date:** June 22, 2026
**Auditor:** Claude (Opus 4.8), live fetches against production seoulsister.com
**Why:** AI search is the fastest-growing, highest-converting traffic channel in 2026 (AI chatbot
referrals to storefronts +8x YoY, AI-referred orders +13x, AI visitors convert ~50% higher than
organic — Shopify/Goodie data, June 2026). Seoul Sister is an *intelligence platform* (5,800+
products, 14,900+ ingredient pages, counterfeit data) — structurally the kind of content AI engines
cite. Most beauty BRANDS can't win this channel (nothing to cite); Seoul Sister can. This audit checks
whether the AI-discoverability infrastructure CLAUDE.md claims is actually live and working.
**Governs under:** `NORTH-STAR.md` (growth/measurement work — clears the build freeze).

---

## VERDICT: Infrastructure is ~80% built and well-executed — but TWO settings are actively
## blocking the highest-value AI engines from seeing the site at all. Both are one-line fixes.

The content layer is genuinely strong (server-rendered, ingredient-rich, blog content already
indexed). The problem is the *permission* layer: `robots.txt` is hand-cuffing the exact crawlers that
power the channel we want to win. This is a self-inflicted block, not a missing-capability gap — which
is good news: it's cheap to fix and explains why AI-search traffic isn't showing up.

---

## FINDINGS

### 🔴 P0 — `robots.txt` BLOCKS GPTBot and Google-Extended entirely

Live `robots.txt` (verified June 22 2026) contains:
```
User-Agent: GPTBot
Disallow: /
User-Agent: Google-Extended
Disallow: /
User-Agent: CCBot
Disallow: /
User-Agent: anthropic-ai
Disallow: /
```
- **GPTBot `Disallow: /`** blocks OpenAI's primary training+retrieval crawler. ChatGPT is still the
  largest AI-referral source (~63% of AI referrals even after losing share). Blocking GPTBot is the
  single most damaging line in the file.
- **Google-Extended `Disallow: /`** blocks Google Gemini / AI Overviews grounding. Gemini is a top-4
  AI referrer. AI Overviews increasingly mediate Google itself.
- `CCBot` (Common Crawl) and `anthropic-ai` blocked too — these feed multiple downstream models.

**This directly contradicts CLAUDE.md**, which claims: *"Dynamic robots.txt allowing GPTBot,
Claude-Web, PerplexityBot."* The doc says GPTBot is allowed; production blocks it. The architecture
intent was right; the deployed file drifted (or was authored defensively to block *training* without
realizing it also blocks *retrieval/citation*). **Either way, today the two biggest AI engines are
told to stay out.**

**Nuance worth a human decision:** some sites intentionally block GPTBot to keep content out of
*training data* while still allowing *search/retrieval* bots (OAI-SearchBot, which IS allowed here).
But in 2026 the citation/referral value of being in GPTBot's index outweighs the training-data
concern for a discovery-funnel business — you WANT to be the cited source. Recommend allowing GPTBot
(scoped, like the others), and allowing Google-Extended, unless there's a deliberate
keep-out-of-training stance Scott wants to hold. Flagging, not auto-deciding.

**Fix:** change the four `Disallow: /` blocks to the same scoped allow the other AI bots already get
(allow `/`, disallow `/api/`, `/dashboard/`, `/admin/`, `/onboarding/`, `/settings/`). One-line-per-bot
edit in the dynamic robots route. ~15 min.

> **✅ Update (June 22 2026):** GPTBot + Google-Extended unblocked (scoped) earlier today. The stale
> 2024-era Anthropic user-agent names were then corrected: the deprecated `Claude-Web` allow rule and
> the `anthropic-ai` `Disallow: /` block were removed and replaced with Anthropic's current 2026 fleet
> — `ClaudeBot` (training), `Claude-User` (user browsing), `Claude-SearchBot` (search/citation) —
> each scoped identically to the other allowed AI search bots. `CCBot` remains blocked.

### ✅ RESOLVED (was flagged P0, was a FALSE ALARM) — `llms.txt` exists and is excellent

Initial automated fetch returned the SPA shell, suggesting `/llms.txt` was missing. **Code inspection
proved otherwise:** a real, static, comprehensive `public/llms.txt` (74 lines) exists and is served —
site summary, all 12 best-of category links, ingredient encyclopedia links, database stats, brand
list, the 6 specialist agents, pricing. This is well above average GEO hygiene. The false alarm was a
fetch-tool artifact (the WebFetch follows the SPA render rather than reading the raw static file). **No
action needed.** Optional later polish: add 3-5 direct links to the highest-traffic blog posts.

### 🟡 P1 — Ingredient index renders server-side (GOOD) but carries NO JSON-LD

The `/ingredients` index is **server-rendered and content-rich** (verified: "14,907 Total
Ingredients," 590+ alphabetized entries with safety/comedogenic/function data in the served HTML —
excellent, crawlable without JS). **But the fetched HTML showed no JSON-LD / schema.org markup on the
index page.** CLAUDE.md claims ingredient pages carry Article/FAQPage/BreadcrumbList JSON-LD — that
may be true on individual `/ingredients/[slug]` pages (not separately verified here) but the index
itself appears bare. Structured data is what lets an engine parse "this is an ingredient guide with
these facts" vs. "some text." Worth confirming the per-ingredient and per-product pages actually emit
the claimed JSON-LD in production (CLAUDE.md's claim is unverified for individual pages in this audit).

**Fix:** verify JSON-LD renders on a sample `/ingredients/[slug]` and `/products/[id]` in production
(view-source, not just the React tree). If missing, that's a separate fix. If present, add
ItemList/CollectionPage JSON-LD to the index. ~1-2 hrs to verify + patch.

### 🟢 GOOD — what's already working (don't touch)

- **Sitemap is live, valid, ~1,000+ URLs** (`/sitemap.xml`), referenced from robots.txt. Covers
  products, 11 best-of category pages, ~25 blog posts, 950+ ingredient pages. Strong.
- **Scoped AI bots already allowed**: OAI-SearchBot, ChatGPT-User, Claude-Web, PerplexityBot,
  Applebot-Extended all get a sane scoped allow (block only private/app routes). This is correct and
  well thought out — it's only GPTBot/Google-Extended/CCBot that are over-blocked.
- **Content is server-rendered and substantive** — the ingredient encyclopedia delivers real text in
  the initial HTML (not a JS shell). This is the hardest part to get right and it's done.
- **Already appearing in conventional search** for branded queries: blog posts (glass skin, dark
  spots, Korean vs American sunscreen, sebaceous filaments), product pages, and an ingredient guide
  (Mugwort/Artemisia) all index and surface. The *content* earns citations; the *permission layer* is
  throttling the AI-specific crawlers.

---

## PRIORITIZED FIX LIST (all clear the build freeze — growth/measurement)

| # | Fix | Effort | Impact | Blocks today? |
|---|-----|--------|--------|---------------|
| 1 | **Unblock GPTBot + Google-Extended** in robots.txt (scope them like the allowed AI bots) | ~15 min | HIGHEST — unblocks the two biggest AI engines | YES |
| 2 | **Ship a real `/llms.txt`** (plain text, summary + key links) | ~30-60 min | HIGH — the file AI agents look for; currently 404→app shell | YES |
| 3 | **Verify JSON-LD on live product + ingredient detail pages**; patch if missing; add ItemList to indexes | ~1-2 hrs | MEDIUM — improves parse quality of already-crawlable content | Partial |
| 4 | **Establish a citation baseline + re-test** after fixes 1-2 deploy (run fixed K-beauty buyer queries against ChatGPT/Perplexity/Gemini monthly; log whether SS is cited) | ~ongoing | MEASUREMENT — makes the channel readable (North Star) | n/a |

**Decision needed from Scott (fix #1):** confirm you WANT GPTBot/Google-Extended allowed (citation
value) vs. a deliberate keep-out-of-AI-training stance. Recommendation: allow them — Seoul Sister's
whole GEO thesis is to BE the cited source, and the training-vs-retrieval distinction is mostly moot
for a discovery funnel. But it's your call, not mine to flip unilaterally.

---

## Why this matters (the strategic frame)

Seoul Sister's structural edge in 2026 is that it's an *intelligence platform*, not a product brand —
it has exactly the citable, factual, ingredient-level content AI engines reward, and competitors
(individual brands) don't. AI-referred visitors convert ~50% higher and arrive pre-trusting ("ChatGPT
told me to check Seoul Sister"). This channel needs no video, no virality, and no dependency on
Bailey — it's the lowest-dependency, highest-ROI traffic lane available. The content is built. The
only thing standing between Seoul Sister and this channel is a robots.txt file telling the two biggest
engines to leave. **Fixing two settings could open the single best-aligned traffic source the platform
has.**

---

## DATA-EXPOSURE QUESTION (Scott asked: "is enough public data available to AI engines?")

Answer after code inspection: **the data exposure is already well-tuned for AI citation — with ONE
strategic lever worth considering.**

**What allowed AI crawlers already get (FULLY public, no paywall, server-rendered):**
- Every **ingredient page** (`/ingredients/[slug]`): INCI + English + Korean name, safety rating,
  comedogenic score, mechanism of action, skin-type effectiveness, conflicts, products containing it.
- Every **product detail page** (`/products/[id]`) reachable via sitemap/URL: full ingredient list
  (names, INCI, function, safety, comedogenic, concentration), price range across retailers, rating,
  review summary, SPF/PA/filter data. The product API (`/api/products/[id]`) returns all of this to an
  anonymous request (anon key, no auth gate).
- All **best-of category pages** and the **ingredient encyclopedia index**.
- GATED (correctly): only *personalized* matching ("your skin match score"), subscriber review
  compilation, and Yuri specialist dives — i.e. the PRODUCT, not the facts. This is the right line:
  give away the citable facts, gate the personalization. (Note: product pages mark
  `isAccessibleForFree: 'False'` on the *gated* sub-sections via schema — fine — but the overall
  WebPage node also carries that flag, which slightly under-sells how much IS free; minor, optional.)

**The `is_verified` search filter (the "~90% invisible" question Scott raised) — ALREADY RESOLVED:**
- Public product **search** (`/api/products`) and the widget's `search_products` tool both filter
  `is_verified = true` (`api/products/route.ts:70`, `lib/yuri/tools.ts:70`).
- **CLAUDE.md is STALE on this.** It cites the May 5 2026 figure of 588/5,901 verified (~10%) and
  warns ~90% of catalog is invisible. **Live DB query June 22 2026 shows the opposite — the
  auto-promotion the May-5 audit prescribed HAS SINCE BEEN RUN:**

  | Metric | CLAUDE.md (May 5) | **Live DB (Jun 22 2026)** |
  |---|---|---|
  | Total products | 5,901 | **5,946** |
  | Verified (visible in search + widget) | 588 (~10%) | **5,311 (~89%)** |
  | Not verified | ~5,300 | **635** |

- **So ~89% of the catalog is ALREADY discoverable.** The visibility barrier described in CLAUDE.md
  no longer exists. Of the 635 still-unverified, only **153** are structurally complete *with a price*
  and **557** complete without one — the genuine long tail (mostly missing price or INCI). These
  should NOT be force-promoted: pushing thin records into citable surfaces *hurts* citation quality.
  The daily `translate-and-index` / `link-ingredients` crons already enrich new/incomplete products at
  $0 marginal AI cost, so the tail shrinks automatically.
- **Cost to "make more products visible":** promoting is a SQL boolean flip (`is_verified = true`) —
  **$0 AI tokens.** Enriching the incomplete tail with Sonnet would be ~635 × ~$0.01 ≈ **~$6-7 one-
  time**, but is largely unnecessary (daily crons handle it). **Recommendation: do NOT invest here —
  it's solved; forcing the last 635 risks citation quality for ~zero upside.**

**Bottom line on exposure:** data exposure is already generous and correctly gated (facts public,
personalization gated), AND product discoverability is already ~89% (not 10%). Nothing to build here.
The real acceleration levers are crawl-submission + backlinks (below), not more data exposure.

### 🟢 CRAWL-ACCELERATION — manual actions only Scott can do (highest-value next step, $0)

The robots unblock is live, but engines re-index on their own schedule (days→weeks). To expedite:
1. **Google Search Console** (https://search.google.com/search-console) — add/verify the
   `seoulsister.com` property, submit `https://www.seoulsister.com/sitemap.xml`. Drives Google
   indexing + Google AI Overviews (now that Google-Extended is unblocked).
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters) — add the site, submit the same sitemap.
   **Bing's index feeds ChatGPT search** — highest-leverage for ChatGPT citation.
3. **Backlinks accelerate crawl + citation** — when Bailey's Reddit/social links point at
   seoulsister.com, engines follow those links and re-crawl faster. Ties into `SEOUL-SISTER-LEAD-GEN-PLAN.md`.
These need account logins (Scott-only); no script/agent can do them.

### 📊 BASELINE CITATION TEST (recorded Jun 22 2026, immediately post-unblock = pre-crawl "before")

Ran 3 canonical K-beauty buyer queries. **Seoul Sister cited in 0 of 3.** Competitors own all three:
- "best Korean serum for dark spots" → UMMA, I DEW CARE, Soko Glam, Skinsider
- "how to tell if COSRX snail mucin is fake" → Mercelbay, COSRX official, Lemon8, TikTok
- "English K-beauty ingredient database" → INCIDecoder, Demythskin, Hwahae Global, SkinSort, CosDNA
Expected (engines hadn't been allowed to crawl until this date). **RE-RUN these exact 3 queries in
2-4 weeks**; any appearance is directly attributable to the unblock + crawl-submission. This is the
GEO teacher — the closest thing to an objective "are we cited" signal.

---

## GUARDIAN MONITORING REQUIREMENT (Scott's directive, Jun 22 2026)

Scott: *"I hope in the future the Guardian can always monitor this feature/functionality so it's always
working at high level with the AI Search Models."* **This is the right instinct — GEO health is
exactly the kind of silent-drift surface the Guardian exists to catch.** This audit itself proved the
drift risk: production `robots.txt` had blocked GPTBot for an unknown period while CLAUDE.md claimed it
was allowed. No alarm fired because nothing watched it. Capture as a **deferred Guardian probe** (build
when the Guardian's autonomous layer is activated; see `GUARDIAN-CHARTER.md`):

**Proposed `geo-health` probe (read-only, zero-AI-token, deterministic — fits the Guardian's Layer-A
pattern):**
1. Fetch `/robots.txt` → assert GPTBot, Google-Extended, OAI-SearchBot, Claude-Web, PerplexityBot,
   ChatGPT-User are NOT `Disallow: /`. Alarm if any high-value AI bot gets re-blocked.
2. Fetch `/llms.txt` → assert it returns plain text (not the SPA shell) and is non-trivial length.
3. Fetch `/sitemap.xml` → assert valid XML + URL count above a floor (catch a collapsed sitemap).
4. Spot-fetch one product + one ingredient page → assert expected JSON-LD `@type` present in raw HTML
   (catch a render/schema regression).
5. (Optional, low-freq, NOT zero-token) run a few canonical K-beauty buyer queries against an AI
   engine monthly; log whether seoulsister.com is cited → the closest thing to a real GEO "teacher."
Log verdicts to `ss_pipeline_runs.metadata` like the existing guardian-watch; warn on regression.
This makes GEO a *monitored* surface so the robots.txt-drift class of failure can never silently
recur. Effort when built: ~half a day. Trigger: Guardian autonomous layer activation + this being
prioritized.

---

## Related
- `SEOUL-SISTER-LEAD-GEN-PLAN.md` (the execution layer — GEO is "Layer 1", lowest dependency)
- `NORTH-STAR.md` (the One Metric — GEO is the fastest path to readable visitor volume)
- `GUARDIAN-CHARTER.md` (where the geo-health probe lands when the Guardian autonomous layer ships)
- CLAUDE.md "AI Discoverability" section + the May 5 2026 DB audit (the `is_verified` promotion)
