# Why two real Korean products aren't in the catalog (July 29 2026)

Phase 2 found that `Medicube PDRN Pink Peptide Eye Cream` and
`Anua Heartleaf 70% Rice Ceramide Serum` are genuinely absent, in brands we
otherwise cover richly (Medicube 83 SKUs, Anua 242). That looked like it might be
a broken pipeline. **It is not.**

## The pipeline is healthy

| Signal | Value |
|---|---|
| New products created, last 7 days | **19** |
| New products created, last 30 days | 111 |
| Newest product | today, 07:00 UTC |
| Staging rows in `failed` state | **0** |
| Latest `olive_young` incremental run | completed, today 06:00 UTC |

Staging distinct IDs seen in 7d = 19, staging rows = 19, promoted = 19. **Every
new thing the scraper saw got promoted.** There is no backlog, no silent failure,
no stuck queue. This is NOT the May 2026 P0 class where the scraper returned zero
for two weeks.

## The actual cause: the daily scrape reads only the head of each listing

`src/app/api/cron/scan-korean-products/route.ts` runs the scraper with
`maxPagesPerCategory: 3`, and in `olive-young.ts` that value is the number of
**"MORE" button clicks** on Olive Young's Vue SPA listing page, not pages of a
paginated index.

So each daily run loads roughly the top ~96 products per category and stops.
Because Olive Young orders listings by popularity, the same head is re-read every
day — which is exactly the observed run shape:

```
olive_young / incremental / completed
products_scraped 96 · products_duplicates 94 · products_processed 0
```

That is not a bug report. It is a **deliberately cheap daily job** doing what it
was configured to do: catch new arrivals that surface near the top. The original
catalog (5,404 processed staging rows) came from a `full` run at
`maxPagesPerCategory: 20`.

The two missing products sit deeper in their categories than 3 MORE-clicks
reaches, and were never scraped — confirmed by zero staging rows matching `PDRN`
or `Rice Ceramide`.

## Why this matters less than it looks

Both products are **line variants of products we already carry**: the catalog has
Medicube PDRN Pink Peptide *Serum*, *Ampoule*, *Ampoule Set*, *Ampoule Limited
Set* and *Ampoule Mask* — just not the eye cream. Anua has 242 SKUs including
several Rice/Ceramide items. Yuri can already reason about the line, the actives,
and the brand; what she lacks is that one SKU's exact INCI and price.

And Phase 1 now closes even that gap per-user: a subscriber who owns one can have
its ingredients captured from a label photo.

## Options, if this is ever worth fixing

Not recommended right now — it is catalog depth, and depth is not what the
measured evidence says is blocking conversion. Recorded so the choice is
informed:

1. **Raise `maxPagesPerCategory`** from 3 to, say, 8 on the daily run. Simple,
   but multiplies runtime against a Vercel function budget, and the marginal
   products are by definition less popular.
2. **Periodic deep sweep.** Keep the cheap daily head-scrape, add a weekly or
   monthly `full` run at `maxPagesPerCategory: 20` — the same shape as the
   original import. Best cost/coverage ratio.
3. **Demand-driven backfill.** When a subscriber names a product we don't carry,
   queue that specific SKU for a targeted scrape. Highest precision, and it
   spends effort only on products a real person actually owns. This is the one
   that fits the app's philosophy: let real usage, not volume, direct the work.

**Recommendation if/when it comes up: option 3, then option 2.** Do not raise the
daily click count — it costs runtime every single day to chase products nobody
asked for.

## The honest summary

The catalog has a **depth** limit, not a freshness failure. New releases that
chart well DO get picked up daily. Deep-catalog line variants do not, and that
was a design decision made for cost, not an accident.
