# Shelf Visibility — Strategic Plan (July 29 2026)

Four AI agents researched, argued opposite positions, and were fed live
production data as it came in. This is where they converged, plus the findings
that decided it.

**The one-line conclusion: acquisition is Korean; retention is the whole shelf.**
Keep every public and acquisition surface 100% Korean. Once someone pays, Yuri's
authority and her safety duty extend to every product on their actual shelf —
delivered by making what we already capture visible, never by expanding the
catalog.

---

## The finding that decided it

`ss_ingredient_conflicts` contains 5 rules. The first one is:

> **Retinol (Vitamin A) + Glycolic Acid (AHA) — severity: HIGH.** "significantly
> increases risk of irritation, redness, peeling, and a compromised skin
> barrier... over-exfoliation and photosensitivity."

Caroline is running **Dr. Dennis Gross glycolic peel pads + Kiehl's retinol on a
post-Accutane barrier**, and told Yuri so during onboarding.

**The rule cannot fire for her.** `checkRoutineConflicts`
(`src/lib/intelligence/conflict-detector.ts:18`) joins `ss_product_ingredients`
by `product_id`. Both of her products are custom entries with
`product_id = NULL`, so they contribute zero ingredients and the function
returns `{ safe: true, conflicts: [] }`.

**For Caroline, `safe: true` is silence, not a safety check.** That is the
strongest argument in the entire debate, and it is not a preference question.

**But the fix is far smaller than it looks.** The `check_ingredient_conflicts`
TOOL already accepts a raw `ingredient_names` array, seeded with **no catalog
resolution at all** (`tools.ts:1540`), and matches `ss_ingredient_conflicts` by
lowercased NAME rather than by id (`tools.ts:1579-1599`). Verified in source.

So feeding Bailey's 11 scanned Cetaphil strings would work **today**, with no
schema change and no catalog row. The capability exists; nothing routes the
user's own scanned INCI into it. Two caveats: matching is exact-string after
lowercasing (so "Aqua" misses "Water"), and the tool's product-NAME path never
queries `ss_user_products`, so custom entries stay invisible on that path.
`ingredient_names` is the only custom-product-capable conflict path that exists.

## The finding that made it cheap

Every scan already persists real INCI, including for products not in the catalog.
Bailey scanned a **Cetaphil Gentle Skin Cleanser** last night and
`ss_user_scans.ingredients_found` captured 11 ingredients: Aqua, Glycerin,
Cetearyl Alcohol, Panthenol, Niacinamide, Xanthan Gum, Sodium Cocoyl
Isethionate…

Those strings bridge to the ingredient master: **6 of 7 tested matched
`ss_ingredients` on name** (only "Aqua" missed, stored as "Water").

And **nothing reads it back.** Grep confirms `ingredients_found` is consumed by
exactly one thing: a count on a dashboard widget
(`RecentScansWidget.tsx:99`). Yuri never sees it. It is not in `memory.ts`, not
in any tool, not in conflict checking.

Worse: the library **actively filters it out**. `src/app/api/library/route.ts:54`
selects scans with `.not('product_id', 'is', null)` — so Bailey's Cetaphil scan
is deliberately excluded from her own library, and `ingredients_found` /
`analysis_result` are not even in the select list.

And `analysis_result` (JSONB) holds far more than the name array: per-ingredient
function, safety_rating, comedogenic_rating, and concerns
(`api/scan/route.ts:313-325`).

So the data is already captured, already matchable, richer than expected, and
thrown away. **This is a plumbing gap, not a data-acquisition problem.**

### One hazard to fix while in here

`find_product_dupes` accepts ANY match quality, unlike `compare_prices` which
explicitly refuses `partial` (`tools.ts:1723-1729`). So a Western product name
with partial token overlap can silently resolve to a DIFFERENT Korean product
and return dupes computed against the wrong item. That is the v10.6.5
wrong-product class. It should refuse `partial` the same way `compare_prices`
does.

## The finding that killed the biggest proposal

The in-store advocate proposed seeding ~100 Western drugstore SKUs, and named
its own falsification test: check whether cold traffic actually hits the
blind-shelf wall. It was run against all anonymous widget traffic — 226 visitor
messages from 54 real visitors (`total_messages > 0`, the honest denominator):

| signal | messages |
|---|---|
| Korean-intent (korea, k-beauty, cosrx, anua, glass skin, centella, olive young…) | **45** |
| Western-brand or in-store (cerave, cetaphil, target, ulta, drugstore, "in store") | **3** |

**≈15:1 Korean-intent.** All 3 dissolve on inspection: one is Caroline
pre-signup, one lists a La Roche-Posay inside an otherwise SKIN1004-led Korean
routine, one describes a bare Cetaphil baseline *before asking to be upgraded
into K-beauty* — the funnel working, not failing.

The advocate withdrew the proposal on its own evidence: *"Cold traffic arrives
Korean-intent because the GEO channel manufactures Korean-intent visitors.
Seeding 100 Western SKUs would serve a visitor who is not arriving. Kill it."*

**Caveat, recorded deliberately:** 54 visitors is a small, channel-shaped sample,
and the intent mix is downstream of acquisition being 100% Korean-query GEO. If a
broader channel opens (Bailey's TikTok audience is not r/AsianBeauty), **re-run
this exact query** before treating 15:1 as a law of nature.

## The finding that corrected the diagnosis

68% of library products (25 of 37, across 3 users) are custom entries with no
catalog link. That looked like a coverage gap. It is three different things:

1. **Correct behavior** — devices and actions ("Ice roller", "LED mask", "Shower
   / cleanse") should never have a catalog row.
2. **Stale rows, not a live bug.** Several are Korean products the catalog holds
   richly (Anua 242 SKUs, Round Lab 96, Medicube 83). Tested against the live
   resolver:
   ```
   RESOLVED  "Anua Heartleaf 77% Soothing Toner"  -> Anua | Heartleaf 77% Soothing Toner
   RESOLVED  "Round Lab Dokdo Cleanser"           -> Round Lab | 1025 Dokdo Cleanser
   NULL      "Anua Rice 70 + Ceramide Glow Milky Toner"  (name merges TWO products)
   NULL      "Medicube PDRN Pink Peptide Eye Cream"      (genuinely absent)
   ```
   **The resolver works today.** Every stale row predates 2026-07-21 (v11.10.0).
   This is a one-time re-link sweep, already in the CLAUDE.md backlog — **not a
   code fix.** Do not "repair" the resolver based on these rows.
3. **Genuinely uncovered** — Caroline's Dr. Dennis Gross, Byoma, Kiehl's,
   Naturium, plus Colorescience and Hero Cosmetics.

---

## The plan

### Phase 1 — Make the shelf visible (the safety fix)

**1a. Feed scanned INCI into the user's library.** When a scan doesn't match the
catalog, attach `ingredients_found` to the custom entry. Needs one new column on
`ss_user_products` (nothing existing fits) plus a link from scan → library.

**1b. Route stored INCI into the conflict tool that already accepts it.** No
schema change and no new matching logic: `check_ingredient_conflicts` already
takes a raw `ingredient_names` array. Give Yuri the user's stored INCI so she
can pass it. Caroline's retinol + glycolic conflict then fires — an existing
HIGH-severity rule, via an existing tool path. Normalize the known synonym gap
("Aqua" → "Water") since matching is exact-string.

Do NOT rewrite `conflict-detector.ts` to accept ingredient names. It is the
routine-page path and is catalog-only by construction
(`ss_routine_products.product_id` is `NOT NULL REFERENCES ss_products(id)`).
Changing it is a schema fight for a second-order surface; the tool path serves
the conversation, which is where the safety judgment actually happens.

**1c. Show Yuri what she can and cannot see.** Add owned-product ingredient
coverage to her context as a FACT, in the established
`cumulative-give.ts` / clinical-honesty style: surface the state, never dictate
the response. "You have INCI for 1 of 5 of her products" lets her say so
honestly and ask for a label photo, instead of silently reasoning from 20% of
the shelf.

**1d. Fix the "Not listed on visible label" case.** Caroline photographed the
front of her Naturium, so the scan captured
`ingredients_found = ["Not listed on visible label"]`. The scan UI should say
plainly it needs the ingredients panel. Trivial copy fix, high real-world value.

### Phase 2 — Re-link and clean (data, not code)

- Run the custom-entry relink sweep (already in the backlog), EXACT matches only.
- Normalize brand casing: `Round Lab` (96) vs `ROUND LAB` (6); `I'm From` (34)
  vs `I'm from` (1).
- Fix one corrupted row: `custom_brand = "I'm From"` on an Anua product.
- **Then re-measure.** The residual custom-entry count is the honest coverage
  gap, cleanly separated from the bug. Falsifiable prediction: the residual is
  dominated by Western brands. If it is mostly obscure Korean products, the
  answer is catalog-pipeline work instead.

### Phase 3 — Earn the Korean recommendation (the bridge, scoped down)

Only after Phase 1, and only where it genuinely wins. **Sunscreen is the honest
wedge**: the catalog has **673 Korean sunscreens, 665 with full INCI, 181
tinted** — and Caroline is fair, burn-prone, post-Accutane, in a high-UV climate,
with sun protection already named as her #1 priority. Korean sunscreen
superiority is the best-documented claim in K-beauty.

**Guardrails, non-negotiable:**
- The bridge must be free to conclude **"keep what you have."** Her Naturium
  moisturizer is a good product. A recommender that must always find a Korean
  swap is exactly the algorithmic surface the Yuri Sole Authority Principle
  exists to prevent.
- **Buy-guidance is where we have already caused harm.** Yuri recommended
  YesStyle to Bailey, vouched for it, and the result was a 2-month order, a
  refund fight, and driver harassment. Retailer policy is unchanged: recommend
  Olive Young Global / Soko Glam / iHerb; never YesStyle, Stylevana,
  StyleKorean; Amazon only via official brand storefronts.
- **In-store is a genuine answer here.** COSRX, Beauty of Joseon, Anua, Laneige
  and others are increasingly on US shelves. "The Korean sunscreen at your
  Target" answers Caroline's objection without arguing with it, without shipping
  risk, and without touching the catalog.

### Explicitly NOT doing

- **No Western catalog.** Killed by the 15:1 acquisition data and by the free
  competition (INCI Decoder, SkinSort, Yuka).
- **No public-surface repositioning.** 525 Bing citations/week exist *because*
  we are the Korean authority. Every public/GEO surface stays Korean-only.
- **No "K-beauty advisor" → "skincare advisor" rebrand.** The acquisition-layer
  reframe was falsified. The subscriber-side rule is narrower: *you advise the
  whole shelf you can see; you never go blind or hand-wave on a product the user
  has shown you.*

---

## Where the two opposed strategists converged

They were assigned opposite positions and each abandoned part of their brief
when the data contradicted it. Both landed on the same split:

**Public stays Korean. Private per-user shelf data covers whatever the
subscriber owns.**

- The in-store advocate killed its own drugstore-seed proposal after its
  falsification test came back 15:1, and withdrew the acquisition-layer
  repositioning entirely: *"Nothing Western-facing gets built."*
- The moat advocate conceded the one thing it had held absolutely: *"Do I still
  hold 'no Western INCI ever'? No... a $24.99/mo advisor that claims to check
  interactions cannot leave a paying user's actives name-inferred when verified
  INCI is one lookup away."* It draws the line at **public, indexed, cited** —
  private per-user shelf data is invisible to retrieval engines and dilutes no
  citation.

Both independently arrived at: **private per-user INCI, never a public catalog
row.** That is the plan above.

**The moat advocate's classification of the 25 unlinked rows** (worth keeping,
because it corrects the headline): ~10 are devices/routine steps that should be
custom entries, ~7 are Korean products the catalog holds (relink), ~8 rows / 6
distinct products are genuinely-absent Western items across 2 users. The
"68% invisible shelf" is really **~22% genuinely-Western, concentrated in two
people we know by name.** The single largest class is a metric artifact.

It also caught something I missed: **Medicube PDRN Pink Peptide Eye Cream and
the Anua Rice Ceramide serum are KOREAN products genuinely missing from the
Korean catalog.** Worth a look at why the daily Olive Young pipeline never
landed them — a specialist-catalog freshness question, not a positioning one.

## The open question — now tested

Both fallback plans assumed Yuri can retrieve a Western product's INCI via
`web_search`, and nobody had verified it. **Tested against the live Brave API
with Caroline's actual products. It works well.**

```
"Naturium Multi-Peptide Moisturizer ingredients list"
  -> incidecoder.com/products/naturium-multi-peptide-moisturizer  (TOP HIT, her exact product)
     "Aqua, Glycerin, Dimethicone, Simmondsia Chinensis Seed Oil, Squalane,
      Glyceryl Stearate, Cetyl Alcohol, Niacinamide, Palmitoyl Tripeptide-5..."
  -> skinsort.com  "...detailed analysis of 48 ingredients"

"Byoma Balancing Toner full ingredients INCI list"
  -> incidecoder.com/products/byoma-brightening-toner
     "Water, Sodium Lactate, Dipropylene Glycol, Glycerin, Salix Alba Bark
      Extract, Lactic Acid, Diglycerin, 1,2-Hexanediol, Urea..."
```

The INCI arrives **in the search snippet itself** — no page fetch required — and
INCI Decoder / SkinSort are exactly the structured sources this needs. So the
private-Western-resolver fallback is **not needed**, which removes the last
piece of Western data anyone proposed storing centrally.

**One real hazard, visible in that same output.** The Byoma query returned the
*Brightening* Toner and the *Milky* Toner; Caroline owns the *Balancing* Toner.
Product-line variants differ in actives — that is the difference between lactic
acid present and absent. So the rule must be: **Yuri only records an INCI whose
product name matches what the user actually owns, and says so when she cannot
confirm the exact variant.** A near-miss INCI in a safety check is worse than an
honest "I need a photo of the label." This is the same discipline as the
v10.6.5 wrong-product class and the Tool-Call Honesty rule.

Scanning the label remains the higher-confidence path; web lookup is the
convenience path when the user cannot photograph it.

## Ship-guard note

Phase 1 is a **safety defect in a paying subscriber's core flow** — a HIGH-severity
conflict rule that exists and cannot fire — not a new feature. Phase 2 is data
cleanup already on the backlog. Both clear the freeze. **Phase 3 is a genuine
feature and should be gated on the owner's call**, and ideally on Phase 2's
residual measurement.
