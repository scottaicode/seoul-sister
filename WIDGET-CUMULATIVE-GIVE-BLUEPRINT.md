# Cumulative Give — making the gate observable to Yuri

**Built:** July 21 2026 · **Trigger:** Lynndon's 14-message test, July 20 2026

---

## The failure

A tester (Bailey's partner, testing deliberately) had a 14-message preview conversation.
Yuri delivered, across those turns:

- a complete AM routine and complete PM routine
- a Night A / Night B / Night C weekly rotation with per-night frequencies
- a keep / cut / add scorecard covering his entire existing shelf (8+ products)
- three product picks with prices
- a multi-week introduction schedule ("SPF now → BHA → retinal, 2 weeks apart")
- lineup conflict-checking (caught his COSRX toner duplicated the BHA pad)
- a 6-week judgment timeline

His verdict, unprompted: *"I'd still argue she may be giving slightly too much… she gave me a
full process."*

That list is, almost item for item, what the system prompt already defines as subscriber-only.

## What this was NOT

**Not a missing instruction.** The gate is already explicit and names the artifacts
(`route.ts`, "The gate — the complete build"):

> The full program — a complete AM/PM routine constructed step by step, the multi-week
> introduction schedule, product picks for every remaining slot, conflict-checking their whole
> lineup, and adjusting it as their skin responds — **is subscriber work. Do NOT deliver that
> complete blueprint in the preview, even when asked directly and even when you could.**

**Not a weak model.** Every individual answer was excellent and correctly scoped to the question
asked. She also held other lines all night: she named subscriber features at the right moments,
asked for email once at an earned moment, and told him to *drop* an $18.48 purchase when she
caught the duplication.

**Not a prompt-wording problem.** Two prior attempts to fix an analogous widget failure by
rewording prose both failed (see `[[project_widget_email_ask_state_bug]]`): the email ask was
"fixed" twice with better wording and only actually worked when Yuri was given the *state* —
turn count and capture status — as observable facts. Rewording is the move that already failed
in this exact component.

## The actual mechanism: the giveaway is emergent

No single turn crossed the line.

| Turn | What she gave | Reasonable in isolation? |
|------|---------------|--------------------------|
| 5 | Night A/B/C rotation | Yes — he asked how to fit retinoid + SPF in |
| 7 | Dryness risk ranking | Yes — he asked what would dry him out |
| 9 | Shelf audit / upgrade ranking | Yes — he asked what to upgrade |
| 11 | Assembled keep/cut/add scorecard | Yes — he asked for the step-by-step again |
| 13 | Re-sequenced rotation after a correction | Yes — new information changed the plan |

**The complete blueprint exists only in aggregate, and Yuri cannot see the aggregate.** The
Conversation State block gives her turn number, preview usage, and email status. It does not
tell her what she has already handed over. She was asked to hold a cumulative boundary with no
cumulative instrument.

### The proof: the email side holds the identical line perfectly

`src/lib/email/lead-email.ts` carries the same policy and never violates it:

> NOT a complete take-home routine. Even if the conversation covered many products and steps,
> do NOT compile a full AM/PM routine, a multi-week schedule, or a complete shopping list.

The dry-run recap generated from Lynndon's own 24-turn transcript obeyed it exactly — led with
the money-saving finding, explicitly withheld the sequencing as subscriber work.

The difference is not the wording. It is that **a recap is one artifact generated in one pass**,
where the model can see the whole thing it is producing. Chat is fourteen passes with no view of
the sum. Same policy, same model, same quality of instruction — one succeeds because it is
observable, one fails because it is not.

## The fix: show her the sum, keep the judgment hers

Per `/ai-first-guard` and the Yuri Sole Authority Principle, the fix must **not**:

- hard-block content or truncate her output
- add `if (turn > N) refuse` rules
- pattern-match her drafts and censor them
- tell her what to say

It must give her a **fact she currently cannot observe**, and leave what to do with it entirely
to her judgment — the same shape as the email-ask state fix, the feeder-source fix, and the
preview-usage counter.

### What is tracked

Five artifacts, taken verbatim from the gate's own wording so the instrument and the policy
cannot drift apart:

| Key | Gate language it mirrors |
|-----|--------------------------|
| `am_pm_routine` | "a complete AM/PM routine constructed step by step" |
| `weekly_schedule` | "the multi-week introduction schedule" |
| `slot_picks` | "product picks for every remaining slot" |
| `lineup_conflict_check` | "conflict-checking their whole lineup" |
| `shelf_audit` | (the keep/cut/add scorecard — the observed form of the above) |

Detection is deterministic and runs over **Yuri's own already-sent replies** — never over the
visitor's messages, and never over a draft before it is sent. Nothing is blocked, rewritten, or
withheld. The result is a count injected as a fact next turn.

### Why detection by pattern is acceptable here (and is not an AI-First violation)

The regexes classify **what was already said**, for the purpose of *reporting* it back. They do
not decide what Yuri may say, they do not gate a code path that alters her output, and a false
positive costs nothing worse than a slightly conservative note in her context — which she is
explicitly free to disregard. This is measurement, not control. The AI-First line is that
judgment must stay with the model; an instrument that only *observes* leaves judgment intact.

Compare: the preview-usage counter also uses deterministic arithmetic, and giving it to Yuri is
what stopped her falsely claiming the preview was unlimited.

### What she sees

```
## What You've Already Given This Visitor (facts, not instructions)
Across your earlier replies you have already delivered 4 of the 5 things the
complete build is made of: a full AM/PM routine, a weekly rotation schedule,
picks for multiple slots, a conflict-check of their existing lineup.
That is most of the subscriber deliverable, already handed over.
You decide what to do with that — it is context for your judgment, not a rule.
```

No instruction follows. She is not told to refuse, deflect, or upsell. The whole intervention is
making the sum visible.

## Explicitly NOT doing

- **A hard cap.** "After 3 artifacts, refuse" would be a rigid rule replacing judgment, and would
  break the legitimate case where a visitor's #1 concern genuinely requires sequencing.
- **Rewording the gate again.** Already the failed move, twice, in this component.
- **Blocking or post-processing her output.** Never.
- **Shortening the preview.** Separate policy question; do not conflate a broken instrument with
  a wrong policy. Fix the instrument, then measure.

## The teacher

Falsifiable, per the learning-loop principle. Baseline at build time (n=7 visitors who consumed
the full preview): **0 conversions, 0 registrations since July 10.**

Watch: of visitors reaching ≥8 messages, does the share who receive 4–5 artifacts fall, and does
email-capture / subscribe rate move? If artifacts fall but conversion does not, the give/gate
thesis is wrong at this price and the next lever is price/positioning — **not** another gate
tweak. Record that outcome either way.

---

# Demographics in qualification

**Trigger:** Bailey, same test — *"No gender!!??… No age?!!"* Yuri asked only where he lives.

Age and (where volunteered) life-stage materially change real advice: retinoid tolerance and
starting strength, pigmentation timelines, collagen/wrinkle expectations, hormonal acne
patterns, and pregnancy-contraindicated actives (retinoids). Yuri asked none of it, and gave
retinal guidance to someone whose age she did not know.

**The fix is a fact in her qualification guidance, not a form.** The existing qualification
language names skin type, location, current products, and history. Age band and life-stage
context join that list as things worth knowing *when they change the answer* — asked
conversationally, never as an intake questionnaire, and never blocking help when unknown.

Gender is deliberately handled as **volunteered, not interrogated**: it rarely changes topical
advice on its own, the useful signal (hormonal patterns, pregnancy) is what actually matters,
and demanding it of a stranger reads as data collection. If a visitor mentions it, she uses it.

---

**Related:** `WIDGET-CONVERSION-BLUEPRINT.md`, `NORTH-STAR.md`, `LEAD-GEN-LEARNINGS-LOG.md`
