# Seoul Sister — North Star Charter

**Version:** 1.0 (June 9, 2026)
**Status:** Active. Read at the START of every session, before any plan, by every human and every AI agent working on this repo.
**Owner:** Scott Martin.
**Companion gate:** `/ship-guard` (`.claude/commands/ship-guard.md`) enforces this charter on every feature-build attempt.

---

## Why this document exists (read this part honestly)

Seoul Sister is a 9/10 product with effectively **zero validated demand**. As of this writing: ~1 paying account (the founder's), **0 widget conversions from 22 visitors, 0 captured leads, conversion rate unmeasured, distribution gated.** Meanwhile the codebase is at **v10.13.x after 14 completed phases, with a self-auditing Guardian, a learning-loop teacher, proactive nudges, decision memory, corrections memory** — sophisticated machinery serving almost no one.

That ratio — *immense engineering depth, near-zero revenue validation* — is not an accident. It is the predictable result of a capable builder with tireless AI agents and **no forcing function pointing the work at money.** Building produces a guaranteed reward: a green build, a changelog entry, the feeling of competence. Selling produces only a *probabilistic* reward: maybe a stranger pays, maybe they don't. A builder will always drift toward the guaranteed dopamine. The agents will build forever, because building is what they are for.

**This charter is the forcing function.** Its job is not to shame anyone into selling. Its job is to make the answer to *"will a stranger pay?"* the thing that governs what gets built — and to make growth work produce its own visible scoreboard, so the satisfaction moves to the right place.

The 90-day blueprint already said "do not build more — the product is overbuilt for the user base." That guidance was ignored once because it had no teeth. This charter has teeth.

---

## The Prime Directive

> **Until a stranger pays, nothing else is real. The only work that matters is the work that answers — and then moves — the question: *will a stranger pay $39.99 for Seoul Sister?***

Everything in this repo is excellent. None of it is validated. **Validation, not improvement, is the job now.**

---

## The One Metric (the gate is keyed to this)

**Visitor → paid conversion rate** is the governing metric, with **count of real external paying subscribers** as its co-pilot.

Why this one and not MRR: MRR is a *lagging* number that can sit at zero without telling you why. Conversion rate is the *diagnostic* — it tells you whether the machine works at all, independent of traffic volume. It is the single number that turns every revenue projection from a guess into a forecast.

**Current value: UNMEASURED (0 of 22 lifetime visitors converted; 0 leads captured).**
You cannot improve a number you cannot see. **Therefore the first permitted work is to make this number measurable** (funnel instrumentation + email capture-and-send), and the second is to move it.

---

## The Build Freeze (default state)

**While the One Metric is unmeasured or flat, the default answer to "should we build this feature?" is NO.**

This is **default-deny, measured-first.** A new feature may only proceed if a written one-paragraph case clears `/ship-guard` by naming BOTH:

1. **The revenue/conversion hypothesis** — specifically how this changes whether or how many strangers pay. ("It makes Yuri better," "it's best practice," "it would be cool," "it's more complete," "a user might like it" are **automatic rejections** — they are improvement claims, not demand claims.)
2. **The measurement** — the metric that will prove or kill the hypothesis, and roughly when you'll read it.

If a change can't name both, it is improvement, not validation, and it waits.

### What is ALWAYS allowed (never frozen)

The freeze is on *building features*. It is not on the work that ends the freeze. Always permitted, no business case required:

- **Funnel instrumentation** — anything that measures visitor → trial → paid → retained.
- **Lead capture & outbound** — email capture-and-send (the Resend pipeline), the conversion mechanics of the widget.
- **Acquisition / content / distribution** — the Yuri-on-video engine, Bailey's story, anything that drives or converts real traffic.
- **Bug fixes that block a real user or a paying flow** — checkout, auth, onboarding, a crash a stranger would hit.
- **Cost/observability correctness** — e.g. the v10.13.1 usage-logger fix: you must be able to see your unit economics before you scale.
- **The Guardian's Tier-1 paper-cut fixes** — per `GUARDIAN-CHARTER.md`, those keep the existing product honest and are not new building.

### What is FROZEN until the metric moves

- New user-facing features and capabilities.
- New Yuri tools, specialists, or surfaces (beyond fixing what exists).
- "Completeness" passes, polish on surfaces no paying user has seen, new intelligence layers.
- Anything justified primarily by "best practice," "AI-First completeness," or "it would be better."

> **Best practices and the AI-First approach are how we build — they are not a reason to build.** "It's the right way to do it" answers *how*, never *whether*. The charter governs *whether*.

---

## What UNFREEZES building (the escape valve)

A guardrail with no exit is a cage. Building unfreezes when the work has earned it:

- **Threshold 1 — Metric exists:** funnel is instrumented and you have a real, measured visitor→paid conversion rate from a cohort of at least ~200 cold visitors. Now you can reason about features with data instead of vibes.
- **Threshold 2 — Metric is alive:** conversion rate is meaningfully > 0 and subscriber count is climbing month over month. Features that *demonstrably* lift conversion or retention unfreeze first; pure "completeness" stays frozen.
- **Per-feature override:** even while frozen, any single feature can proceed if it clears `/ship-guard` with a genuine, falsifiable conversion hypothesis. The freeze is a strong default, not a wall — `/ship-guard` is where the exception is argued and either earned or denied.

---

## The Kill / Pivot Line (decide it cold, now)

Define this *before* the emotion of the moment, so the eventual call is made on data, not sunk cost:

> **If, after a genuine distribution push (real traffic driven through an instrumented, converting funnel for at least ~8 consecutive weeks), the visitor→paid conversion rate stays effectively dead AND paying subscribers do not climb — that is the data telling you the consumer-app thesis is wrong at this price/positioning.**
>
> The correct response is NOT another feature. It is to change one input — **price, positioning, or audience** (e.g. test $19.99/mo, test a $399/yr annual, test a B2B advisor angle for estheticians, or test data/intelligence licensing) — and re-run. If multiple such re-runs stay dead, that is permission to stop or pivot the whole direction, not to keep building.

The product is not the risk. The demand is. This line protects you, your time, and your relationship with Bailey by making "when do we admit this isn't working?" a pre-agreed data decision instead of an open-ended emotional one.

---

## For every AI agent reading this

You are capable of building anything asked of you, quickly and well. That capability is exactly the danger here. **Your default instinct to be thorough, complete, and best-practice will, unchecked, produce more unvalidated product — which is the failure mode this business is already in.**

So: when you are asked to build a feature, or when you notice something that "should" be improved, your first move is **not** to plan the build. It is to run `/ship-guard` and ask whether this work moves the One Metric. If it doesn't, your job is to **say so and redirect to growth/measurement work**, even if the build would be easy and satisfying. Surfacing "this is improvement, not validation — should it wait?" is a *better* contribution than shipping it cleanly.

The most valuable thing you can do for Scott is not another green build. It is helping him answer whether a stranger will pay — and refusing to let the repo's depth grow further ahead of its revenue until it does.

---

**Companion documents:** `GUARDIAN-CHARTER.md` (protects code/data health), `LEARNING-LOOP-BLUEPRINT.md` (the moat), `SEOUL-SISTER-90-DAY-BLUEPRINT.md` (the GTM plan this charter enforces). This charter sits *above* feature work and *beside* the Guardian: the Guardian protects what exists; the North Star governs what gets built next.
