# Profile Capture Gaps — July 29 2026

Work session prompted by Bailey↔Caroline texts and a live read of Caroline's
(`cubrumitt@yahoo.com`) two-day transcript. Caroline is the strongest real user
signal to date: 13 user messages across two sessions, a next-day return, 5
products added to her library, 2 label scans, and agreement to a baseline photo.

## The false alarm (recorded so nobody re-raises it)

An initial audit reported "zero of 37 users have a profile row," including Bailey
with 243 messages. **That was a query error, not a defect.** `ss_user_profiles`
has a surrogate `id` PK and a separate `user_id` FK; the audit joined
`profiles.id = auth.users.id`. All 37 profiles exist and are populated. Any
future audit of this table MUST join on `user_id`.

Caroline's profile is complete and correct: `plan=pro_monthly`,
`onboarding_completed=true`, combination / 25-30 / Fitzpatrick 1 (`estimated`) /
humid / Kansas City, 8 concerns, 1 allergy, 3 medical_history rows. The v11.10.0
clinical-honesty work is functioning — her Accutane history landed in
`medical_history`, not `allergies`, and her Fitzpatrick is stamped `estimated`
rather than passed off as stated.

## Gap 1 — Single-file upload only (committed to Bailey)

`LabelScanner.tsx` and `shelf-scan/page.tsx` both use bare `<input type="file">`
with no `multiple`, no drag-and-drop, and an `onChange` that reads only
`files[0]`. A user photographing five products must run five round trips.

Caroline hit exactly this: she asked Yuri to add five products, and four of the
five saved as blind custom entries because label images were never captured for
them. Multi-upload is the difference between "I'll scan my shelf" and "I'll do
it later."

**Fix**: `multiple` on the gallery inputs, drag-and-drop, a queue that compresses
and scans sequentially (the `/api/scan` route stays one-image-per-call — batching
server-side would risk the 60s function budget), per-item progress and per-item
failure isolation. Camera capture stays single-shot; `capture="environment"`
with `multiple` is meaningless on iOS.

## Gap 2 — `location_text` never becomes coordinates

`ss_user_profiles` carries both `location_text` and `latitude`/`longitude`.
Onboarding writes only the text. Coordinates are populated by exactly one path:
the browser-geolocation button on `/profile`, which a user must find and click.

Result, verified live:

| user | location_text | lat/lon |
|---|---|---|
| Caroline | Kansas City | **absent** |
| Kim Wells | Iowa | **absent** |
| Bailey | Austin, Texas | present |
| Scott | Elk Grove, California | present |

The two newest paying subscribers have no coordinates, so **every weather-driven
surface is dark for them**: `get_current_weather` falls through its profile
fallback and returns "Could not determine location," the dashboard weather card
has nothing to render, and UV-based sun-protection advice cannot fire. Yuri told
Caroline that Kansas City's seasonal humidity swing is half of why her skin
seesaws — and she cannot actually read the weather there.

**Fix**: geocode `location_text` at onboarding-finalize time using the
Open-Meteo geocoding API. A working `geocodeCity()` already exists at
`src/lib/yuri/tools.ts` — promote it to `src/lib/geo/geocode.ts` and call it
from both places rather than writing a second one. Free, no API key, same
provider already used for weather. Backfill Caroline and Kim.

Failure must be silent and non-blocking: a profile without coordinates is the
status quo, and geocoding is a convenience, never a gate on finishing onboarding.

## Gap 3 — No name, anywhere

There is no `name`/`first_name` column on `ss_user_profiles`, the onboarding
prompt never asks, and the extraction schema has no field for it. Yuri has been
advising Caroline for two days without knowing she is Caroline.

**Fix**: add `first_name`, extract it when volunteered, surface it in
`memory.ts` context. Asking is optional and refusable — a name is rapport, not
clinical data, and Yuri should never interrogate for it.

## Gap 4 — `sun_history` was structurally invisible (LARGELY FIXED Jul 28)

Caroline answered the burn question ("I do burn easily in the sun initially")
and `sun_history` still landed NULL. Two of the three causes were fixed earlier
the same day in commits `578029a` and `1324686`:

- `ALL_FIELDS` now lists `medical_history` and `sun_history`, so an unanswered
  safety question is visible to Yuri instead of silently absent.
- `fitzpatrick_source` now records `estimated` for a derived value instead of
  hardcoding `stated`.

What remains is narrower: a burn/tan answer that establishes Fitzpatrick does
not also seed `sun_history`, so a partial answer still leaves the cumulative-UV
field empty. Verify against live data before changing extraction — this may be
prompt guidance rather than code.

## The invisible shelf (measured July 29 2026)

Across every real user, **25 of 37 library products (68%) are custom entries with
no catalog link**. Three distinct causes, and conflating them produces the wrong
fix:

**1. Correct behavior.** Devices and actions — "Ice roller", "LED mask",
"Shower / cleanse", "Cool water rinse" — should never have a catalog row.

**2. Stale rows, not a live bug.** Several are Korean products the catalog holds
richly (Anua 242 SKUs, Round Lab 96, Medicube 83, I'm From 34). Empirically
tested against the live resolver:

```
RESOLVED  "Anua Heartleaf 77% Soothing Toner"   -> Anua | Heartleaf 77% Soothing Toner
RESOLVED  "Round Lab Dokdo Cleanser"            -> Round Lab | 1025 Dokdo Cleanser
NULL      "Anua Rice 70 + Ceramide Glow Milky Toner"  (name merges TWO products)
NULL      "Anua Heartleaf 70% Rice Ceramide Serum"    (genuinely absent)
NULL      "Medicube PDRN Pink Peptide Eye Cream"      (genuinely absent)
```

**The resolver is not broken today** — every stale row predates 2026-07-21, the
v11.10.0 resolver fix. This is a one-time re-link sweep (already in the CLAUDE.md
backlog as "Custom-entry relink sweep"), NOT code work. Do not "fix" the
resolver based on these rows.

Two data-quality items surfaced alongside: brand-casing duplicates
(`Round Lab` 96 vs `ROUND LAB` 6; `I'm From` 34 vs `I'm from` 1) and one
corrupted row (`custom_brand = "I'm From"` on an Anua product).

**3. Genuinely uncovered.** Caroline's Dr. Dennis Gross, Byoma, Kiehl's,
Naturium, plus Colorescience and Hero Cosmetics. No relink reaches these; they
are not in the catalog and are not Korean.

## Acquisition intent is Korean-dominated (measured July 29 2026)

Against all anonymous widget traffic — 226 visitor messages from 54 real
visitors (`total_messages > 0`, the honest denominator):

| signal | messages |
|---|---|
| Korean-intent (korea, k-beauty, cosrx, anua, glass skin, centella, olive young…) | **45** |
| Western-brand or in-store (cerave, cetaphil, target, ulta, drugstore, "in store") | **3** |

Roughly **15:1**. Of the 3, one is Caroline pre-signup, one lists a La
Roche-Posay inside an otherwise SKIN1004-led Korean routine, and one describes a
bare Cetaphil baseline before asking for K-beauty help.

**Cold acquisition and paying retention are different populations.** The widget
measures who arrives; Caroline's library measures what a subscriber owns. A plan
that treats one as evidence about the other will be wrong in one direction or
the other.

## Non-goals

Expanding the catalog to Western brands. Caroline uses Byoma, Naturium, Kiehl's,
and Dr. Dennis Gross and subscribed anyway; the value was Yuri's read on her
post-Accutane barrier, not catalog coverage. Western ingredient lookup is free
elsewhere; 6,060 translated Korean products with INCI data is not. The
Western→K-beauty dupe bridge is tracked separately.
