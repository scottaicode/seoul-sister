# Nudge Date Honesty + One Metric Double-Count — v11.25.0

**Date**: August 11 2026
**Reported by**: Bailey (lighthouse user, co-developer) — two iMessages to Scott
**Status**: implemented, NOT yet verified in production (see Verification below)

---

## What Bailey saw

Two screenshots, two separate defects.

**1.** A dashboard nudge from Yuri opening with *"Sunday's here, so I'm keeping my word and checking in like I said I would."*
Bailey: **"lol it's Tuesday.."**

**2.** The admin One Metric card reading `Paid (from widget): 2` / `Visitor → paid: 2.99%`.
Bailey: **"What's the 2 paid and 2.99% paid?"**

Both were real. Neither was cosmetic.

---

## Defect 1: three stacked date bugs behind one nudge

### What was NOT wrong (corrected mid-investigation)

The first pass of this investigation concluded Yuri had **hallucinated the promise** — that she'd invented "I said I would" out of nothing. **That was wrong**, and Scott pushed back on it. The transcript shows she promised a Sunday check-in **five separate times**, unprompted:

- Aug 6 15:14 — *"By Sunday your chin should feel smooth... I'll check in Sunday."*
- Aug 6 15:12 — *"Once the chin's smooth again (I'll check Sunday, likely right around then)"*
- Aug 7 21:28 — *"I'll check in Sunday to see which way it went."*
- Aug 8 02:31 — *"When your chin and nose are smooth (checking Sunday)"*
- Aug 8 02:26 — *"I'll check back in on the chin and nose Sunday, if they're smooth by then, that's your green light to bring the TXA in solo."*

The nudge asked about *"that chin and nose... still feeling dry or have they smoothed out"* — the exact open loop, the exact body parts, `trigger_reason = open_loop_barrier_recovery_check`. **Her memory worked perfectly.** The promise was real, specific, and correctly recalled.

**Lesson (same class as `feedback_symptom_is_not_diagnosis`):** the user's words described a *symptom* ("wrong day"). The first diagnosis reached for the most dramatic explanation (fabrication) instead of reading the transcript. One query into `ss_yuri_messages` settled it. **Read the source conversation before calling an AI claim fabricated** — this is the third time that rule has paid out (see `feedback_check_the_instrument_first`).

### How Yuri schedules her own follow-ups (the mechanism)

Worth documenting, because it is genuinely the feature working:

1. **She names the date in conversation.** Nothing prompts her. She decided the barrier needed 3-4 days and that Sunday was when the chin should read smooth. Clinical judgment picks the date.
2. **A background Sonnet extractor reads her own words back** (`memory.ts` open-loops section) and resolves the named day to a concrete `check_back_date`. The prompt is strict about provenance: *"This is what she SAID, not what you think would be good... never derive it from how long a treatment takes to work."*
3. **The daily cron fires on the date SHE chose.** `nudge-eligibility.ts:135-140` — a `check_back_date` overrides the generic 5-day staleness rule in **both** directions (can make a loop due early, or hold it back past day 5).

The cadence is Yuri's dermatological judgment, extracted from her own prose and executed by a dumb cron. That is the design, and it is why the nudge landed on the right topic.

### The three bugs

Production row (`ss_yuri_conversations.decision_memory`, conversation `4712fc0c`):

```json
{
  "topic": "barrier_recovery_check",
  "summary": "Yuri will check back on chin and nose dryness Sunday - if smooth by then, that's the green light to bring TXA in solo",
  "opened_date": "2026-08-08",
  "check_back_date": "2026-08-10"
}
```

She said **Sunday**. Sunday was **Aug 9**. The extractor wrote **Aug 10 — Monday**.

| # | Layer | Defect |
|---|---|---|
| **1a** | `memory.ts` extraction prompt | Resolved `check_back_date` relative to `new Date().toISOString()` — raw server **UTC**, **no weekday name**, **no user timezone**. Bailey messaged 9:26 PM CT Aug 8 = **02:26 UTC Aug 9**. "Today" was already Sunday on the server while still Saturday for her, so "Sunday" resolved forward to Monday Aug 10. |
| **1b** | `proactive-nudge` cron prompt | Passed only `opportunity.context` to Opus — **no date, no weekday, no timezone**. Given a genuine memory that the check-in was promised for Sunday and no clock, Yuri stated the promised day as though it were today. |
| **1c** | Delivery latency (pre-existing) | No `scheduled_for` column. The nudge is created at 15:00 UTC and sits until the user next opens the dashboard. Median latency across all 8 surfaced nudges ≈ **3 days**; worst case **57.5 days** (created Jun 11, surfaced Aug 7). Even a correctly-dated nudge drifts. |

Chain: right promise → wrong date extracted (+1 day) → loop due from the 10th, cron fired the 11th → prompt had no clock → Yuri asserted the promised day as today.

**This is the first production row ever produced by the v11.23.0 `check_back_date` feature**, which memory had flagged UNVERIFIED with a recheck due Aug 10. It fired, it wrote, a consumer read it — and finding that row is what exposed bug 1a. The loop was verified and falsified in the same query.

### Fixes

**1a — inject a real clock into the extraction prompt.** The extractor now receives the user's local date *and weekday name*, resolved through their `ss_user_profiles.timezone`, plus an explicit anchor for weekday arithmetic ("Sunday" = the next Sunday on or after today, in their local calendar). Falls back to UTC when timezone is unknown — same posture as `advisor.ts`.

**1b — inject the same clock into the nudge prompt.** Yuri is told the real current date/weekday, the date she promised, and *how many days late she is*. She is NOT told what to say about it. Given the fact, she can write "I said Sunday and I'm running a couple days behind" — which is warmer and more honest than either pretending or staying silent.

**1c — surface staleness as a fact, not a suppression.** The nudge card and email carry the age of the nudge so a days-old message never asserts "now." Not fixing the latency architecture in this release (that needs a `scheduled_for` column and a delivery decision); making it *visible* is the cheap correct step.

**What was deliberately NOT done:** the first draft recommendation was to **ban temporal language in nudges entirely**. That was withdrawn. It would have stripped out the single best thing the feature does — Yuri remembering she gave her word on a specific day. The bug is a missing clock, not the memory. **Fix the clock, not the memory.**

### AI-First posture

The date block is a **FACT**, phrased the way the shelf-visibility and cumulative-give instruments are: it states what is true and hands the decision back. It never says "do not mention the day" or "apologize for being late." A guard test fails if the block acquires imperative mood. This follows the documented rule that the widget give/gate failed twice by rewording a rule before v11.10.0 fixed it with a fact instead.

---

## Defect 2: the One Metric counted rows, not people

`Paid (from widget): 2` was **one human**.

```
visitor_id 1b6e969b…  lrwells2013@gmail.com  14 msgs  converted 2026-07-21 16:20:31  user fe464145…
visitor_id 4848fbee…  lrwells2013@gmail.com  12 msgs  converted 2026-07-21 16:20:31  user fe464145…
```

Same email, same `converted_user_id`, same timestamp — **Kim Wells**, the first paying subscriber, who used the widget from two devices. `ss_subscriptions` confirms exactly **one** active subscription.

**Root cause.** `attributeConversion()` (`src/lib/widget/visitor.ts`) updates *every* visitor row matching the email — **correct**, you want the whole cross-device trail attributed. The bug is downstream, in `src/app/api/admin/widget/analytics/route.ts`, which counted **rows**:

```ts
db.from('ss_widget_visitors')
  .select('*', { count: 'exact', head: true })
  .not('converted_at', 'is', null),      // 2 rows = 1 human
```

**The One Metric — the number the entire NORTH-STAR freeze is keyed to — was reading 2x high.** 1/67 = **1.49%**, not 2.99%.

The denominator has the same disease (67 visitor *rows*; Kim is 2 of them), so the honest rate is somewhat above 1.49% — but the numerator error is the large one.

**Fix.** Count distinct humans:
- **Numerator**: distinct `converted_user_id`.
- **Denominator**: distinct identity — `captured_email` when present (case-insensitive), else `visitor_id`. Collapses the same person across devices once they identify themselves; an anonymous visitor still counts once.
- **Emails**: distinct lowercased `captured_email`, not rows.

**Also fixed: the two panels contradicted each other.** Kim's `ss_subscriptions.lead_source` is `null`, so `lead_source_breakdown` filed her under "organic_or_unknown" while the One Metric counted her as widget-converted, on the same screen. A backfill migration reconciles her row against the attributed visitor record.

---

## Verification (per the Name-the-row rule)

**Defect 2** is verifiable immediately — it reads existing production rows. Confirmed against live data: 2 rows → 1 distinct human.

**Defect 1 is NOT verified as of this writing, and must not be described as working.** Requirements before it can be called verified:

1. A **scheduler-produced** nudge row (not a hand invocation — the Jul 29 Reddit cron lesson: hand-invoking proved the code and hid a GET/POST defect for six more days).
2. That row's message must not assert a weekday that disagrees with its own `created_at`.
3. A **new** `check_back_date` extracted after this deploy, where Yuri names a weekday, landing on the correct local calendar date.

Until (3) produces a row, bug 1a is fixed in code and unproven in production. The next real check-back promise Bailey triggers is the test.

**Cache note:** `/_next/static/` is cache-first — bump `CACHE_NAME` in `public/sw.js` so the admin dashboard fix reaches devices with the app installed.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/yuri/clock.ts` | **NEW** — single shared local-date/weekday resolver. One implementation, per the geocoder rule (never two clocks that can disagree). |
| `src/lib/yuri/memory.ts` | Extraction prompt receives local date + weekday + timezone; `extractAndSaveDecisionMemory` accepts a timezone. |
| `src/lib/yuri/advisor.ts` | Passes the user's timezone into extraction. |
| `src/app/api/cron/proactive-nudge/route.ts` | Nudge prompt receives the clock fact + promised-date/lateness fact. |
| `src/app/api/admin/widget/analytics/route.ts` | Distinct-human counting for the One Metric. |
| `scripts/migrations/backfill_kim_wells_lead_source.sql` | Reconciles the contradicting panel. |
| `public/sw.js` | `CACHE_NAME` bump. |
| `tests/nudge-date-honesty.test.mjs` | **NEW** — guard tests, each confirmed to FAIL when its bug is reintroduced. |

---

## Lessons for the next session

1. **Read the source conversation before calling an AI claim fabricated.** Yuri kept her word; the clock was broken. The dramatic explanation was the wrong one.
2. **A missing fact looks exactly like bad judgment.** Yuri was asked to name a weekday with no calendar and to write "now" with no clock. Both times she did the most reasonable thing available and both times it was wrong. Before rewriting a prompt's *rules*, check what the model can actually **observe** (`project_widget_email_ask_state_bug`, same shape).
3. **Verifying a loop can falsify it.** Chasing the v11.23.0 recheck produced its first row *and* the bug in it. A row existing is not a row being right — the four questions include "does it write?", not "does it write correctly."
4. **Counting rows is not counting people.** Any metric over a table where one human can own multiple rows needs a distinct-identity key. Check the other funnel counters for this shape.
