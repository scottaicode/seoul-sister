# LGAAS Blog Recipe: Comedogenic Ratings and How to Check an Ingredient Label

**Status:** READY, Nov 9 2026. Science facts checked by an independent agent (Opus) against Fulton 1989
(page scans), Draelos & DiNardo 2006 (abstract), FDA and AAD pages. Adversarially reviewed by Fable:
10 defects found and fixed (contradicting ingredient-page links, a "stop the newest product" rule that
could stop an acne treatment, a product fetch that pushed the writer to name products, an acne-name
statistic that did not reproduce, causal framing of a label count, two primary keywords, four
unverified sentences, the alphabetical Drug Facts exception, a Yuri over-promise, and a rinse-off
claim by implication). **No prices, no product picks** in this post.

**Why this post:** Google Search Console, 28 days to Nov 5 2026: about 133 distinct
"[ingredient] comedogenic (rating)" / "does X clog pores" queries landing on ~95 of our ingredient
pages, 940 impressions (up from 558 eight weeks earlier), average position 8.6, about 7 clicks. No
hub page exists.

**Cannibalization check (ss_content_posts, Nov 9):** no post has a comedogenic or pore-clogging
primary keyword. Ten posts mention "comedogenic" in passing. Not a conflict.

## Verified facts the post may use

| Claim | Status | Source |
|---|---|---|
| The 0-5 grade comes from a rabbit-ear test: ingredient at 10% in propylene glycol, applied 5 days a week for 2 weeks, graded on how severe the follicular plugging was | VERIFIED | Fulton, J Soc Cosmet Chem 40(6):321-333 (1989) |
| Fulton called the rabbit model extremely sensitive: not everything that reacts on it reacts on human skin | VERIFIED | Fulton 1989 |
| Finished products listing high-rated ingredients are not necessarily comedogenic | VERIFIED (small study, 6 subjects, industry funded) | Draelos & DiNardo, J Am Acad Dermatol 54(3):507-12 (2006) |
| Fulton did NOT accept that lower concentrations are automatically safe | VERIFIED | Fulton 1989 |
| Reactions can take weeks to months on human skin (Fulton: up to six months) | VERIFIED | Fulton 1989; human tests run ~4 weeks |
| FDA has no list of approved cosmetic claims; claims must be truthful and not misleading | VERIFIED (FDA does not mention "non-comedogenic" specifically) | fda.gov cosmetics labeling claims |
| AAD tells acne-prone people to use products labeled "non-comedogenic" or "won't clog pores" | VERIFIED | aad.org, acne "habits to stop" |
| US cosmetic ingredients are listed in descending order above 1%, any order at or below 1% | VERIFIED by reviewer | 21 CFR 701.3(a)/(f) |
| US OTC drugs (many acne treatments) list inactive ingredients alphabetically | VERIFIED by reviewer, not re-checked | 21 CFR 201.66(c)(8) |
| Rinse-off products matter less | UNVERIFIABLE. Do NOT state or imply | none found |

Fulton 1989 grades (comedogenicity), read from the table: isopropyl myristate 5, myristyl myristate 5,
laureth-4 5, isopropyl palmitate 4, ethylhexyl palmitate 4, isostearyl isostearate 4, squalane 1,
dimethicone 1, **cetyl palmitate 0**. Coconut OIL is not in the table (it lists coconut BUTTER 4).

## First-party figures (Supabase, Nov 9 2026, read-only; reproduced by the reviewer)

Denominator: 5,240 verified catalog products with an ingredient list over 80 characters. "Flagged" =
`ingredients_raw ~* '(isopropyl myristate|isopropyl palmitate|myristyl myristate|laureth-4|ethylhexyl palmitate|octyl palmitate|isostearyl isostearate)'`.
Sun stick = `name_en ~* 'stick' or subcategory ~* 'stick'`. Oil/balm cleanser = `name_en ~* '(oil|balm)'`.

| Group | Products | Flagged | Share |
|---|---|---|---|
| All | 5,240 | 488 | 9.3% |
| Sun sticks | 72 | 36 | 50% |
| Other sunscreens | 544 | 35 | 6.4% |
| Cleansing oils and balms | 210 | 120 | 57% |
| Other cleansers | 514 | 31 | 6.0% |
| Lip care | 217 | 49 | 22.6% |
| Moisturizers | 894 | 79 | 8.8% |
| Toners | 433 | 8 | 1.8% |

The acne/pore-named comparison was DROPPED: it does not reproduce stably (8.4% to 11.6% depending on
the name regex, on both sides of the 9.3% baseline).

---

## How to run it

LGAAS → Seoul Sister → Blog Manager → **+ New Blog**. Paste the three fields exactly.

### Field 1: Topic / Title Idea

```
Is it comedogenic? What pore-clogging ratings can and can't tell you, and how to read an ingredient label to check for yourself
```

(Deliberately matches NO key in `CONCERN_TO_CATEGORIES` or `PRODUCT_DISCOVERY_KEYWORDS`; verified by
running `deriveProductParams` on it, which returns `{}`. With no products fetched, LGAAS adds its own
"Do not name specific products" block, which agrees with Field 3. Do not add words like acne, oily,
pores, best, top, routine, product or k-beauty to this field.)

### Field 2: Target Keyword (SEO)

```
comedogenic rating
```

### Field 3: Additional Context

Paste everything inside the block.

```
TITLE: start the H1 with "Is It Comedogenic?". Example: "Is It Comedogenic? What Pore-Clogging Ratings Can and Can't Tell You".
Secondary keywords: comedogenic ingredients, does it clog pores, non-comedogenic meaning, comedogenic scale.

WHO IS READING: someone who just searched "[some ingredient] comedogenic rating" because a product gave them small bumps or breakouts, or because they are about to buy one. They want a straight answer about whether the number means anything, and a practical way to check their own products. Many use Korean skincare.

POST JOB: explain where the 0-5 comedogenic scale comes from, what it can and cannot predict, and give a practical way to check a label and your own skin. It is NOT a product pick list. In the "What Actually Works" section, the specifics are the label-reading method and the testing method below, not products.

THE FACTS (use these, do not add other claims about the science):
1. The 0 to 5 grades most lists use come from a 1989 study by James Fulton (Journal of the Society of Cosmetic Chemists). Each ingredient was applied to the inside of a rabbit's ear at 10% strength, 5 days a week for 2 weeks, and graded on how severe the plugging in the follicles was.
2. Fulton himself wrote that the rabbit ear is extremely sensitive and that not everything that reacts on it will react on human skin.
3. A 2006 study by Draelos and DiNardo (Journal of the American Academy of Dermatology) tested finished products that listed high-rated ingredients on people and found they were not necessarily comedogenic. It was a small study (6 people). Describe it as small.
4. Fulton disagreed that a low concentration makes a high-rated ingredient safe. So the honest position is: a high rating is a reason to pay attention, not proof a product will clog YOUR pores, and a low rating is not a guarantee either.
5. Reactions can take weeks to months to show on human skin. A product is not "safe" because nothing happened in the first week.
6. In the US, "non-comedogenic" is a marketing claim. The FDA has no list of approved cosmetic claims; claims only have to be truthful and not misleading. Do NOT say the FDA "bans" or "regulates" the term.
7. The American Academy of Dermatology still advises people with acne to choose products labeled "non-comedogenic" or "won't clog pores". Say this fairly. The message is "the label and the numbers are a starting point, your skin is the final test", NOT "dermatologists are wrong" and NOT "ratings are meaningless".
8. Many comedogenic lists online repeat values that are not in the original study. Example you may use: coconut OIL is often listed as "4 from Fulton", but Fulton's table lists coconut BUTTER, not coconut oil.
9. Fulton's 1989 grades (0 to 5) for the ingredients this post may name: isopropyl myristate 5, myristyl myristate 5, laureth-4 5, isopropyl palmitate 4, ethylhexyl palmitate 4, isostearyl isostearate 4, squalane 1, dimethicone 1. These are the ONLY grades you may quote.

SEOUL SISTER'S OWN DATA (present as Seoul Sister's figures, "as of November 2026", from our catalog of 5,240 Korean skincare products with ingredient lists). Always say products "list" an ingredient. Every time you use these numbers, make clear they count what is printed on the label, not what happens on anyone's face. "Flagged" means: lists at least one of six ingredients Fulton graded 4 or 5 (isopropyl myristate, isopropyl palmitate, myristyl myristate, laureth-4, ethylhexyl palmitate, isostearyl isostearate).
- About 9% of all products list one of the six (488 of 5,240).
- Sun sticks: about half (36 of 72). Other sunscreen formats (creams, fluids, cushions): about 6% (35 of 544). This is a count of labels, not a breakout rate. You may say: if you suspect a sunscreen and it is a stick, the format is worth knowing, since sticks list these far more often. Do NOT say sticks cause breakouts, and do NOT tell readers to avoid any ingredient or format.
- Cleansing oils and balms: 120 of 210 (57%). Other cleansers: about 6%. Do NOT say anything about whether rinsing off makes a difference, in either direction.
- Lip care: 49 of 217 (about 23%). Toners: 8 of 433 (under 2%).
- A product's name is not an ingredient check: words like "acne" or "pore" on the front tell you nothing about the list on the back. Do not attach a number to this point.

PRACTICAL SECTION: how to check.
- Read the full ingredient list on the back, not the claims on the front.
- On a US cosmetic, ingredients above 1% are listed from most to least, so one near the top matters more than one near the end. Exception: a US acne treatment with a "Drug Facts" panel lists its inactive ingredients alphabetically, so order tells you nothing there.
- Look for the six names above. Knowing the six is a starting point, not a complete list.
- Change one product at a time and give it several weeks, sometimes longer, before judging. Keep a note of what you started and when.
- If new small bumps appeared after starting something, the newest product is the first suspect. Exception: if the newest product is an acne treatment (for example a retinoid or benzoyl peroxide) and you were told to expect an adjustment period, ask the pharmacist or doctor who recommended it before stopping it.
- See a dermatologist for painful, deep or scarring acne, or if nothing improves after a few months. Do not name prescription treatments other than the general examples above.

INTERNAL LINKS (all verified live; use 3 to 5, do not invent others):
/ingredients/isopropyl-palmitate
/ingredients/squalane
/ingredients/dimethicone
/blog/sebaceous-filaments-vs-blackheads-how-to-tell-treat
/blog/why-does-my-skincare-keep-making-my-skin-worse
/blog/same-brand-different-formula-why-that-similar-k-beauty-product-just-wrecked-your-skin
/blog/best-cleanser-for-oily-sensitive-acne-prone-skin
Do NOT link to any other /ingredients/ page.

YURI: close by saying that if you can't tell which product is the problem, you can paste the ingredient lists (from the box or the brand's website) into a free chat with Yuri, Seoul Sister's AI advisor, using the Ask Yuri button on this page. It is free to start and needs no account. Do not describe Yuri as a dermatologist or as medical advice. Do not say she can look at a photo or scan a label in the free chat, do not call the chat unlimited, and do not say she already knows every product.

HARD RULES:
- Do NOT quote a 0-5 number for any ingredient except the Fulton grades in this context, and only as "Fulton graded it X in his 1989 rabbit-ear test". Do NOT quote any rating from Seoul Sister's ingredient pages.
- Do NOT name, recommend or criticize any specific product or brand. Category level only.
- Do NOT tell readers to avoid, skip or throw out any ingredient, product or format. The post gives a method, not a blacklist.
- Do NOT write any price or dollar figure.
- Do NOT call anything a scam or say brands are lying. Say "list", not "contain".
- No medical claims: nothing "treats", "cures", "heals" or "prevents" acne. No "dermatologist-recommended", no "clinically proven", no "shrinks pores", no "detox".
- Retailers: none needed. If one is mentioned, Olive Young or Soko Glam only. NEVER YesStyle, Stylevana, StyleKorean, Amazon or eBay.
- No em-dashes anywhere.
- The FAQ must include: "What does comedogenic rating mean?", "Is a comedogenic rating of 2 bad?", "Does non-comedogenic mean it won't clog pores?", "How long does it take for a product to clog pores?". Answer each from the facts above only.
```

---

## After it generates (review before publishing)

0. Generate the hero image before Sync to Site.
1. No product or brand named; no dollar figure; no 0-5 number other than Fulton's, each attributed.
2. Grep: YesStyle, Amazon, eBay, Stylevana, StyleKorean, em-dash (—), "dermatologist-recommended",
   "clinically", "treats", "cures", "shrinks", "scam", "contain", "avoid", "skip", "rinse".
3. AAD described fairly; Draelos study described as small; FDA "no approved list", not "banned".
4. Every figure says "Seoul Sister" and "November 2026" and is framed as a label count.
5. The retinoid/benzoyl peroxide exception and the Drug Facts exception are both present.
6. Only the three allowed /ingredients/ links; FAQ count is not 0; primary keyword "comedogenic rating".
7. Ask Claude to check the draft against this recipe before you click Approve & Publish.

## After it publishes (Claude does these)

1. Set the opener if LGAAS did not write one:
   `"I think something in my routine is clogging my pores. Can you go through my products' ingredients with me?"`
2. curl the live page: 200, FAQPage present, every internal link 200.
3. Grade at 28 and 56 days: GSC impressions/clicks on comedogenic queries, and
   `select count(*) from ss_widget_sessions where landing_path = '/blog/<new slug>'`.

## Known issue this post works around (not fixed)

`ss_ingredients.comedogenic_rating` is AI-written at ingest (`src/lib/pipeline/ingredient-matcher.ts:200`,
"Use 0 if unknown"), and ingredient pages show it as "Comedogenic: N/5" with no source. Six of nine
values checked disagree with Fulton 1989 (cetyl palmitate ours 4 vs Fulton 0; laureth-4 2 vs 5;
ethylhexyl palmitate 2 vs 4; isostearyl isostearate 2 vs 4; isopropyl myristate 4 vs 5; myristyl
myristate 4 vs 5). A MISMATCH, not proof ours is wrong, but an unsourced number is shown as fact and
"0" mixes "non-comedogenic" with "unknown". This is why the post links only the three pages that agree.
