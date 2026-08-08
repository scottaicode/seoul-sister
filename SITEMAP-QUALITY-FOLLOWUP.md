# Sitemap quality — scheduled recheck

**Created:** August 4 2026
**⏰ RECHECK ON OR AFTER: August 18 2026** (2 weeks after the Aug 4 sitemap
submission, so Google has had time to crawl and grade the new URLs)

**Status as of Aug 7 2026: PARTIALLY RESOLVED — `run_together` SHIPPED on
Google's evidence. `shade_code` and `ppm` REMAIN DEFERRED to the Aug 18
recheck.** See "Aug 7 2026 update" immediately below before reading the rest of
this document, which was written when nothing had been acted on.

---

## ⚡ Aug 7 2026 update — Google graded early, and one rule shipped

**The verdict arrived 11 days ahead of the recheck date**, unprompted: a Google
Search Console email ("New reasons prevent pages in a sitemap from being
indexed") flagging **Soft 404**. The email was a red herring — Soft 404 was
**1 page**. The real signal was on the Indexing → Pages report it linked to.

### What Google actually said (the Step 1 table, filled in)

| Metric | Aug 4 baseline | **Aug 7 actual** |
|---|---|---|
| Indexed | (2,039 discovered) | **2,630** |
| Not indexed | — | **12,600** (9 reasons) |
| **Discovered – currently not indexed** | — | **11,997** |
| Crawled – currently not indexed | — | 112 |
| Duplicate without user-selected canonical | — | **9** |
| Soft 404 | — | 1 |

### Interpreting it against Step 2 of this doc

The doc listed three possible verdicts. Reality matched **none of them cleanly**,
and the distinction matters:

- **"Duplicate without user-selected canonical"** — the outcome this doc called
  *"the one that matters"*, the trigger to ship the filter — came back at
  **9 pages**. Essentially zero. **The shade-code duplicate theory was NOT
  confirmed.** That is why `shade_code` did **not** ship.
- **"Crawled – currently not indexed"** (Google looked and declined) is only
  **112**.
- The mass is **11,997 "Discovered – currently not indexed"** — a category this
  doc did not anticipate. It means Google knows the URLs exist and **has not
  spent crawl budget visiting them**. That is a verdict on *corpus quality in
  aggregate*, not on any single page.

**Crucially: this is not the 404 problem.** 50 live sitemap URLs were sampled as
Googlebot before anything was changed — **50/50 returned HTTP 200**. The Aug 4
reachability gate is working. These are healthy pages Google decided were not
worth fetching.

### What shipped (commit `9d0c86d`)

Only the **`run_together`** rule, promoted from candidate to shipped because
Google's data supports it and it is the one with a measured safety record.

The pages are real 200s rendering ~700 words of boilerplate under fused names —
sampled live: `TocopherolChampagne Glazed: Calcium Titanium Borosilicate`,
`Yellow Iron Oxide, Juicy Coral, Talc`. At that volume they dilute the
ingredient corpus, which is the AI-citation moat.

Measured against the live catalog **before** shipping (per the "measure first"
rule this doc exists to enforce):

| Check | Result |
|---|---|
| Rows matched | 1,521 |
| Incremental (not already caught by existing guards) | 1,359 |
| **Enriched pages lost (`rich_content_generated_at`)** | **0** |
| Max product-links on any row removed | **5** (vs Sodium Hyaluronate's 2,825) |
| `1,2-Hexanediol` (511 links) survives | ✅ |
| `Hexapeptide-9` (210 links) survives | ✅ |

**Live result, verified on production:** sitemap **14,102 → 12,824 URLs**
(ingredient URLs 7,952 → 6,674). `Sodium Hyaluronate`, `Niacinamide`,
`Ceramide NP`, `Panthenol`, `Allantoin`, `Squalane`, `Grape Seed Oil` all
confirmed still present.

### Where the filter actually went — this doc's Step 4 was WRONG

Step 4 below says the filter goes in `src/app/sitemap.ts`. **It did not.** It
went into the shared pollution guard, `isPollutedIngredientName` /
`excludePollutedIngredientRows` in `src/lib/pipeline/ingredient-parser.ts`.

That is deliberate and better: the sitemap, ingredient pages, ingredient search,
blog and Yuri's tools all consume that one guard, so a fused name is now hidden
from **every** read path rather than just the sitemap. `ingredient-matcher.ts`
already gates the **write** path, so new artifacts stop being created at ingest.

Two mechanics worth knowing before touching it:
- The SQL mirror uses PostgREST **`match`** (`~`, case-SENSITIVE). Using
  `imatch` (`~*`) would match every name containing two adjacent letters and
  **silently empty the catalog**. A test pins this.
- Still a publishing decision, not a data mutation — **no row was edited or
  deleted**, consistent with the "Do NOT do these" list.

### Residual, deliberately not chased

`ultra-marine-ci-77007-etalc` is still published. The underlying name is
`Ultra Marine (CI 77007)/Talc` — a **slash** fusion with no lowercase→uppercase
boundary, so the rule legitimately does not match it. Extending to slashes would
hit `Caprylic/Capric Triglyceride` and `Fragrance/Parfum`. Measured scope of
this residual class: **1 row, 0 product links, 0 enriched.** Not worth a rule.
This is the "do not tune a heuristic by feel" rule being obeyed.

### Do NOT resubmit to Bing over this

Asked and answered Aug 7. **No submission was made, on purpose.** Bing is the
channel that *works* — 525 citations/week, 33–66% share on commercial K-beauty
queries. It is not reporting a problem; this was a Google crawl-budget issue.
Also, removing URLs from a sitemap is **passive** — there is no "resubmit" that
accelerates a removal, and IndexNow (`src/lib/utils/indexnow.ts`) already pings
Bing/Yandex on ingest automatically. Resubmitting a healthy channel to fix
another engine's problem is risk without measured upside.

### What is still open for Aug 18

1. **`shade_code`** (183 pages) — NOT shipped. Its justifying evidence
   ("Duplicate without user-selected canonical") came back at **9**. Re-read
   that number at recheck before touching it.
2. **`ppm`** (3,446 pages) — NOT shipped, unchanged from the original deferral.
   Still the least-proven rule, still 70% of the original proposed cut.
3. **Did indexed climb?** The real test of this fix. 2,630 is the number to beat.
   Expect weeks, not days — and note that **removing a URL from a sitemap does
   not deindex it**, it only stops advertising it.
4. `/ingredients/000-ppm` → "Invalid Ingredient" (Step 5) — still unfixed.

**A caution for whoever does the Aug 18 read:** do not treat a drop in "Discovered –
currently not indexed" as proof this fix worked. The denominator changed — 1,278
URLs left the sitemap. Compare **indexed count** (2,630) and indexed-as-a-share
of submitted, not the raw not-indexed number.

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

| Rule | Pages cut | Max product-links among cuts | Status |
|---|---|---|---|
| `shade_code` — starts with `#`/`'`/`\` or `NN Word` | 183 | 4 | **DEFERRED** — its trigger (duplicate-canonical) measured 9 on Aug 7 |
| `run_together` — a lowercase letter followed by uppercase | 1,366 | 5 | **✅ SHIPPED Aug 7 2026** (`9d0c86d`) — see update at top |
| `ppm_artifact` — name contains ppm/ppb | 3,446 | **43** | **DEFERRED** — least proven, unchanged |
| **Combined** | **4,887 (39.9%)** | — | only ~1,278 of these actually cut |
| Would remain | 7,356 | — | actual live count: **6,674** ingredient URLs |

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

> **⚠️ Step 1 is DONE for `run_together` (shipped Aug 7 2026, commit `9d0c86d`).**
> Only `shade_code` remains from the original "1,549 pages" pairing, and its
> justifying evidence did not materialize — duplicate-canonical measured **9**.
> Do not ship it just because this list says so; re-read the GSC number first.

1. Apply **shade_code + run_together only** first (1,549 pages, max 5 product
   links, near-zero risk).
2. Re-run the safety check above; confirm 0 false positives at ≥20 links.
3. Verify against the live catalog, not from this doc — **these numbers will be
   stale.** The catalog grows daily via `scan-korean-products`.
4. Leave `ppm` for a separate, later decision with its own verification.

### 4. Where the filter goes

> **⚠️ SUPERSEDED Aug 7 2026.** `run_together` did NOT go here. It went into the
> shared guard `isPollutedIngredientName` /
> `excludePollutedIngredientRows` (`src/lib/pipeline/ingredient-parser.ts`), so
> every read path inherits it — sitemap, ingredient pages, search, blog, Yuri's
> tools — and the write path is already gated in `ingredient-matcher.ts`.
> Prefer the shared guard for any remaining rule; put it in `sitemap.ts` only if
> the rule is genuinely publishing-specific.

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
