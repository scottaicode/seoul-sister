# LGAAS Work Order — PIH Product-Type Restructure (SEO Guardian bet `pih-push-to-page1-top`)

**Date:** August 25 2026
**Owner:** Scott Martin
**Status:** ACTIVE — execute now
**Audience:** any AI session working in the LGAAS repo running the blog loop.
**Source bet:** `ss_seo_reports` run 2026-08-23, bet `pih-push-to-page1-top`, review date **2026-09-13**.

> Read `LGAAS-WORK-ORDER-SEO-GUARDIAN.md` first if you haven't — it defines the standing
> division of labor and the rules that carry over. This order is one specific bet under it.
> It is the **sibling** of `LGAAS-WORK-ORDER-PIE-CLUSTER-REFRESH.md` (Aug 3), which has
> already SHIPPED. Read that one for the section format; this order mirrors it.

---

## THIS IS A REFRESH OF ONE EXISTING POST. DO NOT CREATE A NEW POST.

| | |
|---|---|
| **Target post** | `Best Korean Skincare for PIH: How to Fade Post-Acne Dark Spots` |
| **Slug** | `best-korean-skincare-for-pih-fade-post-acne-dark-spots` |
| **Published** | 2026-07-24 · ~6,658 words rendered |
| **Action** | Restructure + expand in place. **Keep the slug.** |

The page already ranks pos 10.1 on 707 impressions for "best korean skincare for pih".
A second PIH post would split that authority and cannibalize the exact query the bet
targets. The URL stays; the body changes.

---

## ⚠️ Do not confuse this with the PIE post

There are **two** similarly-named posts. This order targets the **PIH** one only.

| | **PIH** (this order) | **PIE** (leave alone — already refreshed Aug 3) |
|---|---|---|
| Slug | `best-korean-skincare-for-pih-fade-post-acne-dark-spots` | `best-korean-skincare-for-pie-acne-scars-and-texture` |
| Condition | Post-inflammatory **hyper­pigmentation** — brown/dark marks, melanin | Post-inflammatory **erythema** — red/pink marks, capillaries |
| Actives | tranexamic acid, niacinamide, arbutin, vitamin C | centella, panthenol, azelaic, barrier repair |

**PIH is pigment. PIE is redness.** Every product pick below was filtered on pigment
actives. Do not carry PIE picks over.

---

## What is ALREADY DONE — do not redo it (measured on the live page Aug 25 2026)

This matters more than usual. The SEO Guardian bet that generated this order **also asked
for reciprocal internal links between PIE and PIH. Those already exist in both directions**
— I confirmed by fetching both live pages. The bet asked for them because the grader could
not see them (see the note at the bottom of this order).

| Bet asked for | Live status | Action |
|---|---|---|
| Internal link PIH → PIE | **PRESENT** (absolute URL, in-body) | none |
| Internal link PIE → PIH | **PRESENT** (absolute URL, in-body) | none |
| Ingredient-page links (tranexamic acid, niacinamide, arbutin, ascorbic acid) | **PRESENT**, 4 of them | none |
| "PIH vs PIE" differentiator section | **PRESENT** — H2 "First, Make Sure You Actually Have PIH" + FAQ entry | none |
| Product-type answer block (serum / toner / essence) | **MISSING** | **BUILD THIS** |
| Jump anchors | **MISSING — the page has ZERO anchor ids** | **BUILD THIS** |

**Do not add more internal links between PIE and PIH.** They are there. Adding duplicates
is the specific waste this section exists to prevent.

---

## The actual gap (this is the whole job)

The two posts are organized on **different axes**, and that is the entire finding:

- **PIE** is organized **by product type** — `Best Korean Serum for PIE`,
  `Best Korean Toner for PIE`, `Best Korean Moisturizer for PIE`, each with a jump anchor
  (`#best-serum-for-pie` etc.). 7 anchors total.
- **PIH** is organized **by ingredient** — `The Ingredients That Actually Move PIH`.
  **0 anchors.** No per-product-type section anywhere. Verified: the strings
  "best korean serum", "best toner", "best essence" do not appear on the page.

Someone searching *"best serum for PIH"* lands on a page that never uses that phrase as a
heading. That is the position-10 problem in one sentence.

---

## What to build

### Required section structure (H2s, in this order)

```
## Best Korean Skincare for PIH: How to Fade Post-Acne Dark Spots   <- keep (title H2)
## Quick Answer                                                     <- keep
## First, Make Sure You Actually Have PIH                            <- keep, it's the differentiator
## Best Korean Serum for PIH            <- NEW, anchor: #best-serum-for-pih
## Best Korean Toner for PIH            <- NEW, anchor: #best-toner-for-pih
## Best Korean Essence or Ampoule for PIH  <- NEW, anchor: #best-essence-for-pih
## The Ingredients That Actually Move PIH  <- keep, anchor: #best-ingredients-for-pih
## Why PIH Happens, and Why Some People Get It More   <- keep
## A Realistic Timeline                   <- keep, anchor: #how-long
## What to Avoid                          <- keep
## Frequently Asked Questions             <- keep + expand, anchor: #faq
## The Bottom Line                        <- keep
```

**Anchor ids are REQUIRED and must match the slugs above exactly.** They are not cosmetic:
they are the execution evidence the SEO Guardian's verifier reads. A generator reproduces
an id byte-for-byte while prose gets reworded, so ids are the one durable proof the work
shipped. A refresh that ships the sections without the ids will grade as unverified.

Add a short jump-link list under the Quick Answer, mirroring the PIE post.

### Per-section format (do this for serum / toner / essence)

Each section must contain:

1. **One sentence** on why that product type matters for PIH specifically.
2. **A top pick** — brand, product name, price, and one honest sentence on why it wins.
3. **Two alternates** — a budget option and a sensitive-skin option.
4. **One honest limitation.** What this product type will *not* do for PIH.
   (PIH is melanin already deposited in the skin; nothing topical clears it in a week, and
   without daily sunscreen it comes back. Say so plainly.)

---

## Grounding data — use these products, they are verified in the catalog

**Do not invent products, prices, or ratings.** Every row is `is_verified = true` in
`ss_products`, priced at **Olive Young**, `in_stock = true`, with the listed review count.
Prices as of the `checked` date shown — re-query before publishing if that date is stale.

### Serums

| Brand | Product | Price | Rating | Reviews | Actives | Checked |
|---|---|---|---|---|---|---|
| Numbuzin | No.5+ Vitamin Concentrated Serum | $17.17 | 4.7 | 5,356 | TXA, arbutin, niacinamide, vit C | 2026-08-15 |
| Anua | Niacinamide 10% + TXA 4% Dark Spot Correcting Serum | $39.89 | 4.7 | 963 | TXA, arbutin, niacinamide, vit C | 2026-08-19 |
| Dr. Althea | Vitamin C Boosting Serum | $20.27 | 4.7 | 553 | TXA, arbutin, niacinamide, vit C | 2026-08-15 |

### Toners

| Brand | Product | Price | Rating | Reviews | Actives | Checked |
|---|---|---|---|---|---|---|
| Numbuzin | No. 5+ Vitamin Boosting Essential Toner | $16.50 | 4.7 | 633 | arbutin, niacinamide, vit C | 2026-08-15 |
| Anua | Rice 70 Glow Milky Toner | $21.99 | 4.8 | 371 | arbutin, niacinamide, vit C | 2026-08-20 |

### Essences / ampoules

| Brand | Product | Price | Rating | Reviews | Actives | Checked |
|---|---|---|---|---|---|---|
| SKIN1004 | Madagascar Centella Tone Brightening Capsule Ampoule | $20.40 | 4.7 | 825 | TXA, niacinamide, vit C | 2026-08-15 |

### Gentle / barrier alternate (for the sensitive-skin slot)

| Brand | Product | Price | Rating | Reviews | Actives | Checked |
|---|---|---|---|---|---|---|
| SKIN1004 | Madagascar Centella Soothing Cream | $14.45 | 4.8 | 1,249 | TXA | 2026-08-15 |

⚠️ **Numbuzin numbering trap.** `No.5+` and `No. 5` are DIFFERENT catalog rows at different
prices ($16.50 vs $22.82). In a numbered Korean product line the number is the entire
identity — copy the name exactly as written above. Do not normalize "No.5+" to "No. 5".

---

## Rules that carry over (do not relearn these)

- **Retailer policy:** recommend only **Olive Young, Soko Glam, iHerb**. Never YesStyle,
  Stylevana, or StyleKorean. Price-as-data is fine; recommendation is not.
- **No em-dashes** in any social/Reddit copy derived from this.
- **Ground every product claim in the Seoul Sister DB.** Do not let the generator invent
  a product, a price, a rating, or an ingredient.
- **Do not promote demoted features.** No CTAs to Scan / Glass Skin / Shelf Scan / Dupes.
  Route to Yuri.
- **The bet's expected outcome is Seoul Sister's to grade, not LGAAS's to claim.** Ship the
  content; the grader reads whether position and clicks actually moved. Do not self-report
  success.

---

## Expected outcome (Seoul Sister grades this, not you)

> "best korean skincare for pih" moves from pos 10.1 to pos <7.5 and the PIH page earns
> >=5 clicks (from 3) within 3 weeks. Review date **2026-09-13**.

---

## Why this bet kept getting re-proposed (context, so it doesn't happen again)

The SEO Guardian proposed PIE/PIH work **four times** (Jul 26, Aug 3, Aug 5, Aug 23). The
Aug 3 PIE order shipped and is live. The strategist re-proposed it anyway, because the
execution verifier matched quoted phrases from the bet text **verbatim** against the live
page: the Jul 26 bet named `"PIH vs PIE"`, the page shipped it as `"PIE vs PIH: Which One
Do You Actually Have?"`, the match failed, and it graded `ungradeable_not_executed` — which
`seo-guardian.ts` explicitly tells the strategist to **re-propose**.

Fixed Aug 25 2026 (commit `86b629d`): zero matches now abstains instead of accusing, anchor
ids are read from raw HTML as durable execution evidence, and internal-link bets abstain
because the page that CHANGES is not the ranking target the verifier fetches.

**The practical lesson for this order:** ship the anchor ids exactly as specified. They are
what lets the grader confirm this work happened, so the next strategist run does not order
it a fifth time.
