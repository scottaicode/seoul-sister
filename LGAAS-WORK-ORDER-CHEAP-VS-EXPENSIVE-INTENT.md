# LGAAS Work Order — the "cheap" vs "expensive" intent mismatch

> **STATUS: COMPLETED Aug 19 2026 by LGAAS. One instruction in this file was
> WRONG and was correctly refused — see the box below before reading further.**
>
> **The Korea-vs-US price table asked for below CANNOT be built from our data,
> and LGAAS was right to decline it.** Verified independently: only **50
> products** have both an Olive Young and a US price, and **90% of Olive Young
> price rows share their price with at least one other product** (158 products
> at exactly $34.04, 127 at $22.56) — brand-level placeholders, not per-SKU
> prices. Only **490 of 4,917 rows (10%)** carry a unique price.
>
> Publishing that table would have produced confident-looking numbers that are
> wrong. LGAAS shipped the post grounded in figures it could defend instead.
> Full measurement and the wider implications (this affects **Yuri's price
> quotes**, not just the blog) are in **`PRICE-BLOCK-PLACEHOLDER-FINDING.md`**.
>
> Do not re-issue the price-table instruction.

**Raised:** Aug 19 2026 · **Owner:** LGAAS blog pipeline · **Priority:** medium
**Type:** ONE new post + one small edit to an existing post. Not a pipeline change.

---

## The finding, in one line

`/blog/why-is-k-beauty-so-expensive-in-the-us-the-real-price-markup-explained`
ranks on page one for people asking the **semantic opposite** of its thesis —
*"why is korean skincare so **cheap**"* — and earns **zero clicks** from them.

## The data (GSC window `2026-07-17` → `2026-08-13`)

Queries hitting that page:

| Query | Impressions | Clicks | Position |
|---|---|---|---|
| why is korean skincare so cheap | 26 | 0 | 9.5 |
| why is k-beauty so cheap? | 24 | 0 | 9.5 |
| why are korean beauty products so cheap | 21 | 0 | 9.5 |
| why korean skin care so cheap | 17 | 0 | 11.7 |
| why is k-beauty so cheap | 17 | 0 | 11.7 |
| why are korean beauty products so cheap? | 13 | 0 | 13.2 |
| why is korean skincare so cheap? | 13 | 0 | 8.2 |
| …and 2 more "cheap" variants | ~14 | 0 | — |
| **"cheap" total** | **145** | **0** | ~10 |
| *why is korean skincare so **expensive*** | 16 | 0 | 3.6 |

**The on-topic query gets 16 impressions. The off-topic one gets 145.** Nine
times more demand for the question the page does not answer.

## Why this is a real mismatch and not a false alarm

I checked the body rather than assuming (2,194 words):

- `"affordable"` — **0 occurrences**
- `"cheaper"` / `"cheap"` — 10 occurrences, **every one incidental**: cheap
  *shipping*, cheaper *than a US store*, "is it cheaper to order direct".
- No `<h2>` addresses why Korean products cost less at source. The seven
  headings are all about US import markup, shipping, and customs.

The page is genuinely, correctly about **why K-beauty costs 2-3x more in the
US**. The searcher typing "why is korean skincare so cheap" has the opposite
premise — they have noticed K-beauty is *cheaper than Western brands* and want
to know how that is possible. Different question, different answer.

**Per the "a mismatch is not a diagnosis" rule: neither side is wrong.** The
existing page is accurate and should NOT be retargeted. The gap is a missing
page.

## What the "cheap" answer actually is (verified against live sources)

The real drivers, which our existing post never covers:

1. **Competition density** — 3,000+ domestic brands competing for the same
   shelf, so nobody can overcharge on a near-identical formula.
2. **High-volume manufacturing** — large contract manufacturers (Kolmar,
   Cosmax) produce at a scale that drops unit cost sharply.
3. **DTC distribution** — most Korean brands sell through their own channels
   or local e-commerce, cutting the 30-40% middleman margin.
4. **Lower marketing overhead** — e-commerce-weighted, less TV/print spend
   than Western incumbents.
5. **Government export support** for the beauty sector.

**The honest complication, which is our angle:** it is cheap *in Korea*. Our
existing post proves it is often **not** cheap by the time it reaches a US
shelf. Those two facts belong in one narrative, and nobody else is telling it —
the current top results are thin retailer content-marketing pages
(dewbeauty.ca, mjsmedicals.com, q-depot.com, beautyfeatures.ie).

## The ask

### 1. New post — the "cheap" question

- **Target query:** `why is korean skincare so cheap` (+ the "k-beauty",
  "korean beauty products", and question-mark variants above).
- **Angle that only Seoul Sister can write:** answer the cheap question
  honestly. ~~Then use our own catalog to show where the money actually goes —
  we hold live Korean *and* US retailer pricing on ~4,769 verified products.~~
  **STRUCK Aug 19 2026 — this premise is false.** Only 50 products have both a
  Korean and a US price, and 90% of Olive Young rows carry a shared
  brand-level placeholder rather than a per-SKU price. See
  `PRICE-BLOCK-PLACEHOLDER-FINDING.md`. Ground the piece in figures that hold
  (catalog size, brand count, INCI coverage), never in a price ratio.
- **Must link** to the existing "expensive" post as the companion (the
  Korea-cheap / US-expensive pair is the whole story).
- Follow `BLOG-PRE-PUBLISH-CHECKLIST.md`. Ground every price claim in
  `ss_products` / `ss_product_prices`; **do not assert a price that is not in
  the database**, and respect price staleness (Olive Young rows average ~70
  days old — do not present them as today's price).
- **Do not repeat the stale premise** that "no English K-beauty source exists"
  (see CLAUDE.md positioning correction, Aug 9 2026).

### 2. Small edit to the existing "expensive" post

Add one short section — *"Wait, isn't Korean skincare supposed to be cheap?"* —
that states the Korea-vs-US distinction in two or three sentences and links to
the new post. This resolves the mismatch for the 145 impressions **already
landing there** while the new page earns its own ranking.

## What this is NOT

- **Not a title/meta fix.** The title is accurate; Google is ranking an
  accurate page for the wrong query.
- **Not a sitewide content-strategy change.** I checked all zero-click blog
  pages with ≥5 impressions: **this is the only one with a genuine intent
  mismatch** (9 off-intent queries; every other zero-click page has 0). The
  others are zero-click for ordinary reasons — several sit at position 31, 40
  and 81, where zero clicks is simply what that position earns.
- **Not urgent.** 145 impressions at a ~1% realistic CTR is roughly 1-2 clicks
  a month. It is worth doing because it is cheap and the page is already
  ranking, not because it moves the business.

## How to grade it

Re-read the same GSC rows in ~4 weeks:
- Does the new page appear for the "cheap" queries, and does it earn clicks?
- Do the "cheap" queries stop landing on the "expensive" page?
- **Honest expectation: 1-3 clicks/month.** If someone reports a large traffic
  win from this, be skeptical and check the row.
