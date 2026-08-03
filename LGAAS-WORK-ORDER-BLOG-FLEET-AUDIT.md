# LGAAS Work Order — Blog Fleet Audit & Remediation (all 43 posts)

**Date:** August 3 2026
**Owner:** Scott Martin
**Status:** ACTIVE
**Audience:** any AI session working the LGAAS blog loop.
**Companion order:** `LGAAS-WORK-ORDER-PIE-CLUSTER-REFRESH.md` (one post, deeper treatment).
**Standing context:** `LGAAS-WORK-ORDER-SEO-GUARDIAN.md` defines the division of labor.

---

## Why this exists

The blog is Seoul Sister's **only working acquisition channel** — 596 Bing AI citations/7d,
13K Google impressions, 123 clicks/wk. Blog and feeder pages carry **99.3% of citations**.
Everything below is a leak on that channel.

Measured Aug 3 2026 across all 43 published posts in `ss_content_posts`:

| Finding | Count | Severity |
|---|---|---|
| Route readers to **paywalled** features | **17 / 43 (40%)** | HIGH — sends strangers to a signup wall |
| **No Yuri CTA anywhere in body** | **34 / 43 (79%)** | HIGH — the one free surface that converts |
| Recommend a **banned retailer** | **1** | CRITICAL — policy violation |
| Repeat a **stale fact** (Amazon commingling) | 1 | MEDIUM |
| Korean-sunscreen claims **without the US-reformulation caveat** | 11 | HIGH — factually misleads US buyers |
| Contain em-dashes | 5 | LOW |
| Name **zero** buyable catalog products | ~33 | MEDIUM — costs commercial-intent clicks |

**Good news, verified:** **zero** posts repeat the unsourced "KTRI 2022 / 68% of COSRX
sunscreen failed SPF" statistic. Do not introduce it.

**Also verified good — do NOT "fix" these:** both sebaceous-filament posts handle the
anatomy honestly. `sebaceous-filaments-vs-blackheads-how-to-tell-treat` opens with
*"You can't permanently remove sebaceous filaments (they refill within 30 days), but
consistent use of salicylic acid, oil cleansing, and niacinamide can minimize their
appearance significantly."* That is the correct framing on the site's single
highest-impression query cluster (176 impressions). A keyword scan flags "permanently
remove" as a risky claim; reading it shows the opposite. **Read before editing** — a
naive find-and-replace would break the best clinical copy on the blog.

---

## PHASE 1 — Do these first (policy + factual risk)

### 1.1 CRITICAL: Stylevana recommended as trusted

**Post:** `best-japanese-korean-sunscreens-you-can-buy-in-the-us-2026-without-getting-ripped-off`

It contains a "Where to buy" table with the row:

> `| Trusted US-based K-beauty retailers (Soko Glam, Stylevana US warehouse) | Fast shipping, generally authentic | ... |`

**Stylevana is on the never-recommend list.** Remove it from that cell; leave Soko Glam.
The recommend-set is **Olive Young, Soko Glam, iHerb** and nothing else.

Same table also lists **Amazon** with *"commingled inventory"* as a con. **Amazon ended
commingled inventory in March 2026.** That mechanism is stale — the counterfeit caution is
still valid, but must be restated on current grounds (third-party sellers, not commingling).

**NOT a violation — leave alone:** `where-to-buy-k-beauty-online-trusted-shops-in-2026`
names YesStyle and StyleKorean, but explicitly to say *"we don't recommend them"* with real
reasons (slow shipping, poor refund policy). That is correct and useful. Naming a retailer
to warn about it is fine; the ban is on **recommending**.

### 1.2 HIGH: 11 posts claim Korean sunscreen superiority without the US caveat

Verified at Consumer Reports (Jul 10 2026): Korean-brand sunscreens **sold in US stores are
REFORMULATED** with FDA-approved filters and test substantially weaker than the Korean-market
version — **Beauty of Joseon SPF 36 vs 19, Innisfree 48 vs 16, Round Lab 46 vs 16.**

The worst offender is `korean-sunscreen-vs-american-sunscreen-why-k-beauty-sunscreens-are-taking-over-tiktok`,
whose Quick Answer says Korean sunscreens *"use newer UV filters (like Tinosorb S and
Tinosorb M)"* with no mention that the bottle a US reader buys at Target may not contain them.

**Add this caveat to all 11** (adapt wording per post, keep it short):

> Worth knowing before you buy locally: Korean sunscreens sold in US stores are often
> reformulated with FDA-approved filters and can test meaningfully weaker than the
> Korean-market version. If the filter list is what you're after, buy the Korean-market
> product from Olive Young Global rather than assuming the US shelf version matches.

Three calibrations that keep this honest and must survive:
- The documented advantage is **protection, not texture** (the CR panel found them greasy
  and white-casting — do not claim cosmetic elegance as the proven win).
- The finding is **relative** — even Korean formulas came in under their SPF 50+ labels.
- The gap is **narrowing** — FDA approved bemotrizinol June 2026, first new filter since 1999.

Affected slugs: `beauty-of-joseon-aqua-fresh-sunscreen-full-review`,
`how-to-build-a-korean-skincare-routine-that-actually-works-...`,
`how-to-fix-dehydrated-skin-with-a-korean-skincare-routine`, `trending-k-beauty-products-2026-03`,
`best-korean-skincare-for-dark-spots-...`, `best-korean-skincare-for-pie-acne-scars-and-texture`,
`why-does-your-makeup-look-worse-over-korean-skincare-...`,
`things-i-wish-i-knew-before-buying-korean-skincare`, `why-does-sunscreen-pill-how-to-stop-it-for-good`,
`korean-sunscreen-vs-american-sunscreen-...`, `best-korean-skincare-for-dry-skin-with-pigmentation-...`.

---

## PHASE 2 — The paywall leak (17 posts)

### The problem

17 posts route readers to **Glass Skin Score, Sunscreen Finder, Smart Routine Builder,
Label Scanner, Dupe Finder, or Shelf Scan.**

These all return HTTP 200, so nothing flags them as broken — but they live under
`src/app/(app)/` and `AppShell` gates that tree on `plan != 'free'`. **A cold reader from
Google, mid-article, clicking "track your progress with the Glass Skin Score" hits a
signup/paywall wall instead of the tool just promised to them.**

They were also deliberately **demoted** in the June 22 2026 positioning decision — usage
data showed everyone lives in Yuri chat. Measured lifetime usage as of Aug 3 2026:
**Glass Skin Score 13, label scans 4, wishlists 0.** Sunscreen Finder and Dupe Finder are
no longer standalone pages at all; they are Yuri tools (`find_sunscreen_match`,
`find_product_dupes`).

### The fix

**Replace every gated-feature CTA with a Yuri CTA.** Yuri is free, needs no signup, and is
the only surface with a measured conversion record (16.4% email capture from visitors who
actually talk to her; the one cold paid conversion came through her).

- ✅ **Keep** Ingredient Encyclopedia (`/ingredients/...`) and product page links — public,
  crawlable, good internal linking.
- ❌ **Remove** promos for Glass Skin Score, Sunscreen Finder, Routine Builder, Label
  Scanner, Dupe Finder, Shelf Scan.
- ↔️ **Rewrite in place**, keeping the sentence's job. Example:
  - Before: *"Seoul Sister's Sunscreen Finder can help you find one that works with your skin type."*
  - After: *"Not sure which one fits your skin type? Ask Yuri — she'll narrow it down free, no signup."*

**Standing rule for all future content: never CTA a stranger to a paywalled surface. CTA to Yuri.**

Affected slugs (17): `korean-sunscreen-vs-american-sunscreen-...`, `best-korean-skincare-for-dark-spots-...`,
`why-is-k-beauty-so-expensive-in-the-us-...`, `where-to-buy-k-beauty-online-trusted-shops-in-2026`,
`how-to-build-a-korean-skincare-routine-...`, `best-korean-cleansing-oils-for-every-skin-type-2026`,
`oily-skin-routine-guide`, `why-does-your-makeup-look-worse-over-korean-skincare-...`,
`do-korean-eye-patches-actually-work-...`, `can-niacinamide-cause-acne-...`,
`best-korean-skincare-for-pie-acne-scars-and-texture`, `how-to-figure-out-your-skin-type-for-korean-skincare`,
`why-your-sebaceous-filaments-keep-coming-back-...`, `how-to-get-glass-skin-a-k-beauty-routine-that-works`,
`best-korean-skincare-for-dry-skin-with-pigmentation-...`, `how-to-fix-dehydrated-skin-...`,
`trending-k-beauty-products-2026-03`.

---

## PHASE 3 — Add a Yuri CTA to the 34 posts without one

Only 9 of 43 posts mention Yuri in the body. The template block at the end of the PIH post
is the pattern that works.

**Placement matters more than wording.** Put it where an engaged reader is already deciding:

1. **Mid-article**, right after the section that creates the need ("which of these is
   right for me?"), and
2. **End of article**, as the standard close.

**The offer must be the thing the page cannot do.** A page can explain what an ingredient
is; it cannot know what else is in this person's bathroom. That's Yuri's only real edge —
lead with conflict-checking and personalization, not "learn more."

> Good: *"Already using other actives? Yuri can check whether this clashes with them. Free, no signup."*
> Bad: *"Want to learn more about K-beauty? Chat with Yuri!"*

---

## PHASE 4 — Name buyable products on commercial-intent posts

~33 posts name zero catalog products. This matters most on posts targeting **"best X"** /
**"X for Y"** queries, where the reader wants a name, not a heuristic.

Do this for the commercial-intent posts first (the PIE order is the worked example).
Definitional posts ("what are sebaceous filaments") do **not** need product lists — those
queries are AI-Overview-owned and measured **0 clicks on 541 impressions**; their job is
citation, not clicks.

**Grounding rules (non-negotiable):**
- Every product must exist in `ss_products` with `is_verified = true`.
- Require **`review_count >= 200`** before calling anything a top pick. Sorting by rating
  alone returns a wall of 5.00★ products with 0-2 reviews.
- Watch for **duplicate rows** of the same product at different prices (verified example:
  Etude SoonJung pH 5.5 Relief Toner exists at `$9.50/7,201 reviews` and `$16.00/1,700`).
  Use the highest-review row and quote **that** row's price.
- Prices are as-of-date data: *"about $X at Olive Young"*, never a live guarantee.

---

## PHASE 5 — Internal linking

Cross-link the confusable pairs. Readers routinely land on the wrong one:

- **PIE ↔ PIH** — PIH already links to PIE; PIE does **not** link back. Add it.
- **The three counterfeit posts** (`how-to-tell-if-korean-skincare-is-fake`,
  `...sulwhasoo-first-care-serum-is-fake`, `...cosrx-snail-mucin-is-fake`) should form a
  cluster with the generic 5-point check as the hub.
- **The two sebaceous-filaments posts** should link to each other.
- **`did-cosrx-snail-mucin-break-you-out`** ↔ **`can-niacinamide-cause-acne`** — same
  "is this ingredient breaking me out" intent.

---

## PHASE 6 — Housekeeping

- **Em-dashes** (5 posts): **in scope — fix them.** I checked the rule rather than assuming:
  it bans em-dashes (—) *and* double-dashes ( -- ) in "any copy drafted for Scott to send as
  a Reddit response, DM, **or any user-facing text**." A published blog post is user-facing.
  Replace with commas, periods, parentheses, or restructure. Both are known AI tells, and
  the blog is the surface where reading as machine-written costs the most trust.
- **Stale time-bound posts**: `trending-k-beauty-products-2026-03` is a March trends post
  still live in August. Either refresh it or de-index it; a stale "trending" page damages
  credibility on a site whose whole pitch is current intelligence.
- **`purito-oat-in-cream-discontinued-best-alternatives`** — verify the alternatives named
  are still in the catalog and not themselves discontinued.

---

## Hard rules (carried over — do not relearn)

- Retailer recommend-set: **Olive Young, Soko Glam, iHerb.** Never YesStyle, Stylevana,
  StyleKorean. No Amazon/eBay affiliate links. Naming a retailer to **warn** about it is fine.
- **Ground every product claim in the Seoul Sister DB.** Never invent a product, price, INCI,
  or rating.
- **Yuri Sole Authority:** the blog surfaces data and routes to Yuri. It must not become a
  parallel recommendation engine that contradicts her. Product lists are fine; "here is YOUR
  routine" is not — that's Yuri's job.
- **Clinical honesty:** no cure/erase/permanent claims. Sebaceous filaments are anatomical
  and cannot be permanently removed — any post implying otherwise is wrong. Lesions,
  spreading rashes, and non-resolving marks get a dermatologist referral, stated early.
- **Do not claim the outcome.** LGAAS ships; Seoul Sister's SEO Guardian grades against real
  GSC data.
- **Keep every slug.** These are in-place refreshes. A new URL forfeits earned ranking.

---

## Execution order

1. **Phase 1** (2 posts, policy + the 11 sunscreen caveats) — today. Factual risk.
2. **Phase 2** (17 posts, paywall CTAs) — this week. Biggest lead-gen leak.
3. **Phase 3** (34 posts, Yuri CTA) — can be batched with Phase 2 since it edits the same
   sections.
4. **Phase 4** (commercial-intent product naming) — start with the PIE post per its own
   order, then the other "best X" posts.
5. **Phases 5-6** — cleanup pass.

## Definition of done (per post)

- [ ] No gated-feature CTA remains.
- [ ] At least one Yuri CTA, placed at a decision point, offering what the page can't do.
- [ ] Retailer mentions comply (recommend-set only; warnings allowed).
- [ ] Any Korean-sunscreen claim carries the US-reformulation caveat.
- [ ] Every named product verified in `ss_products` with ≥200 reviews.
- [ ] Slug unchanged.
- [ ] No cure/erase/permanent claims; referral threshold present where clinically relevant.
