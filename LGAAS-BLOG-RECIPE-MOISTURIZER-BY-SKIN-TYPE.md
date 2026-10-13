# LGAAS Blog Recipe: Korean Moisturizer by Skin Type

**Status:** READY. Adversarially reviewed by Fable 5.1 on Oct 12 2026 (11 defects found and fixed: picks cut 16 to 8 to fit the route's mandated structure, pick heading renamed so the route's grounding rule honors it, a false "no ceramide" on Lagom, a truncated INCI on Aestura, "Korean" overclaim in the stats, primary-keyword collision). **Prices as of Oct 12 2026.** If you run this after
**Oct 26 2026**, ask Claude to re-check prices and stock first; prices in prose drift (see
`project_blog_price_drift_class`).

**Why this post:** Google Search Console, Sep 11 to Oct 8 2026: about 615 impressions a month across
"best korean moisturizer" (277, position 27), "korean moisturizer" (145, pos 28), "best moisturizer
korean" (126, pos 32), "moisturizer korea" (67, pos 46). No post ranks; only `/best/moisturizers`
does, badly. It is also the "which one is right for ME" shape, the only blog shape that has turned
readers into Yuri chats (sunscreen post: 20 sessions, 3 chats).

**Not cannibalizing:** `/blog/korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs`
(Sep 3) is the DIAGNOSTIC post (damaged vs dehydrated, humectant/occlusive theory). This new one is
the PICK LIST. It links there for diagnosis and does not re-teach the theory.

---

## How to run it

LGAAS → Seoul Sister → Blog Manager → **+ New Blog**. Paste the three fields exactly. Picks dropped in review (Aestura Cica-Some, COSRX Oil Free, Torriden Dive-In, iUNIK, Aestura Aepiderm, Lagom Cellus, Dr. Althea 345, Etude SoonJung) are in the data pack for a later post.

### Field 1: Topic / Title Idea

```
Best Korean moisturizer for your skin type: picks for dry, sensitive and barrier damage, plus gel creams for oily and combination skin
```

(Contains "dry", "sensitive" and "barrier damage" so LGAAS fetches moisturizers. The auto-fetch
returns poor products, which is why the real picks are in Field 3.)

### Field 2: Target Keyword (SEO)

```
Ceramide NP
```

(This field is looked up as an INCI ingredient, which pulls the `/ingredients/ceramide-np` page into
context. The real SEO keyword is set in Field 3.)

### Field 3: Additional Context

Paste everything inside the block.

```
TITLE: start the H1 with "Best Korean Moisturizer for Your Skin Type".

POST JOB: a PICK LIST by skin type, with named, priced, dated products and the ingredients that
justify each pick. It is NOT a moisturizer theory explainer. Inside the required "What Actually
Works" section, the four skin types ARE the four strategies: one bold title per skin type, two picks
each. Keep the 8-row comparison table inside that section.

PRIMARY KEYWORD: return primaryKeyword = "korean moisturizer for your skin type". The "Target Primary
Keyword: Ceramide NP" line above this block was used to pull the ingredient page into context only;
it is NOT the SEO keyword. Do NOT use "best korean moisturizer" or "Ceramide NP" as the primary
keyword. Secondary keywords: "best korean moisturizer for oily skin", "best korean moisturizer for dry
skin", "best korean moisturizer for combination skin", "best korean moisturizer for sensitive skin".

LINK FOR DIAGNOSIS, DO NOT RE-TEACH: early in the post, send readers who are not sure whether their
skin is dry, dehydrated or barrier-damaged to
/blog/korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs and
/blog/how-to-figure-out-your-skin-type-for-korean-skincare. Do NOT explain humectants vs occlusives,
the "hydrator trap", or the ceramide brick-wall analogy; that post already does.

SEOUL SISTER FIRST-PARTY DATA (attribute these plainly to Seoul Sister's own catalog, checked
October 12, 2026; never hedge them as "floating around" or "you may have seen"):
- Seoul Sister tracks about 900 verified moisturizers, nearly all Korean.
- Of 884 verified moisturizers with a full ingredient list in Seoul Sister's catalog (about 95% Korean
  brands), 44% list at least one ceramide, but only 18% list a ceramide AND cholesterol together.
- 27% list "fragrance" or "parfum". Counting fragrant essential oils and fragrance allergens
  (limonene, linalool, citral, citrus peel, lavender or sage oil) it is 44%. So "calming" on the
  front does not mean unscented: read the list.
- The median Olive Young price of an in-stock, single-unit moisturizer in the catalog is $28.
Land the fragrance figure in the sensitive-skin strategy; it is the strongest fact in the post.

PRODUCTS FROM DATABASE (Seoul Sister catalog, verified ingredient lists, checked October 12, 2026).
These 8 are the ONLY products in this post. Any product appearing in an "Available products" or
internal-linking list below was auto-fetched by category and is NOT a pick; do not name it. Use the
exact names. Quote each price WITH "as of October 2026". Link each to its Seoul Sister page.

OILY (light gel bases):
1. Beauty of Joseon Red Bean Water Gel, 100ml. $18 at Olive Young. /products/29c6a30c-695e-4a87-bd42-b4249d83bbd9
   Ingredients that justify it: red bean (Vigna Angularis) seed extract is the first ingredient; glycerin, betaine, panthenol, allantoin. No fragrance on the list.
2. Isntree Hyaluronic Acid Aqua Gel Cream, 100ml. $22.20 at Olive Young. /products/d198a1fb-4ca6-45db-b5da-ed637fca4af6
   Ingredients: sodium hyaluronate plus hydrolyzed hyaluronic acid, centella asiatica extract, sodium PCA. No fragrance on the list.

COMBINATION:
3. SKIN1004 Madagascar Centella Soothing Cream, 75ml. $17 at Olive Young. /products/1bf18471-7fdf-4748-bf54-6161577680f1
   Ingredients: centella asiatica extract is 72% of the formula, with four ceramides (EOP, NS, NP, AP), phytosphingosine and cholesterol. SAY: it contains peppermint leaf extract, so skip it if your skin is reactive.
4. Purito Seoul Oat-In Calming Gel Cream, 100mL. $15.60 at Olive Young. /products/bd1ce1b5-6e26-4bf0-985d-d5565681a6eb
   Ingredients: oat seed water is 77%, with squalane, panthenol, beta-glucan. No fragrance on the list. (This is the Gel Cream, still sold. It is NOT the discontinued Oat-in Intense Cream.)

DRY:
5. S.Nature Aqua Squalane Moisturizing Cream Special Set (60ml + 30ml). $18.90 for the set at Olive Young. /products/da6aa851-617e-4849-b9f4-a8863d1fe2ed
   Ingredients: squalane at 150,000ppm (15%), glycerin, betaine, panthenol, sodium hyaluronate. No fragrance on the list. Say it is a set.
6. Anua Rice 70 Intensive Moisturizing Milk, 150ml. $19.99 at Olive Young. /products/1689aad0-c15a-4f07-841a-9a92e303a524
   Ingredients: rice bran water 71%, meadowfoam seed oil, ceramide NP, cholesterol, niacinamide. A milk texture for people who hate heavy creams. No fragrance on the list.

SENSITIVE / BARRIER-DAMAGED (open this strategy with the fragrance figure):
7. Dr. Jart+ Power Derma Barrier Cream Set (80mL + 7mL). $23.30 for the set at Olive Young. /products/31594279-c1d7-4c11-b4bd-85503763ca3e
   Ingredients: panthenol, dipotassium glycyrrhizate, sodium hyaluronate, ceramide NP. No fragrance on the list. Say it is a set; do NOT call $23.30 the price of a single tube.
8. Purito Seoul Wonder Releaf Centella Cream Unscented, 50mL. $16.80 at Olive Young. /products/9beab671-f72b-49eb-8b71-284444f1c7a7
   Ingredients: centella asiatica extract (about 3%), niacinamide, ceramide NP, madecassic acid, asiaticoside, squalane. No fragrance on the list.

COMPARISON TABLE: columns Product | Skin type | Texture | Price (Oct 2026) | Fragrance or essential oils on the list | Ceramide on the list.
TABLE VALUES (use exactly):
- Fragrance/EO: "No, but peppermint leaf extract" for SKIN1004; "No" for the other seven.
- Ceramide: "Yes" for SKIN1004, Anua, Dr. Jart+, Purito Wonder Releaf; "No" for Beauty of Joseon, Isntree, Purito Oat-In, S.Nature.
- Texture: gel (Beauty of Joseon, Isntree, Purito Oat-In), cream (SKIN1004, S.Nature, Dr. Jart+, Purito Wonder Releaf), milk (Anua).

INTERNAL LINKS (all verified live; use these exact paths, no others):
/best/moisturizers
/ingredients/ceramide-np
/ingredients/panthenol
/ingredients/centella-asiatica-extract
/ingredients/squalane
/ingredients/sodium-hyaluronate
/blog/korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs
/blog/how-to-figure-out-your-skin-type-for-korean-skincare
/blog/how-to-tell-if-your-skin-barrier-is-damaged-real-signs
plus each product page listed above.

YURI: most people are two of these types at once (oily T-zone and dry cheeks; dry AND reactive).
Close by saying Yuri, Seoul Sister's AI advisor, can tell you which of these fits your actual skin in
a free chat with no signup. Do not describe Yuri as a dermatologist or as medical advice.

HARD RULES (this route has no automatic fact-checker, so these are mandatory):
- Do NOT add any product beyond the 8 above, and do NOT claim any ingredient in a product beyond the
  notes above.
- Do NOT name Illiyoon, Aestura, Real Barrier, COSRX Balancium or Purito Dermide with a price or
  review count. If you mention that famous barrier creams exist, do it without numbers.
- Do NOT quote review counts or star ratings for any product.
- Retailers: Olive Young and Soko Glam only. NEVER name YesStyle, Stylevana, StyleKorean, Amazon or eBay.
- No em-dashes anywhere.
- No medical claims: nothing "treats", "heals" or "repairs" eczema, rosacea or acne; no
  "dermatologist-recommended", no "clinically proven". If skin is cracked, bleeding, or a rash is
  spreading, say to see a doctor.
- Do not call any pick "best for everyone". Do not invent texture claims beyond gel, cream, milk.
- Korean products only; do not recommend Western brands in this post.
```

---

## After it generates (2-minute review, `BLOG-PRE-PUBLISH-CHECKLIST.md`)

0. **Before publishing:** generate the hero image in Blog Manager before Sync to Site, or the post
   ships with no featured image.
1. Every product named is one of the 8, with the right price and "as of October 2026".
2. Grep the draft for: YesStyle, Amazon, eBay, Stylevana, StyleKorean, em-dash (—), "dermatologist",
   "clinically", "heals", "treats", any review count.
3. The four first-party figures appear AS Seoul Sister's, with the date.
4. FAQs count is not 0; Quick Answer is a clean question; meta description matches the title.
5. It links to the diagnostic post and does not re-teach humectant/occlusive theory.
6. Primary keyword is "korean moisturizer for your skin type", not "Ceramide NP".

## After it publishes (Claude does these)

1. Apply `supabase/migrations/20261012000001_blog_yuri_opener.sql` first (if not already), then set
   the opener (LGAAS cannot send it yet):
   `UPDATE ss_content_posts SET yuri_opener = 'I have oily skin in some spots and dry in others. Which Korean moisturizer fits that?' WHERE slug = '<new slug>';`
2. curl the live page: 200, FAQPage present, every internal link 200.
3. Move the old post off the shared keyword (it earns no moisturizer impressions; every GSC row is
   `/best/moisturizers`), here AND in `lgaas_blog_posts` so LGAAS doesn't overwrite it:
   `UPDATE ss_content_posts SET primary_keyword = 'korean barrier cream' WHERE slug = 'korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs';`
   That old post also recommends two products with no price row and one now out of stock; queue a
   revision.
4. Grade at 28 and 56 days: GSC impressions/position for the four moisturizer queries, and
   `select count(*) from ss_widget_sessions where landing_path = '/blog/<new slug>'`.
