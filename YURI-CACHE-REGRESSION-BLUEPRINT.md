# Yuri Cache Regression — Diagnosis + Fix Blueprint

**Found: Jul 13 2026 · Diagnosed from LGAAS by Richard (Opus 4.8)**
**Status: ✅ FIXED Jul 13 2026 (v11.3.0, commit e175a1d). See CHANGELOG for the full record.**

---

## ⚠️ READ THIS BEFORE THE REST OF THIS DOCUMENT

**The root-cause section below (`## Root cause`) is WRONG, and the method section is RIGHT.**
That is exactly what the method was for. Preserved as-is, because how it was wrong is the
lesson.

**The hypothesis:** `## Recent Conversation Excerpts` (memory.ts:886) mutates per turn inside
the cached block.

**What the byte-diff actually found:** that section **excludes the current conversation**
(memory.ts:1789), so it is byte-stable *within* a conversation. It never mutated. It was
being **withheld** — which is a different bug with the opposite sign.

**The two REAL invalidators** — both made the cached prefix a function of *what the user just
typed*:

1. **`classifyIntent(message)`** gated which context sections loaded. `loadAll` is true only
   for `'general'`, which fires when a message matches **no keywords**. So "Great!" loaded
   everything (~88K chars) and a specific question loaded a subset (~80K). Sections blinked in
   and out mid-prefix. **9 of 11 turns broke the cache; first diff at char 36,469 (41% in).**
2. **`detectSpecialist(message)`**, recomputed per turn, appended its block *inside* the cached
   body.

**Fixed. Measured warm on the live API: `cache_creation_tokens` 34K/turn → 0, warm cost/turn
−83.2% / −58.7% across two real conversations. Verified in production.**

**Residual (tracked, not yet fixed):** `applyCacheControl` places the messages-level breakpoint
at `idx === msgs.length - 2`, which doesn't exist on turn 1 — so turn 2 is the first turn with
that breakpoint and pays a one-time ~$0.15 re-write. Marginal cost of turns 3+ is ~$0.02.

**The meta-lesson, which is the whole point of Step 1:** the blueprint's root cause was a
plausible, well-argued hypothesis from someone who had just solved the same bug class next
door. It was still wrong. **Follow the bytes, not the document — including this one.**

---

## TL;DR

Yuri's per-message cost went from **$0.006 → $0.35** (a **~60× regression**) starting
around **Jun 23 2026**. The prompt cache is being **invalidated and fully rewritten on
every single turn**. You are paying cache-WRITE rates (1.25×) instead of cache-READ rates
(0.1×) — a **12× penalty** — on ~40-55K tokens, every message.

**This is NOT the clock bug.** The clock split (`CLOCK_SPLIT_ENABLED`) is live, correct,
and defaults ON. That fix works. This is a **different invalidator**, and it is the same
class of bug as LGAAS's BP112: **mutable content living inside the cached prefix.**

---

## The evidence (do not skip this — it is the whole diagnosis)

### 1. Cost per message, over time (`ss_ai_usage`, `feature='yuri_chat'`)

| Date | $/msg | raw_in | cache_read | cache_write |
|---|---|---|---|---|
| Jun 5 | **$0.0051** | 0 | 0 | 0 |
| Jun 9 | **$0.0056** | 0 | 0 | 0 |
| **Jun 23** | **$0.2156** | 1,900 | 28,274 | **28,504** |
| Jun 24 | $0.2618 | 5,979 | 35,058 | **31,490** |
| Jun 29 | $0.3560 | 11,011 | 39,485 | **41,647** |
| Jun 30 | **$0.3948** | 7,510 | 20,602 | **53,583** |
| Jul 9 | $0.2648 | 476 | 14,951 | **38,465** |

### 2. Raw rows, ONE conversation, in timestamp order (the BP98.5 method)

Conversation `9f047ae2`, 24 turns:

```
time     raw_in   cache_READ   cache_WRITE     cost
01:53      4132        39390         39390   $0.3076
01:57      4441        41287         30483   $0.2533
02:01        59         5930         31272   $0.2124
02:06      9956        45088         36397   $0.3261
02:15        78         5930         41468   $0.2779
02:22        28         5930         49368   $0.3172
02:29         9         5930         51566   $0.3289
22:03         8         6009         54415   $0.3462

total cache WRITE: 1,059,208     total cache READ: 853,221
```

**Read those rows.** Two things are damning:

1. **`cache_write` is nonzero on EVERY turn**, and roughly equals `cache_read`. A healthy
   cache writes ONCE and reads on every subsequent turn. This one rewrites every turn.
2. **`cache_write` GROWS MONOTONICALLY** (39K → 55K) while `raw_in` stays tiny (often <100
   tokens). The cached block is *accumulating*. **The better Yuri knows you, the more you
   pay per message** — cost scales with memory depth, which is exactly backwards.

---

## Root cause

`src/lib/yuri/advisor.ts:872` marks the whole system prompt as cacheable:

```ts
const systemBlocks = [
  { type: 'text', text: cachedPrompt, cache_control: { type: 'ephemeral' } },
]
if (clockBlock) systemBlocks.push({ type: 'text', text: clockBlock })  // clock: correctly OUTSIDE
```

`cachedPrompt` is built by `buildSystemPrompt()` (advisor.ts:308), whose `# USER CONTEXT`
section comes from `formatContextForPrompt()` in `src/lib/yuri/memory.ts`.

**That context contains per-turn-mutable content.** The primary suspect, confirmed by the
monotonic growth pattern:

- **`src/lib/yuri/memory.ts:886`** —
  `## Recent Conversation Excerpts (Your Actual Messages)`
  *"These are the last few messages from your recent..."*

**This changes on every single turn.** A prompt cache is a **prefix match**: one changed
byte invalidates everything from that byte onward. Because this section sits *inside* a
~50K-token cached block, every new message rewrites the entire block.

Secondary suspects in the same block, all of which mutate as the conversation progresses
(verify each against the byte-diff in Step 1 below):

| Line | Section | Why it may mutate per turn |
|---|---|---|
| **886** | **Recent Conversation Excerpts** | **PRIMARY — literally the last N messages** |
| 1034 | Your Decisions & Preferences (Structured Memory) | grows as Yuri extracts decisions |
| 844 | Previous Conversations (Your Memory) | may re-summarize |
| 861 | YOUR Previous Product Recommendations | grows as she recommends |
| 790 | Glass Skin Score History | only on new scan — probably stable |
| 704 / 749 | Routine Products / Product Inventory | only on routine change — probably stable |

The **specialist block** (advisor.ts:324) is a second, separate risk: if `specialistType`
is re-routed mid-conversation, the cached body changes shape and invalidates. Confirm
whether specialist routing is per-turn or sticky-per-conversation.

---

## MANDATORY method (this is not optional — read it)

This repo's own principles, and LGAAS's BP98.5 postmortem, are explicit:

> **Do not ship an infrastructure change on reasoning. Ship it on a measurement of the
> actual mechanism, A/B'd against a kill switch, on the real payload, warm.**

Three consecutive LGAAS cache "fixes" each shipped on locally-sound reasoning and each
made cost *worse* (+43%, +48%, then a 4th measured 24% worse and was reverted). The one
that worked was A/B'd first. **It cut warm-turn cost 79.7%.**

Specifically:
- **A correct root cause is not a complete one.** In LGAAS, fixing the clock alone measured
  **−0.1%**. There were *two* defects; neither fix worked without the other. Assume the
  same here until measurement says otherwise.
- **An aggregate over a branch is uninterpretable until you know why rows land on that
  branch.** BP98.2 deleted a cache marker because "marked turns cost $0.91, unmarked cost
  $0.14" — those were the two ROUNDS of one turn; it deleted the writer and kept the reader.
- **Read the raw production rows in timestamp order.** That is how this bug was found and
  it is all it ever required.

---

## The work

### Step 1 — Prove the invalidator (byte-diff, no guessing)

Build the *real* system prompt for a real user (Bailey — `user_id 551569d3`) at turn N and
turn N+1 of the same conversation. Diff them.

```
The first differing byte position tells you exactly which section is the invalidator,
and everything after it is what you are paying to rewrite.
```

Expected: the first diff lands at/near `## Recent Conversation Excerpts`. **If it lands
somewhere else, that is your real bug — follow the bytes, not this document.**

Log: `first_diff_at_char`, `total_prompt_chars`, `% of prompt after the first diff`.

### Step 2 — Split the volatile tail out of the cached block

Same shape as the clock fix already in this file (`CLOCK_SPLIT_ENABLED`). Restructure
`buildSystemPrompt` to return **two** blocks:

- **`cachedPrompt`** — the byte-STABLE prefix: `YURI_SYSTEM_PROMPT`, skin profile,
  allergies, routine/inventory, durable corrections, learning-engine insights. Marked
  `cache_control: ephemeral`.
- **`volatileBlock`** — everything that changes per turn: recent conversation excerpts,
  freshly-extracted decisions, and the existing clock. Delivered as **unmarked** system
  block(s) AFTER the cache breakpoint.

Order matters and is non-negotiable: **`system` blocks render before `messages`.** The
cached block must come first, the volatile blocks after it. (LGAAS learned this the hard
way: a tail delivered inside `messages` re-wrote every turn *regardless* of its own
byte-stability, because the user's new question was part of its cache prefix.)

### Step 3 — Ship it behind a kill switch

Mirror the existing pattern exactly:

```ts
export const VOLATILE_SPLIT_ENABLED = process.env.YURI_VOLATILE_SPLIT_ENABLED !== 'false'
```

Kill-switch-OFF must be **byte-for-byte identical** to today's prompt (the existing
`CLOCK_SPLIT_ENABLED` code does this correctly — copy its approach, including the `'\n'`
join-seam reproduction). Reverting must never require a deploy.

### Step 4 — A/B it warm, on the real payload

Not a synthetic benchmark. **Synthetic probes measure your harness; production rows measure
the system.**

Run a real multi-turn conversation as Bailey with the flag ON, and the same with it OFF.
Compare, per turn: `cost_usd`, `cache_read_tokens`, `cache_creation_tokens`.

**Success criteria:**
- `cache_creation_tokens` → **~0 on turns 2+** (write once, read thereafter)
- `cache_read_tokens` → large and roughly constant
- **Cost per message returns to ~$0.006–0.02** (the Jun 5–9 baseline)
- **Zero change to what Yuri actually says.** Same content, same order, different byte
  *position*. Verify the assembled prompt has an identical character multiset.

### Step 5 — Guard it

Add a test that fails on the commit that would reintroduce this:

- assert no `## Recent Conversation Excerpts` (or any per-turn-mutable marker) appears
  inside the `cache_control`-marked block
- assert the volatile block is delivered **unmarked** and **after** the cached one

LGAAS's `tests/advisor-cache-shape.test.js` is the model. **Prove the guard works by
checking out the offending commit and watching it fail.** A test that has never failed is
not a guard.

---

## Non-goals — DO NOT DO THESE

- **Do NOT change what Yuri says.** This is a byte-POSITION fix. Zero prompt-content
  change. If the model's behavior changes, you did it wrong.
- **Do NOT remove memory to "make the prompt smaller."** The memory is the product. Move it
  out of the cached prefix; do not delete it.
- **Do NOT downgrade the model.** Principle 1. The cost problem is infrastructure, not
  intelligence, and it will still be infrastructure after you downgrade — you will simply
  have paid the full price of the bug *and* given up the thing that made the product worth
  building.
- **Do NOT touch the clock split.** It is correct and it is working.
- **Do NOT "fix" this by lowering `max_tokens`.** Output tokens are not the problem;
  `raw_in` is often under 100 while `cache_write` is 50,000.

---

## Why this matters beyond the money

A free-tier / paywall decision for Seoul Sister is currently blocked on this. At the
**broken** rate, a free onboarding looks like it costs ~$3.50 and a heavy user ~$6.62/mo —
numbers that argue for a restrictive free tier. At the **true** rate, an onboarding costs
about **$0.10** and Bailey — the heaviest user in the system, 167 chats over 68 days —
costs about **$0.15/month**.

**Pricing the product on the broken number would encode a defect into the business model.**
Fix the mechanism first. Then measure. Then decide.
