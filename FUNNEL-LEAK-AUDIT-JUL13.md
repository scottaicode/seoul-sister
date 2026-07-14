# Funnel Leak Audit — Jul 13 2026

**Method:** top-down, from GA4 + Bing AI Performance into `ss_widget_sessions` / `ss_user_profiles`. Every number below is measured, not estimated.

---

## The funnel, as it actually is

| stage | n | note |
|---|---|---|
| GA4 "new users" (5 days) | 631 | **mostly junk** — see below |
| Organic Search sessions | 105 | **52% engagement, 50s dwell** ← the real humans |
| AI Assistant sessions | 20 | 45% engagement, 25s |
| Direct sessions | 514 | **16% engagement, 2s** ← bots (Singapore 425 of 631 users) |
| **Reached Yuri from a feeder page** | **3** | `blog` 1, `best_cta` 1, `ingredient_cta` 1 |
| Talked to Yuri at all (ever, all sources) | 38 visitors / 44 sessions | since March |
| Registered | 20 | 16 strangers + 4 insiders |
| **Completed onboarding** | **4** | **all insiders** |
| **Strangers who paid** | **0** | |

**Ignore the 631.** Singapore = 425 of 631 users; Direct = 514 sessions at 2 seconds. That's scraper traffic. Scott already discounts it — recorded here so no future session builds a decision on it.

---

## LEAK 1 (the big one) — engaged search traffic never reaches Yuri

**105 organic sessions engaging for 50 seconds. THREE of them reached Yuri.**

Organic + AI search is, by a wide margin, the **best-engaging channel** (52% engagement / 50s dwell vs Direct's 16% / 2s), and the GEO play is working: **501 Bing AI citations in 7 days, 30 cited pages, `/best/serums` the #1 cited page.**

The traffic is arriving. It is qualified. It is engaged. **And it leaves without ever meeting the product.**

### Root cause A — the CTA is below a fold nobody reaches

- `/ingredients/[slug]`: **1,005 lines. "Ask Yuri" CTA at line 991.**
- `/best/[category]`: **587 lines. CTA at line 557**, below 20 product cards.

A visitor who searched *"is niacinamide safe with retinol"* gets their answer in the first screen and leaves. **50 seconds is read-the-answer-and-go, not scroll-the-whole-page.** The CTA is well-written and correctly wired (`?ask=` prefill, routes to FREE Yuri, not the paywall) — it is simply never seen.

### Root cause B — `/best/*` had NO nudge at all

`ContextualYuriNudge` (engagement-gated: 40% scroll or 9s dwell, dismissible) existed and was mounted on **products** and **ingredients** — but **not** on `/best/[category]`, which is the **top AI-search landing page**. Its only Yuri path was the invisible bottom CTA.

**Fixed:** nudge now mounted on `/best/[category]` with a `category` variant.

### Root cause C — the nudge offered the reader what they already had

**217 `yuri_nudge_shown` events. ~3 clicks (~1% CTR)** on an *already-engaged* audience. The mechanism was right; the **offer** was wrong:

> *"Curious whether Niacinamide is right for your skin? Ask Yuri, free."*

They just read a comprehensive page answering exactly that. **We were selling them the thing they'd finished reading.**

The page can explain what an ingredient is, how it works, and how it scores by skin type. The one thing it **structurally cannot know is what else is in this person's bathroom.** That is Yuri's only real edge and the nudge never mentioned it.

**Fixed — the offer is now what the page cannot answer:**

| page | new offer |
|---|---|
| ingredient | *"Tell Yuri what you already use and she'll check whether X conflicts with it."* → **Check my routine** |
| product | *"Already using other actives? Yuri can check whether X clashes with them."* → **Check my routine** |
| category | *"Not sure which one is for you? Tell Yuri your skin type and what you already use."* → **Which one for me?** |

Seeded questions changed to match (they seed the VISITOR's opening message; Yuri still answers freely — AI-First).

**Measurable:** nudge clicks arrive as `from=ingredient|product|category`; bottom CTAs as `from=ingredient_cta|best_cta`. So we can tell which fix moved the number.

---

## LEAK 2 (documented, NOT fixed tonight) — the paywall is in front of the product

```
register → /subscribe ($24.99) → Yuri onboarding → app
                 ↑
        16 strangers died here
```

`src/app/(auth)/register/page.tsx:79` → `router.push('/subscribe')`. This is working as designed (CLAUDE.md:654 documents exactly this flow). **The design is the bug.**

Proof, from `ss_user_profiles`:
- **Every stranger who hit the paywall hit it BEFORE onboarding.** 5 rows: `PAYWALL BEFORE ONBOARDING`.
- The 4 "conversions" all have **`paywall_reached_at IS NULL`** — they are Scott, Bailey, and 2 insiders, provisioned straight through. **No human being has ever encountered that paywall and paid.**

So: **a stranger cannot experience Yuri-with-memory before being asked for $24.99/mo.** They are being asked to buy a car they have never sat in. The One Metric isn't "flat" — **the funnel has never actually been run.**

**Why not fixed tonight:** it is a real design change (routing + a paywall trigger at the value moment), and **it is not the binding constraint.** Only 16 strangers have *reached* registration in five months. A perfect free-onboarding funnel converting at a fantasy 20% yields 3 subs. **Fix the top of the funnel first, then the paywall has someone to convert.**

**Recommended shape when it is built:** not "a free tier" (a permanent lesser product — if free Yuri has memory, what does $24.99 buy?) but **moving the wall**: `register → onboarding → she builds your profile and first routine → THEN the ask, at the moment she says "I'll remember all of this. Want me to keep going?"` The value moment IS the ask.

---

## What was shipped tonight

1. `/best/[category]` — nudge mounted (was: nothing but an invisible bottom CTA).
2. Nudge offer rewritten on all three page kinds to lead with **routine conflict / which-one-for-me**, the questions the page cannot answer.
3. `ContextualYuriNudge` extended with a `category` kind.

**Not shipped, deliberately:** the paywall reorder (Leak 2) and any new content. The next number to read is whether nudge CTR moves off ~1%.

## How to read the result

```sql
select coalesce(source,'(untagged)') source, count(*) sessions,
       round(avg(message_count),1) avg_msgs
from ss_widget_sessions group by 1 order by 2 desc;
```

Baseline tonight: `ingredient_cta` 1, `best_cta` 1, `blog` 1, untagged 41.
Watch for: `category`, `ingredient`, `product` (nudge clicks) appearing at all.
