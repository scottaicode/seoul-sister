# Widget Grounding & Pacing Fix — Aug 9 2026

Earned from one real conversation: an India visitor, Aug 9 2026 14:42–14:48 UTC,
session `2731265d-3fb3-4a5e-aee1-c007c459dc9b`, 6 messages, **zero tool calls**.

The diagnosis Yuri gave was excellent — she read a five-product lineup, found two
BHA sources stacked on one small area, and told the visitor to *remove* a product
rather than buy one. The reasoning was the product working. **The instrumentation
around it was not.**

---

## What actually went wrong (four defects, measured not assumed)

### 1. Tools never fired — and the obvious fix is WRONG

`shouldWidgetForceToolUse()` (`src/app/api/widget/chat/route.ts`) decides whether
to set `tool_choice: {type:'any'}` on the first tool-loop round. I transpiled the
**real** function and ran it against her **real** six messages. All six returned
`false`. Controls (`"recommend a moisturizer"`, `"how much is COSRX snail mucin"`)
return `true`.

Two causes:
- `BRAND_SIGNALS` is a ~28-entry hardcoded, mostly-Korean list. Her lineup —
  Neutrogena, Dr. Sheth, Pond's, Re'equil — contains **zero** of them.
- The recommend-regex requires a product noun within 20 characters. *"I'm looking
  to revamp my routine using indian brands"* has no product noun at all.

**Blast radius, from production:**
| Metric | Value |
|---|---|
| Sessions (≥2 msgs) with zero tool calls | 7 / 50 (**14%**) |
| Assistant replies naming a brand | 157 |
| …of those, with NO tool call | 57 (**36.3%**) |

**The measurement that killed the obvious fix.** Before widening the brand list,
I queried the catalog for the seven brands Yuri actually recommended:

| Brand | Catalog rows |
|---|---|
| Aestura | 108 |
| Round Lab | 105 |
| Pond's | 6 (cleansers only — not what she recommended) |
| Neutrogena | 1 |
| CeraVe, Dr. Sheth, Re'equil, Minimalist, Deconstruct, Dot & Key | **0** |

**Forcing a tool would have grounded 2 of 7 brands and returned EMPTY for five.**
The catalog is Korean by deliberate policy (Shelf Visibility rule). Decomposing all
57 ungrounded brand-naming replies:

- **44** name a Korean brand with no tool call → genuinely groundable, a real defect.
- **13** name only Western/Indian brands → **no tool call can ground these.**

So ~23% of the blast radius is *structurally immune* to deterministic forcing. Any
design treating forcing as the primary mechanism is capped before it starts.

Worse, a forced search on "Dr. Sheth" returns zero rows, and the prompt's own rule
(`route.ts`) says *"never let 'not in our database' sound like 'not good'"* — so a
forced empty search actively risks producing the harm that line exists to prevent.

### 2. `tool_choice:{type:'any'}` has an asymmetric cost this surface can't absorb

`advisor.ts` states the governing principle: *"better to force a tool call
unnecessarily than to miss a query."* That is right for the **authenticated**
advisor and wrong for the widget. Under `{type:'any'}` the model **cannot emit
text** — it must call a tool. On a cold first impression that means a full extra
Opus round-trip plus a visible "Searching the product database…" spinner, **for a
message like "Got it. Thank you."**

### 3. The email ask landed on a warning, and got a hard "No"

Yuri appended the ask to the end of a plan message, framed as *"this is easy to get
right for a week and then drift back into old habits."* That is a warning about the
visitor's own discipline with a data request stapled to it. Her literal next words:
**"No. I'm good."** The prompt's existing timing rule already says don't ask
*"mid-build while they're still firing new questions"* — this was a judgment miss,
and the fix is a sharper observable fact, not more prose.

### 4. She volunteered a quota countdown mid-conversation

Final message: *"you've got 6 free messages left in this preview."* She was at
message 6 of 12 — the exact midpoint. The prompt reserves countdowns for *"near
the end (last 2-3 messages)."* This is a **prompt violation, not a rule gap**: the
Conversation State block hands her the raw remaining count every single turn with no
signal about whether volunteering it is appropriate *now*.

---

## The fix

**Rejected — Option A (widen `BRAND_SIGNALS`, loosen regex, add lineup detector).**
Named failure mode: an unbounded hardcoded list indexed on a set that grows with
traffic. It was blind to Western lineups in `ffcede9`, blind to Indian on Aug 9, and
will be blind to Thai (this same visitor asked about Phuket), Brazilian, Indonesian.
It exists in **two divergent copies** (`route.ts` 28 brands, `advisor.ts` 60,
already drifted by six). This is the `CLAUDE.md` rule verbatim: *"When a classifier
needs repeated hand-tuning, that is the signal to stop, not to keep adjusting."*
The "lineup disclosure detector" is the same shape as the run-together heuristic
that flagged 4,898 rows including `Hexapeptide-9` and was **discarded rather than
tuned**. And even fully tuned it reaches at most ~77% of the blast radius.

**Adopted — Option B (a FACT, the house pattern) + one narrow piece of C.**

**B. `src/lib/widget/tool-grounding.ts`** — a sibling to `cumulative-give.ts`,
same shape. Reads Yuri's OWN already-sent replies plus the tool-call record, and
injects an observable fact into the **uncached** dynamic context block:

> Tools fired this conversation: 0. Your last N replies named specific products
> without one. The catalog indexes Korean brands — a search grounds those and
> returns nothing for Western or Indian ones, which is information rather than a
> verdict on the product.

Zero marginal latency and zero marginal round-trips — the history is already being
iterated for `detectCumulativeGive()`, and `tool_calls` is already persisted per
message. It cannot break the prompt cache: the dynamic block is already outside the
`cache_control` breakpoint (the v11.1.0 regression this repo already paid for).

**Two drafting traps, both deliberate:**
- Never say *"your claims are ungrounded."* That is a **verdict**, not a fact — it
  pre-judges the 13 replies where the brand is legitimately outside a Korean
  catalog, and would push Yuri to hedge on CeraVe, which `CLAUDE.md` explicitly
  calls a **regression** ("Yuri may say 'keep what you have'").
- The trailing clause about Western brands is what makes the fact *usable* rather
  than misleading. It is the difference between an instrument and a nag.

**Fact, never a cap.** It blocks nothing and ends by handing the call back. A guard
test **fails** if it becomes a command.

**C (one piece only). Fix the recommend-regex.** The product-noun requirement is a
*bug*, not a tuning knob — "help me revamp my routine" is an unambiguous request
for recommendations. Add `routine|lineup|regimen|shelf`: market-neutral words that
will never need a market-specific update. **`BRAND_SIGNALS` is NOT expanded and the
lineup detector is NOT built.**

**Plus the two pacing facts:**
- **Countdown**: the Conversation State block gains an explicit
  `appropriate to volunteer / not appropriate yet` flag derived from remaining
  count, so Yuri isn't handed a number with no guidance on when it's relevant.
- **Email ask**: a fact recording that a warning-shaped framing preceded a refusal.

---

### 5. The cow walked out the door — the give instrument was silent at the decisive turn

Owner-raised, Aug 9: *"She should NOT be giving them an entire skincare routine from
the landing page widget. Milk, not the cow."* That is already the documented policy
(the give and the gate, v11.9.0). The question was whether it holds. **It does not.**

The Aug 8 TikTok visitor (session `d3b442fb`, a cold 20-year-old) received **three
complete lineups** in one free preview: a Korean reset, the whole thing rebuilt for
Target/Ulta, then a third revision re-textured for clog-prone skin. In the Target
reply Yuri **stated the gate out loud** — *"the full step-by-step AM/PM build with
timing is the subscriber side"* — and delivered a full cleanser/moisturizer/sunscreen
lineup in the same message. She left no email and did not subscribe.

**This is not Yuri ignoring the rule.** Replaying her real transcript through
`buildCumulativeGiveBlock()`: at the moment she was about to write the SECOND
lineup, `lineupBuilds` was 1 and `count` was 1, and the gate required
`count >= 2 || lineupBuilds >= 2`. **The instrument returned null and she wrote the
rebuild with no visibility at all.** The note first appeared before the *third*
build.

An off-by-one with a clear shape: the counter reports builds already **sent**, but
the note exists to inform the build she is **about to write**. Requiring two sent
means the warning always arrives one build late — precisely one too late. The moment
one lineup exists is the moment `"what about Target?"` becomes likely.

**Two changes, both in `cumulative-give.ts`:**
- Threshold `lineupBuilds < 2` → `< 1`. Fires while one lineup exists.
- A new one-build note naming the actual failure: **a rebuild is a REPEAT, not a new
  question.** The gate was defined by ARTIFACT ("a complete AM/PM routine is
  subscriber work") while the real leak is REPETITION — every one of the three
  replies looked compliant in isolation, because a different store genuinely reads
  as a different question from inside one turn. The note points at the more useful
  answer (the translation rule plus the one pick that changes) rather than only
  forbidding.

**Deliberately NOT tightened: the give itself.** Two reasons, both from production.
Kim Wells — the only paying subscriber on record — converted because Yuri talked her
*out* of purchases; generosity closed her. And this visitor's first reply, the
3–4-year cheek-lesion referral, is exactly the free value that earns trust. Clamping
the give risks the thing that works to fix the thing that leaks. A guard test asserts
the instrument stays **silent** before any lineup exists.

**Honest caveat: n=1 for the three-build pattern**, and 0 of ~58 widget visitors have
ever converted, so it is NOT established that the giveaway is what costs
subscriptions — it may simply be volume. This shipped because it is cheap and clearly
correct on the transcript, not because revenue is proven to move.

## Verification standard

Per `CLAUDE.md`: a source-text test can pass against broken code. Every test here
**executes the real module**, and each was confirmed to **FAIL when the bug is
reintroduced verbatim**.

Replayed against the real Aug 9 transcript and the Aug 8 TikTok control.

## Deliberately NOT done

- **No Western/Indian catalog.** Measured cold-traffic intent is ~15:1 Korean.
  Three India visitors in three weeks is a signal to *keep measuring*, not to build.
- **`advisor.ts` has the same 60-brand defect on the PAID surface** (Bailey, Kim).
  Not measured here — `ss_yuri_messages` was out of scope. **Flagged, not fixed.**
