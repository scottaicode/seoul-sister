# Blog→Yuri Path + Hero Copy Improvements — Plan & Execution

**Date:** June 28 2026
**Trigger:** GA4 (Jun 24-28) showed 380 new users, 0 conversions. The engaged cohort (Organic Search 38s, Referral 53s) lands on blog posts and bounces — the blog→Yuri handoff throws away all context. Separately, Bailey (lighthouse user) flagged the hero copy as not relatable / not engaging.

**Gate status:** ship-guard PASS (conversion mechanics / growth — always allowed under the freeze). ai-first-guard PASS (no Yuri judgment constrained; prefilled opener is the VISITOR's question, never a scripted Yuri answer).

---

## The diagnosis (grounded in code)

Anonymous blog reader clicks "Ask Yuri" → `BlogYuriCta`/`BlogInlineYuriPrompt` dispatch an **empty** `open-yuri` event → `YuriBubble` just does `setIsOpen(true)` → opens a **blank chat**. The reader who just read 1,500 words on toners must re-type their question from scratch. Most won't. That re-type wall is the leak, and it hits exactly the engaged-reader cohort GA4 identified.

Secondary: the only strong CTA is past the 8-min mark (bottom of post); the inline prompt is a faint low-contrast line.

---

## Change 1 — Context-pass the click into Yuri (HIGHEST LEVERAGE)

Make `open-yuri` carry an opening question derived from the post, and have `YuriBubble` auto-send it on open. Clicking "Ask Yuri" on the toner post opens Yuri **already answering** the visitor's implied question — warm, in-progress conversation instead of a cold box.

- `open-yuri` event gains an optional `detail.prefill: string`.
- `YuriBubble` listener reads `detail.prefill`; if present and the session isn't at the limit, it auto-sends that as the first user message.
- The prefill is the VISITOR's question (e.g. "I just read your guide on toners — can you help me pick one for my skin?"), NOT a Yuri script. Yuri answers freely (AI-First preserved).

## Change 2 — Make the CTA contextual to the post

Pass the post's title/primary product/keyword into the prefill so it references what they read. The toner post → "...help me pick a toner for my skin?". Data already on the page (category, primaryKeyword, key ingredients).

## Change 3 — Mid-article CTA at peak intent

Add one Yuri prompt after the main "what to look for" section (not just bottom), at the moment the reader naturally thinks "so what about MY skin?".

---

## Change 4 — Hero copy rewrite (Bailey's ask)

### Why current copy underperforms
- Headline "Your K-Beauty Expert, On Call 24/7" = generic SaaS service framing, not a feeling.
- Subhead is a feature LIST (reads labels / builds routine / catches conflicts / remembers) — capabilities, not the visitor's felt problem.
- Leads with what Yuri DOES, not what the visitor stops feeling (overwhelmed, scammed, unsure).
- The one warm line ("texting a friend...") is buried last.

### Positioning (grounded in SS's own proof)
The validated angle is the **honest-insider-friend who cuts through the hype** — same DNA as glass_skin_atx's viral Reddit pattern (contrarian truth + specifics + peer voice) and the counterfeit/price-markup hooks. Lead with the visitor's pain (too many products, no idea what works, scared of fakes/wasting money); Yuri = straight-talking Seoul insider who tells the truth, free.

### SHIPPED hero copy

**Badge:** `Free to talk to. No signup.`

**Headline:**
> Stop guessing
> **which K-beauty actually works.**

**Subhead (SHIPPED — no em-dash per the no-em-dash rule):**
> You've got a shelf of Korean products and no idea what's working, what's clashing, or what's a $40 dupe of a $12 hero. Yuri's the Seoul-insider friend who tells you the truth. She reads your labels, spots the fakes, and builds your routine. Ask her anything, free.

**Microcopy under CTAs:** `Talk to Yuri free — 20 messages, no signup.` (kept, slightly tightened)

### Rationale
- Opens on the visitor's actual felt problem ("stop guessing"), not a feature.
- "$40 dupe of a $12 hero" + "spots the fakes" = the price-markup + counterfeit hooks that are SS's proven media angles, concrete not abstract.
- "Seoul-insider friend who tells you the truth" = the relatable, honest-friend voice Bailey wanted, moved to the FRONT.
- Keeps the proud-AI honesty (she's openly Yuri/AI in the widget header) — no false human claim.
- "free" stated twice (subhead + microcopy) — lowers the click barrier for the engaged-but-unconverted cohort.

---

## Measurement
- GA4 `paywall_*` funnel already live; watch whether blog→Yuri engagement (widget conversations originating from blog) rises.
- The honest read of success is: more anonymous widget conversations from Organic Search / Referral visitors, and eventually first paid conversion. Directories are paused until this moves (per ship-guard discipline).
