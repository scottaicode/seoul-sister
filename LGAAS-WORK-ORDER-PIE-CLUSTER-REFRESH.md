# LGAAS Work Order — PIE Cluster Refresh (SEO Guardian bet `pie-subtype-restructure`)

**Date:** August 3 2026
**Owner:** Scott Martin
**Status:** ACTIVE — execute now
**Audience:** any AI session working in the LGAAS repo running the blog loop.
**Source bet:** `ss_seo_reports.id = 8dacab77-6ecd-4e17-82bc-90db747437f7`, bet 1 of 3, review date **2026-08-24**.

> Read `LGAAS-WORK-ORDER-SEO-GUARDIAN.md` first if you haven't — it defines the standing
> division of labor and the rules that carry over. This order is one specific bet under it.

---

## THIS IS A REFRESH OF ONE EXISTING POST. DO NOT CREATE A NEW POST.

| | |
|---|---|
| **Target post** | `Best Korean Skincare for PIE Acne Scars and Texture` |
| **Slug** | `best-korean-skincare-for-pie-acne-scars-and-texture` |
| **Post id** | `d8cdad5a-59ad-4b87-b4c9-c1df61948c82` |
| **Published** | 2026-03-10 · 12,927 chars |
| **Action** | Restructure + expand in place. **Keep the slug.** |

Creating a second PIE post would split the ranking authority this page has already earned
and cannibalize the exact queries the bet targets. The URL stays; the body changes.

---

## ⚠️ Do not confuse this with the PIH post

There are **two** similarly-named posts. This order targets the **PIE** one only.

| | **PIE** (this order) | **PIH** (leave alone) |
|---|---|---|
| Slug | `best-korean-skincare-for-pie-acne-scars-and-texture` | `best-korean-skincare-for-pih-fade-post-acne-dark-spots` |
| Published | 2026-03-10 | 2026-07-24 |
| Topic | **Red/pink** marks — vascular | **Brown/tan** marks — pigment |
| Named products | **0** | yes, with prices |
| Retailer mentions | **none** | Olive Young |

**The PIH post is the template.** It already does what this order asks for: named picks,
real prices, retailer named, "Grounded pick:" callouts under each ingredient. Written
July 24, four months after the PIE post, so it reflects the newer house style.

Read the PIH post before starting and match its depth and format. The job is to bring the
PIE post up to that standard — with PIE-appropriate actives (centella, madecassoside,
panthenol, azelaic — **not** the brighteners PIH uses).

Note the PIH post already links to the PIE post ("Read our dedicated guide on Korean
skincare for PIE acne scars and texture instead"). **Add the reciprocal link back** from
PIE to PIH. That cross-link is genuinely useful — the two conditions are constantly
confused, and readers land on the wrong one.

---

## Why this post specifically (measured, not assumed)

This is **the strongest real estate on the site**, and it is the one page where a content
change can actually move clicks. Measured from Google Search Console, 28-day window:

**933 impressions · 7 clicks**, ranking **position 4–9** on a fan of buyer-intent queries:

| Query | Impressions | Position | Clicks |
|---|---|---|---|
| best products for pie | 48 | 9.3 | 0 |
| pie treatment products | 47 | 9.6 | 0 |
| best skincare for pie | 38 | **5.8** | 0 |
| best serum for pie | 38 | 8.4 | 0 |
| best moisturizer for pie | 25 | 7.2 | 0 |
| best toner for pie | 8 | **4.9** | 0 |

**Position 4.9 with zero clicks is not a ranking problem. It is a match problem.**

The diagnosis, verified against the post body:

- It has **zero named products** in 12,927 characters (`named_products_in_body = 0`).
- It has **no "best serum for…" / "best toner for…" / "best moisturizer for…" sections**.
- Its headings are generic: *What's the Best Korean Skincare for PIE*, *The Situation
  You're In*, *Why This Happens*, *What Actually Works*, FAQ, *The Bottom Line*.

Someone searching "best serum for pie" wants a **named serum**. They land on an explainer
about what PIE is, see no product, and leave. That is the entire 933-impression/7-click gap.

### The wider context that makes this bet the priority

Measured Aug 2 2026 across the top 32 queries by impressions (818 impr, 2 clicks, 0.24%
CTR at avg position 12): **definitional queries returned 541 impressions and 0 clicks
(0.00%)** while **solution/review-intent queries returned 277 impressions and both clicks
(0.72%)**. AI Overviews answer definitional questions inline — the reader never leaves
Google. Commercial/solution intent still clicks.

The PIE cluster is solution-intent **and already on page one**. That combination does not
exist anywhere else on the site right now.

---

## What to build

Restructure the post around **product-type sub-sections**, each one a jump-anchor target
that matches a real query. Every section names real products with real prices.

### Required section structure (H2s, in this order)

```
## What's the Best Korean Skincare for PIE? (Quick Answer)
## PIE vs PIH: Which One Do You Actually Have?      <- keep, it's the differentiator
## Best Korean Serum for PIE                         <- NEW, anchor: #best-serum-for-pie
## Best Korean Toner for PIE                         <- NEW, anchor: #best-toner-for-pie
## Best Korean Moisturizer for PIE                   <- NEW, anchor: #best-moisturizer-for-pie
## Best Ingredients for PIE (and what to skip)       <- NEW, anchor: #best-ingredients-for-pie
## A Full PIE Routine, AM and PM                     <- NEW, anchor: #pie-routine
## How Long PIE Takes to Fade
## Frequently Asked Questions                        <- keep + expand
## The Bottom Line
```

Add a **jump-link table of contents** immediately under the intro linking to each anchor.
Google surfaces these as sitelinks on exactly this query shape, which is the mechanism the
bet is betting on.

### Per-section format (do this for serum / toner / moisturizer)

Each section must contain:

1. **One sentence** on why that product type matters for PIE specifically.
2. **A top pick** — brand, product name, price, and one honest sentence on why it wins.
3. **Two alternates** — a budget option and a sensitive-skin option.
4. **One honest limitation.** What this product type will *not* do for PIE. (PIE is
   vascular; nothing topical erases it fast. Say so.)

---

## Grounding data — use these products, they are verified in the catalog

**Do not invent products, prices, or ratings.** Every item below is `is_verified = true`
in `ss_products` with the listed price and review count as of Aug 3 2026.

PIE is post-inflammatory **erythema** — lingering redness from damaged capillaries, not
pigment. The actives that matter are **centella/madecassoside, panthenol, azelaic acid,
niacinamide**, plus barrier repair. Everything below was filtered on those actives.

### Serums (≤$35, ≥500 reviews, ≥4.4★)

| Brand | Product | Price | Rating | Reviews |
|---|---|---|---|---|
| iUNIK | Tea Tree Relief Serum | $14.00 | 4.5 | 6,100 |
| Beauty of Joseon | Glow Deep Serum: Rice + Alpha-Arbutin | $11.00 | 4.6 | 5,800 |
| Skinfood | Black Sugar Perfect First Serum The Light | $15.50 | 4.5 | 6,800 |
| It's Skin | Power 10 Formula VE Effector | $9.50 | 4.5 | 5,600 |

### Essences / ampoules (use if a serum pick needs a gentler alternate)

| Brand | Product | Price | Rating | Reviews |
|---|---|---|---|---|
| ONE THING | Centella Asiatica Extract | $12.00 | 4.6 | 2,800 |
| Illiyoon | Probiotics Skin Barrier Essence Drop | $15.50 | 4.6 | 3,800 |
| Numbuzin | No. 9 NAD Bio Lifting-sil Essence | $30.55 | 4.9 | 1,573 |
| CNP | Propolis Treatment Ampule Essence | $33.89 | 4.9 | 1,039 |

### Moisturizers (≤$35, ≥200 reviews, ≥4.4★)

| Brand | Product | Price | Rating | Reviews |
|---|---|---|---|---|
| Real Barrier | Extreme Cream | $22.00 | 5.0 | 11,501 |
| Aestura | A-Cica 365 Calming Cream | $20.00 | 4.7 | 6,100 |
| Real Barrier | Cicarelief Cream | $20.00 | 4.7 | 6,200 |
| Illiyoon | Ceramide Ato Soothing Gel | $11.00 | 4.7 | 6,200 |
| Beplain | Cicaful Calming Cream | $18.50 | 4.7 | 5,400 |
| iUNIK | Centella Calming Gel Cream | $15.50 | 4.6 | 5,800 |
| Apieu | Madecassoside Cica Gel | $9.50 | 4.4 | 5,800 |
| Klairs | Rich Moist Soothing Cream | $18.00 | 4.6 | 5,800 |

### Toners (≤$35, ≥500 reviews, ≥4.4★)

| Brand | Product | Price | Rating | Reviews |
|---|---|---|---|---|
| Etude | SoonJung pH 5.5 Relief Toner | $9.50 | 5.0 | 7,201 |
| Heimish | Matcha Biome Redness Relief Hydrating Toner | $20.00 | 4.6 | 5,400 |
| Dr.G | R.E.D Blemish Clear Soothing Toner | $18.00 | 4.6 | 5,600 |
| Real Barrier | Extreme Essence Toner | $17.00 | 4.6 | 5,800 |
| VT Cosmetics | Cica Mild Toner | $14.00 | 4.5 | 5,200 |
| Isntree | Green Tea Fresh Toner | $13.00 | 4.6 | 6,800 |

The Etude SoonJung is the strongest default here: pH 5.5, panthenol-led, deliberately
minimal, and the cheapest of the set — it fits the "calm an inflamed barrier" job PIE
actually needs. The Heimish and Dr.G are named for redness specifically.

### Two catalog traps that WILL bite you

**1. The 5.00★ noise floor.** Sorting by `rating_avg` alone returns a wall of 5.00★
products with **0–2 reviews**. Those are noise. Always require `review_count >= 200`
(ideally 500+) before naming something a "top pick." The tables above already apply that
filter.

**2. Duplicate rows for the same product at different prices.** Verified example: the
Etude SoonJung pH 5.5 Relief Toner exists **twice** — `$9.50 / 5.0★ / 7,201 reviews` and
`$16.00 / 4.6★ / 1,700 reviews` (different size or listing). Both are `is_verified`. When
a product appears more than once, use the row with the **highest review count** and quote
that row's price. Do not average them, and do not quote the cheaper row's price against
the other row's rating.

---

## Hard rules (carried over — do not relearn these)

- **Retailer policy:** recommend **Olive Young, Soko Glam, iHerb** only. Never YesStyle,
  Stylevana, StyleKorean. No Amazon or eBay links.
- **No em-dashes** in any social or Reddit copy derived from this.
- **Ground every product claim in the Seoul Sister DB.** Never let the generator invent a
  product, price, INCI, or rating.
- **Prices are as-of-date data.** Write them as "about $X at Olive Young" — do not present
  a scraped price as a live guarantee.
- **Do not claim the outcome.** LGAAS ships the content; Seoul Sister's SEO Guardian grades
  whether position/CTR actually moved on **2026-08-24**. Don't self-report success.
- **Keep the existing slug and post id.** This is an in-place refresh.

## Honesty requirements specific to PIE

This is a medical-adjacent topic and the honesty moat is the product. Non-negotiable:

- **PIE is vascular, not pigment.** Do not promise it "fades" like a dark spot. Say
  plainly that it resolves slowly, often over months, and that some cases need in-office
  vascular laser. Products support and speed the process; they are not an eraser.
- **Do not recommend aggressive acids as the headline answer.** PIE sits on compromised,
  inflamed skin. Over-exfoliation is a common way people make it worse and is a real
  failure mode we've seen with our own users.
- **Sunscreen is load-bearing.** UV prolongs erythema. Any PIE routine that omits daily
  SPF is incomplete — say it in the routine section.
- If a reader's redness is spreading, painful, or not resolving, say dermatologist. The
  referral threshold is low and stated, never buried.

## What NOT to do

- **Do not create a new post.** Refresh this one.
- **Do not chase the definitional PIE queries** ("what is pie skin", "pie acne") as the
  page's primary framing. They are AI-Overview-owned and returned 0 clicks on 541
  impressions. Keep a short definitional section for the reader who needs it, but the
  page's spine is now product-type selection.
- **Do not rewrite the PIE-vs-PIH section away.** It's the genuine differentiator and it
  already earns impressions.
- **Do not add a chat widget or new CTA pattern.** Feeder-page CTA architecture was
  settled June 29 2026 (single front door) and re-confirmed Aug 2. Out of scope.

---

## Definition of done

- [ ] Post refreshed in place, slug unchanged.
- [ ] Jump-link TOC present; serum / toner / moisturizer / ingredients / routine anchors live.
- [ ] Every named product exists in `ss_products` with the stated price (spot-check 3).
- [ ] Every product named has ≥200 reviews.
- [ ] Retailer mentions limited to Olive Young / Soko Glam / iHerb.
- [ ] PIE-is-vascular honesty line present; SPF in the routine; dermatologist threshold stated.
- [ ] FAQ section retained and expanded with the sub-type questions.
- [ ] IndexNow ping fires on ingest (automatic — just confirm it ran).

## Grading (Seoul Sister's job, not LGAAS's)

The bet's falsifiable expectation, recorded Aug 3 2026:

> PIE post total clicks rise from **7 to ≥12**, and at least **three** of the named
> sub-type queries earn their **first clicks** (currently 0), within 3 weeks.

Review date **2026-08-24**. The SEO Guardian grades it against real GSC data.
