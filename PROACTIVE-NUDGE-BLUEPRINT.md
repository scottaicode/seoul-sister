# Proactive Nudge Engine — Blueprint (v10.10.0)

> **Status**: Planned + executing May 31 2026. Three pillars, built in dependency
> order (Pillar 2 → Pillar 3 → Pillar 1). Read this before touching the nudge
> cron, the decision-memory extractor, or the durable-corrections rollup.

## Origin

Surfaced during a May 31 2026 review of Bailey's (the lighthouse user's) activity.
The system works beautifully *when she remembers to open Yuri* — but every open
loop only closes because Bailey is conscientious:

- She advanced to **Phase 3 (Brightening/Glow)** on May 29 but her routines still
  say "Phase 2" and no brightening routine has been built.
- Yuri ran the under-eye **press test** with her, identified pigmented +
  structural, said "don't repurchase the Medicube serum for the darkness, the
  brightening active handles the pigmented part" — but the *next step* was never
  taken.
- Neither loop got a proactive nudge. They wait on Bailey.

A less-conscientious subscriber (sub #100, who isn't Scott's daughter) would just
drift. **The burden of "come back at the right moment" is entirely on the user.**
That is the retention gap this feature closes.

The same day, today's live session proved *why timing matters*: Bailey opened Yuri
about her menstrual-phase Day 2, and Yuri correctly said "this is a hydration week,
pull the actives." A naive inactivity nudge would have told her to *start
brightening* during her weakest-barrier week — exactly wrong. The right nudge fires
on the **dermatologically correct moment**, not a fixed inactivity clock.

## What we learned from LGAAS (the sibling app)

LGAAS (AriaStar) has shipped, in production, the patterns we're adapting:

1. **Proactive nudge crons** (`api/cron/nudge-trial-members.js`,
   `nudge-stalled-onboarding.js`): inactivity threshold + `MAX_NUDGES = 3` +
   `NUDGE_SPACING_HOURS = 48` + Sonnet-personalized message + logged to a
   sequences table. **The escalation ladder is the gem**: 1st nudge warm + specific
   next step; 2nd nudge value-they're-missing; 3rd nudge *"low pressure, leave the
   door open. No guilt."* — the "don't pressure Bailey" rule made mechanical.

2. **Corrections memory + durable rollup** (Blueprint 79,
   `api/cron/rollup-durable-corrections.js`): when Kristy corrects AriaStar, the
   correction is promoted from per-conversation memory into a **permanent per-user
   store that never ages** — *"every correction by definition is ground truth."*
   Origin: two documented incidents where Kristy corrected AriaStar in conversation
   and the correction silently failed to persist, forcing a re-teach every thread
   (`MEMORY-EXTRACTION-CONTINUITY-GAP-MAY19-2026.md`, Blueprint `50.4`).

3. **The continuity scar**: LGAAS's May 19 gap (extraction silently truncated long
   threads, nobody noticed for a week because there was no observability). The
   lesson: **an advisor that acts on memory must verify that memory persisted, or
   it produces confident amnesia.** This is the same class as Seoul Sister's
   thin-Phase-3-record bug (May 31) and the decision-memory crash (v10.3.4) that
   lost 3 months of data behind a fire-and-forget `.catch()`.

### Deliberate divergences from LGAAS (do NOT "optimize" these back)

- **Message model is Opus 4.8, not Sonnet.** LGAAS generates nudge *emails* with
  Sonnet because they're lower-stakes re-engagement for trial members of someone
  else's business. Seoul Sister's nudge **is Yuri herself speaking to a paying
  subscriber about her skin** — squarely user-facing, so Principle 1 (most powerful
  model on all user-facing output) applies. Even `ROUTINE_GENERATION` and
  `DUPE_FINDER_AI` are Opus here. Sonnet's only role in this feature is the silent
  background detection (open-loop extraction, eligibility computation) the user
  never reads.

- **Timing is signal-driven, not inactivity-driven.** LGAAS nudges on "48h
  inactive." Seoul Sister nudges on cycle phase + treatment phase + glass-skin
  cadence + open loops. This is a *better* trigger and the moat LGAAS doesn't have.

- **Timezone-aware.** LGAAS fires on cron regardless of local time. Seoul Sister
  already stores `timezone` on `ss_user_profiles` — never nudge overnight.

## Architectural interlock with the Yuri Sole Authority Principle

A nudge **routes the user to Yuri**; it does not generate standalone skincare
recommendations. The nudge message may *reference* what Yuri already established
(a phase, a commitment, an open loop) and carry a prefilled `?ask=` deep-link, but
the actual "what should you do" reasoning happens when the user lands in the Yuri
conversation. The nudge is a *Yuri-conversation entry point* (an acceptable surface
pattern), not a parallel recommender. This is non-negotiable — it's the same
principle that killed five algorithmic recommenders across v10.5.2–v10.7.1.

---

## Pillar 2 — Open-loop ledger (PREREQUISITE, build first)

**Why first**: the nudge engine reads from this. Without it, the nudge can only fire
on raw inactivity (the LGAAS weakness we're explicitly improving on).

Yuri already extracts `commitments[]` (date-stamped, dedup'd) in
`decision_memory`. Commitments capture what the *user* committed to ("I'll try the
BHA MWF"). What's missing is what **Yuri left unresolved** — the open loop she
opened and didn't close (the under-eye press test, the unbuilt Phase 3 routine).
LGAAS calls these `unfinished_items` in its handoff summary.

**Change**: add `open_loops[]` to `DecisionMemory` in `src/lib/yuri/memory.ts`.

```ts
open_loops: Array<{
  topic: string        // short slug, e.g. "phase_3_routine", "under_eye_plan"
  summary: string      // what's unresolved, in plain language
  opened_date: string  // when Yuri raised it
  // resolved when a later extraction sees it closed; until then it's a nudge candidate
}>
```

- **Interface + EMPTY default + merge** (dedup by `topic`, latest wins; an open
  loop disappears when a later extraction no longer surfaces it — Sonnet judges
  resolution).
- **Extraction prompt**: add an `open_loops` instruction — "things Yuri proposed,
  asked the user to do, or said she'd follow up on, that the conversation did NOT
  resolve. A question Yuri asked that the user never answered. A next step named
  but not taken. Be conservative: only genuinely unresolved items, with a quote."
- **Rendering**: surface in Yuri's context so she's aware of her own open loops on
  the next conversation (closes the loop even without a nudge).
- **Same defensive shape as the v10.3.4 fix**: `base.open_loops || []` everywhere,
  so old JSONB rows without the field don't crash the merge.

## Pillar 3 — Durable corrections rollup + memory observability

**Why**: the nudge may reference something the user corrected weeks ago. Yuri's
`corrections[]` currently lives only in the recent-conversation window (last N
conversations) and ages out. For a nudge to never assert a stale/dropped fact about
the user's skin, corrections must be **durable** (LGAAS Blueprint 79).

And the May-19 LGAAS scar + Seoul Sister's own v10.3.4 silent loss mean: **build the
tripwire that catches silent memory failure before a user does.**

1. **Migration** `ss_user_memory` (per-user durable store), JSONB columns:
   `durable_corrections JSONB DEFAULT '[]'`, `updated_at`. RLS: service-role write,
   user read own. One row per user.
2. **Rollup cron** `/api/cron/rollup-durable-memory` — weekly. Pure DB, no AI
   (negligible cost). Consolidates every user's `decision_memory.corrections[]`
   from recent conversations into `ss_user_memory.durable_corrections[]` (dedup by
   topic, latest wins). Corrections are always durable — "ground truth by
   definition." Failure-isolated per-user try/catch (one bad row never aborts the
   batch — LGAAS's structural-isolation lesson). Separate Vercel execution from the
   advisor path so it can't take down chat.
3. **Memory-audit cron** `/api/cron/audit-memory-health` — weekly. The tripwire.
   Logs (to `ss_pipeline_runs` + `console.warn`, the v10.3.5 visibility pattern):
   conversations with ≥6 messages but empty `decision_memory` (extraction silently
   failed), durable store staleness, open_loops older than 30 days (stuck loops).
   Makes the otherwise-invisible failure VISIBLE.
4. **Render** durable corrections in Yuri's context (alongside the windowed
   corrections, deduped) so a correction never falls out of memory.

## Pillar 1 — Proactive nudge engine

1. **Migration** `ss_user_nudges` — log + spacing + observability:
   `id, user_id, nudge_type, trigger_reason, message, deep_link, status
   (pending|surfaced|dismissed|acted), created_at, surfaced_at, dismissed_at`.
   Index `(user_id, created_at desc)`. RLS: service-role write, user read/update
   own (so the dashboard can mark surfaced/dismissed/acted).

2. **Eligibility module** `src/lib/intelligence/nudge-eligibility.ts` — pure
   functions, no AI. For a given user, compute the **single best nudge opportunity**
   (or none) from signals already in the DB:
   - **Open loop stale**: an `open_loops[]` item opened ≥5 days ago, unresolved.
   - **Phase/routine mismatch**: active treatment phase ≠ the phase their active
     routines are labeled for (Bailey's exact case — Phase 3 active, routines say
     Phase 2).
   - **Cycle-timed**: a brightening/actives loop that's well-timed for the user's
     *current* cycle phase (follicular/ovulatory) but NOT during menstrual week.
     This is the dermatological-timing intelligence.
   - **Glass-skin cadence**: latest score ≥14 days old AND a momentum moment
     (phase milestone) — suggest a fresh photo (existing prompt pattern).
   - Returns `{ type, reason, context }` or `null`. Conservative: prefer `null`
     over a weak nudge.

3. **Nudge cron** `/api/cron/proactive-nudge` — daily.
   - Load active subscribers (pro plan, onboarded).
   - Per user: check `ss_user_nudges` for `MAX_NUDGES` (3) and `SPACING_DAYS` (3)
     — never nag.
   - **Timezone gate**: skip if it's outside 9am–8pm in the user's `timezone`
     (don't queue a nudge they'll see at 3am).
   - Compute eligibility. If `null`, skip.
   - **Generate the message with Opus 4.8** in Yuri's voice, with the no-guilt
     escalation ladder (nudge #1 warm + specific; #2 value; #3 low-pressure,
     door-open, no guilt). Prefilled `?ask=` deep-link carries the context.
   - Insert `ss_user_nudges` row (`status: 'pending'`). Log decisions for
     observability (eligible/skipped + why).
   - Failure-isolated per-user.

4. **Delivery — dashboard first (web, free, no infra)**:
   - `/api/me/nudge` GET returns the latest `pending` nudge; POST marks
     surfaced/dismissed/acted.
   - Dashboard renders a dismissible Yuri-voiced card with the `?ask=` CTA.
   - **Push notification deferred** (CLAUDE.md Future Work — needs service-worker
     push + web-push lib). The cron + ledger are channel-agnostic; push is a later
     delivery adapter on the same `ss_user_nudges` rows.

5. **vercel.json**: add `/api/cron/proactive-nudge` (daily), `rollup-durable-memory`
   (weekly), `audit-memory-health` (weekly).

## Build order

Pillar 2 (open-loop extraction) → Pillar 3 (durable + observability) → Pillar 1
(nudge engine + dashboard) → verify (`tsc --noEmit` + `next build`) → CLAUDE.md +
CHANGELOG + commit.

## Observability is a first-class requirement (not optional)

Every cron in this feature logs its decisions to `ss_pipeline_runs.metadata` +
`console.warn/error` on the failure paths. No fire-and-forget `.catch(() => {})`.
This is the direct lesson of v10.3.4 (3 months of silent data loss) and LGAAS's
May-19 gap (a week of silent truncation). A proactive system that asserts things
about a user's skin MUST be auditable.

## What this is NOT

- NOT a marketing/upsell drip. It's Yuri continuing care at the right moment.
- NOT a standalone recommender (Yuri Sole Authority Principle — it routes to Yuri).
- NOT inactivity-spam (signal-driven, capped, spaced, timezone-gated, no-guilt).
