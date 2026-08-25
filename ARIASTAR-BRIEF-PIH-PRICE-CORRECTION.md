# Brief for AriaStar — PIH post: replace stale prices with live links

**Date:** August 25 2026
**Type:** EDIT one existing published post. **Do NOT create a new post.**
**Slug (do not change):** `best-korean-skincare-for-pih-fade-post-acne-dark-spots`

---

## Why

This post quotes seven prices in prose. Prices were correct on the day it
published and have drifted since. Audited against the live catalog Aug 25 2026:

| Product | Post says | Live catalog | Status |
|---|---|---|---|
| Numbuzin No.5+ Vitamin Concentrated Serum | about $25 | **$17.17** (stable 8 days) | **45% overquote** |
| Numbuzin No.3 Skin Softening Serum | about $28 | $25.20 | wrong + **out of stock** |
| Numbuzin No.5 Vitamin-Niacinamide Pad | about $17 | no price on file | unverifiable |
| Beauty of Joseon Glow Deep Serum | about $11 | only at YesStyle | unverifiable at an approved retailer |
| Neogen Dermalogy Real Vita C Serum | about $19 | no price on file | unverifiable |
| Beplain Cicaful Calming Ampoule | about $17 | no price on file | unverifiable |
| Illiyoon Ceramide Ato Concentrate Cream | about $17 | no price on file | unverifiable |

A reader arriving ready to buy finds the real price 45% higher than promised.
That is a trust break on our best-ranking PIH page.

**Ratings and review counts are all CORRECT. Keep every one of them.**
Only the price figures are wrong.

---

## The fix: remove the price, keep everything else, link to the live page

Do not substitute a new number. A number goes stale again. Replace each price
with a link to our own product page, which reads the live price from the
database and always shows the current one.

### The seven find-and-replace edits

Match the parenthetical exactly. Keep surrounding prose untouched.

**1.** FIND: `(about $25 at Olive Young, 4.7 stars across roughly 5,400 reviews)`
REPLACE: `(4.7 stars across roughly 5,400 reviews, <a href="/products/2d041fc2-78b2-4d03-98f1-d0511b3b76bd">see the current price</a>)`

**2.** FIND: `(about $28 at Olive Young, roughly 8,200 reviews)`
REPLACE: `(roughly 8,200 reviews, <a href="/products/7edcdabd-e7fd-46f3-ab23-171b7e6459dd">see the current price</a>)`

**3.** FIND: `(about $17, 4.6 stars across roughly 6,800 reviews)`
REPLACE: `(4.6 stars across roughly 6,800 reviews, <a href="/products/afb269bc-b505-4519-bf88-f4d3cc114b9c">see the current price</a>)`

**4.** FIND: `(about $11 at Olive Young, 4.6 stars across roughly 5,800 reviews)`
REPLACE: `(4.6 stars across roughly 5,800 reviews, <a href="/products/f15f5eb0-5638-4222-aeac-9f88a6f466ca">see the current price</a>)`

**5.** FIND: `(about $19, 4.5 stars across roughly 4,200 reviews)`
REPLACE: `(4.5 stars across roughly 4,200 reviews, <a href="/products/a9940f94-b3da-4838-a2f5-4b78d55ccabb">see the current price</a>)`

**6.** FIND: `(about $17 at Olive Young, 4.7 stars across roughly 6,800 reviews)`
REPLACE: `(4.7 stars across roughly 6,800 reviews, <a href="/products/949424f4-141d-4689-8723-e7359b160fdc">see the current price</a>)`

**7.** FIND: `(about $17, roughly 15,200 reviews)`
REPLACE: `(roughly 15,200 reviews, <a href="/products/aeb68155-76a8-47aa-8255-967475237633">see the current price</a>)`

All seven product URLs verified live (HTTP 200) on Aug 25 2026.

---

## One more change: the No.3 serum is out of stock

Edit **2** above also needs a stock caveat, because recommending an
unbuyable product wastes the reader's time. In that sentence, after the
Numbuzin No.3 mention, add a short clause noting it is currently out of stock
at Olive Young and the No.5 pad is the available alternative. Keep it factual
and brief. Do not delete the No.3 recommendation; the reasoning is still sound
and stock returns.

---

## Hard rules

- **Change nothing else.** Not the title, slug, meta description, Quick Answer,
  FAQ block, headings, or any other sentence.
- **Keep every rating and review count** exactly as written. They are correct.
- **Never name YesStyle, Stylevana, StyleKorean, Amazon or eBay.**
- **No em-dashes.**
- Do not add products. Do not add sections. This edit only removes stale
  numbers and adds links.

## Definition of done

1. Zero `$` figures remain in the article body.
2. All seven links present and pointing at the exact IDs above.
3. FAQ count still 6. Title, slug and meta description unchanged.
4. All ratings and review counts intact.

Scott will diff the draft against the live post before approving.
