# LGAAS Work Order: the cleansing-oil post names picks its own advice rules out, and quotes review counts nobody holds

**Date:** November 18 2026
**Status:** OPEN
**Audience:** any AI session working in the LGAAS repo.
**Post:** `best-korean-cleansing-oils-for-every-skin-type-2026` (Seoul Sister `ss_content_posts`, last updated Nov 14 2026).
**Related, still open:** `LGAAS-WORK-ORDER-BLOG-SEEDED-REVIEW-FIGURES.md` (Nov 14). That order searched one sentence shape, "(... roughly N reviews)", and so missed this post, which writes its counts without parentheses.

## Why this post, now

It is the highest-earning post on the site: 2,287 impressions and 16 clicks across 143 queries in the 28 days to Nov 12 2026 (Google Search Console), sitting around position 10. On Nov 17 2026 it produced a member: a reader arrived from Google on this post, signed up, and asked Yuri which cleansing oil suits oily to combination skin. Yuri recommended the Anua oil this post recommends, then looked it up and had to correct herself: it contains fragrance. The post has the same problem in four of its five picks.

Everything below was checked against the Seoul Sister catalog on Nov 18 2026. Where a figure is a count or a rating, the source is named.

## Finding 1. Four of the five review counts are not in the catalog

The section opens: "These are pulled from our catalog and filtered for review volume, because a 5-star rating from nine people tells you nothing."

| Pick | What the post says | What the catalog holds |
|---|---|---|
| Anua Heartleaf Pore Control Cleansing Oil | 4.7 stars, roughly 5,200 reviews, "sold as a double set" | 4.7, 5,239 reviews on the Double Set listing (an Olive Young figure). **Real. Keep.** |
| Beauty of Joseon Ginseng Cleansing Oil | roughly 6,800 reviews | no rating, 0 reviews |
| Klairs Gentle Black Deep Cleansing Oil | 4.6 stars, roughly 4,800 reviews | no rating, 0 reviews |
| The Face Shop Rice Water Bright Light Cleansing Oil | roughly 7,200 reviews | no rating, 0 reviews |
| Banila Co Clean It Zero Cleansing Balm Original | roughly 18,200 reviews, "the single most-reviewed cleanser in our entire catalog" | 16 reviews on one listing, 0 on the other |

The four unsupported figures have the shape of the February 2026 launch seed numbers that Seoul Sister removed from its catalog on Nov 14 2026 (v11.61.11). I did not re-match each one to the seed files; the earlier work order did that for its 38 sentences and found every one matched.

The "single most-reviewed cleanser in our entire catalog" sentence is false on today's data: the most-reviewed cleanser is the Anua Double Set at 5,239.

**Do:** remove the four unsupported counts and the Klairs star rating. Remove "the single most-reviewed cleanser in our entire catalog". Do not replace them with "highly reviewed", "top-rated" or any other popularity claim. Rewrite the opening sentence of the section, since four of five picks were not filtered for review volume.

## Finding 2. Three picks contradict the post's own table

The post's central advice is to match the base oil to the skin type and, for sensitive skin, to be careful with fragrance ("Fragrant essential oils, citrus-derived extracts" are in the caution column).

| Pick, and who it is recommended for | What our ingredient record shows |
|---|---|
| **Klairs Gentle Black Deep Cleansing Oil**, for sensitive skin, "built around a low-irritation formula" | Lists **Parfum**. 16 ingredients. |
| **The Face Shop Rice Water Bright Light Cleansing Oil**, "light enough for combination skin" | First ingredient is **isopropyl myristate**. Lists **Parfum, Limonene, Linalool**. |
| **Anua Heartleaf Pore Control Cleansing Oil**, for oily or acne-prone skin, "Heartleaf-based" | First four ingredients are ethylhexyl palmitate, two emulsifiers and caprylic/capric triglyceride. Heartleaf extract is 18th of 22 as our record orders them. Lists **Fragrance**. Also holds olive and macadamia oil, which the table files under dry skin. |
| Banila Co Clean It Zero Original, and "the Purifying version ... if you are oily" | Both list **Fragrance**. The Pore Clarifying version also lists tea tree leaf oil. |
| Beauty of Joseon Ginseng Cleansing Oil, for dry skin | Soybean oil first, then olive oil. No fragrance on our record. **Consistent with the table.** |

**Do:**
1. Replace the sensitive-skin pick with one whose list has no fragrance, or keep Klairs and say it is fragranced. Candidates whose lists show no fragrance, essential oil or fragrance allergen on our record (confirm each against its full list before naming it, my filter is a word match, not a chemist):
   - TISS Deep Off Cleansing Oil: 10 ingredients, mineral oil base, 4.8 stars across 1,406 reviews (Olive Young).
   - Haruharu Wonder Black Rice Moisture Deep Cleansing Oil: 9 ingredients, rice bran oil base, 4.7 across 492 reviews (Olive Young).
   - Purito Seoul From Green Cleansing Oil: 10 ingredients, olive oil base, 4.7 across 49 reviews (Olive Young).
2. For Anua, drop "Heartleaf-based" and say what the list shows: a light ester base that rinses clean, with fragrance. A reader with reactive skin should be told before they buy, not after.
3. For The Face Shop, either drop it or state the isopropyl myristate base and the fragrance, and do not recommend it for breakout-prone combination skin on the strength of "light".
4. For Banila, say both versions are fragranced.
5. Do not present any pick as fragrance-free unless its full list on the product page shows no fragrance. A product with no ingredient list on file is not fragrance-free; it is unknown.

## Finding 3. Smaller statements that are out of date or unsourced

| Sentence | Problem | Do |
|---|---|---|
| "She's free to start with a free account" (about Yuri) | Since Nov 16 2026 creating an account starts a 7-day free week with no card; after that membership is $9.99/month only if a card is added. "Free to start" undersells the first and hides the second. | "Creating an account starts a free week with her, 7 days, no card." Take the price sentence from Seoul Sister's `src/lib/offers.ts` wording, never write a charge sentence by hand. |
| "detailed profiles for 8,200+ ingredients with safety ratings and comedogenic scores" | The catalog holds 15,184 ingredient rows, all with a safety rating and all but two with a comedogenic rating. The landing page says "14,900+". | Use the landing page's figure or no figure. |
| "The base oil typically makes up 60 to 80 percent of a cleansing oil formula" | No source. | Cite one or cut the percentage. |

## Finding 4. The SEO change that keeps being recommended and has not been applied

Seoul Sister's weekly SEO report of Nov 15 2026 records that four earlier recommendations asked for a short answer on this post naming one pick per skin type, and that none of them appeared on the live page (the Nov 1 report is one of them). The Nov 15 wording, which fits how the template renders:

> Inside the existing "Frequently Asked Questions" section, add an H3 with the exact heading text "What is the best Korean cleansing oil for each skin type?" followed by a one-line pick for dry, oily, combination and sensitive skin.

**Do this after Findings 1 and 2**, so the answer block names the corrected picks. The report asked for store names in that line; leave prices out (`LGAAS-RULE-NEVER-QUOTE-PRICES.md`), and name a store only where Seoul Sister's catalog shows that store carrying the product.

## How to apply

1. Write old and new sentence pairs to a replacements file, as for the first-person-claims fix.
2. Second-model review the pairs (a different model, told to refute): every pick's claims against the product's full ingredient list on its Seoul Sister product page, and no popularity claim left standing.
3. Apply to the LGAAS copy; Seoul Sister applies the same file to `ss_content_posts`.
4. Check the generator on one fresh draft: it should not describe a product's formula from the product's name ("Heartleaf", "Gentle", "Light") when the ingredient list says otherwise.

## Not covered

- I checked this one post. The same sentence shape, "roughly N reviews" without parentheses, appears in at least eleven other posts. The two with the most are `best-korean-skincare-for-pih-fade-post-acne-dark-spots` and `best-korean-skincare-for-pie-acne-scars-and-texture`, 13 each. Some of those figures will be real Olive Young counts and some seed leftovers; each has to be checked against the catalog, not assumed either way.
- I did not check the picks in any other post against their ingredient lists.
- Fragrance on our record is what the ingredient list we hold says. A reformulated product can differ from it.
