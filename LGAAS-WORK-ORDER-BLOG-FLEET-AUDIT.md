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

**Every one of the 43 posts gets touched. Nothing is deferred out of scope.** The ordering
below is about sequence, not about which posts get fixed.

1. **Phase 0 — publishing defects + the factual error.** Same day. Small, and two of them
   are actively harmful.
2. **Phase 1** (2 posts, policy + the 11 sunscreen caveats). Factual risk.
3. **Phase 2 + 3 batched** (the mechanical sweep across ALL 43). One pass, same sections.
4. **Phase 4** (commercial-intent product naming) — PIE post per its own order, then the
   other "best X" posts.
5. **Phases 5-6** — cross-linking and housekeeping.

---

# PHASE 0 — Publishing defects and one harmful recommendation

These were found by reading the bodies, not by scanning. They are small and they are the
worst things on the blog.

### 0.1 HARMFUL: a 23% pure L-ascorbic acid ampoule sold as the gentle option

**Post:** `given-up-on-vitamin-c-heres-why-and-what-to-try`

The post is *about* helping people whose skin can't tolerate strong vitamin C. It says:

> *"One of the well-regarded **SAP options** in K-beauty is the **DW-EGF Vitamin C
> Boosting Ampoule 25** by Easydew, which pairs the derivative with soothing ingredients
> aimed specifically at **people who can't tolerate the harsh stuff**."*

**Verified against `ss_products`:** that product's INCI is
`Water, Ascorbic Acid (230,000 ppm), Propanediol, ...` — **230,000ppm is 23% pure
L-ascorbic acid.** It is not SAP, it is not a derivative, and it is very likely the
harshest vitamin C product in the catalog. The post routes sensitive, already-reactive
readers straight to it while calling it gentle.

**Fix:** either swap in a genuine SAP / ascorbyl-glucoside / ethyl-ascorbic-acid product
verified from the catalog, or keep the Easydew and describe it honestly as the
high-strength option that this reader should NOT start with. Note the site's own
`how-to-get-rid-of-hyperpigmentation` post describes the same product correctly — the two
posts currently contradict each other.

### 0.2 Two live posts are truncated mid-sentence

Verified by reading the last characters of the stored body:

- `best-japanese-korean-sunscreens-...` ends `"...for your face and neck daily (about 1/4"` — cut off inside an FAQ answer.
- `best-korean-skincare-for-dry-skin-with-pigmentation-...` ends `"...aggressive active to do everything"` — no period, no conclusion, no CTA.

Both are live and indexed. Complete the endings.

### 0.3 `/cycle` is a hard 404 — worse than the paywall links

Confirmed: `https://www.seoulsister.com/cycle` returns **404**, and no route exists
anywhere under `src/app/`. It is linked from at least four posts as "Cycle-Aware Skincare."
A paywall link at least shows a page; this is a dead end.

Remove every `/cycle` link. (`/verify`, `/tracking`, `/dashboard`, `/trending` all return
200 but are gated — handle those under Phase 2.)

### 0.4 White-label generation artifacts in six posts

Literal third-person placeholder voice survived generation: **"The company helps you…",
"The company's AI skincare advisor", "the team's Smart Routine Builder", "Their site
tracks", "The site's AI advisor."**

Affected: `beauty-of-joseon-aqua-fresh-sunscreen-full-review`,
`best-japanese-korean-sunscreens-...`, `how-to-get-glass-skin-...`,
`how-to-build-a-korean-skincare-routine-...`, `oily-skin-routine-guide`,
`trending-k-beauty-products-2026-03`.

Seoul Sister is not a third party writing about someone else's product. Rewrite in first
person plural ("we", "our catalog") or name Yuri directly.

### 0.5 Two link defects

- `how-to-tell-if-korean-skincare-is-fake-a-5-point-check-for-a` links its COSRX checklist
  to the **blog index** rather than the post slug.
- `best-korean-skincare-for-dry-skin-with-pigmentation-...` uses bare-root
  `https://seoulsister.com` as the anchor for five specific tools.

---

# THE COMPLETE 43-POST CHECKLIST

Every published post, with its specific defects. **Tick each row.** A post with no flags
still gets read for the Yuri CTA and cross-links. Legend: **G** gated CTA · **Y** no Yuri
CTA · **B** banned retailer · **S** missing SPF-reformulation caveat · **A** artifact ·
**T** truncated body · **C** `/cycle` 404 · **P** commercial-intent with no named products.

| # | slug | flags | note |
|---|---|---|---|
| 1 | best-japanese-korean-sunscreens-us | **B S T A Y** | **Fix first.** Every defect class on one page |
| 2 | best-korean-skincare-for-pie | **G S Y P** | Has its own work order — execute that |
| 3 | korean-sunscreen-vs-american | **G S Y** | Tells US buyers the opposite of what CR measured |
| 4 | given-up-on-vitamin-c | **Y** | **23% LAA sold as gentle.** Phase 0.1 |
| 5 | best-korean-cleansing-oils-2026 | **G Y P** | "Best 2026" title, zero products |
| 6 | how-to-get-glass-skin | **G Y P A** | Namesake query, zero products |
| 7 | dry-skin-with-pigmentation | **G S Y T P** | Truncated; refuses picks under a "Best" title |
| 8 | best-korean-skincare-for-dark-spots | **G S Y C** | 12 gated CTAs incl 2× /cycle |
| 9 | how-to-build-a-korean-routine-that-works | **G S Y A C** | Head query; niacinamide+C claim contradicts siblings |
| 10 | how-to-figure-out-skin-type | **G Y C** | Content excellent, CTAs only |
| 11 | why-is-k-beauty-so-expensive | **G Y** | "2025" framing reads dead; de minimis likely stale |
| 12 | where-to-buy-k-beauty-online | **G Y** | Retailer language is CORRECT, leave it |
| 13 | oily-skin-routine-guide | **G A P** | HTML not markdown; cites deleted effectiveness stats |
| 14 | do-korean-eye-patches-work | **G P** | "Worth your money" query, zero products |
| 15 | why-does-makeup-look-worse | **G S Y C P** | Won't even name a sunscreen |
| 16 | trending-k-beauty-2026-03 | **G S Y A** | 5 months stale; date-frame it |
| 17 | how-to-fix-dehydrated-skin | **G S Y** | Names 6 real products; CTA sweep only |
| 18 | sebaceous-filaments-routine | **G Y P** | Medically excellent; add picks, cross-link sibling |
| 19 | can-niacinamide-cause-acne | **G** | FAQ overstates vs its own body |
| 20 | beauty-of-joseon-aqua-fresh-review | **S Y A** | Guardian target; needs reformulation note + price |
| 21 | things-i-wish-i-knew | **S Y** | Amazon counterfeit accusation, violates the rule |
| 22 | why-does-sunscreen-pill | **S Y** | Solid otherwise |
| 23 | how-to-get-rid-of-hyperpigmentation | **Y** | Recommends 23% LAA as default AM step |
| 24 | sebaceous-filaments-vs-blackheads | **Y** | Correct clinically; cross-link sibling |
| 25 | best-korean-skincare-for-pih | **Y** | **The template.** Only nit: CTA → /yuri (paywalled) |
| 26 | k-beauty-toners-worth-your-money | **Y** | FAQ formatting nit |
| 27 | best-milky-toners | **Y** | Good |
| 28 | did-cosrx-snail-mucin-break-you-out | **Y** | Model post |
| 29 | how-to-evaluate-your-routine | **Y** | **Style template** alongside #25 |
| 30 | late-20s-skin-spiral | **Y** | Good |
| 31 | 7-minute-routine | **Y** | One blanket sunscreen line to calibrate |
| 32 | makeup-over-tretinoin-wedding | **Y** | Good |
| 33 | skin-barrier-damaged-real-signs | **Y** | Good hub post |
| 34 | purito-oat-in-discontinued | **Y** | Verify alternates still in catalog |
| 35 | retinol-or-retinal | **Y** | **Has the best reformulation paragraph — reuse it** |
| 36 | same-brand-different-formula | **Y** | Light persona only |
| 37 | where-to-buy-authentic-snail-mucin | **Y** | Model marketplace framing |
| 38 | how-to-tell-if-korean-skincare-is-fake | — | Blog-index mislink (0.5) |
| 39 | cosrx-snail-mucin-fake | — | Model counterfeit post |
| 40 | sulwhasoo-fake | — | Bottom Line contradicts body on barcode check |
| 41 | korean-expiration-dates | — | Good |
| 42 | build-a-routine-youll-stick-to | — | Good |
| 43 | why-simplifying-works | — | Good |

**Posts 25, 29, 35, 39 are the quality bar.** Read them before editing anything else;
they already do what this order asks of the rest.

---

## Definition of done (per post)

- [ ] No gated-feature CTA remains.
- [ ] At least one Yuri CTA, placed at a decision point, offering what the page can't do.
- [ ] Retailer mentions comply (recommend-set only; warnings allowed).
- [ ] Any Korean-sunscreen claim carries the US-reformulation caveat.
- [ ] Every named product verified in `ss_products` with ≥200 reviews.
- [ ] Slug unchanged.
- [ ] No cure/erase/permanent claims; referral threshold present where clinically relevant.
