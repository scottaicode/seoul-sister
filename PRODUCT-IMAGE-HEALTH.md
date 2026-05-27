# Product Image Health — System of Record

**Last updated**: May 26 2026 (after v10.8.13 catalog-wide backfill)
**Owner**: whoever next touches product imagery
**Status**: catalog ~91% covered with images; ~507 still blank; no self-healing yet

This document is the single source of truth for how product images work in Seoul
Sister, why they go blank, what's been fixed, what remains, and the reusable
tooling. Read this before doing any image work — it captures hard-won lessons
(wrong-product pairings, silent dead URLs, PostgREST pagination) that are easy to
re-learn the expensive way.

---

## 1. How product images work (the pipeline)

Each row in `ss_products` has an `image_url TEXT` column. The UI renders it via
`LazyImage` → `proxyImageUrl()` → (for allow-listed CDN hosts) the `/api/img`
proxy, which fetches the origin image, sniffs the content-type, and streams it
back. The proxy exists because Safari/iOS and Firefox ORB block cross-origin
images served as `application/octet-stream` (which Olive Young does) and because
some brand sites block hotlinking by `Referer`.

**Where image_url comes from:**

| Source | Reliability | Notes |
|---|---|---|
| **Olive Young CDN** (`cdn-image.oliveyoung.com`) | **High** | Content-hashed UUID paths; effectively never drift. ~91% of catalog. The daily scraper's primary output. |
| Brand-direct / Shopify / YesStyle (`medicube.us`, `cdn.shopify.com`, `image.yesstyle.com`, `*.us`, etc.) | **Low** | Brand sites move files (404) and YesStyle hotlink-blocks (403). ~62% dead rate when sampled. The drift-prone minority. |
| `NULL` | n/a | Product never got an image. ~354 products, mostly the Feb-2026 seed cohort. |

**New-product image capture (WORKING, verified May 26 2026):**
The daily `scan-korean-products` cron captures images automatically:
- `src/lib/pipeline/sources/olive-young.ts:190-199` — extracts the listing
  thumbnail (`.unit-thumb img` → `src`/`data-src`) into `RawProductData.image_url`.
- `src/lib/pipeline/extractor.ts:167` — Sonnet extraction preserves it
  (`image_url: parsed.image_url ?? raw.image_url`).
- `src/lib/pipeline/batch-processor.ts:237` — inserted into `ss_products`.

**Implication**: products added since ~March 2026 are ~100% image-covered. The
blank-image problem is almost entirely the legacy Feb-2026 cohort + drift on old
brand-direct URLs. It is NOT growing for new products.

---

## 2. The three causes of a blank product image

A product renders as a gray box (`Package` fallback icon) for one of three
distinct reasons. They need DIFFERENT fixes — do not conflate them.

### Cause A — `image_url` is NULL
The product simply has no image. Visible as an empty box. ~354 products.
- **Fixable from staging** if the same product was scraped into
  `ss_product_staging` with an Olive Young image (~63 of these were fixed in
  v10.8.13).
- **Not fixable from staging** otherwise → needs a live scrape (deferred).

### Cause B — `image_url` is set but DEAD at origin (the *silent* bug)
The product *looks* like it has a photo, but the URL returns 404 (brand moved the
file) or 403 (YesStyle hotlink-block). Renders blank with **zero error signal** —
this is the most dangerous class because nothing tells you it's broken. ~118
products at audit; ~17 of the staging-fixable ones repaired in v10.8.13.
- **Fix**: re-point to the product's own Olive Young image (from staging, or a
  live lookup).

### Cause C — not a catalog product at all (custom entry / device)
In a user's library or routine, `ss_user_products.product_id` /
`ss_routine_products.product_id` can be NULL (schema made nullable in v10.3.3).
These are devices ("Ice roller", "LED mask"), actions ("Cool water rinse"), or
products the resolver couldn't match to the catalog ("Hero Mighty Patches",
"Anua Heartleaf 70% Rice Ceramide Serum"). **They will NEVER show a product photo
by design** — there's no catalog row to attach one to.
- Some of these ARE real products mis-saved as custom entries. They can be
  *relinked* to the catalog (see §4, Bailey's Ma:nyo example) — but ONLY when an
  exact match exists. Relinking to a similar-but-different product is the
  wrong-product error (§3).

---

## 3. The wrong-product discipline (NON-NEGOTIABLE)

> **A box icon beats a wrong photo.** Attaching the wrong product's image (or
> linking a custom entry to a similar-but-different catalog product) erodes trust
> faster than a missing image. This was earned across v10.7.0, v10.8.12, and a
> live mistake during v10.8.13 (a Green Tangerine *Serum* nearly got the *Cream*
> row's image).

Rules that every image/relink fix MUST follow:

1. **Exact-name match, or strict containment only.** Containment (catalog name is
   a substring of the staging name, or vice versa) is allowed ONLY when:
   - the **brand matches**, AND
   - the staging name is **not a multi-product bundle** (`Set`, `Double Pack`,
     `+`, `Special`, `Gift`, `Duo`, `Trio` markers) unless the product itself is
     a bundle, AND
   - the **product-category word sets are identical** — a `Cream` product must
     not take a `Cream Cleanser` or `Cream Ampoule` photo (category words:
     serum, cream, toner, essence, ampoule, oil, mask, cleanser, foam, lotion,
     pad, mist, balm, gel, patch, sheet, water, cushion, powder).
   - The surviving containment matches are then almost all "same product with a
     volume suffix" (`...50ml`, `...70P`, `...Jumbo Size Package`) — which is
     correct.
2. **Verify reachability at WRITE time.** Never write a URL you haven't just
   confirmed returns 200 with an image (or octet-stream from Olive Young). Staging
   URLs themselves can be dead — 3 were in the v10.8.13 run and were skipped.
3. **Verify the target row.** Confirm the `product_id` you're updating resolves to
   the product you think it does. (The v10.8.13 Green Tangerine Serum/Cream slip
   was caught only because the post-write verification re-read the row name.)
4. **Dry-run + eyeball before apply.** Print the product-name → staging-name pairs
   and scan for category/bundle mismatches before any write. This pass caught 11
   risky pairings in v10.8.13 and dropped the count from a loose 100 to a safe 80.

---

## 4. What's been done (chronology)

| Version | What | Scope |
|---|---|---|
| **v10.8.3** | Wired the `/api/img` proxy into `LazyImage` + content-type sniffing | Infra — makes octet-stream OY images render |
| **v10.8.6–v10.8.8** | `/browse` candidate ordering so image-bearing products surface first; ASC ordering surfaces reliable OY CDN ahead of drift-prone brand URLs | `/browse` visual quality |
| **v10.8.11** | (image part) diagnosed Bailey's blanks; deferred backfill | Diagnosis only |
| **v10.8.12** | Three-cause diagnosis of Bailey's library blanks (4 mis-linked custom + 1 null + 3 dead-URL) | Diagnosis |
| (post-12) | Relinked Bailey's **Ma:nyo Pure Cleansing Oil** custom entry → catalog product (the other 3 custom entries correctly refused — no clean catalog match) | Bailey's data |
| (post-12) | Re-pointed Bailey's **3 dead-URL products** (Green Tangerine Serum, PDRN Pink Peptide Serum, Acne Pimple Master Patch) to reachable Olive Young images; caught + corrected a wrong-row write | Bailey's data |
| **v10.8.13** | **Catalog-wide backfill**: 80 products (≈17 dead-URL + ≈63 null) re-pointed to their own Olive Young images from staging | Whole catalog |

**v10.8.13 before/after (catalog of 5,924):**

| Bucket | Before | After |
|---|---|---|
| Olive Young (reliable) | 5,337 | **5,417** (+80) |
| Other host (drift-prone) | 170 | 153 |
| Null | 417 | 354 |

---

## 5. What remains (the deferred backlog)

**~507 products still render blank** (354 null + 153 non-OY drift-prone), and they
have **no match in `ss_product_staging`**, so they can't be fixed from existing
data. They need a live Olive-Young-search scrape.

Plus structural gaps:

1. **No image-health cron.** Once a brand URL goes dead, nothing re-detects it. The
   ~153 remaining non-OY URLs will keep rotting silently. Dead-URL is invisible by
   nature (no error), so without active monitoring it only surfaces when a user
   like Bailey screenshots it.
2. **No live-scrape backfill.** Olive Young search is JS-rendered, so it needs
   Playwright. The infra exists (`OliveYoungScraper`) but only does category-listing
   and product-detail-by-URL, not search-by-name.
3. **Mis-saved custom entries persist.** Some users have real products saved as
   custom entries (NULL product_id) because Yuri's resolver missed them at save
   time. These show boxes AND lose the catalog linkage (no enrichment, no price).
   Only relinkable when an exact catalog match exists.

---

## 6. Reusable tooling

| Script | Purpose | Usage |
|---|---|---|
| `scripts/audit-catalog-images.ts` | Catalog-wide image health: null count, host distribution, sampled dead-URL rate, staging-fixability estimate | `npx tsx --tsconfig tsconfig.json scripts/audit-catalog-images.ts` |
| `scripts/backfill-catalog-images.ts` | Re-point dead/null images to own Olive Young image from staging. Strict matcher, write-time reachability, dry-run default | add `--apply` to write; `--sample=N` to limit |
| `scripts/check-bailey-library-images.ts` | Per-user (Bailey) owned + routine image state | diagnostic |
| `scripts/relink-bailey-custom-entries.ts` | Relink mis-saved custom entries to catalog (strict match) | pattern for per-user relink |
| `scripts/fix-bailey-product-images.ts` | Per-product dead-URL re-point (the Bailey 3) | pattern for targeted fixes |

**Re-running the backfill is safe and idempotent** — it only touches dead/null
images, verifies reachability, and never overwrites a working image. As the daily
scraper grows `ss_product_staging`, re-running picks up newly-available matches.
The PostgREST 1000-row cap is handled via `.range()` pagination (v10.8.6 lesson) —
any new query over `ss_products`/`ss_product_staging` must paginate.

---

## 7. Recommended next work (priority order)

See the "Recommended next steps" section the assistant delivered alongside this
doc. In short:

1. **Image-health cron** (highest leverage, ~half day) — periodically re-check
   image URLs, re-point newly-dead ones from staging, and **log what it can't fix
   so failures are visible, not silent** (v10.3.5 fire-and-forget lesson). This
   converts the invisible dead-URL bug into a monitored, self-healing one.
2. **Live-scrape backfill for the ~507 no-staging-match products** (~1 day) —
   extend `OliveYoungScraper` with search-by-name (Playwright), confidence-gate
   the match, write Olive Young images. Closes the "all products eventually have
   photos" promise for real catalog products.
3. **Custom-entry relink sweep** (~few hours) — find real products mis-saved as
   custom entries across all users, relink the exact matches (restores images AND
   catalog enrichment). Strict matching only.
4. **(Optional) Image reliability tier column** — `image_source_host` or a
   `image_reliable BOOLEAN` so `/browse` ordering and health checks don't have to
   re-derive reliability from the hostname each time.
