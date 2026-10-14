# LGAAS Blog Recipe: Best Korean Lip Balm for Dry, Chapped Lips

**Status:** READY. Adversarially reviewed by Fable 5.1 on Oct 13 2026 (fixes: CNP Propolis Lipcerin, which lists denatured alcohol plus fragrance allergens, replaced by Laneige Lip Sleeping Mask EX with presence-only claims; Anua's 0.01ppm hyaluronic acid and 10ppm sodium DNA disclosed; LGAAS heading collision; Yuri capability guard). Pack sizes verified against the catalog volume field. Modeled on
`LGAAS-BLOG-RECIPE-MOISTURIZER-BY-SKIN-TYPE.md`. **No prices in the post** (standing rule
`lgaas/LGAAS-WORK-ORDER-NEVER-QUOTE-PRICES.md`). Stock and price freshness checked Oct 13 2026 (every
pick has an in-stock Olive Young row checked Oct 1 to Oct 13). If you run this after Nov 1, ask Claude
to re-check all 8 picks are still in stock.

**Why this post:** Google Search Console, Sep 11 to Oct 8 2026: about 116 impressions a month across
"best korean lip balm" (77, position 9.2) and "korean lip balm" (39, pos 39). No post ranks; only
`/best/lip-care` does. Position 9.2 on the head term means page one is already within reach.

**Cannibalization check (ss_content_posts, Oct 13):** no existing post on lip balm or lip care
(title, slug, primary_keyword). Not a conflict.

**Catalog depth caveat (read before running):** the catalog supports this post, but thinly. Once
tinted balms (makeup mis-filed as lip care), Western brands and dirty INCI are removed, there are 65
verified untinted lip products from Korean brands with an ingredient list, and the picks below
include three with under 70 reviews (Illiyoon 33, Round Lab 47, COSRX 66). The best-known Korean lip
product, Laneige Lip Sleeping Mask EX, is included with **presence-only** claims: its catalog INCI ends
in a trailing comma, so the list may be truncated. A truncated list can hide an ingredient but never
add one, so saying what IS listed is safe and saying "does not contain X" is not. **There is no lip SPF pick**: the
only in-stock Korean lip sunscreen (Some By Mi V10 Hyal Lip Sun Protector) has no SPF value in the
catalog and lists lemon and orange peel oils plus limonene and citral.

**First-party figures, computed live Oct 13 2026 (Supabase, read-only):**

```sql
-- Denominator: verified lip_care with an ingredient list, untinted (tint/liner/glaze/gloss/color/
-- matte/remover/plump/volumizing subcategories and any colorant on the INCI excluded), Korean brands
-- only (Bepanthol, Bioderma, Blistex, Dr.PAWPAW, Kamill, Mentholatum, Uriage, Vaseline, Sampar excluded).
with l as (select brand_en, ingredients_raw i from ss_products where category='lip_care' and is_verified and length(ingredients_raw)>80
 and coalesce(subcategory,'') !~* '(tint|liner|glaze|gloss|color|matte|remover|plump|volumizing)'
 and ingredients_raw !~* '(CI ?[0-9]{5}|iron oxide|red ?[0-9]|yellow ?[0-9]|blue ?[0-9]|\mmica\M|tetrabromofluorescein|phloxine|carmine)'
 and brand_en not in ('Bepanthol','Bioderma','Blistex','Dr.PAWPAW','Kamill','Mentholatum','Uriage','Vaseline','Sampar'))
select count(*) n,
 count(*) filter (where i ~* '(fragrance|parfum|flavor|aroma)') frag,
 count(*) filter (where i ~* '(fragrance|parfum|flavor|aroma|limonene|linalool|citral|geraniol|citronellol|eugenol|coumarin|cinnamal|menthol|mentha[^,]*oil|peel oil|lavandula[^,]*oil|rosmarinus[^,]*oil|citrus[^,]*oil|bergamia|melaleuca[^,]*oil|eucalyptus[^,]*oil|camphor)') frag_broad,
 count(*) filter (where i ~* 'ceramide') cer,
 count(*) filter (where i ~* '(methoxycinnamate|ethylhexyl salicylate|octocrylene|homosalate|avobenzone|butyl methoxydibenzoylmethane|zinc oxide)') uv
from l;
-- n 65 | fragrance/flavor/aroma 24 (37%) | + EO, allergens, menthol, camphor 38 (58%)
-- ceramide 26 (40%) | a sunscreen filter 4 (6%)
```

---

## How to run it

LGAAS → Seoul Sister → Blog Manager → **+ New Blog**. Paste the three fields exactly.

### Field 1: Topic / Title Idea

```
Best Korean lip balm for dry, chapped or sensitive lips: fragrance-free balms, overnight lip masks and lip essences
```

(Why this wording: `deriveProductParams` substring-matches the topic against `CONCERN_TO_CATEGORIES`
in `lgaas/utils/ingredient-context.js`, lines 887-906. **No key maps to lip care**; the category
`lip_care` is unreachable from the topic. The words that match here are `dry: ['moisturizer',
'essence', 'ampoule']` and `sensitive: ['toner', 'moisturizer', 'essence']`. They are there only so
the fetch returns SOME products: if it returns zero, `api/content-blog.js` (lines ~1671-1678) injects
"No products were retrieved... Do not name specific products", which would contradict the picks in
Field 3. The auto-fetched products are face products and are not picks.)

### Field 2: Target Keyword (SEO)

```
Ceramide NP
```

(This field is looked up as an INCI ingredient via `fetchIngredientContext`, which pulls the
`/ingredients/ceramide-np` page into context. Five of the eight picks list it. **This line is NOT the
SEO keyword**; the real one is set in Field 3.)

### Field 3: Additional Context

Paste everything inside the block.

```
TITLE: start the H1 with "Best Korean Lip Balm".

POST JOB: a PICK LIST by lip need, with named products, a link to each one's live price, and the ingredients that justify each pick. It is NOT a lip anatomy explainer. Inside the required "What Actually Works" section, the four needs ARE the four strategies: one bold title per need (Everyday dry lips: fragrance-free balms; Lips that crack overnight: lip sleeping masks; Glossy daytime moisture: lip essences; The famous ones: what is actually on the label), two picks each. Keep the 8-row comparison table inside that section.

PRIMARY KEYWORD: return primaryKeyword = "best korean lip balm". The "Target Primary Keyword: Ceramide NP" line above this block was used to pull an ingredient page into context only; it is NOT the SEO keyword. Do NOT use "Ceramide NP" as the primary keyword. Secondary keywords: "korean lip balm", "korean lip sleeping mask", "fragrance free korean lip balm", "korean lip balm for chapped lips".

WHY LIPS DRY OUT (keep to one short paragraph in "Why This Happens"): lips have a much thinner outer layer than facial skin and no oil glands, so they lose water fast; a balm works by sealing (waxes, butters, petrolatum, oils), and what irritates them most often is what is added for taste and smell. Do not invent statistics for this.

SEOUL SISTER FIRST-PARTY DATA (attribute these plainly to Seoul Sister's own catalog, checked October 2026; never hedge them as "floating around" or "you may have seen"):
- Of 65 verified, untinted lip balms, lip masks and lip essences from Korean brands with an ingredient list in Seoul Sister's catalog, 37% list fragrance, flavor or aroma. Counting essential oils, fragrance allergens (limonene, linalool, citral, geraniol, citronellol) and menthol or camphor, it is 58%.
- 40% list at least one ceramide.
- Only 4 of the 65 list a sunscreen filter. So a lip balm is not sun protection unless it says SPF; in daytime sun, use a lip product labeled with SPF.
Land the fragrance figure at the top of the first strategy; it is the strongest fact in the post. Land the SPF figure in the Bottom Line or FAQ.

PRODUCTS FROM DATABASE (Seoul Sister catalog, verified ingredient lists, checked October 13, 2026). These 8 are the ONLY products in this post. A SECOND block below, also titled "PRODUCTS FROM DATABASE" and followed by "PRODUCT INTEGRATION RULES", lists face moisturizers, essences or toners auto-fetched by category. None of them are lip products and none appear in this post. Those integration rules apply ONLY to the 8 picks above. Use the exact names. NEVER write a price or dollar figure (standing Seoul Sister rule: prices in prose go stale). Link each product as "[see the current price](/products/<id>)" using its page below.

EVERYDAY DRY LIPS (fragrance-free balms; open this strategy with the fragrance figure):
1. Illiyoon Ceramide Unscented Vegan Lip Balm, 3.2g. /products/da48bc54-61ac-4de5-b008-0d796f1451a9
   Ingredients that justify it: shea butter, squalane, candelilla wax, ceramide NP, phytosphingosine, dipotassium glycyrrhizate. No fragrance on the list (it lists rosemary leaf EXTRACT, not rosemary oil).
2. Round Lab Birch Juice Moisturizing Lip Balm, 20g. /products/92c046c3-e282-433f-aa8a-63fca2de609d
   Ingredients: squalane, jojoba seed oil, macadamia seed oil, sweet almond oil, argan kernel oil, olive fruit oil, birch juice, sodium hyaluronate. No fragrance on the list. SAY: it contains sweet almond and macadamia oils, which matters if you avoid nut-derived oils.

LIPS THAT CRACK OVERNIGHT (lip sleeping masks, the last step at night):
3. COSRX Balancium Ceramide Lip Butter Sleeping Mask, 20g. /products/54035d6b-689a-4575-bb66-ae11607210fc
   Ingredients: shea butter is the second ingredient, with coconut oil, castor seed oil, jojoba seed oil, mango seed butter, beeswax, ceramide NP, phytosphingosine. No fragrance on the list. SAY: it contains beeswax, so it is not vegan.
4. Dermatory Hyalluron Peptide Volume Lip Mask Balm, two tubes (10ml + 10ml). /products/feac32d4-3ce4-4dc1-aac0-57f78dd638d3
   Ingredients: castor seed oil, panthenol, allantoin, sodium hyaluronate, ceramide NP, plus five peptides (copper tripeptide-1, palmitoyl pentapeptide-4, acetyl hexapeptide-8, palmitoyl tetrapeptide-7, palmitoyl tripeptide-1). No fragrance on the list. SAY: "Volume" is in the product name, but nothing on the list is a plumping or tingling agent, so do not expect plumping. Say it comes as two tubes.

GLOSSY DAYTIME MOISTURE (lip essences, thinner and shinier than a stick):
5. Beplain Milk Ceramide Lip Essence, two tubes (10g + 10g). /products/c45a2ff6-ecfa-4ebc-b65e-ec707dfc6bec
   Ingredients: petrolatum, shea butter, jojoba seed oil, meadowfoam seed oil, rice bran oil, ceramide NP (40ppm), phytosphingosine, panthenol, niacinamide. No fragrance on the list. Say it comes as two tubes.
6. Anua PDRN Lip Serum, 10mL. /products/53127af7-68fc-46c9-8513-5eee98893ca4
   Ingredients: the "PDRN" is listed as sodium DNA (10ppm), with jojoba seed oil, ceramide NP, panthenol, and hydrolyzed collagen. No fragrance on the list (it lists rose flower EXTRACT, not rose oil). SAY plainly: the "PDRN" is sodium DNA at 10ppm (0.001%) and the hyaluronic acid is 0.01ppm, so treat it as a glossy occlusive serum, not an active treatment. Link /blog/what-is-pdrn-skincare-really-why-salmon-dna-and-pdrn-are for why PDRN usually appears as "sodium DNA". Do not claim PDRN does anything specific for lips.

THE FAMOUS ONES: WHAT IS ACTUALLY ON THE LABEL:
7. FORMENT Hidden Lipbalm, 3.6g. /products/dd69cc95-4ee0-4f85-bbe2-6ea9f507920e
   Ingredients: paraffin, shea butter, argan kernel oil, cocoa seed butter, tocopheryl acetate. SAY: it lists fragrance; skip it if scented products sting your lips.
8. Laneige Lip Sleeping Mask EX, 20g. /products/b9a0f92a-71e7-48a5-95dd-794e487b953f
   The one most readers already own. Its ingredient list includes fragrance, limonene, linalool, mica, titanium dioxide and two dyes (Brilliant Blue FCF, Quinoline Yellow WS). SAY: if it works for you, keep it; if your lips sting, those are the usual suspects. Make PRESENCE claims only: never say it lacks or does not contain anything.

COMPARISON TABLE: columns Product | Lip need | Format | Fragrance or essential oils on the list | Ceramide on the list. No price column.
TABLE VALUES (use exactly):
- Format: "Balm" for Illiyoon, Round Lab, FORMENT; "Overnight mask" for COSRX, Dermatory and Laneige; "Essence" for Beplain; "Serum" for Anua.
- Fragrance/EO: "Yes" for FORMENT; "Yes, plus fragrance allergens and dyes" for Laneige; "No" for the other six.
- Ceramide: "Yes" for Illiyoon, COSRX, Dermatory, Beplain, Anua; "No" for Round Lab and FORMENT; "Not stated" for Laneige.

INTERNAL LINKS (all verified live; use these exact paths, no others):
/best/lip-care
/ingredients/ceramide-np
/ingredients/phytosphingosine
/ingredients/shea-butter
/ingredients/squalane
/ingredients/petrolatum
/ingredients/panthenol
/ingredients/sodium-dna
/ingredients/beeswax
/ingredients/fragrance
/ingredients/linalool
/blog/what-is-pdrn-skincare-really-why-salmon-dna-and-pdrn-are
/blog/korean-sunscreen-vs-american-sunscreen-why-k-beauty-sunscreens-are-taking-over-tiktok
plus each product page listed above.

YURI: dry lips that never improve are often something in the routine (a scented balm, a toothpaste, licking, a retinoid creeping onto the lip line). Close by saying that to work out what is drying your lips and which of these fits, tap Ask Yuri on this page, which opens a free chat (no account needed). Yuri is Seoul Sister's AI advisor. Do not describe Yuri as a dermatologist or as medical advice.

DOCTOR LINE (one sentence, once, not repeated as hedging): a sore on the lip that will not heal, bleeds, or has spreading crusting needs a doctor, not a balm.

HARD RULES (this route has no automatic fact-checker, so these are mandatory):
- Do NOT add any product beyond the 8 above, and do NOT claim any ingredient in a product beyond the notes above.
- Laneige: presence claims from the notes only, no "does not contain", no review count. Do NOT name Some By Mi, Etude, Torriden or any tinted lip product with a review count or ingredient claim. If you mention that famous lip masks exist, do it without numbers or ingredient claims.
- Do NOT recommend any product as a lip sunscreen and do NOT state any SPF number.
- Do NOT write any price or dollar figure anywhere, including the table and FAQ.
- Do NOT quote review counts or star ratings for any product.
- Retailers: Olive Young and Soko Glam only. NEVER name YesStyle, Stylevana, StyleKorean, Amazon or eBay.
- No em-dashes anywhere.
- No medical claims: nothing "treats", "heals", "cures" or "repairs" cheilitis, cold sores or cracked lips; no "dermatologist-recommended", no "clinically proven"; no plumping or "fuller lips" claims.
- Do not invent texture, taste or feel beyond balm, overnight mask, essence and serum. Do not call any pick "best for everyone".
- Do not say Yuri can look at a photo or scan a label in the free chat, and do not call the chat unlimited; say "free chat, no account needed" and nothing more.
- Korean products only; do not recommend Western brands in this post.
```

---

## After it generates (2-minute review, `BLOG-PRE-PUBLISH-CHECKLIST.md`)

0. **Before publishing:** generate the hero image in Blog Manager before Sync to Site, or the post
   ships with no featured image.
1. Every product named is one of the 8, and NO dollar figure appears anywhere (body, table, FAQ, meta).
2. Grep the draft for: YesStyle, Amazon, eBay, Stylevana, StyleKorean, em-dash (—), "dermatologist",
   "clinically", "heals", "treats", "plump", "SPF" next to any product name, any review count.
3. The first-party figures appear AS Seoul Sister's, with "October 2026"; the "4 of 65 list a
   sunscreen filter" line is present and no product is called sun protection.
4. FORMENT and Laneige state their fragrance (Laneige presence-only, no "does not contain"); Anua states 0.001% sodium DNA; Dermatory does not promise volume;
   Round Lab mentions the nut oils; COSRX says beeswax.
5. The doctor line appears once and only once.
6. FAQs count is not 0; Quick Answer is a clean question; meta description matches the title.
7. Primary keyword is "best korean lip balm", not "Ceramide NP".
8. The Yuri line reads "tap Ask Yuri on this page, which opens a free chat (no account needed)".

## After it publishes (Claude does these)

1. Set the opener if LGAAS did not write one, or compare with LGAAS's:
   proposed `yuri_opener` (16 words): **"My lips stay dry and peeling no matter which balm I use. What should I change?"**
   `UPDATE ss_content_posts SET yuri_opener = '<opener>' WHERE slug = '<new slug>';`
2. curl the live page: 200, FAQPage present, every internal link 200.
3. Grade at 28 and 56 days: GSC impressions/position for "best korean lip balm" and "korean lip
   balm", and `select count(*) from ss_widget_sessions where landing_path = '/blog/<new slug>'`.

## Dropped in selection (for a later post or for the reviewer)

- Laneige Lip Sleeping Mask EX (1,298 reviews): INCI ends in a trailing comma, possibly truncated;
  also lists fragrance, limonene, linalool and two dyes. Re-check the full list before ever citing it.
  Its non-EX sibling and Lip Glowy Balm rows have no price row.
- Torriden Cellmazing Low Molecular Collagen Lip Essence Double Pack (442): INCI ends in a trailing
  comma ("1,2-Hexanediol,").
- Some By Mi V10 Hyal Lip Sun Protector (three rows): no SPF value in the catalog; citrus peel oils,
  limonene, citral.
- GRAFEN, TOCOBO Lip Balm Collection, Dasique, Melixir Vegan Lip Butter and similar: multi-shade
  concatenated INCI (3,900 to 21,000 characters) or tinted makeup mis-filed as lip balm.
- Skinfood Avocado Stick Lip Balm: fragrance plus hexyl cinnamal, geraniol, linalool.
- Abib PDRN Collagen Lip Mask Glazed Jelly: fragrance and iron oxide (tinted).
- Mentholatum, Blistex, Bepanthol: Western brands.
