# LGAAS Work Order: two posts in one day needed 37 corrections before they were fit to publish

**Date:** November 18 2026
**Status:** OPEN
**Audience:** any AI session working in the LGAAS repo.
**Posts:** `best-korean-cleanser-for-every-skin-type-and-how-to-tell` (15 corrections, applied after it had published) and `is-snail-mucin-fungal-acne-safe-how-to-read-any-korean` (22 corrections, applied to the draft).
**Records:** `ss-cleanser-post-replacements.json` and `ss-fungal-acne-post-replacements.json` in the Seoul Sister repo. Each pair carries a one-line `finding`. Read those first; this order groups them by cause.

## Why this order exists

Both posts were generated from a brief that asked for the right things, and both drafts were well structured. The corrections were not style. Each one is a sentence a reader could act on that was false, unsupported, or pointed somewhere wrong. Fixing them by hand took a second-model review per post and found 22 further defects in the first set of fixes. The generator should not produce these in the first place.

The fixes below are stated as outcomes. How the generator gets there is for the LGAAS session to decide; give the model the facts and let it write, do not bolt on phrase filters.

## Defect 1. A product link that does not open the product

Every product named in both drafts was linked to `https://www.seoulsister.com/products`, the general listing. Ingredients were linked to `https://www.seoulsister.com/ingredients` the same way. Eighteen older links of this kind were found in eight published posts on the same day (`ss-product-link-replacements.json`).

**Outcome:** when a draft names a catalog product, the link is `https://www.seoulsister.com/products/<id>` with the id of the row the draft's facts were read from. If the generator does not hold the id, it writes the name with no link. The same for ingredient pages: the ingredient's own slug or no link. A link to the general page is right only when the text says so ("the product database").

## Defect 2. A link whose text names one post and whose target is another

The fungal acne draft linked "Did COSRX Snail Mucin Break You Out? Here's Why" to `/blog/why-does-my-skincare-keep-making-my-skin-worse`.

**Outcome:** an internal blog link's title and slug come from the same row of the published list the generator is given. If it is not given that pairing, it cannot link by title.

## Defect 3. A pick the draft says it has not read

The cleanser draft, briefed "one pick per skin type, each chosen from its full ingredient list", published with:

- no pick at all for oily or combination skin ("I'm not going to name a specific gel here that I haven't verified the ingredients on");
- two picks carrying "I haven't read this one's full INCI", one of them a French product in a post titled "Best Korean Cleanser";
- the sentence "That's the whole reason I pick these from the full INCI".

The catalog held full lists and real review counts for strong candidates in every category asked for (foam, gel, cream and powder cleansers: 330 products, 318 with a list). The generator did not have them in hand, or did not look.

**Outcome:** for a "picks by X" brief, the generator is given, per slot, catalog candidates with their full ordered ingredient lists, and writes about a pick only from its list. Honest abstention is still right when the catalog has nothing; it is not right when the catalog was never searched. A draft that leaves a briefed slot empty should say so to the person approving it, above the draft, not inside the prose.

## Defect 4. Ingredient claims that ignore where the ingredient sits

Both the drafts and the first hand corrections made this mistake, which is why it is worth a rule:

- "built on glycerin, panthenol, and a mild amino-acid surfactant" for a cleansing milk where the surfactant is 15th of 20 and works as an emulsifier;
- "The top of the list is ... sodium hyaluronate" for an ingredient in 7th place, after the preservative.

**Outcome:** the generator sees each ingredient's position and is told plainly that order is roughly descending concentration and that anything after the preservative or 1,2-hexanediol is present in small amounts. "Built on", "main", "top of the list" are claims about the first few entries.

## Defect 5. A rating with nothing behind it

"It holds a 5 out of 5 on Olive Young" was written about a product whose catalog row held a rating and a review count of zero, and about another whose 5.0 came from 3 reviews. Seoul Sister cleared 544 such ratings on Nov 18 (v11.66.1), so the catalog no longer offers the first kind.

**Outcome:** a rating is quoted only with its review count, and both come from the same catalog row as the product named. The reader is told the figure is Olive Young's. A rating from a handful of reviews is the generator's call to quote or leave out, with the count shown either way.

## Defect 6. Medical sentences that contradict the post's own advice

The fungal acne draft said a dermatologist and an antifungal come first, then:

- "no essence, serum, or cream treats or cures it" (antifungal creams are the treatment);
- "which no over-the-counter product does" (antifungal washes are sold over the counter);
- "the only way to know for sure is a dermatologist" (any doctor can diagnose and prescribe);
- a paragraph telling readers how to rule themselves out.

**Outcome:** on a post about a condition, the draft is checked once more, by a different model, for sentences that rule out the treatment it has just named, that tell a reader how to decide they do not need a doctor, or that state a mechanism as settled when the brief said it was not. This is a check on the draft, not a list of banned words.

## Defect 7. First-person claims

"I've read its full ingredient list", "I pulled the full COSRX ingredient list", "I wrote the whole thing up separately". The byline is "Seoul Sister Team" and no person did those things. The earlier first-person work order (Nov 14) covered "I tested"; these are the same class with different verbs.

**Outcome:** the voice may be warm and direct. It may not claim an act of reading, testing, writing or owning. The rule is where the claim comes from, not which verbs are allowed.

## Defect 8. What Yuri can do

"She'll check a product's full ingredient list against it, and remember it for the next product you're curious about", and checking "every time you add something new". Yuri can check a product when asked, from the list Seoul Sister holds or from a photo of the label. No store for a member's avoid-list was found, and nothing checks automatically.

**Outcome:** capability sentences about Yuri come from a short statement of what she does that Seoul Sister supplies, not from the generator's idea of what an assistant would do. Until that statement exists, describe only "you can ask her to check a product against what you're avoiding".

## Defect 9. The free week

"The first week is free, no card." True for a first-time member only.

**Outcome:** the sentence comes from Seoul Sister's wording (`src/lib/offers.ts`), as the Nov 18 cleansing-oil order already asked.

## Defect 10. Visible FAQ and FAQ schema drift apart

In the fungal acne draft the visible FAQ answers and `faq_schema` differed in two places.

**Outcome:** one is generated from the other.

## How to apply

1. Read the two replacements files so each defect has its real sentence in front of you.
2. Fix causes 1, 2, 3 and 5 first: they are data the generator was not handed (product ids, post title and slug pairs, full ordered lists, counts). Check what the Seoul Sister search endpoint already returns before asking for more.
3. Second-model review the generator change.
4. Regenerate the cleanser brief as a test and count how many of the 15 corrections the new draft would still need. Do not publish the test draft.

## Not covered

- Whether Seoul Sister's endpoint returns ordered ingredient lists and product ids today was not checked from this side.
- The moisturizer, lip balm and face mask posts of October were not re-read for defects 3 and 4.
- A capability statement for Yuri (defect 8) does not exist yet. That is Seoul Sister's to write.
