# Loop Verification Discipline

**Written Aug 5 2026, after finding that the Reddit learning loop had been
capturing for four months and closing for zero of them.**

**Read this before claiming any learning loop is "working."**

---

## What actually happened, stated without softening

Scott told people Seoul Sister grades itself and improves. He believed that,
because he was told it by AI coding partners — including me, in earlier
sessions. He then discovered, four months in, that the Reddit loop had never
closed.

He described that as having lied. **He hadn't.** The distinction matters, and
getting it wrong leads to the wrong fix:

### The loops that ARE real (verified live, Aug 5 2026)

| Loop | Evidence |
|---|---|
| Yuri decision memory | **108** conversations carry `decision_memory` |
| Learning patterns | **182** rows |
| Ingredient effectiveness | **47** rows |
| Nudge outcome grading | **1** outcome actually graded by the deterministic teacher |
| SEO Guardian | **5** completed reports, **5** dated falsifiable bets |

Those are working, and most products never ship one. The claim was not fiction.

### What was actually broken

**Not the design. The wiring.** Every gap found on Aug 5 was the same shape —
a working component whose output never reached its consumer:

| Symptom | Real defect | Silent for |
|---|---|---|
| Reddit capture cron dead | Exported POST only; Vercel Cron sends GET -> 405 before the handler | 6 days, twice |
| Guardian saw it 5 consecutive runs | Findings written to metadata, never added to `report.signals`, so they could not reach `critical` and could not alert | the whole time |
| `attributed_sessions` all 0 | Written at insert, never updated by anything | since the table shipped |
| `was_corrected` all NULL | Column existed; nothing ever populated it | since the table shipped |
| Nudges generated, never delivered | Rendered only on a dashboard, waiting for a user whose return the nudge existed to cause | since May |
| Reddit `extracted_claims` 0 | Piece B deliberately deferred (correct), but the deferral was invisible from outside the docs | 4 months |

**Five of six are wiring, not design.** The parts were built well. Nothing
verified the connection end-to-end against production.

---

## THE RULE

> **A loop is not shipped until you have seen a row it produced in production.**

Not "the code is correct." Not "the tests pass." Not "the cron is registered."
A **row**, in the live database, that the loop wrote **by itself**, on its own
schedule, with nobody invoking it by hand.

Every failure above dies in minutes under this rule:

```sql
-- Reddit cron: would have shown ZERO rows, ever
SELECT max(started_at) FROM ss_pipeline_runs WHERE run_type='capture_reddit_intel';

-- Attribution: would have shown every row at 0
SELECT count(*) FILTER (WHERE attributed_sessions > 0) FROM ss_reddit_intel;

-- Nudge delivery: would have shown email_sent_at NULL on everything
SELECT count(*) FILTER (WHERE email_sent_at IS NOT NULL) FROM ss_user_nudges;
```

### The trap this closes

**A hand invocation does not count.** On Jul 29 the Reddit cron was diagnosed by
invoking it manually — with POST. It worked, the backlog captured, and the real
defect (GET -> 405) survived untouched for another six days. The manual run
*proved the code worked* and *hid that the schedule did not.*

If you tested it yourself, you tested the code. The loop is verified when the
SCHEDULER produces a row.

---

## The four questions for any loop

Ask these before saying a loop works. Each has a SQL answer, not an opinion.

1. **Does it fire?** — is there a run row from the scheduler, not from you?
2. **Does it write?** — is the output column non-empty on real rows?
3. **Does the output reach a consumer?** — who READS that column, and can you
   point at a row where it changed a decision?
4. **Can "nothing happened" be told apart from "nothing ran"?** — if the answer
   is no, that is the bug, whatever else is true.

Question 3 is the one that gets skipped, and it is where four months went. The
Reddit corpus passed 1 and 2 the whole time. Nothing consumed it.

---

## What to do about the deliberate deferrals

Not every unclosed loop is a defect. Reddit Piece B (claims -> Yuri) was
deferred **on purpose**, with a written unfreeze condition, and that call still
looks right — the bottleneck was never Yuri's INCI knowledge.

But a deferral that lives only in a markdown file is indistinguishable from a
gap, six weeks later, to a founder describing the system to someone else.

**So: a deferred loop must be visible in DATA, not just docs.** If
`extracted_claims` is 0 because we chose that, something queryable should say
so. A row in a `deferred_loops` table, a status column, anything one query away.

---

## What this does NOT mean

Do not respond to this by building more loops, more monitoring, or a dashboard.
**The failure was never insufficient machinery — this repo has more than it
needs.** It was that nothing checked whether the machinery was connected.

The fix is one habit and four questions, not another system.

---

## Standing monthly check

```sql
-- Every watched loop, and whether it has produced anything lately.
SELECT run_type, max(started_at) AS last_run,
       now()::date - max(started_at)::date AS days_stale
FROM ss_pipeline_runs GROUP BY 1 ORDER BY days_stale DESC;

-- The learning loops, and whether they hold graded output.
SELECT 'nudges graded' AS loop, count(*) FROM ss_user_nudges WHERE outcome_grade IS NOT NULL
UNION ALL SELECT 'seo bets graded', count(*) FROM ss_seo_reports WHERE grades IS NOT NULL
UNION ALL SELECT 'reddit pushback confirmed', count(*) FROM ss_reddit_intel WHERE pushback_confirmed IS NOT NULL
UNION ALL SELECT 'reddit sessions attributed', count(*) FROM ss_reddit_intel WHERE attributed_sessions > 0;
```

A zero in the second query is not automatically wrong — it may be honest
abstention on thin data, which is the correct behaviour. But a zero you cannot
EXPLAIN is a gap, and it is exactly what four months of Reddit looked like.
