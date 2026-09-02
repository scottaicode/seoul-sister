# Widening the grading window 28 → 90 days (measured, NOT shipped)

**Status:** recommended, quantified, not implemented. Sep 1 2026.

## Why this and not another metric

The SEO learning loop's constraint is **trials, not instruments**. Three metrics
were considered as the escape from click-scarcity; two were measured and rejected:

| Metric | Verdict-capable? | Why |
|---|---|---|
| Clicks | Yes, but rarely | Only 3 pages have ≥10 clicks / 28d |
| Impressions | **No** | Solution-intent CTR 1.148% vs definitional 0.397% (2.9x) — grading raw impressions teaches the strategist to farm content this site measured as worthless. Also violates `conditionalBinomialTail`'s independence assumption (correlated bursts). |
| Position | **No** | 66.9% of 871 untouched queries clear `POSITION_DEADBAND` on pure churn; and absence is asymmetric (1,972 vanished vs 2,665 appeared) so drops disappear while improvements stay visible → systematically optimistic. See `[[seo-position-verdicts-rejected]]`. |

Widening the window adds **sample**. Nothing else changes: the conditional
binomial test, the power gate, the confound rule and the abstention ladder all
stay exactly as they are and simply get more trials.

## Measured effect (executing the grader's own math at alpha=0.05)

Required lift to be gradeable, current 28d vs proposed 90d:

| page | 28d clicks | need | lift | 90d (proj.) | need | lift |
|---|---|---|---|---|---|---|
| PIE cluster | 19 | 32 | 1.68x | 61 | 82 | **1.34x** |
| sebaceous-filaments | 13 | 24 | 1.85x | 42 | 60 | **1.43x** |
| BoJ sunscreen | 10 | 20 | 2.00x | 32 | 48 | **1.50x** |
| /best/moisturizers | 6 | 15 | 2.50x | 19 | 32 | **1.68x** |
| eye-care / PIH | 3 | 10 | 3.33x | 10 | 20 | **2.00x** |

A 1.34x lift is a plausible SEO outcome; a 3.33x lift on a 3-click page is not.

## Verified before recommending

- **90-day windows are mechanically available.** `gsc-client.ts` paginates
  `dimensions: ['query','page']` at `ROW_LIMIT = 25000` with `startRow`, and
  imposes no date-range restriction. (Google's own API allows 16 months.)
- **The 90d projection is linear extrapolation from one 28d window**, not
  measured. Seasonality could move it either way — the ratio is the argument,
  not the absolute number.

## Cost, honestly

- **Latency.** A bet ships and is graded a quarter later, not a month. That is
  the whole trade: fewer, later, real verdicts instead of frequent abstentions.
- **`MIN_GAP_DAYS` semantics.** It currently guarantees the after-window shares
  no days with the baseline. At 90 days that guarantee costs more calendar time;
  the snapshot-archive fallback becomes much less useful (weekly 28d snapshots
  cannot supply a clean 90d after-window), so the live `fetchCleanWindow` path
  effectively becomes required.
- **Confound exposure grows with window length** — more time for unrelated
  sitewide movement. `SITEWIDE_CONFOUND_SIGMA` is already scaled to volume, so
  it should self-correct, but this should be re-checked against real 90d data,
  not assumed.

## Do NOT do this without

1. A second-model adversarial review (this is a semantics change to a live
   learning loop; two of this session's three proposals were refuted on review).
2. A cadence-faithful test like `tests/seo-grader-verdict-reachable.test.mjs`,
   confirmed to fail on revert.
3. Re-reading `MIN_GAP_DAYS` and the snapshot-fallback path in
   `grade-bets.ts` — the fallback likely needs to be dropped or reworked.

## What this does NOT fix

Nothing here produces a single additional widget conversation. The blog earns
~674 clicks/28d and yields ~4 conversations/month, and no grader change moves
that. This makes the click loop honest and cheap; it does not make it matter.
