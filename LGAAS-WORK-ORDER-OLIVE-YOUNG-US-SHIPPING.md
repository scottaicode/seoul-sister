# LGAAS Work Order — Olive Young Global No Longer Ships to the US

**Date:** October 21 2026
**Owner:** Scott Martin
**Status:** OPEN
**Audience:** any AI session working in the LGAAS repo.
**Client:** Seoul Sister (`b577e4df-1549-45ea-bb25-b2167d4f3292`).
**Supersedes part of:** Blueprint 131 (Jul 23 2026), whose recommend-set named Olive Young Global as the default store for everyone.

---

## What changed in the world (verified, not assumed)

- **Olive Young Global stopped shipping to all 50 US states and D.C. on May 29 2026**, when Olive Young US (`us.oliveyoung.com`, operated by CJ OLIVE YOUNG USA Inc.) launched. Verified Oct 21 2026 on `global.oliveyoung.com`: the page says *"This site does not ship to the U.S. (50 U.S. states & D.C.)"*. A US visitor opening a Global product link gets a "Shopping from the U.S.?" pop-up pointing them to the US store.
- **Global prices are not US prices.** Same product, Oct 21 2026: SKIN1004 Hyalu-Cica Water-Fit Sun Serum twin pack, **$21.50 at Olive Young Global, $38.00 at Olive Young US** (US price read from Olive Young US's own product feed).
- **Olive Young US does not carry every brand.** Its search returned nothing for Beauty of Joseon, Starlike or ATTATION on Oct 21 2026.
- **Olive Young US sells US formulas.** Its Korean-brand sunscreens use FDA-approved filters, so the "Korean-formula sunscreen" advantage is not available there.
- **Import costs changed.** The US duty-free allowance for small packages ended Aug 29 2025, and since July 9 2025 the FDA reviews even small personal shipments of cosmetics and drugs (CBP CSMS #65581188). The duty rate itself has changed several times in 2026; **do not publish a percentage.**
- **Sephora's Olive Young-curated section launched Aug 20 2026** (500+ US stores and online, 19 brands). None of the major Korean sunscreen brands is in it.

## What Seoul Sister already changed (Oct 21 2026)

- `ss_retailers`: the old "Olive Young" row is now **"Olive Young Global"** with `ships_to_us = false`; a new **"Olive Young US"** row exists with `ships_to_us = true`. Soko Glam, iHerb, YesStyle, StyleKorean, Stylevana and Amazon are `ships_to_us = true`.
- **`/api/admin/products/prices`** (what `fetchPriceContext` calls): same response shape. Each price now also carries **`retailer_ships_to_us`** (true / false / null). The retailer name for Global rows is now "Olive Young Global".
- **`/api/admin/products/search`** (what `fetchProductContext` calls): **`us_price` changed meaning.** It used to be `ss_products.price_usd`, an undated price from an unnamed store (usually Olive Young Global). It is now the freshest price at a store that ships to the US, **or `null`** when there is none (most products, until Olive Young US prices are matched). A new **`international_price`** field carries the Global price separately.
- **`/api/retailers`**: now includes "Olive Young US" and lists the Global row as "Olive Young Global".
- Seoul Sister's price jobs now run less often (Olive Young Global weekly, Soko Glam monthly, YesStyle retired), so expect older `age_days` values. Policy for Seoul Sister going forward is **rough US prices, not exact ones**.

## What LGAAS needs to change

### 1. AriaStar's retailer guidance (`lgaas_system_configs.system_prompt` for this client)
Blueprint 131 set the recommend-set to "Olive Young Global, Soko Glam, iHerb". Replace it with location-aware guidance:
- **US readers:** Olive Young US, Soko Glam, iHerb, and the brand's own US site. Olive Young US doesn't carry every brand, so the brand's US site is often the cleanest answer.
- **Outside the US:** Olive Young Global remains the default.
- **Never send US readers to Olive Young Global to buy.**
- Keep the existing YesStyle/Stylevana/StyleKorean rule unchanged (authentic, but slow shipping and weak refunds; never imply counterfeits).

**This is a persona prompt change. It requires an adversarial second-model review before shipping** (global rule; a `PreToolUse` hook enforces it).

### 2. The 10 live posts that name Olive Young Global
Each lives in BOTH databases (`lgaas_blog_posts.content` in LGAAS and `ss_content_posts.body` in Seoul Sister); edit both, or the next sync reverts one. Use the Blueprint 131 pattern: read live content, replace only on an exact match, snapshot first, dry-run by default, report drift instead of half-applying.

| Seoul Sister slug | LGAAS post id |
|---|---|
| where-to-buy-k-beauty-online-trusted-shops-in-2026 | cc930279-4b74-453d-8cdd-b3c486c40006 |
| where-to-buy-authentic-korean-snail-mucin-in-the-us | 9aa3ce29-271b-40ee-a22b-08a2f34b8930 |
| best-japanese-korean-sunscreens-you-can-buy-in-the-us-2026-without-getting-ripped-off | 4b125e94-88c5-436b-95d9-89ef1600b8e4 |
| beauty-of-joseon-aqua-fresh-sunscreen-full-review | af58b143-f1a0-4415-bd78-3d6127748c43 |
| why-is-k-beauty-so-expensive-in-the-us-the-real-price-markup-explained | c26ae054-da05-404d-8467-1032a58e399e |
| how-to-tell-if-korean-skincare-is-fake-a-5-point-check-for-a | 8508fb83-3d0c-4883-a693-4ea7718766d5 |
| how-to-tell-if-your-cosrx-snail-mucin-is-fake-a-2-minute-che | db9895d4-0058-4264-a0f6-52e8b61b2ca4 |
| how-to-tell-if-your-sulwhasoo-first-care-serum-is-fake-5-che | ae8fa0e2-638e-46af-84e6-9b8a4c20d907 |
| korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs | 81125e1f-a420-480d-aa01-976671103be6 |
| why-your-sebaceous-filaments-keep-coming-back-and-the-k-beauty-routine-that-finally-changed-mine | 979c7fd3-4e1f-4215-8ec7-c9222fbf1456 |

Priorities: the two "where to buy" posts and the two sunscreen posts first; they are the ones a buyer reads and an AI engine cites. The "why is K-beauty expensive" post likely tells US readers to buy from Korea to save money, which is no longer something they can do through Olive Young Global, and every import now pays duty.

### 3. Stop writing exact prices into new posts
32 of 55 live posts quote dollar prices, and prices written into prose are never re-read against the catalog (a 45% overquote was found live in August). For new content: give a price only with its date and store, or describe it qualitatively ("under $20"). Never present an Olive Young Global (`retailer_ships_to_us: false`) price as what a US reader will pay. Your existing grounding rule for `[STALE]` prices already points this way; extend it to `retailer_ships_to_us: false` and to `us_price: null`.

### 4. Check the two code paths that render `us_price`
`utils/content-card-generator.js:84` and `utils/ingredient-context.js:525` print `$${us_price}` when present. They now receive `null` for most products (correct: we don't have a US price) and should keep skipping it. Confirm nothing treats `null` as "free" or "$0", and decide whether `international_price` should be shown, labelled as international, or ignored.

### 5. Other drift found by the Oct 21 review (Fable 5.1)
- `tests/blog-context-parity.test.js:74` pins the old recommend-set wording ("Recommend Olive Young, Soko Glam, iHerb"). Update it with the guidance change, or it will fail or, worse, lock the old policy in.
- AriaStar's context still says Sephora's Olive Young section rolls into "~650 Sephora stores in fall 2026". It launched **Aug 20 2026, 500+ US stores and online, 19 brands**.
- `international_price` is new and unread by LGAAS. With `us_price` now `null` for most products, blog and Reddit drafts will quote far fewer prices. That is the intended outcome (no unpayable prices), but confirm nothing downstream treats a missing price as an error or fills one in from memory.
- Published posts that say "$X at Olive Young" are untouched by the Seoul Sister change. Treat them under item 3.

## How to verify you're done
- AriaStar asked "where should I buy COSRX snail mucin? I'm in Texas" names no Olive Young Global link.
- `rg -i "olive young global"` over the 10 posts in BOTH databases returns only sentences that are explicitly about readers outside the US.
- A Reddit draft generated for a US product question carries no Global price presented as a US price.
- Say plainly in your report whether the second-model review ran.
