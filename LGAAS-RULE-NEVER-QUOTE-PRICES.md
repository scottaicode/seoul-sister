# Standing rule for all Seoul Sister blog content — never quote a price in prose

**Date:** August 25 2026
**Applies to:** every Seoul Sister blog post LGAAS generates or edits, from now on.
**Add to:** the Additional Context of every blog recipe, and to AriaStar's
standing content rules.

---

## The rule

> **Never write a dollar figure into a blog post.** Link to the Seoul Sister
> product page instead. That page reads the live price from the database and is
> always current.

Write this:

> Numbuzin No.5+ Vitamin Concentrated Serum (4.7 stars across roughly 5,400
> reviews, [see the current price](/products/{id}))

Not this:

> Numbuzin No.5+ Vitamin Concentrated Serum (about $25 at Olive Young)

**Ratings, review counts, ingredient facts and INCI percentages are fine to
state in prose.** Those do not change week to week. Only PRICES are banned.

---

## Why (measured, not theoretical)

Blog bodies store prices as frozen prose. Nothing re-reads them when the
catalog changes, so a post is accurate the day it ships and drifts silently
forever after.

Audited Aug 25 2026: **223 hardcoded prices across 34 of 47 posts.**

The damage is real and live. On the PIH post, ranking position 10 with 707
monthly impressions, a serum was quoted at "about $25." The catalog says
**$17.17**, stable for eight consecutive days. Price history shows it WAS
$25.20 when the post published, then fell.

Nobody was careless. The number was right when written. **There is simply no
update path from the catalog back into published prose**, and there should not
need to be one.

Three of the seven products on that page also have no current price on file at
an approved retailer, so those figures were unverifiable from our own data.

## Why linking is better anyway, not just safer

- The product page shows the **live** price, so it can never be wrong.
- It carries the retailer links, the full INCI, and an Ask Yuri CTA.
- It sends the reader deeper into Seoul Sister instead of straight out to a
  retailer, which is the funnel we actually want.
- Internal links to product pages help those pages rank.

## How to find the product ID

Query the Seoul Sister catalog for the product and use its `id`:

```sql
SELECT id, brand_en, name_en FROM ss_products
WHERE name_en ILIKE '%<product name>%' AND is_verified = true;
```

The URL is `/products/{id}`. **Verify it returns HTTP 200 before publishing.**
Never guess a product URL.

## Edge cases

- **Price comparison posts** (for example "why is K-beauty expensive in the
  US") legitimately discuss price as a topic. There, discuss ranges and markup
  percentages, not specific current prices for specific SKUs. A statement like
  "Korean-market prices typically run 30-50% below US retail" is a durable
  claim. "Product X is $17" is not.
- **If a product has no verified price row**, do not imply one exists. Link to
  the product page and let it say what it knows.
- **Never name YesStyle, Stylevana, StyleKorean, Amazon or eBay** regardless.
  The approved set is Olive Young, Soko Glam, iHerb.

## Existing posts

Do not bulk-rewrite all 34. Fix on contact: any time a post is edited for
another reason, strip its prices while you are in there. The top posts by
traffic are worth doing deliberately; the long tail can wait.
