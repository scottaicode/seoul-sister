# Pending LGAAS drafts: what to publish, fix, delete (Oct 13 2026)

Screened by Opus 5.5 (all 24, against the catalog, GSC demand and published posts), then the top 5
attacked by Fable 5.1. **None of the 24 can publish as-is.** 4 are ready after the edits below,
1 needs more work, 8 are lower-value fixes, 11 should be deleted.

## How Ask AriaStar edits work (read first)

It is NOT find-and-replace. It rewrites the WHOLE post (title, content, meta, FAQ) from your
instruction. So:
- Paste ONE instruction per post containing every edit (below, ready to paste).
- Re-read the whole post afterwards; the rewrite can touch sentences you didn't ask about.
- It strips em-dashes from the body but NOT from the FAQ, hence the FAQ line in each instruction.

## Two defects in EVERY draft

1. **"Ask the AI advisor right here on this page"** is false: blog pages link to Yuri on the home
   page, she is not embedded. Fixed in each instruction below.
2. **Beplain Pumpkin Blended Cream Cleanser** appears in 11 drafts as "gentle". Our catalog shows a
   soap (fatty acids + potassium hydroxide) with fragrance, limonene and linalool. Root cause: the
   product lookup LGAAS uses ranks by star rating alone, and this product has 5.00 from zero
   reviews. Removed from every post below.

---

## Publish after edits (in this order)

### 1. "Best Cleanser for Oily, Sensitive, Acne-Prone Skin" (e80d48f2)
Most demand: ~484 impressions/28d across cleanser queries, no cleanser post exists.

Paste into Ask AriaStar:
```
Edit this post. Make all of these changes and nothing else:
1. Replace the sentence "If you want to browse options that fit the low-pH, gentle brief, the cleanser category page is a decent starting point." with: "Two that fit that brief: the Celimax Dual Barrier Mild Gel Cleanser (https://www.seoulsister.com/products/6d43eeb2-d38a-4af5-ac9c-8239bdd2016d), a gel with ceramides and no fragrance on its ingredient list, and the Cell Fusion C Low pH pHarrier Cleansing Foam (https://www.seoulsister.com/products/712de75a-a26e-4576-85c0-4f0a7a0fea08), which has no added fragrance (parfum) on its ingredient list. For more options, the cleanser category page (https://www.seoulsister.com/best/cleansers) is a decent starting point."
2. Delete the whole paragraph about the Beplain Pumpkin Blended Cream Cleanser (from "The Beplain Pumpkin Blended Cream Cleanser uses kaolin clay" through "Mid-week, not daily.") and replace it with: "If you want exfoliation, use a leave-on BHA two or three nights a week so you control the frequency, rather than an exfoliating cleanser."
3. Remove Beplain from anywhere else in the post, including the FAQ.
4. Replace "you can ask the advisor right here on this page, tell it your skin type" with "tap Ask Yuri on this page, which opens a free chat (no account needed), and tell her your skin type".
5. faq_items must contain no em-dashes; use commas instead.
```

### 2. "Why Does My Skincare Keep Making My Skin Worse?" (bd41287e)
Best conversion shape: "which of my products should I pause?" is exactly what Yuri answers.

```
Edit this post. Make all of these changes and nothing else:
1. Replace "I read that Reddit post ("progressively feeling worse and worse about my skin") and honestly, it's one of the most common patterns I see." with "If you've been feeling progressively worse about your skin, you're describing one of the most common patterns I see."
2. Replace the link text and URL "the milky toner guide for sensitive, dehydrated barriers (https://www.seoulsister.com/blog/best-milky-toners-for-a-sensitive-dehydrated-skin-barrier) walks through it" with "this moisturizer vs barrier cream guide (https://www.seoulsister.com/blog/korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs) walks through it".
3. Replace "you can ask the AI advisor right here on this page," with "tap Ask Yuri on this page, which opens a free chat (no account needed),".
4. faq_items must contain no em-dashes.
```

### 3. "Deep Cystic Acne: What Actually Helps" (a7923555)
Handles the dermatologist referral well. Low demand (~10 impressions), publish third.

```
Edit this post. Make all of these changes and nothing else:
1. Replace "is a stripped-back, minimal-ingredient option with panthenol and madecassoside (a concentrated centella derivative). It's from a hypoallergenic, fragrance-free line, so it's a safer bet when everything feels reactive." with "is a stripped-back, 13-ingredient formula built on glycerin, betaine and madecassoside (one of centella's active compounds), with no fragrance on its ingredient list, so it's a safer bet when everything feels reactive."
2. Replace the Beplain Pumpkin Blended Cream Cleanser recommendation with: "The Cell Fusion C Low pH pHarrier Cleansing Foam (https://www.seoulsister.com/products/712de75a-a26e-4576-85c0-4f0a7a0fea08) is a good fit here: a gentle foam with no added fragrance (parfum) on its ingredient list, which matters when your skin is already reactive." Remove Beplain everywhere else.
3. Replace "built around" with "includes" in the sentence about centella asiatica extract, sodium hyaluronate and panthenol.
4. Replace "drying alcohols (Alcohol Denat. SD Alcohol)" with "drying alcohols (Alcohol Denat., SD Alcohol)".
5. Replace "you can ask the AI advisor right here on this page," with "tap Ask Yuri on this page, which opens a free chat (no account needed),".
6. Keep every dermatologist referral exactly as it is.
7. faq_items must contain no em-dashes.
```
Note: the Etude SoonJung toner it recommends has no retailer price in our catalog, so its link lands on
a page without a buy option. Acceptable, or swap it later.

### 4. "Why Is PDRN So Popular?" (1d41eaf6)
Carries our own uncopyable finding. ~61 impressions on PDRN product queries.

```
Edit this post. Make all of these changes and nothing else:
1. Replace "A lot of serums list "salmon DNA" or a vague ferment extract and let you assume it's the same regenerative powerhouse from the injectable studies." with "Most "PDRN" serums actually list Sodium DNA on the label and let you assume it's the same ingredient from the injectable studies."
2. Replace the sentence beginning "If a product's whole personality is PDRN, you want to see a named PDRN or sodium DNA ingredient reasonably high on the list" with: "In Seoul Sister's database, of 188 products with "PDRN" in the name and a complete ingredient record, 171 list Sodium DNA and zero list polydeoxyribonucleotide (counted October 2026). So the ingredient you're most likely buying is Sodium DNA. That isn't a bad ingredient, but it isn't PDRN, and it shouldn't be priced like the injectable."
3. In Key Takeaways, replace "**"Salmon DNA" ≠ purified PDRN.** Brands use the terms loosely. Check where the actual PDRN ingredient sits on the list." with "**"Salmon DNA" and Sodium DNA are not purified PDRN.** In Seoul Sister's catalog, 171 of 188 "PDRN" products list Sodium DNA and none list polydeoxyribonucleotide."
4. In the FAQ (body and faq_items), change any wording about whether "PDRN is actually formulated well" to "where Sodium DNA sits on the ingredient list".
5. Replace "which leads on sodium hyaluronate" (and the rest of that phrase about betaine and centella asiatica) with "is built on betaine and centella asiatica, with sodium hyaluronate further down,".
6. Delete the Beplain Pumpkin Blended Cream Cleanser clause so that sentence ends at "without stripping."
7. Remove "and refill" from the Te' Chorok mention.
8. Replace "you can ask the AI advisor right here on this page," with "tap Ask Yuri on this page, which opens a free chat (no account needed),".
9. faq_items must contain no em-dashes.
```

## After each one publishes (tell Claude, it sets these)

| Post | yuri_opener |
|---|---|
| Cleanser | My oily, sensitive skin feels tight after cleansing and still breaks out. Which cleanser actually fits my skin? |
| Skin getting worse | My skincare routine keeps making my skin worse. Which of my products should I pause, and which can stay? |
| Cystic acne | I keep getting deep cystic acne that never comes to a head. What routine calms it without wrecking my barrier? |
| PDRN | I'm eyeing a PDRN serum and can't tell if it's real PDRN or Sodium DNA. Is it worth it for my skin? |

---

## Needs more work: "Best Matte K-Beauty Sunscreen Under Makeup?" (e0b39ec0)
The title promises matte and **none of its picks is matte** in our catalog. Rataplan is sold as calming
but carries six essential oils; Dinsee Mild Moist is out of stock. A real matte pick exists: Beauty of
Joseon Matte Sun Stick: Mugwort + Camelia ($14.40 at Olive Young, in stock Oct 8). Rewrite, don't patch.

## Lower-value fixes (later, if at all)
c4de8da1 skincare at 30, 8ffe35a2 routine "wrong", e55f3db6 skin picking (needs a BFRB/infection
referral), 00943355 post-Accutane, eedf5535 tretinoin peeling (needs "ask your prescriber"),
b0141c84 what Koreans use, f93393d7 too late for K-beauty. 43e0edbb (Asian sunscreens) overlaps two
sunscreen posts that already rank; merge, don't publish. Details:
scratchpad `pending-posts-review.md`.

## Delete (11)
7241c7d3 "A Korean Doctor Says No" (the doctor is invented), 1f13d7f3 milky toner (duplicate; pick
isn't a milky toner), 2e2d8647 expiry (published post already ranks), e3811c4d beginner routine
(5 posts cover it), d1f4e0f9 "20+ holy grails" (covers 4; leaked model text), b68d7004 hyped flops
(names none), 481f57c3 ex-employee routine (routine never shown), ec7ba1de "Can't Stand Dr. Dray?"
(disparages a real person), c47bc025 balm vs remover (no products; pitches the paid scanner as free),
817f921f relationship (no demand, duplicate), c7332eb4 eye bruising (medical question, off-domain).
