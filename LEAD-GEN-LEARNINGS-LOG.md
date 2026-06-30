# Lead-Gen Learnings Log — What's Worked, What Hasn't

> **Purpose:** A dated, honest record of lead-generation experiments and their measured outcomes, so we learn instead of re-running the same ideas. This is the "what worked / what didn't" companion to the forward-looking `SEOUL-SISTER-LEAD-GEN-PLAN.md` (the plan), `WIDGET-CONVERSION-BLUEPRINT.md` (the continuity thesis), and `NORTH-STAR.md` (the one metric). Newest entry first. Append, don't overwrite — old entries are the corpus.

> **The one metric (from NORTH-STAR):** visitor → Yuri conversation → continued conversation → email/subscription. We measure the funnel, not vanity. A win is movement on a real conversion step, not a shipped feature.

---

## June 29 2026 — Funnel consolidation ("single front door") + first measured stranger conversations

### What we built (7 PRs, all gated AI-First + tsc + build green)
The strategic call (Scott + Bailey): **the landing-page Yuri widget is the ONE conversion surface; every other page is a feeder to it.** Implemented:
- **Single front door** (#14): every "Ask Yuri" (blog CTAs, nav, ingredient/product CTAs) now routes to the landing hero widget via `/?ask=<question>&from=<source>` with the visitor's question **prefilled**, instead of the small corner bubble. The floating bubble was removed (cleanly unmounted, reversible).
- **Land at hero top** (#15) so the full headline + demo + prefilled question is the first impression.
- **Bigger/readable bubble** (#13) — superseded by the bubble removal but kept the readability lesson.
- **Phase 4 contextual nudges** (#16, tuned #17): product/ingredient DETAIL pages show an engagement-triggered (9s dwell or 40% scroll), dismissible, context-referencing nudge that feeds the front door. NOT a random popup — that distinction protects the honest-insider brand.
- **Paywall-first CTAs fixed** (#18): ingredient + products-list CTAs were sending visitors to `/subscribe`/`/register` BEFORE they'd experienced Yuri. Re-pointed to a free Yuri chat first; paid price kept as secondary context. "Experience Yuri free → the paid ceiling sells itself."
- **Source attribution** (#19): added `ss_widget_sessions.source` so each conversation records which feeder drove it — funnel now measurable in OUR OWN data (the moat), not just GA4. (Manual one-line `ALTER TABLE` run by Scott June 29.)
- **Hero copy → paid-ceiling framing** (earlier same day): hero showcases what PAID Yuri does (routine, memory, photo tracking), free widget is the taste, the gap converts. Adopted Bailey's copy, edited for voice + AI-tell removal.

### ✅ What WORKED (measured, not assumed)
- **The blog → widget funnel produced real stranger conversations.** In the 48h window, 2 of 3 landing-widget sessions were blog-CTA-shaped prefilled questions ("I just read your guide on [toner / sebaceous filaments]..."). Strangers read a post, clicked Ask Yuri, and arrived with a real question. The funnel mechanic works end-to-end.
- **Yuri's quality with cold strangers is excellent and on-brand.** All 3 replies were honest, expert, and did the HARD honest thing:
  - Declined to fake account/billing access on a "cancel my subscription + order #" message, pointed to support (no fake confidence).
  - Flagged that a "sebaceous filaments guide" the visitor claimed to have read doesn't exist, rather than playing along — then taught the real insight (filaments aren't blackheads, BHA is the move).
  - Refused to name a single "best toner" without knowing the visitor's skin, explained the toner types, asked for skin type/concern/routine.
  - This is the moat behavior (honesty = trust) holding up with real strangers, not just Bailey.
- **The proud-AI / honest-insider voice is landing** — no fabrication, no overpromise, genuine value in every reply.

### ❌ What DIDN'T work yet (the real bottleneck)
- **Every conversation died at ONE message.** All 3 sessions were single-message: visitor asked → Yuri gave a strong answer ending with a question → **nobody replied.** Continuation, not traffic or quality, is the current gate. (This is exactly the thesis already named in `WIDGET-CONVERSION-BLUEPRINT.md`: "Continuity Is the Gate." Today's data CONFIRMS it with real strangers.)
- **0 subscriptions, 0 emails captured** in the 48h window. Total all-time: 1 active sub (test/Bailey), 1 widget email. The funnel is proven through *engagement* but NOT through *continuation → conversion*.

### Hypotheses for the one-message drop-off (NOT yet acted on — n=3 is too small)
1. They got their answer and left (casual visitor, framework was "enough").
2. Yuri's reply asks for 3 things (skin type + concern + current routine) — a small homework ask; a single lower-friction question might keep more people typing.
3. Volume is just tiny — 3 sessions can't distinguish signal from noise.

### The discipline lesson (important — don't violate next time)
**Do NOT tune the prompt off n=3.** The right move is to let traffic accumulate (~20-30 conversations) WITH the new `source` attribution, then read: continuation rate, which sources drive multi-message chats, where the single-message ones cluster. Acting on 3 data points is the build-instead-of-measure trap NORTH-STAR warns about. The instrument is in place; it needs traffic + time.

### Process win
Every change this session passed AI-First + ship-guard + tsc + build, shipped via PR, branches auto-cleaned. Source attribution makes the NEXT read possible — we'll be able to answer "which content drives the deepest conversations" from our own DB.

### Next read (when ~20-30 conversations have accumulated)
```sql
SELECT source, count(*) AS conversations,
       round(avg(message_count),1) AS avg_msgs,
       count(*) FILTER (WHERE message_count > 1) AS continued
FROM ss_widget_sessions
WHERE started_at >= '2026-06-29'   -- since attribution went live
GROUP BY source ORDER BY conversations DESC;
```
If continuation stays low across sources → act on the `WIDGET-CONVERSION-BLUEPRINT` continuity changes (lower the first-reply friction, capture email before they vanish). If a specific source continues well → double down on that content type.

---

## Earlier context (pre-this-log)
- **June 24-25 2026 — TAAFT launch (first real traffic):** 152 GA4 users, multi-source (taaft, chatgpt, google), first 2 cold-stranger Yuri conversations — both deep, honest, high quality. 4 registrations, 0 paid. See [[project_first_real_traffic]] memory. Same pattern as June 29: engagement proven, conversion not yet.
- The standing prior state: funnel UNMONETIZED, not unproven — glass_skin_atx Reddit corpus (1K+ public threads, validated DMs) shows the conversion *content* works; the *paid* step is the open question.
