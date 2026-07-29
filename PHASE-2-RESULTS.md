# Phase 2 — Relink, Dedupe, and the Honest Residual (July 29 2026)

Phase 2 was planned as "run the relink sweep, merge brand casing, then
re-measure." Every unlinked row was probed against the **live resolver** before
anything was written. That measurement corrected two assumptions from the
planning session, and the corrections are the useful output.

## Correction 1 — the relinkable set is 2 rows, not "most of the Korean ones"

Probing all 25 unlinked `ss_user_products` rows through
`resolveProductByNameStrict`:

```
RESOLVED  Round Lab | Round Lab Dokdo Cleanser      -> Round Lab | 1025 Dokdo Cleanser
RESOLVED  Anua      | Anua Heartleaf 77% Soothing Toner -> Anua | Heartleaf 77% Soothing Toner
                                                     ... 23 others NULL
relinkable=2  unresolved=23
```

The planning estimate of ~7 relinkable Korean rows was too high. The real number
is 2.

## Correction 2 — brand casing is NOT a resolver bug

The plan asserted that casing duplicates (`Round Lab` 96 vs `ROUND LAB` 6) were
"likely CAUSING some resolver misses." **They are not.** Search uses `ilike`, so
case never mattered:

```sql
SELECT count(*) FROM ss_products WHERE brand_en ILIKE 'anua';  -- 242 (all casings)
```

Confirmed against the resolver directly — a minority-cased brand resolves fine:

```
RESOLVED  AESTURA Atobarrier 365 Cream  ->  Aestura | Atobarrier 365 Cream
          (AESTURA has 4 products; Aestura has 103)
```

So the casing merge is a **display-consistency** fix (108 products, 52 brands),
worth doing because `brand_en` is rendered to users and to Yuri and a brand facet
would otherwise list the same brand twice. It unlocks **zero** additional
matches. Do not sell it as a matching fix.

## What actually blocks the remaining Korean products

Not casing, and not a broken resolver. Two distinct causes, both benign:

**A user-typed extra term.** Bailey's stored name is *"Anua Rice 70 **+ Ceramide**
Glow Milky Toner"*. The catalog has *"Rice 70 Glow Milky Toner"* — the product
exists. The spurious "Ceramide" term fails the all-terms match:

```
NULL      Anua Rice 70 + Ceramide Glow Milky Toner   -> (none)
RESOLVED  Anua Rice 70 Glow Milky Toner              -> Anua | Rice 70 Glow Milky Toner
RESOLVED  Anua Rice 70 Glow Milky                    -> Anua | Rice 70 Glow Milky Toner
```

This is the resolver being **correctly conservative**. Loosening all-terms
matching to tolerate extra tokens is exactly how "Hero Mighty Patches" became
Dr.ppae Honey Heel Patch (v10.7.0) and how a routine step named "Shower /
cleanse" became "your nightly cleanser" in Bailey's face. **Not changing it.**
The right fix is per-row and human-verified, or simply letting the user correct
the name in conversation.

**Genuinely absent from the catalog.** `Medicube PDRN Pink Peptide Eye Cream`
does not exist in any casing — the catalog has PDRN Pink Peptide *Serum*,
*Ampoule*, *Ampoule Set*, *Ampoule Limited Set*, and *Ampoule Mask*, but no eye
cream. Same for the Anua Heartleaf 70% Rice Ceramide serum. These are Korean
products the Olive Young pipeline has not landed — a **catalog freshness**
question, not a positioning or resolver one.

## The residual, measured

This is the number Phase 3 was supposed to be gated on. Of 25 unlinked rows:

| Class | Rows | Note |
|---|---|---|
| Devices / routine steps | **10** | Ice roller, LED mask, "Shower / cleanse", "Cool water rinse", "Moisturizer (TBD)". Correct as custom entries — no catalog links these. |
| Relinked by this migration | **2** | Verified pairs, applied. |
| Korean, genuinely absent from catalog | **3** | Medicube PDRN eye cream (x2 rows), Anua Heartleaf 70% Rice Ceramide. Pipeline gap. |
| Korean, blocked by a user-typed name | **1** | Anua Rice 70 + Ceramide Glow Milky Toner. Product exists. |
| Western, genuinely absent | **9** | Dr. Dennis Gross, Byoma, Kiehl's, Naturium (Caroline); Colorescience x2, Hero Mighty Patch x2 (Bailey). |

**The honest headline: the "68% invisible shelf" is 40% not-products, 8%
relinkable, 16% catalog-freshness, and ~36% genuinely-Western.**

Phase 1 already covers every one of these classes, because it attaches INCI to
the *custom entry* regardless of why the entry is custom. A device gets no
ingredients (correctly); a Byoma toner gets them from a label scan or a lookup.

## Duplicate rows (found, not fixed)

Four exact-duplicate pairs exist in Bailey's library: Medicube PDRN Eye Cream x2,
Hero Mighty Patch/Patches x2, Colorescience SPF x2, plus "Shower / cleanse",
"Cool water rinse", "Ice roller" and "LED mask" appearing twice each from
separate routine saves.

**Deliberately not deduped here.** The pairs differ in `created_at` and
sometimes `status` (one "Shower / cleanse" is destashed, the other active), so
merging them is a judgment about which row is authoritative, not a mechanical
sweep. Doing it blind risks deleting the row a routine references. Left for a
session that can inspect each pair, or for Yuri to resolve naturally in
conversation.

## Applied

`scripts/migrations/phase2_relink_and_dedupe.sql`:
1. Relink the 2 verified pairs (guarded on exact stored name + target product
   still existing, so re-running is a no-op).
2. Fix one corrupted row: `custom_brand = "I'm From"` on an Anua product. Yuri
   reads `custom_brand` as fact, so this told her the user owned a product they
   do not own.
3. Normalize 103 products to their majority brand casing, **skipping 5 genuinely
   tied groups** (dewdap, eiom, entropy makeup, huecalm, the tool lab — each 1
   vs 1) rather than guessing.

Cosmetic note: majority-rule capitalizes `numbuzin` → `Numbuzin` and `mixsoon` →
`Mixsoon`, though both brands officially style themselves lowercase. Consistency
was preferred over per-brand special-casing; revisit if it ever looks wrong on a
product page.

## Follow-up worth scheduling

Check why the daily Olive Young pipeline never landed **Medicube PDRN Pink
Peptide Eye Cream** or the **Anua Heartleaf 70% Rice Ceramide serum**. Both are
real, current Korean products in brands we otherwise cover richly (Medicube 83
SKUs, Anua 242). If popular new releases are being missed, that is a specialist-
catalog freshness gap — the one kind of coverage problem that *does* argue for
pipeline work.
