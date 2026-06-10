BEFORE planning or writing any feature, review the proposed work against Seoul Sister's North Star Charter (`NORTH-STAR.md`). This is a PRE-BUILD BUSINESS gate — the revenue-side companion to `/ai-first-guard`. `ai-first-guard` asks "is this built the right way?"; `ship-guard` asks the prior question: **"should this be built AT ALL right now, or is it unvalidated product that should wait?"**

Run this on the PROPOSED WORK, before any plan or edit. It exists because Seoul Sister is a 9/10 product with ~0 validated demand (0 conversions from 22 visitors, conversion rate unmeasured), and the standing failure mode is building more product instead of answering "will a stranger pay?"

## Step 1 — Classify the work

Put the proposed work in exactly one bucket:

- **GROWTH/MEASUREMENT** — funnel instrumentation, lead capture & outbound (email/Resend), acquisition/content/distribution, conversion mechanics. → **ALWAYS ALLOWED.** This is the work that ends the freeze. Pass immediately.
- **BLOCKING BUGFIX** — a defect a real or paying user hits: checkout, auth, onboarding, a crash, a broken paying flow. → **ALLOWED.** Pass.
- **COST/OBSERVABILITY CORRECTNESS** — being able to see unit economics or health truthfully (e.g. the usage-logger fix). → **ALLOWED.** Pass.
- **GUARDIAN TIER-1 PAPER-CUT** — per `GUARDIAN-CHARTER.md`, keeping the existing product honest (dead image, stale copy, silent failure). → **ALLOWED.** Pass.
- **NEW FEATURE / CAPABILITY / COMPLETENESS / POLISH** — anything that adds to or improves the product surface. → **Go to Step 2. Default answer is NO.**

## Step 2 — The feature must clear BOTH gates (only reached by the last bucket)

A new feature proceeds ONLY if the request provides, in writing, BOTH:

1. **A revenue/conversion hypothesis** — specifically how this changes *whether or how many strangers pay*, or *how long they stay*. It must be falsifiable and demand-side.

2. **The measurement** — the metric (ideally visitor→paid conversion, or retention) that will prove or kill the hypothesis, and roughly when it will be read.

### Automatic rejections (these are improvement claims, not demand claims)

- "It would make Yuri / the product better."
- "It's best practice" / "it's the AI-First / complete way to do it."
- "It would be cool" / "users might like it" / "it feels incomplete without it."
- "We already started it" / "it's almost done."
- Any justification that describes the product getting better rather than a stranger being more likely to pay.

> Best practices and AI-First are HOW we build, never WHY we build. They answer the wrong question at this gate.

## Step 3 — Verdict

- If the work is GROWTH/MEASUREMENT, a BLOCKING BUGFIX, COST/OBSERVABILITY, or a GUARDIAN TIER-1 fix:
  say **"SHIP-GUARD: PASS — [bucket]. This advances or protects validation. Proceed (then run /ai-first-guard on the plan as usual)."**

- If it's a new feature WITH both a genuine conversion hypothesis and a measurement:
  say **"SHIP-GUARD: PASS — feature cleared with a falsifiable conversion hypothesis. Proceed."** and restate the hypothesis + metric so it's on record.

- If it's a new feature WITHOUT both:
  say **"SHIP-GUARD: HOLD — this is improvement, not validation."** Then:
  1. Name which gate it failed (no demand hypothesis / no measurement / automatic-rejection phrase).
  2. State plainly: *the One Metric (visitor→paid conversion) is unmeasured/flat, so the default is don't-build.*
  3. Redirect: name the highest-leverage GROWTH/MEASUREMENT work that should happen instead (instrument the funnel, wire email capture-and-send, drive a real cohort and read the conversion rate).
  4. Note the escape valve: this feature unfreezes once the metric is measured and moving, or if a real conversion hypothesis can be articulated.

The goal is not to block work — it is to make sure the work pointed at the product is *earning its place* against the only question that matters right now. When in doubt, HOLD and redirect to growth. A redirect that protects Scott from over-building is a better outcome than a clean build of something no paying user asked for.

ARGUMENTS: the feature or work being proposed.
