# Nudge Outcome Teacher — Blueprint (v10.11.0)

> **Status**: Planned + executing May 31 2026. Upgrades the proactive-nudge learning
> loop from a *soft* teacher (engagement: acted/dismissed) to a *measured* teacher
> (skin outcome: did the Glass Skin Score move after she acted). Read this before
> touching the grader, the nudge ledger, or the eligibility calibration.

## Why (the Learning Loop principle)

Per the owner's overriding Learning Loop principle: a feature only *learns* if a
dated judgment is graded by the **least-gameable teacher** in the domain, and the
grade feeds back into the model's context. The v10.10.0 nudge engine records a
dated judgment ("now is the moment to surface X") and has an engagement teacher
(`acted`/`dismissed`). But engagement is a *soft* signal — per the hierarchy
"a measured outcome beats a thumbs-up beats engagement," it's the weakest rung
that still counts.

The strongest teacher available in this domain is a **measured skin result**: did
the routine the nudge led to actually improve her Glass Skin Score in the weeks
after? Tying nudge outcomes to subsequent score movement turns this from
"engagement learning" into "did-it-actually-help learning." That is the upgrade.

## The honest design constraints (read before building)

This is where it's easy to build a teacher that's *worse* than no teacher. Three
traps, and how this design avoids each:

### Trap 1 — Sparsity
Glass Skin scores are sparse and irregular (Bailey: 4 scores in 3 months). Most
nudges will NOT have a clean before/after score bracketing them. **The grader must
abstain** (`insufficient_data`) rather than fabricate a verdict. We never force a
grade. Coverage will be low at first and grow as scoring cadence improves (the
nudge engine itself drives more scoring via the glass_skin_cadence nudge type —
a virtuous loop).

### Trap 2 — Correlation ≠ causation
A score rising after a nudge does NOT mean the nudge caused it. Her cycle moved,
weather changed, time passed, she did other things. A naive "score up after nudge →
good nudge" grader is **gameable by coincidence** — exactly what the principle
warns against. Mitigations:
- **Engagement is a necessary precondition.** Only nudges the user `acted` on are
  eligible for an outcome grade. A dismissed nudge can't have caused a skin change;
  it gets no outcome grade (its engagement grade stands). The outcome teacher
  *layers on top of* engagement; it does not replace it.
- **Phase-consistency gate.** Only grade if the follow-up score is in the SAME
  treatment phase the nudge related to, or a later phase reached by progressing
  (not by abandoning). A score taken after the user blew up their routine isn't a
  fair grade of the nudge.
- **We grade the DELTA modestly.** Small deltas (±3 points, within photo/lighting
  noise) → `no_change`, not `helped`/`hurt`. We don't over-read noise as signal.

### Trap 3 — Confounded measurement
The score itself can be noisy: `photo_quality.confidence_modifier` (v10.5.0) flags
bad-lighting/post-shower photos. **A low-confidence baseline or follow-up score is
not gradeable** — its movement is measurement noise, not skin change. The grader
requires both bracketing scores to be reasonable-confidence, else abstains.

## Architecture — a two-tier teacher

| Tier | Signal | Density | Strength | When computed |
|------|--------|---------|----------|---------------|
| 1 — Engagement | `status`: surfaced→acted vs dismissed | dense, immediate | soft | at user interaction (already built v10.10.0) |
| 2 — Skin outcome | Glass Skin Score delta after acting | sparse, delayed | measured | weekly grader cron, ≥14 days after `acted_at` |

Tier 2 is a strict superset gate on Tier 1: outcome grades exist only for acted
nudges that clear all the honesty gates. Everything else is `insufficient_data`
(or stays purely engagement-graded). The two tiers are stored side by side — the
calibration layer prefers Tier 2 where it exists and falls back to Tier 1.

## Pillar A — Migration (outcome columns on `ss_user_nudges`)

```
outcome_grade           TEXT  -- 'helped' | 'no_change' | 'hurt' | 'insufficient_data' | NULL(pending)
outcome_score_delta     INTEGER          -- followup.overall - baseline.overall (NULL if ungraded)
outcome_baseline_score_id  UUID          -- the score at/just-before the nudge
outcome_followup_score_id  UUID          -- the earliest qualifying score ≥14d after acted_at
outcome_graded_at       TIMESTAMPTZ
outcome_notes           TEXT             -- why this grade / why abstained (honesty + debugging)
```

No new table — the grade lives on the nudge row it grades. The judgment and its
teacher's verdict stay together.

## Pillar B — Grader module + weekly cron

`src/lib/intelligence/nudge-outcome-grader.ts` — pure deterministic logic, NO AI
(it's measurement, not reasoning; AI would only add gameable subjectivity).

For each nudge with `status='acted'` and `outcome_grade IS NULL`:
1. **Maturity gate**: skip unless `acted_at` is ≥14 days ago (give the routine time
   to work; <14d → leave pending, try next week).
2. **Baseline**: the user's latest Glass Skin Score at or before `acted_at`. None →
   `insufficient_data` ("no baseline score").
3. **Follow-up**: the earliest Glass Skin Score ≥14 days after `acted_at`. None yet →
   leave `pending` (not insufficient — it may still come; only mark insufficient
   once a long ceiling, e.g. 60 days, passes with no follow-up).
4. **Confidence gate**: if either score's `photo_quality.confidence_modifier < 0.85`
   → `insufficient_data` ("low-confidence photo, movement not reliable").
5. **Phase gate**: if the follow-up score's `treatment_phase_id` indicates a phase
   *earlier* than the nudge's context (regression/abandonment) → `insufficient_data`
   ("phase regressed; not a fair grade").
6. **Grade the delta**: `delta = followup.overall - baseline.overall`.
   - `delta >= +4` → `helped`
   - `delta <= -4` → `hurt`
   - else → `no_change` (within photo/biological noise band)
7. Write grade + delta + both score IDs + notes. Log to `ss_pipeline_runs`.

Cron `/api/cron/grade-nudge-outcomes` — weekly. Per-nudge try/catch (failure
isolation). Observability: logs counts of each grade + abstention reasons.

## Pillar C — Feed the grade back (the loop closes)

A teacher that grades but never changes behavior isn't a learning loop. Add a
calibration read used by the eligibility/message layer:

`getNudgeTypePerformance()` → per `nudge_type`, the historical **helped-rate**
among *graded* outcomes (Tier 2 preferred; Tier 1 acted-rate as fallback when no
Tier-2 grades exist yet). Conservative:
- Only influences behavior once a **minimum sample** exists per type (e.g. ≥5
  graded outcomes) — below that, no calibration (don't learn from n=1).
- A nudge type with a poor helped-rate gets **discounted** (deprioritized in
  `pickNudgeOpportunity`'s ordering, or its message framing flagged for the Opus
  writer as "this nudge type has underperformed — be especially earned"). It is
  NOT hard-disabled — a low rate might be small-sample noise, and the cycle/phase
  context still matters.

This is the feedback arc: dated judgment → measured grade → calibrated next
judgment. After a quarter of real data, the engine fires the nudge types that
*actually move skin*, not the ones I guessed at.

## What this is NOT

- NOT a replacement for engagement grading — it layers on top.
- NOT a causal claim from correlation — gated hard (acted + phase + confidence +
  noise band), abstains by default.
- NOT AI-graded — pure measurement; abstention is honest, not a model opinion.
- NOT a hard on/off switch on nudge types — calibration discounts, never silently
  kills (small-sample humility).

## Honest limitations (stated, not hidden)

- **Coverage will be low initially.** Few nudges will clear all gates until scoring
  cadence rises. That's correct — better a small set of defensible grades than a
  large set of coincidental ones. The glass_skin_cadence nudge type bootstraps the
  scoring density over time.
- **Still not a randomized trial.** Even gated, this is observational. We're not
  claiming proof of causation; we're claiming a *defensible, least-gameable-available*
  signal that's strictly stronger than engagement. Per the principle, that's the bar.
- **The strongest possible teacher** would be an A/B (nudge vs no-nudge) on matched
  users. Not feasible at current user count; revisit when MAU justifies it.

## Build order
A (migration) → B (grader + cron) → C (calibration feedback) → verify → ship.
Observability first-class throughout (no silent failure — v10.3.4 lesson).
