# LGAAS Blog Recipe: Best Korean Face Masks by Skin Concern

**Status:** READY. Adversarially reviewed by Fable 5.1 on Oct 13 2026 (6 defects fixed: Beplain Mung Bean, a six-essential-oil scrub clay, replaced by Isntree Mugwort; LGAAS heading collision; APLB 0.1% framing; SKIN1004 gelling-agent wording; listing-count wording; Yuri capability guard). Pack sizes verified against the catalog volume field. Modeled on
`LGAAS-BLOG-RECIPE-MOISTURIZER-BY-SKIN-TYPE.md`. **No prices in the post** (standing rule
`lgaas/LGAAS-WORK-ORDER-NEVER-QUOTE-PRICES.md`). Stock and price freshness checked Oct 13 2026 (every
pick has an in-stock Olive Young row checked Oct 1 to Oct 13). If you run this after Nov 1, ask Claude
to re-check all 8 picks are still in stock.

**Why this post:** Google Search Console, Sep 11 to Oct 8 2026: about 167 impressions a month across
"best korean face mask" (76, position 49), "korean mask" (46, pos 10.5), "korean face masks" (45,
pos 34). No post ranks; only `/best/masks` does. Same "which one is right for ME" shape as the
moisturizer and sunscreen posts.

**Cannibalization check (ss_content_posts, Oct 13):** no existing post targets masks. The only hit
for mask/sheet/lip in title, slug, primary_keyword or body was
`the-7-minute-k-beauty-routine-that-actually-sticks` (primary keyword "minimalist korean skincare
routine"), which mentions sheet masks in passing. Not a conflict.

**First-party figures, computed live Oct 13 2026 (Supabase, read-only):**

```sql
-- Denominator: verified masks with an ingredient list, excluding pads, patches, strips,
-- bands, nose/eye/neck/cheek products, kits, sets, films and V-line masks.
with m as (
 select subcategory, ingredients_raw i,
  case when subcategory ~* '(sheet|gel mask|hydrogel mask|bio-cellulose|ampoule mask|cream mask|collagen mask|gauze mask|jelly mask|cooling mask|hydrating mask)' then 'sheet'
       when subcategory ~* '(sleeping|overnight)' then 'leave_on'
       when subcategory ~* '(clay|mud|wash|modeling|bubble|peel|scrub|foam|salt|sherbet|splash|pore mask|pore tightening)' then 'rinse_or_peel'
       else 'other' end typ
 from ss_products where category='mask' and is_verified and ingredients_raw is not null and length(ingredients_raw) > 80
   and subcategory !~* '(pad|patch|strip|band|nose|eye|neck|cheek|kit|set|film|v-l)' )
select coalesce(typ,'ALL') typ, count(*),
 round(100.0*count(*) filter (where i ~* '(fragrance|parfum)')/count(*)) frag_pct,
 round(100.0*count(*) filter (where i ~* '(fragrance|parfum|limonene|linalool|citral|geraniol|citronellol|eugenol|lavandula[^,]*oil|peel oil|rosmarinus[^,]*oil|salvia[^,]*oil|pelargonium[^,]*oil|mentha[^,]*oil|melaleuca[^,]*leaf oil|anthemis[^,]*oil|chamomilla[^,]*oil|rosa[^,]*flower oil|juniperus[^,]*oil|abies[^,]*oil|pogostemon[^,]*oil|artemisia[^,]*oil|cymbopogon[^,]*oil|eucalyptus[^,]*oil|citrus[^,]*oil|bergamia)')/count(*)) frag_eo_pct,
 round(100.0*count(*) filter (where i ~* '^\s*(purified )?water')/count(*)) water_first_pct
from m group by rollup(typ) order by 1;
-- ALL 777 | frag 33% | frag+EO 62% | water first 73%
-- sheet 575 (74% of 777) | frag 32% | frag+EO 61% | water first 78%
-- rinse_or_peel 154 | leave_on 38 | other 10
```

---

## How to run it

LGAAS → Seoul Sister → Blog Manager → **+ New Blog**. Paste the three fields exactly.

### Field 1: Topic / Title Idea

```
Best Korean face masks by skin concern: sheet masks for dry and sensitive skin, clay masks for oily skin and pores, and glow masks for dull skin
```

(Why this wording: `deriveProductParams` substring-matches the topic against `CONCERN_TO_CATEGORIES`
in `lgaas/utils/ingredient-context.js`, lines 887-906. **No key maps to masks**; the category
`mask` is unreachable from the topic. The words that match here are `dry: ['moisturizer', 'essence',
'ampoule']`, `sensitive: ['toner', 'moisturizer', 'essence']`, `oily: ['cleanser', 'toner',
'sunscreen']` and `pores: ['toner', 'serum', 'exfoliator']`. They are there only so the fetch returns
SOME products: if it returns zero, `api/content-blog.js` (lines ~1671-1678) injects "No products were
retrieved... Do not name specific products", which would contradict the picks in Field 3. The
auto-fetched products are not masks and are not picks.)

### Field 2: Target Keyword (SEO)

```
Centella Asiatica Extract
```

(This field is looked up as an INCI ingredient via `fetchIngredientContext`, which pulls the
`/ingredients/centella-asiatica-extract` page into context. Three of the eight picks list it. **This
line is NOT the SEO keyword**; the real one is set in Field 3.)

### Field 3: Additional Context

Paste everything inside the block.

```
TITLE: start the H1 with "Best Korean Face Masks".

POST JOB: a PICK LIST by skin concern, with named products, a link to each one's live price, and the ingredients that justify each pick. It is NOT a "what is a sheet mask" explainer and NOT a 10-step routine post. Inside the required "What Actually Works" section, the four skin concerns ARE the four strategies: one bold title per concern (Dry or dehydrated; Sensitive or redness-prone; Oily or congested pores; Dull-looking: hydration plus a gentle polish), two picks each. Keep the 8-row comparison table inside that section.

PRIMARY KEYWORD: return primaryKeyword = "best korean face mask". The "Target Primary Keyword: Centella Asiatica Extract" line above this block was used to pull an ingredient page into context only; it is NOT the SEO keyword. Do NOT use "Centella Asiatica Extract" as the primary keyword. Secondary keywords: "korean face masks", "korean sheet mask for dry skin", "korean clay mask for oily skin", "korean mask for sensitive skin".

FRAME: a mask is a short, occasional boost on top of a routine, not a replacement for moisturizer or sunscreen. Say this once, plainly. Explain the three types in one short paragraph each at most: single-use sheet masks (leave on, then pat in what is left), overnight or sleeping masks (the last step at night, leave on), and wash-off clay or scrub masks (rinse off). Send readers unsure of their skin type to /blog/how-to-figure-out-your-skin-type-for-korean-skincare.

SEOUL SISTER FIRST-PARTY DATA (attribute these plainly to Seoul Sister's own catalog, checked October 2026; never hedge them as "floating around" or "you may have seen"):
- Of 777 verified face-mask listings with an ingredient list (some products appear more than once as different pack sizes) in Seoul Sister's catalog (sheet, overnight and wash-off masks; pads and patches not counted), 575, about three in four, are single-use sheet or gel masks.
- 33% list "fragrance" or "parfum". Counting essential oils and fragrance allergens (limonene, linalool, citral, citrus peel, lavender, rosemary or tea tree oil and similar) it is 62%. So "calming" or "cica" on the front does not mean unscented: read the list.
- 78% of those sheet masks list water as the first ingredient, so the serum soaked into the sheet is mostly water plus humectants; the ingredients after the first few lines are what make one mask different from another.
Land the fragrance figure in the sensitive-skin strategy; it is the strongest fact in the post.

PRODUCTS FROM DATABASE (Seoul Sister catalog, verified ingredient lists, checked October 13, 2026). These 8 are the ONLY products in this post. A SECOND block below, also titled "PRODUCTS FROM DATABASE" and followed by "PRODUCT INTEGRATION RULES", lists moisturizers, toners, cleansers or sunscreens auto-fetched by category. None of them are masks and none appear in this post. Those integration rules apply ONLY to the 8 picks above. Use the exact names. NEVER write a price or dollar figure (standing Seoul Sister rule: prices in prose go stale). Link each product as "[see the current price](/products/<id>)" using its page below.

DRY OR DEHYDRATED:
1. Round Lab 1025 Dokdo Hydrating Water Gel Mask Sheet, pack of 10 sheets (30ml each). /products/af79ad09-62ac-444e-9043-6b44ac917a79
   Ingredients that justify it: glycerin, sea water, eight forms of hyaluronic acid on one list (including sodium hyaluronate, hydrolyzed hyaluronic acid and sodium hyaluronate crosspolymer), panthenol, betaine, allantoin, dipotassium glycyrrhizate. No fragrance on the list. Single-use sheet.
2. COSRX Ultimate Nourishing Rice Overnight Spa Mask, 60ml. /products/f1baa7d3-3e12-4068-9b1c-05f0d89d37f2
   Ingredients: rice (Oryza Sativa) extract is the first ingredient; glycerin, sunflower seed oil, betaine, niacinamide, dimethicone, palm and palm kernel oil. No fragrance on the list. Overnight leave-on mask, the last step at night.

SENSITIVE OR REDNESS-PRONE (open this strategy with the fragrance figure):
3. Cell Fusion C Cica Cooling Mask Sheet, 1 sheet (27g). /products/4a6994c0-ab52-44ed-b4f3-a582d5386063
   Ingredients: centella asiatica extract is the second ingredient, plus centella leaf, root and flower/leaf/stem extracts, madecassoside, asiaticoside, sodium hyaluronate, panthenol, allantoin, trehalose. No fragrance on the list. SAY: the "cooling" comes from methyl diisopropyl propionamide, a synthetic cooling agent on the list.
4. ma:nyo Bifida Biome Ampoule Mask Sheet Intensive Recovery, 1 sheet (30g). /products/0ab521af-4af9-4792-880d-19eb95a9071f
   Ingredients: bifida ferment lysate (10,000ppm, which is 1%), niacinamide, ceramide NP, panthenol, madecassoside, hyaluronic acid, licorice root extract. No fragrance on the list. SAY: it also lists witch hazel water.

OILY OR CONGESTED PORES (wash-off clay):
5. SKIN1004 Madagascar Centella Poremizing Quick Clay Stick Mask, 27g stick. /products/e450d36a-80a7-46f4-86de-766e6c04bf73
   Ingredients: kaolin (18%), bentonite, illite, montmorillonite, calamine, centella asiatica extract (4.9%). No fragrance on the list. SAY: the stick is set with sodium stearate, a soap-type gelling agent that holds the stick shape; it is tinted with titanium dioxide and iron oxide; rinse-off.
6. Isntree Mugwort Calming Clay Mask, 100ml. /products/a1985179-5da3-4d3b-a62d-ce157dfb0fdf
   Ingredients: kaolin (17.4%), bentonite (6%), mugwort (Artemisia Princeps) extract (5%), illite, mugwort leaf powder, panthenol, allantoin, beta-glucan. No fragrance or essential oils on the list. SAY: it lists red bean (Vigna Angularis) seed powder, a mild particle, and cinnamon (Cinnamomum Cassia) bark extract. Wash-off.

DULL-LOOKING (hydration plus a gentle polish):
7. APLB Glutathione Niacinamide Sheet Mask, pack of 10 sheets (25ml each). /products/b54ce570-4eb5-4c9f-9072-dafbd1fa8f20
   Ingredients: centella asiatica extract (13.5%), niacinamide (1,000ppm), glutathione (1,000ppm), squalane, cholesterol, beta-glucan, sodium hyaluronate. No fragrance on the list (it lists tea tree leaf EXTRACT, not tea tree oil). SAY plainly: centella asiatica extract (13.5%) is the real content; niacinamide and glutathione are 0.1% each, so the name promises more than the list delivers. Treat it as a hydrating sheet, not a spot fader.
8. Beauty of Joseon Ground Rice and Honey Glow Mask, 150ml. /products/02658712-cc50-4d3c-a680-338819541546
   Ingredients: kaolin, honey, rice hull powder, rice bran, rice and rice lees extracts, bentonite. No fragrance on the list; it lists menthyl lactate, a cooling agent. SAY: rice hull powder is a gritty scrub particle, so skip it on irritated or broken skin. Wash-off.

COMPARISON TABLE: columns Product | Skin concern | Type | Fragrance or essential oils on the list | Pack. No price column.
TABLE VALUES (use exactly):
- Type: "Sheet" for Round Lab, Cell Fusion C, ma:nyo, APLB; "Overnight (leave on)" for COSRX; "Wash-off clay" for SKIN1004 and Isntree; "Wash-off" for Beauty of Joseon.
- Fragrance/EO: "No (has a cooling agent)" for Cell Fusion C and Beauty of Joseon; "No" for the other six.
- Pack: "10 sheets" for Round Lab and APLB; "1 sheet" for Cell Fusion C and ma:nyo; "60ml" for COSRX; "27g stick" for SKIN1004; "100ml" for Isntree; "150ml" for Beauty of Joseon.

INTERNAL LINKS (all verified live; use these exact paths, no others):
/best/masks
/ingredients/centella-asiatica-extract
/ingredients/sodium-hyaluronate
/ingredients/panthenol
/ingredients/madecassoside
/ingredients/niacinamide
/ingredients/glutathione
/ingredients/kaolin
/ingredients/bentonite
/ingredients/honey
/ingredients/fragrance
/blog/how-to-figure-out-your-skin-type-for-korean-skincare
/blog/how-to-tell-if-your-skin-barrier-is-damaged-real-signs
/blog/best-korean-moisturizer-for-your-skin-type-8-picks-for-dry
plus each product page listed above.

YURI: most people have two of these concerns at once (an oily T-zone with reactive cheeks; dry AND dull). Close by saying that to ask which mask fits your skin and how often to use it, tap Ask Yuri on this page, which opens a free chat (no account needed). Yuri is Seoul Sister's AI advisor. Do not describe Yuri as a dermatologist or as medical advice.

HARD RULES (this route has no automatic fact-checker, so these are mandatory):
- Do NOT add any product beyond the 8 above, and do NOT claim any ingredient in a product beyond the notes above.
- Do NOT name Mediheal, Laneige, Abib, Numbuzin, Anua or VT masks with a review count or ingredient claim. If you mention that famous sheet-mask brands exist, do it without numbers.
- Do NOT write any price or dollar figure anywhere, including the table and FAQ.
- Do NOT quote review counts or star ratings for any product.
- Retailers: Olive Young and Soko Glam only. NEVER name YesStyle, Stylevana, StyleKorean, Amazon or eBay.
- No em-dashes anywhere.
- No medical claims: nothing "treats", "heals", "cures" or "repairs" acne, rosacea, eczema or pigmentation; no "dermatologist-recommended", no "clinically proven"; no "detox", no "shrinks pores", no "brightens in one use". If skin is broken, burning, or a rash is spreading, say to see a doctor.
- Do not invent texture, feel or results beyond the notes (no "instantly plump", no "glass skin overnight"). Do not call any pick "best for everyone".
- Do not tell readers to sheet-mask daily or to stack wash-off clay masks on irritated skin.
- Do not say Yuri can look at a photo or scan a label in the free chat, and do not call the chat unlimited; say "free chat, no account needed" and nothing more.
- Korean products only; do not recommend Western brands in this post.
```

---

## After it generates (2-minute review, `BLOG-PRE-PUBLISH-CHECKLIST.md`)

0. **Before publishing:** generate the hero image in Blog Manager before Sync to Site, or the post
   ships with no featured image.
1. Every product named is one of the 8, and NO dollar figure appears anywhere (body, table, FAQ, meta).
2. Grep the draft for: YesStyle, Amazon, eBay, Stylevana, StyleKorean, em-dash (—), "dermatologist",
   "clinically", "heals", "treats", "detox", "shrinks", any review count, any star rating.
3. The three first-party figures appear AS Seoul Sister's, with "October 2026"; the fragrance figure
   is in the sensitive-skin strategy.
4. Isntree's red bean powder and cinnamon extract are stated; APLB says 0.1% and "hydrating sheet";
   SKIN1004 describes sodium stearate as a gelling agent; Beauty of Joseon warns about the scrub particles.
5. FAQs count is not 0; Quick Answer is a clean question; meta description matches the title.
6. Primary keyword is "best korean face mask", not "Centella Asiatica Extract".
7. The Yuri line reads "tap Ask Yuri on this page, which opens a free chat (no account needed)" and
   never "right here on this page" or "their site's".

## After it publishes (Claude does these)

1. Set the opener if LGAAS did not write one, or compare with LGAAS's:
   proposed `yuri_opener` (19 words): **"My skin is oily in some spots and sensitive in others. Which Korean face mask should I use, and how often?"**
   `UPDATE ss_content_posts SET yuri_opener = '<opener>' WHERE slug = '<new slug>';`
2. curl the live page: 200, FAQPage present, every internal link 200.
3. Grade at 28 and 56 days: GSC impressions/position for the three mask queries, and
   `select count(*) from ss_widget_sessions where landing_path = '/blog/<new slug>'`.

## Dropped in selection (for a later post or for the reviewer)

- SKIN1004 Centella Watergel Sheet Ampoule Mask: INCI garbled ("Glycereth-26Glycerin") and lists
  Mentha Arvensis leaf oil.
- Beauty of Joseon Centella Asiatica Calming Mask: INCI garbled ("Glycereth-26 Butylene Glycol") and
  lists Roman chamomile oil.
- Torriden Cellmazing Vita C mask (10ea row): INCI truncated (ends "Hydrolyzed"); 5ea set row has a
  run-together "Glycereth-26 Panthenol".
- Mediheal Madecassoside Essential Mask Sheet: madecassoside at 50ppm with four essential oils.
- Abib Gummy Sheet Mask Sticker Heartleaf: named "Heartleaf" but no Houttuynia cordata on its INCI
  (name/INCI mismatch; direction not investigated).
- Isntree Mugwort Calming Clay Mask and Pestlo peeling mask: review_count exactly 100 (round).
- COSRX Advanced Snail Mucin Power Sheet Mask: tea tree leaf oil (fine, but cut to keep 8).
- OBgE Pore Zero Mousse Clay Pack: fragrance; Comma Nine clay pack: lavender and bergamot oils.
- Round Lab 1025 Dokdo Moisturizing Water Gel Mask (single, 341 reviews): sibling of pick 1 with a
  duplicated tail in its INCI; another sibling "Hydrating Water Gel Mask" 20ea has 0 reviews.
