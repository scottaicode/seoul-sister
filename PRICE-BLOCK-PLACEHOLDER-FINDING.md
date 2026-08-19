# Olive Young prices are largely brand-level placeholders, not per-SKU prices

**Found:** Aug 19 2026, by the LGAAS session that was asked to build a
Korea-vs-US price table for a blog post. It refused, and it was right.
**Status:** MEASURED, not fixed. No code change made. This is the record.

---

## What was asked, and why the refusal was correct

`LGAAS-WORK-ORDER-CHEAP-VS-EXPENSIVE-INTENT.md` (written by me, Aug 19) told
LGAAS its unique angle was a real Korea-price vs US-price table, since we hold
"~4,769 verified products with prices." **That instruction was wrong.** LGAAS
queried the data, found it would not support the claim, published the post
without the table, and said so explicitly.

Verified independently against production:

| Check | Result |
|---|---|
| Products with BOTH an Olive Young and a Soko Glam price | **50** (not thousands) |
| Olive Young rows sharing a price with ≥1 other product | **4,427 of 4,917 (90.0%)** |
| Rows in blocks of **20+** products at one identical price | **2,069** |
| Distinct price points shared by 20+ products | **51** |
| Rows with a genuinely **unique** price | **490 (10.0%)** |

Largest blocks: **158 products at exactly $34.04**, **127 at $22.56**, 94 at
$29.68, 87 at $25.99, 74 at $48.00.

A price that 158 different products share is not that product's price. It is a
**brand- or category-level placeholder** captured by the scraper.

## Why this matters well beyond the blog post

**Yuri quotes these prices to real buyers at purchase intent.** In the Aug 18
transcript she told a visitor a cleanser was "$20 at Olive Young Global (fresh
price, 3 days old)" — accurate to the day on freshness, and freshness was never
the problem. The open question this finding raises is whether the *number* is
that SKU's price or a block placeholder it inherited.

This is a **different and more serious defect class than staleness**, which was
the thing being tracked (see the stale-price entry in
`TRAFFIC-DIAGNOSIS-AUG18.md`). A stale price is a real price that has moved. A
block placeholder was never that product's price at all, and refreshing it does
not fix it — the refresher will faithfully re-capture the same placeholder.

**It also explains an old mystery.** `GEO-STRATEGY.md` records that of 231,865
price-history rows, "only 95 products show actual price movement." If 90% of
rows carry a shared block value, most of them cannot move by construction.

## What was NOT concluded

Per the "a mismatch is not a diagnosis" rule — this is a **measurement, not a
diagnosis.** What is confirmed is that many products share identical prices.
What is NOT established:

- **Which side is wrong.** Some blocks may be legitimate: Korean brands do use
  uniform pricing tiers, and a 10-pack of sheet masks genuinely may cost the
  same across variants. 158 unrelated products at $34.04 is not that.
- **Whether the scraper is the cause.** It could be capturing a category page
  price, a "from" price, a set price, or a brand default. Not investigated.
- **The blast radius on Yuri's actual recommendations.** The products Yuri
  recommends most are not necessarily the ones in the big blocks. A sample drawn
  from the blocks would be a sampling artifact — the same error that produced a
  false "0.0% price change" reading in v11.28.0.

## What to do next (nobody has done this yet)

1. **Take the products Yuri has actually recommended in real transcripts** and
   check each price against the live Olive Young page. That is the population
   that matters, not a random or stalest-first sample.
2. **If the block prices are wrong**, the fix is in the scraper
   (`POST /product/detail-data` path, v11.28.0), not in the refresh cadence.
3. **Consider suppressing block-shared prices** rather than quoting them —
   `in_stock: false` already demonstrates the pattern of surfacing a data
   condition as a FACT for Yuri rather than as prompt prose.

## Two related claims that are now also in doubt

- **The existing "expensive" blog post asserts a 2-3x US markup** in its body,
  meta description, and FAQ schema. LGAAS flagged that our own data does not
  currently support that number, and correctly left it alone as outside its
  work order's scope. It is a pre-existing published claim; correcting it is a
  separate decision. That post is also date-anchored to "2025" throughout.
- **The "/best" pages and product pages advertise multi-retailer price
  comparison.** With 50 products having two retailer prices, that promise is
  thinner than it reads.

## Credit where it belongs

LGAAS was handed a confident instruction from a sibling repo, checked it against
the database instead of executing it, declined the part the data could not
support, published the defensible remainder, and reported the discrepancy with
its numbers. That is exactly the behavior these work orders should get. The
instruction was mine and it was wrong.
