# Reddit: what four months of real data actually says

**Aug 5 2026.** First read of the full `ss_reddit_intel` corpus (621 comments,
Mar 9 – Aug 4 2026). Measurement only — nothing was shipped off the back of this.

**Why this exists:** Scott's read was *"a few steps forward, then a couple steps
back — no strong trend of better performance."* That is exactly right, and the
data explains why. It is not regression. It is an **unmeasured process**:
improvements that are never graded cannot compound, so each change is as likely
to hurt as help and the net looks like noise.

---

## 1. Comment performance has been FLAT for five months

| Month | n | avg | **median** | p75 | p90 | % ≥10 |
|---|---|---|---|---|---|---|
| Mar | 287 | 3.74 | **2.0** | 3.0 | 6.0 | 7.7% |
| Apr | 126 | 3.10 | **2.0** | 2.0 | 6.0 | 4.0% |
| May | 79 | 4.89 | **2.0** | 3.0 | 6.0 | 8.9% |
| Jul | 99 | 3.35 | **2.0** | 3.0 | 8.2 | 7.1% |
| Aug | 30 | 2.40 | **1.0** | 3.0 | 5.1 | 3.3% |

**The median is 2.0 in every month.** p75 is 3.0 in four of five. The average
moves only because a handful of outliers move it — that is the "steps forward,
steps back" feeling, and it is noise, not signal.

## 2. The variable that actually moves performance is WHERE, not HOW

| Subreddit | n | avg | median | % ≥10 |
|---|---|---|---|---|
| **r/AsianBeauty** | 61 | **9.66** | 3.0 | **26.2%** |
| r/koreanskincare | 300 | 3.46 | 2.0 | 5.7% |
| r/KoreanBeauty | 67 | 3.01 | 2.0 | 9.0% |
| r/30PlusSkinCare | 26 | 2.96 | 2.0 | 3.8% |
| **r/SkincareAddiction** | 161 | **2.12** | 1.0 | **1.2%** |

r/AsianBeauty beats r/SkincareAddiction by **4.6x on average score and 22x on
hit rate** — and 2.6x more comments went into the worse one.

## 3. The monthly wobble IS the subreddit mix

| Month | %AsianBeauty | %SkincareAddiction | avg |
|---|---|---|---|
| Mar | 9.1 | 32.8 | 3.74 |
| Apr | 12.7 | 31.7 | 3.10 |
| **May (best)** | **12.7** | **7.6** | **4.89** |
| Jul | 8.1 | 14.1 | 3.35 |
| **Aug (worst)** | **3.3** | **23.3** | **2.40** |

Best month had the LOWEST SkincareAddiction share. Worst month had AsianBeauty
collapse to 3.3% while SkincareAddiction climbed back to 23.3%. **The apparent
progress and regression is allocation drift.**

## 4. Controlling for subreddit, the writing changes did nothing measurable

r/koreanskincare alone, median by month: **2.0, 2.0, 2.0, 2.0, 1.0.**

That is the honest verdict on months of prompt/voice iteration. It does not mean
the comments are bad — they are demonstrably good, and the corpus contains a 91
and a 68. It means **the iteration was never graded, so it could not compound.**

---

## What this implies (NOT yet acted on)

1. **Allocation is the lever, not phrasing.** Shifting volume from
   r/SkincareAddiction toward r/AsianBeauty is the single highest-expected-value
   change available, and it costs nothing to try.
2. **Caveat before over-reading #1:** r/AsianBeauty's n is 61 and its median is
   3.0 against SkincareAddiction's 1.0 — the average gap is partly outlier-driven,
   so the honest claim is "materially better", not "4.6x better". Also unknown:
   whether AsianBeauty can absorb more volume without the fit degrading. Test by
   shifting allocation and re-reading, not by assuming.
3. **Upvotes are a proxy, not the goal.** Zero attributed sessions to date, so
   nothing here proves score correlates with visits. When
   `attributed_sessions` starts populating, re-run this by subreddit — it may
   contradict the upvote ranking entirely, and if it does, the CLICK data wins.
4. **The reason nothing compounded is now fixed.** `ss_reddit_intel` +
   attribution + pushback capture means the next four months are gradeable in a
   way the last four were not. That is the actual unlock, not any single tactic.

## Do NOT re-derive

- Do not read the monthly average as a performance trend. It tracks subreddit
  mix. Always segment by subreddit before concluding anything about writing.
- Do not conclude the writing is the problem. Within r/koreanskincare the median
  has never moved, across 300 comments and months of iteration.
