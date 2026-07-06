# Blog "Key Ingredients Mentioned" — Extraction Fix (July 2026)

## Symptom
On `/blog/did-cosrx-snail-mucin-break-you-out-heres-why`, the "Key Ingredients
Mentioned" section rendered only **one** chip (Betaine) despite the body naming
at least six ingredients (snail secretion filtrate, betaine, niacinamide,
centella/cica, ceramides, sodium hyaluronate).

## Root cause (diagnosed, not guessed)
Chips are computed at **render time** in `src/app/blog/[slug]/page.tsx`, not at
ingest. The webhook (`/api/admin/content/ingest`) only stores the LGAAS payload;
there is no key-ingredients column or join table.

The chips were sourced from `linkedIngredients` — the set of names that
`linkIngredients()` **itself newly hyperlinked**. But LGAAS authors the article
markdown with the ingredient links **already baked in**
(`[betaine](…/ingredients/betaine)`, `[niacinamide](…)`, `[ceramide](…)`, etc.).
`linkIngredients()` deliberately **skips text already inside `<a>` tags**, so every
LGAAS-pre-linked ingredient was excluded from `linkedIngredients` — and therefore
from the chips.

Betaine survived only by luck: it was mentioned 3× (link text + href slug + one
stray plain-text mention). The linker caught the plain-text mention, so "Betaine"
was the only name it added → the only chip.

Verified against the live DB:
- All 7 ingredient links in the body are LGAAS-authored markdown links.
- Betaine: 3 total mentions, 1 markdown link, 1 stray plain-text → 1 chip.
- Prose uses common names the exact-`name_en` matcher can't hit: "centella",
  "cica" (0 encyclopedia rows), "ceramides" (plural breaks `\bCeramide\b`),
  "snail secretion filtrate" (encyclopedia `name_en` is "Snail Mucin").

This under-promise affects **every** LGAAS post that pre-links its ingredients,
not just the COSRX post. The chips are internal links that Google/LLM crawlers
follow, so this is a GEO/discoverability quality bug (allowed lane under the
ship-guard freeze).

## Fix — shipped in two sequenced parts

### (a) Source chips from ALL ingredient links in the rendered HTML (shipped first)
Stop deriving chips from `linkedIngredients`. Instead, after `linkIngredients()`,
scan the **final HTML** for every `href` pointing at `/ingredients/<slug>`
(relative or `seoulsister.com`-absolute — both forms LGAAS emits), dedupe by slug,
and use the link's **own anchor text** as the display label. This captures both
LGAAS-authored and linker-added links, and does not depend on the extracted slug
matching a `name_en`-keyed map entry (LGAAS sometimes slugs from INCI).

- New helper `extractIngredientChips(html)` in `src/lib/utils/ingredient-linker.ts`.
- `src/app/blog/[slug]/page.tsx` renders chips from that instead of
  `linkedIngredients`.
- Zero over-extraction risk: only surfaces links already present in the HTML.

Result on the COSRX post: 1 chip → 7 chips (betaine, retinol, salicylic acid,
niacinamide, hyaluronic acid, centella asiatica, ceramide), each a valid
`/ingredients/` link.

### (b) Common-name / alias map for prose mentions (shipped second)
For posts where LGAAS did **not** pre-link an ingredient, extend the matcher so
natural prose common-names still link. Hand-curated allowlist only — never
substring — to avoid "acid"/"water"/"oil" over-extraction.

- `IngredientLink` gains optional `aliases?: string[]`.
- `buildIngredientMap()` attaches a curated alias set (e.g. cica/centella →
  Centella Asiatica Extract; snail mucin/snail secretion filtrate → Snail Mucin;
  ceramide plural tolerance) to the matching canonical entry.
- `linkIngredients()` matches canonical name OR any alias (whole-word,
  case-insensitive, first plain-text occurrence, still skips existing `<a>`).

## Verification
- COSRX post: all six target ingredients present as chips, each linking to its
  encyclopedia page.
- 2–3 other recent posts: chip set diffed before/after — no chip for "acid",
  "water", "extract", "oil", or other generic tokens.
- `tsc` + `build` green.
