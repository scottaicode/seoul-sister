# The Widget Corpus Does Not Feed the Learning Engine

**Status: DEFERRED ON PURPOSE — not a bug, not an oversight. Recheck trigger below.**
**Found:** Aug 13 2026, reviewing visitor `1ce3b6ce` (rosacea consult, 12 messages, 53 min).
**Deferred by:** Scott, Aug 13 2026.

---

## The finding, in one line

571 stranger messages have been captured by the widget. **Zero of them have ever reached
`ss_learning_patterns`, `ss_ingredient_effectiveness`, or `ss_specialist_insights`.**

## What is actually connected (verified, not assumed)

Traced every consumer of `ss_widget_messages` / `ss_widget_sessions` / `ss_widget_visitors`:

| Reader | What it does |
|---|---|
| `src/app/api/widget/chat/route.ts` | the widget itself (history, memory) |
| `src/app/api/admin/widget/*` (3 routes) | admin dashboards — human viewing |
| `src/app/api/admin/traffic/route.ts` | admin dashboard |
| `src/lib/reddit/intel.ts` | Reddit intel, unrelated path |

And the learning cron's sources:

```
aggregate-learning reads:
  ss_yuri_messages, ss_yuri_conversations, ss_reviews, ss_specialist_insights,
  ss_user_product_reactions, ss_user_routines, ss_routine_products,
  ss_products, ss_product_ingredients, ss_ingredient_effectiveness,
  ss_learning_patterns, ss_trend_signals, ss_user_profiles
  ss_widget_*  ← ABSENT
```

**The learning engine is alive** — `ss_learning_patterns` has 196 rows, newest written
Aug 13 2026. It is fed exclusively by the authenticated corpus, which is ~2 subscribers.

### Passing the four questions honestly

1. **Does it fire?** Yes — the widget writes on every turn (571 messages, 81 sessions).
2. **Does it write?** Yes, and well. `ss_widget_visitors.ai_memory` for `1ce3b6ce` holds a
   genuine structured summary: skin concerns, topics, products, and a `recommended_approach`
   correctly encoding *"emphasize subtraction over addition, avoid actives, educate on
   vascular vs barrier."*
3. **Does the output reach a CONSUMER?** **Partially — and this is the gap.** It reaches
   *the widget itself* (a returning visitor gets continuity — a real, working loop). It does
   **not** reach the platform-wide learning engine. Nothing cross-user is learned from it.
4. **Can "nothing happened" be told apart from "nothing ran"?** For the per-visitor loop,
   yes. For the cross-user loop, **there is nothing to tell apart — it was never wired.**

### A separate, smaller finding

`ss_widget_sessions.ai_summary` is **NULL for all 81 sessions ever recorded**, including all
20 substantive ones (≥5 messages). A column that has never once been populated. Either wire
it or drop it — a permanently-null column is indistinguishable from a broken writer.

## Why this is deferred rather than fixed

**The corpus is too thin, and mining it now would repeat a known expensive mistake.**

571 messages across ~68 strangers is not a cross-user pattern corpus. Seoul Sister has
already paid for this exact error once: the Phase 11.4 bootstrap wrote 87 rows into
`ss_ingredient_effectiveness` that scored **fillers** — water, glycols, waxes — as effective
actors, because the seed script measured *frequency, not mechanism*. Bailey caught it. All 87
rows were deleted (v10.5.2, May 17 2026).

A pattern-miner pointed at 68 conversations would produce exactly that class of confident
garbage, and unlike the bootstrap it would keep producing it daily. The Yuri Sole Authority
Principle exists because algorithmic recommenders trained on thin data get things wrong in
ways that reach real users' faces.

**The bottleneck is volume, not wiring.** This is the same conclusion the end-of-preview work
reached from a different direction.

## What was NOT lost by deferring

The valuable half already works. Betty's conversation is fully preserved — 24 messages,
15 intent signals, 3 specialist domains, and a rich `ai_memory` summary. **If she returns,
Yuri picks up where they left off.** Nothing needs re-derivation later; the raw corpus is
intact and every row is still there to mine whenever mining becomes justified.

What is lost is only the *compounding* — betty's genuinely good clinical content (heat-reactive
rosacea is vascular not barrier; azelaic is the rosacea-safe active; fragrance in a cleansing
oil is the hidden trigger) does not make the next stranger's answer better. Searching the
corpus for it: **one** rosacea pattern exists, dated May 6 2026, and it is generic.

## Recheck trigger

Revisit when **either** holds:

- **≥300 distinct widget visitors with `total_messages > 0`** (currently 68), or
- **≥25 paying subscribers** — at which point the authenticated corpus is itself rich enough
  that widget data is additive rather than load-bearing.

Query to check the first:

```sql
select count(*) from ss_widget_visitors where total_messages > 0;
```

**Do not wire this on a schedule or "because it's easy."** The gate is corpus size. If a
future session proposes mining the widget corpus, the question to answer first is *what
protects this from the 87-filler-rows failure?* — and the answer must be more than "we'll
review the output."

## If and when it IS built

Constraints earned from the prior failure, to be honored:

1. **Mechanism, not frequency.** Co-occurrence counting is what produced the filler rows.
2. **Never write directly to `ss_ingredient_effectiveness`.** That table feeds Yuri's reads
   and a bad row poisons real advice. Stage to a review table first.
3. **Strangers are unverified.** A widget visitor's self-description is not a graded outcome —
   there is no teacher on the widget side at all. Anything mined is a *hypothesis*, and must
   be labeled as one. Per the Learning Loop principle: if there is no objective teacher, say
   so rather than pretending the pattern is graded.
4. **`ai_summary` is the cheap first step** — populating it costs one Sonnet call per session
   and makes the corpus browsable before any mining is attempted.

---

*Recorded because a deferral that lives only in conversation is indistinguishable from a gap
six weeks later — which is exactly how a deferred loop once got described to other people as
working.*
