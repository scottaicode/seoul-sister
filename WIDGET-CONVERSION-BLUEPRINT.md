# Widget Conversion Blueprint — Continuity Is the Gate

**Date:** June 4, 2026
**Status:** Shipping (v10.12.0)
**Trigger:** A landing-page widget review found 20 unique anonymous visitors (March 11 → June 3), 71 user messages, several `engaged`/`ready_to_buy` — and **0 conversions, 0 captured emails**. The conversation quality is excellent (the April 21 atopic-dermatitis visitor got a full diagnosis, product plan, budget coaching, and authenticity checks across 15 messages, then said "Thank you Yuri" and left). The funnel leaks at the moment that matters most: Yuri **fully resolves the visitor's problem in the free preview, leaving no reason to subscribe and no way to follow up.**

---

## The diagnosis (research-grounded)

2026 freemium research is blunt about this failure mode:

- **Freemium converts at 2–6%** even done well; correct aha-moment gating reaches 5–16%; hard paywalls convert ~5× better than freemium (10.7% vs 2.1%).
- The single most-cited failure: *"If the free tier is too generous, users never upgrade. Give ~80% of the solution so they experience success; keep the 20% that completes the job behind the paywall."*
- For AI advisors specifically: *"The biggest quality leap comes from memory — an AI that remembers you is a fundamentally different experience. Platforms front-load memory richness and gate deep memory behind the paid tier."*

Seoul Sister's widget currently gives **100%**. Yuri completes the job — diagnosis, plan, "come back and tell me how it goes" — for free. But an anonymous visitor *can't* come back to the same Yuri, because there's no memory of them. That continuity gap is the product, and it's exactly what the lighthouse subscriber (Bailey) has that the visitor doesn't.

**The give/gate line is therefore NOT about advice quality** (quality is what earns trust — keep giving it fully). **The gate is continuity:**

- **Give freely:** brilliant one-session advice, real diagnosis, real product recommendations, real warmth. Earn the trust.
- **Gate (the 20%):** "I'll remember all this. I'll track whether it's working. I'll adjust next month. I'll catch the conflict when you add a product. That's the subscriber side — and honestly it's the part that actually changes your skin, because skincare is a months-long relationship, not a single conversation."

That's not a sales pitch. It's the one true fact a cold visitor genuinely cannot infer from a single great conversation.

---

## What ships (three AI-First changes)

Per the **Surface Facts, Do Not Instruct** invariant (mirrored from LGAAS Blueprint 83): each change gives Opus *one fact it can't see* plus *at most one tripwire* (a forbidden bad-output, which the invariant explicitly allows). None of them script Yuri's words, timing, or sequence. Opus decides everything about *how* the conversation runs.

### 1. Redefine the give/gate line (prompt)

`src/app/api/widget/chat/route.ts` — the `## The Business Reality` section of `YURI_WIDGET_SYSTEM` is replaced with `## The One Thing Subscribers Get That You Can't Give Here`. It:

- Surfaces the **continuity fact**: a visitor she fully helped who leaves still got real value, but skincare changes over weeks/months and the follow-through (remembering, tracking, adjusting, catching conflicts) only exists for subscribers — and that follow-through is the part that actually moves skin.
- Sets **one tripwire**: when she's walked a visitor through a real multi-step skin problem (a routine, a multi-week plan, a "come back and tell me how it went"), don't let the conversation close as if the journey is finished — the journey *starting* is the free part; the *continuation* is the subscriber part, and she should let the visitor feel that naturally.
- **Keeps every existing guardrail**: never pushy, never sales language, never "sign up now," value-before-pitch sequence, let non-fits go warmly. Those lines are doing real brand work and are preserved verbatim.

The old block told Yuri to "mention what subscribers get" as a *feature list* with no signal about *when the moment has arrived*. The default became "never," so the ask never fired. The new block gives her the moment (a resolved journey) and the fact (continuation is the value), and trusts her to land it.

### 2. Capture the email before they vanish (the urgent leak)

Right now a `ready_to_buy` visitor leaves with **zero way for Seoul Sister to ever reach them again.** Personalized email capture converts at up to ~19%, and nurture sequences convert visitors who weren't ready on day one. This is the cheapest, highest-return fix and it's independent of the paywall.

- **Migration** (`ss_widget_visitors`): add `captured_email TEXT` + `email_captured_at TIMESTAMPTZ`. No CHECK constraints, no enum — avoids the silent-constraint bug class. Nullable, additive, zero backfill.
- **Server-side detection** (`route.ts`): after the response completes, if the visitor's message this turn contains an email (`\b[\w.+-]+@[\w-]+\.[\w.-]+\b`) and the visitor hasn't already given one, persist it to the visitor record + fire a `widget_email_captured` AI-usage breadcrumb. Email *detection* is mechanical extraction (like BP84's phone detection), not conversation logic.
- **Prompt fact (Option A — capture, do NOT promise a send)**: Seoul Sister does **not** yet send outbound email (a `RESEND_API_KEY` exists but no SDK / sending code is wired). So Yuri offers to **save** a visitor's email so Seoul Sister can reach them and pick the thread back up — framed honestly as staying connected, NOT as an instant delivery. She is explicitly forbidden from promising an email will arrive ("check your inbox," "I just sent it," "it's on the way"). The address still lands in the lead list (the actual goal — reachability); the nurture email itself is sent deliberately later, out of band. She decides when/whether to offer. **No scripted line.** When real automated sending is built (install Resend SDK + verify a sending domain), the prompt can be upgraded to promise delivery — deferred.

This turns "20 visitors gone forever" into "a list you can nurture," and gives a natural soft-conversion that doesn't require the $39.99 leap on day one.

### 3. Move the conversion moment to high-intent action, not a message counter

The strongest 2026 finding: *"the conversion magic happens when the paywall is triggered by a specific high-intent action — the user has already invested effort and is primed to convert."* The current "20 messages → prompt" is the weak version.

This blueprint implements the *prompt-side* of this (the high-leverage, low-risk half): the give/gate block names the high-intent moments (visitor asks Yuri to **build/save a routine**, **remember a reaction**, **track progress**, or **personalize to their specific skin**) as the natural places for the continuity fact to surface — because those are exactly the actions that *require* a remembered profile. Yuri delivers the value, then surfaces that saving/tracking/remembering it is the subscriber side.

A heavier structural change (a high-intent-triggered inline upgrade card in the UI, and a reverse-trial that lets a visitor *feel* the memory then lose it) is **deliberately deferred** to a measured follow-up — verify the prompt+email changes move the numbers first.

---

## Observability (verify before escalating)

Two zero-cost breadcrumbs on the existing AI-usage log + the new columns make adherence a one-query check:

```sql
-- Email capture volume (the leak-fix metric)
SELECT DATE(email_captured_at) AS day, COUNT(*) AS emails_captured
FROM ss_widget_visitors
WHERE captured_email IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

-- Conversions (the north star)
SELECT COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS converted,
       COUNT(*) AS visitors,
       COUNT(*) FILTER (WHERE captured_email IS NOT NULL) AS with_email
FROM ss_widget_visitors;
```

**Baselines to beat:** 0 captured emails, 0 conversions, 20 lifetime visitors. If captured-email rate on multi-message conversations climbs and the visitor list starts growing, the leak fix worked — independent of subscription conversions, which are slower and need traffic.

---

## What this deliberately does NOT do

- **No worse / more withholding Yuri.** The research is explicit that gating the aha-moment kills conversion. Yuri gives advice quality fully and freely. Only continuity is gated.
- **No scripted dialogue, no sequencing rules, no "capture EARLY" choreography.** That would violate Surface-Facts-Do-Not-Instruct (the exact line LGAAS BP83 caught and reverted). Opus owns the conversation.
- **No hard paywall, no reverse-trial mechanic, no UI upgrade card yet.** Prompt + email + measurement first. Escalate only if the breadcrumbs show the light fix underperforms.
- **No ad spend.** Fix the bucket before pouring traffic in. (Acquisition was intentionally gated on Bailey's sign-off; this fixes the funnel during that window.)
- **No change to authenticated Yuri, onboarding, or any subscriber surface.** Widget-only.

---

## Files

- `src/app/api/widget/chat/route.ts` — give/gate prompt rewrite, email-capture fact in prompt, server-side email detection + breadcrumb.
- `src/lib/widget/visitor.ts` — `captured_email` / `email_captured_at` on the visitor type + `recordCapturedEmail()` helper + select columns.
- `supabase/migrations/20260604000001_widget_email_capture.sql` — additive columns (manual apply via Supabase Studio).
- `WIDGET-CONVERSION-BLUEPRINT.md` — this doc.
- `CLAUDE.md` — changelog (v10.12.0).

## Cross-references

- **LGAAS Blueprint 83** (Surface the Fact, Don't Script the Pitch) — the AI-First pattern this mirrors; diagnosis is identical (value met before "yes," so the ask never fires), mechanism differs (self-serve Stripe vs human callback).
- **LGAAS Blueprint 84** (real conversion event) — the lesson to measure the thing you actually want; relevant when ad traffic starts.
- **Yuri Sole Authority Principle** — unaffected; the widget gives advice, the gate is continuity, no parallel recommender introduced.
- **2026 freemium research** — 80/20 give/gate, memory-as-moat, high-intent-trigger, email-capture-before-paywall (sources in the conversation record).
