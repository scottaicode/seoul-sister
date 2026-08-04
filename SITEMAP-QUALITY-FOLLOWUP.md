# Sitemap quality — scheduled recheck

**Created:** August 4 2026
**⏰ RECHECK ON OR AFTER: August 18 2026** (2 weeks after the Aug 4 sitemap
submission, so Google has had time to crawl and grade the new URLs)

**Status: DELIBERATELY NOT ACTED ON.** This is a decision waiting on evidence,
not a bug. Read "The decision" before changing anything.

---

## What happened on Aug 4 2026

Three fixes took the sitemap from **2,033 → 14,096 URLs**:

1. `is_active` was being used as a publish gate (it is a functional
   classification — "active ingredient vs. excipient" — not an enabled flag).
2. PostgREST was silently capping the ingredient query at **1,000 rows**, so the
   sitemap had been truncated mid-alphabet for months.
3. The resulting set included ~2,018 URLs that 404'd; a reachability gate now
   withholds any URL the resolver cannot serve.

Both consoles were resubmitted and 14,034 URLs were pushed to IndexNow
(Bing + Yandex, HTTP 200). Full history in `IS-ACTIVE-SEMANTIC-FIX.md`.

**The open question this created:** the sitemap now advertises ~12,243 distinct
ingredient pages, and some meaningful share of them are parse artifacts rather
than real ingredients.

---

## A framing error to not repeat

I originally reported this as *"2,014 pages with no content."* **That was wrong,
and it was wrong because I inferred it from `product_links = 0` without opening
a single page.** Measured:

| Of the 2,014 zero-product pages | Count |
|---|---|
| Truly empty (no function, no guide) | **33** |
| Have real function text | **1,981** |
| Rendered word count | **650–860 words each** |

`links = 0` means *our catalog* has not linked that ingredient yet — a gap in
our data, not a verdict on the ingredient. Lauric Acid, Barium Sulfate,
Madecassic Acid and Apple Juice all sit in that bucket and are perfectly good
pages. **Do not cut on `links = 0`.**

## What IS actually wrong

Sampling 40 live pages straight from the sitemap: **4 of 40 (~10%)** render a
genuinely bad title.

Three distinct defect shapes, all confirmed on live URLs:

1. **Multi-ingredient dumps** that slipped the pollution guard —
   `Water, Methylpropanediol, Betaine, Glycereth-26`
2. **Run-together parse failures** —
   `Nelumbium Speciosum Flower ExtractTocopherolPentylene GlycolCaprylyl Glycol`
3. **Shade-code duplicates** — `/ingredients/01calcium-aluminum-borosilicate`
   renders as "Calcium Aluminum Borosilicate", a **duplicate** of the real page
   under a garbage slug. Duplicates are worse than thin pages: they split
   ranking signal across two URLs for the same thing.

Also: `/ingredients/000-ppm` renders with the title **"Invalid Ingredient"** —
the page names itself invalid and we are asking Google to index it.

---

## The candidate filter (measured, NOT applied)

Baseline at Aug 4 2026, over the **12,243** distinct published ingredient pages:

| Rule | Pages cut | Max product-links among cuts |
|---|---|---|
| `shade_code` — starts with `#`/`'`/`\` or `NN Word` | 183 | 4 |
| `run_together` — a lowercase letter followed by uppercase | 1,366 | 5 |
| `ppm_artifact` — name contains ppm/ppb | 3,446 | **43** |
| **Combined** | **4,887 (39.9%)** | — |
| Would remain | 7,356 | — |

### ⚠️ Two warnings before anyone applies this

**1. 40% is over-correction territory.** July 30 2026 nearly shipped a
run-together heuristic that flagged 4,898 rows including `Hexapeptide-9`; it was
discarded rather than tuned. The number here is 4,887. That similarity is a
reason to be suspicious, not confident.

**2. The `ppm` rule is 70% of the cut and is the least proven.** Its max
cut carries 43 product links (the other two rules max out at 4–5), and 12 rows
have ≥10 links. `ppm`/`ppb` names ARE mostly concentration artifacts
(`Niacinamide (20,000 ppm)`), and the canonical row for those ingredients exists
separately — but this rule deserves its own verification pass before use.
**Consider shipping shade_code + run_together only (1,549 pages, max 5 links)
and leaving ppm alone.**

### Safety check that HAS been done

The first draft of the shade-code rule flagged **`1,2-Hexanediol` (510 product
links)** because it starts with a digit — the July over-correction repeating
verbatim. Tightened to require `#`/`'`/`\` or a 2+ digit run followed by a
capitalized word. Re-verified:

- **0 false positives** among rows with ≥20 product links
- 200 junk rows still caught (`'01Calcium Aluminum Borosilicate`, `\2Talc`,
  `#001 CORAL WATER Octyldodecanol`)
- Confirmed SAFE: `1,2-Hexanediol`, `Hexapeptide-9`, `PEG-40 Hydrogenated
  Castor Oil`, `Caprylic/Capric Triglyceride`, and every top-20 ingredient

Any future change to these rules must re-run that check.

---

## The decision, and why it is deferred

**Google is about to grade these pages for us, with real data.** Acting now
would substitute my heuristic for their measurement — the exact mistake that
produced three wrong calls on Aug 4 (shortest-name for canonical rows,
`rich_content` for relevance, a character class for URL reachability; all three
looked right in code and were wrong against live data).

There is also a real argument for keeping thin-but-valid pages: **AI citation
works differently from blue links.** An LLM answering "what is madecassic acid?"
can cite a 650-word ingredient page with no products on it. That is Seoul
Sister's actual channel — 525 Bing citations/week as of July 2026.

**So: measure first, cut second.**

---

## ⏰ RECHECK PROCEDURE (do this on/after Aug 18 2026)

### 1. Get Google's verdict

Google Search Console → **Indexing → Pages**. Record:

| Metric | Aug 4 baseline | Recheck value |
|---|---|---|
| Total indexed | (was 2,039 discovered) | |
| "Crawled – currently not indexed" | — | |
| "Discovered – currently not indexed" | — | |
| "Duplicate without user-selected canonical" | — | |

Also Bing Webmaster Tools → **Sitemaps** → "URLs discovered" (was 2.0K).

### 2. Interpret

- **Indexed climbing toward ~12,000, low "not indexed"** → the pages are fine.
  **Do nothing.** The concern was unfounded and the cut would have destroyed
  value.
- **Large "Crawled – currently not indexed"** → Google is already ignoring the
  junk. Cutting is optional housekeeping, not urgent — it saves crawl budget
  and tidies the report, nothing more.
- **Large "Duplicate without user-selected canonical"** → **this is the one that
  matters.** It confirms the shade-code duplicates are actively splitting
  ranking signal. Ship the filter.

### 3. If cutting, do it in this order

1. Apply **shade_code + run_together only** first (1,549 pages, max 5 product
   links, near-zero risk).
2. Re-run the safety check above; confirm 0 false positives at ≥20 links.
3. Verify against the live catalog, not from this doc — **these numbers will be
   stale.** The catalog grows daily via `scan-korean-products`.
4. Leave `ppm` for a separate, later decision with its own verification.

### 4. Where the filter goes

`src/app/sitemap.ts`, alongside the existing reachability gate in the
`ingredientPages` map — the same place `pollutedSlugs` and `matchesFastPath`
already live. It is a sitemap-publishing decision, **not** a data change: no
row is edited or deleted, and every page stays reachable by direct URL and by
Yuri. Reversible by deleting the filter.

### 5. Also worth fixing regardless

`/ingredients/000-ppm` and its siblings render the title **"Invalid
Ingredient"**. Whatever is decided about the sitemap, a page that declares
itself invalid should probably 404 rather than render. That is a
`findIngredientBySlug` question, not a sitemap one.

---

## Do NOT do these

- **Do not cut on `links = 0`.** 1,981 of those 2,014 pages have real content.
- **Do not delete or deactivate rows.** `is_active` was already misused as a
  publish gate once (see `IS-ACTIVE-SEMANTIC-FIX.md`); this must stay a
  publishing decision, not a data mutation.
- **Do not tune a heuristic by feel.** If a rule needs repeated adjustment, that
  is the signal to stop, per the July 30 lesson in `CLAUDE.md`.
- **Do not grade any of this with GA4.** On Aug 4 it reported 88 "new users"
  against **0** database rows, 81 of them from Singapore. The teachers here are
  **Google Search Console** and **Bing Webmaster Tools**.
