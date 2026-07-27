# Instructions: Apply the LGAAS Advisor Cost Fix to Yuri

**For the AI working in the `seoul-sister` repo. From Richard (Claude Opus 4.8), who
diagnosed and fixed the same problem in LGAAS on 2026-07-10.**

Scott asked me to port a cost fix from LGAAS to Seoul Sister. I read your advisor code
(`src/lib/yuri/advisor.ts`) before writing this, so these instructions are specific to
*your* architecture, not generic. But **you must verify every claim below against the
current code and against production data before changing anything.** The LGAAS fix took
four failed attempts precisely because people (including me) shipped on clean reasoning
instead of measurement. Do not add a fifth to that list here.

---

## The one-paragraph summary

Yuri's system prompt is cached (`cache_control: ephemeral` on the `system` block —
good). But `buildSystemPrompt()` appends a `## RIGHT NOW` block ending in a
**minute-granularity clock** (`fmtTime` renders `h:mm AM/PM`) to the *end* of that same
cached block. Prompt caching is a **prefix match**: one byte that changes between turns
invalidates the entire cached block. So the ~22K-token static prompt plus all user
context is **re-written to cache on every single message**, instead of being read cheaply.
The fix is to move the volatile clock OUT of the cached block and deliver it separately.

**Yuri's fix is SIMPLER than LGAAS's** — her tail is already in `system` (the correct
place), so she only has half the problem LGAAS had. Read the "What NOT to do" section
anyway; it will save you from the traps I hit.

---

> **Note from Richard:** I read Yuri's *code* and confirmed the clock-in-cached-block
> structure and the two relative-time buckets by inspection. I could NOT run Seoul
> Sister's production database from where I was, so I have **not** measured Yuri's actual
> cost the way I measured LGAAS's. The structural bug is real and visible in the source.
> Whether it's currently *costing* what LGAAS's version did is something YOU must confirm
> in Step 0 before you change anything. If Yuri's prompt caching happens to already be
> working (someone may have fixed part of this), the numbers will tell you and you should
> stop. Trust the data over this document.

## Step 0 — VERIFY THE PROBLEM EXISTS (do this first, do not skip)

You cannot fix a cost problem you haven't measured. Before touching code:

1. **Confirm the clock is inside the cached block.** Read `buildSystemPrompt()` in
   `src/lib/yuri/advisor.ts` (around line 279-355). Confirm `parts.push('## RIGHT NOW ...
   ${nowTime} ...')` happens, and that the returned string is passed to
   `client.messages.stream({ system: [{ text: systemPrompt, cache_control: {...} }] })`
   (around line 826). If the clock is in the cached `system` block, the problem is real.

2. **Confirm `fmtTime` has minute precision** (line ~326). If it renders minutes, the
   cache invalidates every minute. If someone already reduced it to date-only, this part
   is already fixed — check before assuming.

3. **Measure it in production.** Query your AI-usage / cost table for Yuri's advisor
   calls. The signature of this bug is: **`cache_creation` (write) tokens are large on
   EVERY call, and `cache_read` tokens are small or zero.** If instead you see large
   `cache_read` and near-zero `cache_write` on turns 2+, the cache is already working and
   you should STOP — there is nothing to fix. Scott's LGAAS data showed cost jumping from
   $0.24 to $0.36/call when this broke, on ~47 calls/day for Seoul Sister. Find the
   equivalent rows for Yuri.

**If steps 1-3 don't all confirm the problem, do not proceed. Report what you found.**

---

## Step 1 — The fix (once verified)

Split the volatile clock out of the cached block. Concretely, in
`src/lib/yuri/advisor.ts`:

**(a)** In `buildSystemPrompt()`, stop appending the `## RIGHT NOW` block to `parts`.
Instead, return the cached body and the clock **separately**. E.g. change the signature
to return `{ cachedPrompt: string, clockBlock: string }`, or return the cached body and
build the clock at the call site. The cached body must NOT contain `nowTime` or any other
per-minute value.

**(b)** At the `client.messages.stream(...)` call, keep the cached body exactly where it
is (in `system`, with its `cache_control` marker), and deliver the clock as a **separate,
UNMARKED block AFTER it**. On Opus 4.8 you have two valid placements — pick based on what
your code already does:

  - **Simplest:** append the clock as a second, unmarked `system` block:
    `system: [{ text: cachedPrompt, cache_control: {ephemeral} }, { text: clockBlock }]`.
    The unmarked block after the breakpoint is not cached, which is exactly what you want
    for volatile content. This is the lowest-risk option and I recommend it for Yuri.

  - LGAAS delivered it as a trailing `role:'system'` message in the `messages` array
    instead. That was necessary in LGAAS for unrelated reasons. **You do NOT need that
    complexity** — the second-system-block form above is simpler and Yuri's structure
    supports it. Do not copy LGAAS's message-array approach unless you have a specific
    reason.

**(c)** Put it behind a kill switch. Env var, default-on, e.g.
`const clockSplitEnabled = process.env.YURI_CLOCK_SPLIT_ENABLED !== 'false'`. When off,
fold the clock back into the cached body exactly as it is today. Reverting must never
require a code deploy.

**(d)** The clock's TEXT does not change by one character. You are moving *where the bytes
sit*, not what they say. Yuri reads the identical `## RIGHT NOW` content, in the same
place relative to the conversation, just after the cache breakpoint instead of before it.

---

## Step 2 — The relative-time buckets (separate, smaller, also worth doing)

Yuri has the same secondary problem LGAAS had: computed relative-time strings inside the
cached block that tick and invalidate it. I found at least two:

- `src/lib/yuri/memory.ts:769` — ``s.daysAgo === 0 ? 'today' : ... `${s.daysAgo} days ago` ``
- `src/lib/yuri/memory.ts:951` — `ageMs > SIXTY_DAYS_MS ? ' [60+ days ago — ...]' : ''`

These tick daily, not per-minute, so they cost far less than the clock — but they're also
just wrong on their own merits. Render a **raw ISO date** (`new Date(x).toISOString()
.split('T')[0]`) instead of a computed bucket. Claude does her own date math better than a
bucket does, and a fixed date is byte-stable until the underlying row changes.

This is a **correctness** fix first, a cost fix second. Verify it by checking Yuri still
reasons correctly about dates ("about 5 days ago", "older than two months"), NOT by
checking cost. Do NOT touch relative-time strings that appear inside *user-authored
content* (a note the user typed, a review) — those are their words, not your renderer.

---

## Step 3 — Also check the widget

`src/app/api/widget/chat/route.ts` uses the same cached-`system` pattern (line 374). If
its `systemPrompt` builder also appends a live clock or relative-time strings, it has the
same bug and the same fix. The widget is often higher-volume than the advisor, so this may
matter more for total cost. Verify the same way (Step 0) before fixing.

---

## What NOT to do — the four traps that cost LGAAS four attempts

Read these. Each one shipped on reasoning that looked correct.

1. **Do not remove the cache marker "because caching looks expensive."** LGAAS did this
   and cost went UP 48%. The expensive "cache write" call and the cheap "cache read" call
   are often the **two rounds of a single turn** (a tool-use round that writes, then a
   response round that reads). Removing the marker deletes the write that the read depends
   on. Before concluding the marker is the problem, order your raw usage rows by timestamp
   and READ them — you will see write→read pairs.

2. **Do not trust a per-branch average (`GROUP BY path`) until you know why each call
   landed on that branch.** A cheaper-looking branch is often cheaper because of *which
   calls go there*, not because of the branch itself. This is Simpson's paradox and it
   burned LGAAS for four days.

3. **A correct root cause is not a complete one.** In LGAAS, fixing the clock ALONE
   measured −0.1% — because a second defect (tail placement) was also present. Yuri
   probably does NOT have that second defect (her tail is already in `system`), but verify
   your fix actually moves the cost number. Do not assume.

4. **The "cached is slower" latency worry is usually a measurement artifact.** If you
   compare a streaming call against a non-streaming call, streaming looks slower because
   its timer measures time-to-last-token. Hold `is_streaming` constant before concluding
   caching costs latency. In LGAAS, generation speed was identical (21.2 vs 21.3
   ms/output-token); there was no latency tradeoff.

---

## Step 4 — Verify the fix, then guard it

1. **A/B on the real prompt, warm, with the kill switch as control.** Build Yuri's actual
   prompt for a real user, send two consecutive identical requests. With the fix ON:
   request 1 writes the cache, request 2 should show large `cache_read` and near-zero
   `cache_write`. With the fix OFF (kill switch): both requests write. If ON isn't cheaper
   than OFF on the warm (second) request, DO NOT SHIP — you've missed something.

2. **Expect the first turn of every conversation to be expensive.** It pays the one-time
   cache write. Judge success on turns 2+, never on a single cold call.

3. **Add a test** that fails if a `Date.now()`/`new Date()`-derived string is interpolated
   into the cached block, or if `fmtTime` regains minute precision inside it. LGAAS's is
   `tests/advisor-cache-shape.test.js` (pure string assertions against the source, zero
   tokens, ~45ms) — adapt its shape. Prove it works by reverting your fix and watching the
   test fail.

4. **Confirm nothing about Yuri's voice, memory, or reasoning changed.** She must read a
   byte-identical prompt. Only the position of the clock moves.

---

## Expected result

Warm-turn cost should drop substantially — in LGAAS it fell ~80% on the equivalent fix
(clock split), from ~$1.15 to ~$0.14 per turn. Yuri's absolute numbers will differ (her
prompt is smaller), but the *shape* is the same: `cache_write` tokens collapse toward zero
on turns 2+, and `cache_read` carries the load. Measure the warm-turn cost before and
after; that is the only number that proves it worked.

If you get stuck, the full LGAAS write-up is in that repo at
`lgaas-blueprint/98.5-STEP-1-ROOT-CAUSE-CONFIRMED.md`, `98.6-CLOCK-SPLIT-AND-TAIL-
PLACEMENT.md`, and the operating principles at
`VibeTrendAI/vibetrendai/principles.md` (Principle 5) and `patterns.md` (Patterns 16, 17).

— Richard
