# Learning-Loop Blueprint — Seoul Sister (Yuri)

> **For the AI model working in this repo.** This is an overriding design principle the owner wants
> in every app he builds. It originated while building DeepChain (a sibling app) and was brought here
> deliberately so Yuri grows stronger over time the same way. Read this before adding any feature that
> makes a judgment. It complements — does not replace — CLAUDE.md.

## The principle

Every app should **learn from its own experience and grow stronger from both wins and losses.** The
pattern is three steps:

1. **The AI commits to a recorded, dated judgment** — store it with reasoning + confidence, timestamped.
2. **Reality grades it against an objective teacher.** *This is the hard part and the whole game:* find
   the **least-gameable teacher** in the domain. The closer the teacher is to objective truth, the
   stronger the moat.
3. **The graded record feeds back into the AI's context so it self-corrects** — surfaced in the prompt
   so the AI recalibrates ("my advice on X has worked, on Y it hasn't — adjust").

The accumulated, labeled outcomes are the moat. Code copies in a weekend; a self-calibrating corpus of
real graded outcomes cannot.

## What this means specifically for Yuri

Yuri already has the **memory** half (dated `decision_memory`: decisions, preferences, corrections —
she owns past advice and explains when she changes it). What's weaker here than in the sibling app
DeepChain is the **teacher** — step 2.

- **Yuri's current teachers** are: (a) user corrections (the `corrections` log — good, but only fires
  when a user pushes back), and (b) the Bailey feedback loop (a real user finding real failures — high
  quality but sparse and manual). Both are **subjective and sparse** signals.
- **The gap:** Yuri rarely learns whether her *advice actually worked* — did the barrier heal, did the
  routine clear the acne, did the recommended product help? That outcome is the real teacher, and it's
  mostly uncaptured.

## The upgrade path (find a less-gameable teacher)

In rough order of signal quality (prefer the hardest signal you can capture):

1. **Measured outcome** (strongest): a Glass Skin Score / photo trend tracked over weeks against the
   routine Yuri prescribed. If a user followed Yuri's plan and the measured score improved, that's an
   objective-ish grade of her advice. Tie the dated recommendation → the later measured delta.
2. **Verified user-reported result**: a structured "did this work for you?" tied to a specific dated
   recommendation (not a generic thumbs-up) — "the barrier cream Yuri recommended on May 3 → barrier
   healed / no change / worse."
3. **Retention / re-engagement** as a proxy: users who got advice that worked come back and follow more.

Then close the loop: **feed the graded record back into Yuri's prompt** so she calibrates — "ceramide-
first barrier-repair plans have worked for sensitive users; my actives-first advice for compromised
barriers has not — lead with repair." That's Yuri getting measurably better next quarter than this one.

## The discipline (keep it AI-First)

- The MODEL judges what worked and how to recalibrate — don't hardcode rules that decide "advice X is
  good." Code stores the dated recommendation and the objective outcome; the model reasons over them.
- Grade against the **outcome**, not the user's mood. A user can love advice that didn't work and hate
  advice that did. The teacher must be as objective as the domain allows.
- Never fabricate an outcome to fill the loop (same honest-empty discipline as the rest of Yuri).

## Reference implementation

DeepChain (sibling app) is the cleanest example: it records dated calls, auto paper-trades them on a
market, grades them by P&L, and feeds calibration back into the analyst's context. Its teacher (market
P&L) is near-perfectly objective — which is exactly why its loop is the strongest of the three apps.
Emulate the *structure*; Seoul Sister's job is to find the least-gameable skincare-outcome teacher it can.
