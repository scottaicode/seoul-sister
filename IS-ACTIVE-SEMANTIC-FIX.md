# `is_active` — the publish-gate misuse (Aug 4 2026)

**Status: FIXED.** Record of what was wrong, what was measured, and what was
deliberately left alone.

## The column means one thing and was used for two

`supabase/migrations/20260216000001_foundation_schema.sql:51`

```sql
is_active BOOLEAN NOT NULL DEFAULT true,  -- "active" as in active ingredient vs. inactive
```

It is a **functional classification**: retinol and niacinamide are actives; water,
xanthan gum, and preservatives are not. It is **not** a published/enabled flag,
and `ss_ingredients` has no such column — the pollution guard
(`excludePollutedIngredientRows`) is the only quality gate.

Six read paths used it as a publish gate anyway. The result was that a
legitimately-classified excipient — or a **misclassified real ingredient** —
disappeared from the surfaces that feed the AI-citation moat.

## What made the conflation plausible

Two things pushed junk into `is_active = false`, so the flag *looked* like a
quality signal:

1. `scripts/cleanup-polluted-ingredients.ts:100` deactivated 2,614 unsplit-INCI
   dump rows rather than deleting them ("reversible"). All 2,027 rows the
   pollution guard rejects today are `is_active = false`; **zero** are `true`.
2. `src/lib/pipeline/ingredient-matcher.ts` has two silent paths to `false` —
   `:270` defaults false on malformed LLM JSON, and `:308`
   (`insertMinimalIngredient`) hardcodes false when the Sonnet call fails.

So the column's live state is a blend of DB default, LLM judgment, LLM failure,
and a cleanup script. Using it as a gate is unsound in **both** directions.

## Measured blast radius (live catalog)

| Metric | Value |
|---|---|
| Ingredient URLs the pollution guard alone would publish | **12,863** |
| URLs actually in the sitemap (guard + `is_active`) | 7,641 |
| **Real pages missing from the sitemap** | **5,222** |
| …of those, with ≥100 product links | **198** |
| Product-link mass behind the missing pages | 120,926 |

All eight sampled missing pages return **200 with full product lists** —
`sodium-hyaluronate`, `panthenol`, `allantoin`, `ceramide-np`, `squalane`,
`beta-glucan`, `butylene-glycol`, `xanthan-gum`. The pages exist and are good.
We simply were not telling crawlers about them.

## A claim I made and had to retract

I first reported this as "198 major ingredients are misflagged." **That was
wrong, and measuring it corrected me twice.**

`is_active` is a *noisy but broadly correct* classifier. Against a hand-labelled
probe, true actives are 235/337 flagged `true`, and excipients are mostly
`false`. Butylene Glycol, Aqua, Xanthan Gum, Disodium EDTA, Carbomer and
Fragrance are `false` and that is **correct** — they are not actives.

Classifying the 7,310 `false` rows by whether their own `function` text
describes an active benefit:

| Verdict | Rows | ≥100 links |
|---|---|---|
| correctly false — excipient | 2,152 | 93 |
| unclassified | 4,463 | 91 |
| **misflagged — function describes an active benefit** | **594** | **11** |
| mixed (e.g. humectant + preservative) | 101 | 3 |

Only **11 major rows** are genuinely misflagged, and 3 of those 11 are false
positives of my own heuristic (BHT, orange peel oil, and a formulation
stabiliser — all excipients whose `function` merely contains "antioxidant").

**So the fix is NOT to change the flag or backfill the data.** The fix is to
stop using a functional classifier as a publish gate. That resolves all 5,222
missing pages, including the 8 genuinely-misflagged heroes, without touching a
single row.

## The pattern the codebase already converged on

Two surfaces were audited independently in July and both landed in the same
place — use the pollution guard as the quality gate, demote `is_active` to a
sort key or a badge:

- `src/app/ingredients/[slug]/page.tsx:137-139` explicitly rejects filtering on
  it: requiring `is_active` "would 404 4,962, including the real Ceramide NP
  (1,468 links), Hydroxyacetophenone (1,340) and Citric Acid (1,161)."
  It uses `is_active` only as a **sort tiebreak** in `pickBestSlugMatch`.
- `src/app/api/ingredients/search/route.ts:32` uses
  `.order('is_active', { ascending: false })` — sort, not filter — plus the
  pollution guard. Its comment states the intent: "it serves inactive rows too."

This change applies that same treatment to the six remaining sites.

## Changed

| # | Site | Was | Now |
|---|---|---|---|
| 1 | `src/app/sitemap.ts:61` | `.eq('is_active', true)` | removed — guard is the gate |
| 2 | `src/app/ingredients/page.tsx:98` | `.eq('is_active', true)` + guard-by-flag | pollution guard, `is_active` as sort |
| 3 | `src/app/blog/[slug]/page.tsx:165` | `.eq('is_active', true)` | pollution guard only |
| 4 | `src/app/api/admin/ingredients/context/route.ts:92` | `.eq('is_active', true)` | pollution guard only |
| 5 | same file, pain-point query | `.eq('is_active', true)` | **kept** — see below |
| 6 | `scripts/enrich-ingredients.ts:123` | `.eq('is_active', true)` | ordered by product links |

**Site 5 is deliberately kept.** A pain-point query ("what treats redness?")
genuinely wants functional actives — that is case (A), the column used for its
real meaning. Removing it there would surface solvents as treatments.

## Deliberately NOT done

- **No data backfill.** Flipping the 8 genuinely-misflagged heroes to `true`
  would be a second, independent change with its own blast radius (it alters
  the "Active" badge, actives-stacking detection in
  `ingredient-overlap.ts`, and dupe scoring). The publish-gate fix already
  recovers their pages. If someone later wants the badge correct, that is a
  separate scoped change with its own verification.
- **No change to (A)-class sites** — product-page badges, actives-stacking
  detection, dupe key-ingredient scoring, Yuri's condensed-overview gate. Those
  use the column for exactly what it means.
- **No change to the `ingredient-matcher.ts` silent-false paths.** Real, but a
  write-path defect, and the read paths no longer depend on the flag being
  right. Worth its own change.

## Verification

- Sitemap URL count before/after, measured against the live catalog.
- Sampled missing pages confirmed 200 with product lists **before** adding them
  to the sitemap — never ask crawlers to index a URL you have not opened.
- Pollution guard confirmed still applied on every touched query: no
  `@`/bracket/dump row may enter the sitemap (the July 30 regression).
- Guard tests execute the real query-builder chain and fail when the filter is
  reintroduced.

## Postscript — the bigger bug this exposed

Removing the filter recovered **nothing** at first. Verifying the live sitemap
after deploy showed only 971 ingredient URLs, truncated mid-alphabet (it ended
at "water"), with `allantoin` present but `panthenol` and `sodium-hyaluronate`
absent.

**PostgREST caps an unpaginated select at 1,000 rows by default and reports no
error.** The sitemap had been silently truncated the whole time — ~1,000 of
12,863 eligible ingredient URLs, and ~1,000 of 5,946 products. That predates
this fix; the cap, not the filter, was the binding constraint. Both queries now
page via `.range()`.

This is the same class as a swallowed error: **the result looks complete and is
not.** It was only visible because the fix was verified against the live
surface rather than against the code.

## Second postscript — the fix published dead URLs, and that was caught too

Sampling the live sitemap after the pagination fix found **~14% of ingredient
URLs 404ing** — roughly 2,018 dead URLs handed to crawlers on the citation
surface. Removing a filter that was withholding pages had also admitted pages
that do not render.

Two causes, and **neither is a pollution-guard failure** — both names pass it
legitimately:

1. **Slug collision with a polluted twin.** `[01 Black]Iron Oxide Black` and
   `(01 Black)Iron Oxide Black` share a slug. The resolver drops polluted
   candidates and refuses the slug when the surviving set is empty. Correct
   behaviour; the sitemap simply should not have listed it.
2. **The resolver's `ilike` prefilter cannot match some names.**
   `Sodium Acetylated Hyaluronate (0.000002ppm)` becomes the pattern
   `%sodium%...%0%000002ppm`, and the broad fallback searches only the first
   word with a 200-row cap, so the row is unreachable.

The fix defers to the resolver rather than loosening it — loosening was the
exact defect fixed earlier the same day (serving the wrong row). A URL that
cannot be proven reachable is not advertised.

Measured: **0 predicted 404s**, 7,734 ingredient URLs published, and all 16
recovered hero ingredients still present. Deliberately conservative — it
withholds uncertain URLs rather than risking dead ones on the moat.

**The lesson worth keeping:** every stage of this fix looked correct in code
and was wrong on the live surface. Removing the filter changed nothing (row
cap). Fixing the cap published 404s (unreachable rows). Only sampling real URLs
after each deploy surfaced either one.
