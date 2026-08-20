# SEO Bet Grader (Phase 3) — the objective teacher for the SEO loop

**Shipped Aug 20 2026.** Closes the learning loop the SEO Guardian has been missing
since it launched: 23 bets across 7 weekly reports, **none ever graded**.

## What was broken

The Guardian wrote dated, falsifiable bets every week and stored them. Nothing
ever scored them, so `grades` was NULL on every row. The strategist's prompt
lists prior bets only as "do not duplicate" — it could see *that* it had bet on
something, never whether the bet **shipped and failed**.

The cost was visible in the Aug 16 report, which called the Beauty of Joseon
Aqua-Fresh page "the single best CTR-recovery opportunity on the site" — the
**third** bet on that page. The Jul 24 metadata rewrite had already shipped
(verified live: the meta description reads *"…the complete INCI list"*) and the
page still sat at position 8 with 5 clicks. The strategist was re-proposing a
fix that was already deployed and measurably not working.

## The instrument is a ruler, not a judge

**No AI in the verdict path.** Grades feed straight back into the strategist's
prompt, so a fabricated grade doesn't merely mislead a human — it corrupts next
week's judgment. Same discipline as `grade-nudge-outcomes`.

### Gate order (each can STOP grading)

1. **Executed?** — verified by fetching the LIVE page. `not_executed` never
   becomes a `miss`: "the theory was wrong" and "the theory was untested" have
   opposite remediations.
2. **Window clean?** — baseline and after-window must share zero days
   (`>= 28d` apart). Snapshots are 28-day windows taken weekly, so adjacent runs
   overlap 21/28 days and attenuate a true effect ~4x.
3. **Data present?** — a page absent from a snapshot is missing data, never a
   ranking loss.
4. **Powered?** — could hitting *this bet's own threshold* have been
   distinguished from chance (p < 0.05)?
5. **Compare** — grade the THRESHOLD the bet named, never the distance travelled.

### The central protection

The real case that shaped the design: BoJ went **4 → 5 clicks** against a
`>= 10` threshold. Naively that is a clean `miss`. But **P(X≥5 | λ=4) = 0.371** —
the single most likely outcome under *no effect*, and equally consistent with the
edit having worked in a window too short to show it. Recording `miss` would teach
the strategist *"metadata edits don't work"* from pure Poisson noise.

So a `miss` is recorded **only when the shortfall is informative**: under the
bet's own hypothesis (true rate ≈ threshold), a count this low must itself be
unlikely (p < 0.05). Otherwise the honest verdict is abstention.

The gradeability test is deliberately **not** a flat volume floor. Measured:
baseline 3 reaching a stated threshold of 10 scores p=0.0011 — decisively
significant — so a "baseline ≥ 10" floor would have discarded a perfectly
falsifiable bet. Conversely baseline 40 with threshold 41 is unfalsifiable
however large the numbers look.

## Verdict vocabulary

| Verdict | Meaning |
|---|---|
| `hit` / `miss` | Real evidence. Executed, powered, clean window. |
| `ungradeable_not_executed` | Work never shipped. **Never counts against a bet type.** |
| `ungradeable_underpowered` | A verdict about how the BET WAS WRITTEN — no outcome could have confirmed it. |
| `ungradeable_too_soon` | No non-overlapping window available yet. |
| `ungradeable_no_data` | Page/query absent from a snapshot. |

**A high abstention rate is the honest reading of a small site, not a broken
instrument.** At ~64 clicks per 28 days sitewide, most bets cannot be measured.
Reporting that plainly is the point — it says the bet cadence is faster than the
site can generate evidence.

## Traps found and encoded

- **URL join.** Bets store `/blog/x`; all 21,263 GSC snapshot rows store
  `https://www.seoulsister.com/blog/x`. A naive equality join returns zero rows
  **silently** and would grade every bet a confident `miss`. Guarded by 5 tests.
- **`updated_at` is not execution evidence.** 40 of 47 posts share a single
  `2026-08-03` bulk-migration timestamp. The live page is the only witness.
- **Position is advisory only, never a verdict.** The BoJ page gained **68
  brand-new queries** against a 67-query baseline, so its average position mostly
  reports which long-tails Google surfaced. Live Simpson's paradox: *"is beauty
  of joseon aqua fresh sunscreen mineral"* improved 8.33 → 5.35 while the page
  average went **backwards** 7.87 → 8.04. Only both-snapshots-present queries are
  compared, with a 1.5-rank deadband.
- **An absent query is not a ranking loss.** GSC privacy-filters low-volume
  queries. Only 43.4% of queries survive between snapshots.
- **A GSC fetch failure must never look like "no effect."** It abstains.
- **Provenance travels in the same object as the verdict** (`scorer`, `powered`,
  `p_value`, `execution_status`, `gap_days`) — a caveat in a sibling table is a
  caveat that gets read past. The `fitzpatrick_source` / v11.33.0 discipline.

## Why snapshots alone are not enough

The archive's widest window-start separation is **23 days** — always short of the
28 needed for a non-overlapping comparison. Run against snapshots alone, all 8
due bets correctly graded `ungradeable_too_soon`. The grader therefore fetches a
**clean window directly from the GSC API** (16-month retention), falling back to
snapshots when credentials are absent.

## Verification status

- 31 guard tests across three files, each **confirmed to FAIL** when its bug is
  reintroduced by reverting the real code. One revert initially produced a false green from a
  quoting error — the anchor is now asserted before the result is trusted.
- Poisson math checked against an independent reference on 80 (k, λ) pairs plus
  boundary cases.
- Execution verification confirmed against the live site: the BoJ metadata bet
  **shipped** (title/meta live), its on-page INCI section **did not** —
  `partially_executed`, which must not grade as a miss.
- Full suite: 1,003 tests green.

**NOT yet verified: the scheduler has not produced a graded row.** A hand
invocation proves the code works and says nothing about whether the schedule
does. The cron is registered at `0 9 * * 0` (one hour before the strategist, so
the same morning's report sees fresh verdicts); the loop is not "working" until a
scheduler-produced row exists.

## The consumer link — the defect this build nearly repeated

After the first 8 grades were written, a check of what the strategist would
*actually see* showed all 23 bets still listed as `ungraded`. The grades existed
in the database and **reached no consumer**.

Cause: the strategist reads only the **last 3 reports**, but a bet needs ~28 days
before a clean grading window exists — and reports are **weekly**. Every grade
aged out of the prompt before it could ever be written. That is the loop's third
question failing *inside the fix for that same failure*.

Fixed by widening the window to 12 reports, and guarded by a test that fails if
it drops below 8. Verified after the fix: **8 GRADED, 15 ungraded** reaching the
prompt, each carrying `execution=` and a power flag — because without those,
`miss` is ambiguous between "the theory was wrong" and "the work never shipped".

## What a third adversarial review found (and it was right)

A Fable 5 review of the finished code found four real defects the author's own
tests passed over. All are fixed; each is recorded because the shapes recur.

1. **The tests could not tell working code from an impostor.** A grader with
   `poissonUpperTail = () => 0.5` and fabricated p-values passed **16/16** —
   reproduced and confirmed. The suite attacked the *gates* but never pinned a
   single NUMBER, so the statistical core, the whole point of the module, was
   unguarded. Fixed by asserting values against an independent reference
   (P(X≥5|4)=0.3712, P(X≥10|4)=0.0081) and an alpha-straddling pair no heuristic
   can reproduce. The impostor now loses 6 tests.

2. **The p-values were anti-conservative by ~10x.** Treating the baseline count
   as a KNOWN rate ignores that it is itself one noisy draw. Measured:

   | before → after | naive Poisson | exact conditional |
   |---|---|---|
   | 3 → 8 | **0.0119 → confident HIT** | **0.1133 — noise** |
   | 2 → 7 | 0.0045 | 0.0898 |
   | 4 → 12 | 0.0009 | 0.0384 |

   A 3 → 8 bet graded a confident hit on a result a correct test calls noise —
   and that verdict feeds the strategist *"this action type works"*. Replaced
   with the exact conditional binomial test (given N = before + after, after ~
   Bin(N, ½) under the null), still fully deterministic. **Determinism was never
   the safety property — calibration is.**

3. **Every abstention was terminal.** The orchestrator skipped any bet with any
   stored grade, and it PERSISTS `too_soon`. One early run would have stamped the
   whole backlog permanently, turning "abstain rather than fabricate" into
   *"abstain once, never grade"*. Only `hit`/`miss` are terminal now; the 8 rows
   written before this fix were cleared and re-graded.

4. **A run whose writes all failed returned `completed`.** Letter-for-letter the
   price-refresher failure — a `console.error` nobody reads. Now returns
   `status: 'failed'`, which the Guardian's pipeline check keys on.

Also fixed: **`extractMarkers` was broken by ordinary apostrophes.** `"Don't bury
the ingredients: add a scannable 'Ingredients list' section"` extracted
`t bury the ingredients: add a scannable ` — garbage matching no page, producing
a **false `not_executed`** that silently drops the bet from grading. And
`stripHtml` decoded `&#39;` but not `&#x27;`, which the live site also emits
(verified: 8 and 3 occurrences in one real page).

**And the first attempt to guard (3) and (4) did not bind** — those tests
asserted on source text and passed against both bugs when reintroduced. Rewritten
to execute `runBetGrader` against an in-memory DB stub; all three now fail on
revert. That is the repo's own "source tests miss runtime bugs" rule, violated by
the author who had just written it down.

## A finding that did NOT survive measurement

An early read of this data reported *"44 of 47 posts have meta titles under 45
characters — you're leaving a third of every SERP headline unused."* **That was
wrong**, and the error is worth recording because it is the shape this repo keeps
paying for: it measured the DATABASE COLUMN, not the RENDERED title.

`src/app/layout.tsx` sets `template: '%s | Seoul Sister'`, so every `meta_title`
renders 15 characters longer than it is stored. Re-measured against what Google
actually sees: **38 of 46 render at 40-60 characters** (mean 50.1) — a healthy
range. Only 7 are genuinely short, and 1 is over 60.

No fix is warranted. The instrument was reading the wrong surface, exactly like
grading a page by `updated_at` instead of fetching it.

## Files

- `src/lib/seo/bet-grader.ts` — deterministic verdict engine
- `src/lib/seo/execution-verifier.ts` — live-page execution check
- `src/lib/seo/grade-bets.ts` — orchestrator, window selection, persistence
- `src/app/api/cron/seo-grade-bets/route.ts` — weekly cron
- `scripts/grade-seo-bets.ts` — dry run (`npx tsx scripts/grade-seo-bets.ts`)
- `tests/seo-bet-grader.test.mjs`, `tests/seo-execution-verifier.test.mjs`, `tests/seo-grade-bets-orchestrator.test.mjs` — 31 guard tests
