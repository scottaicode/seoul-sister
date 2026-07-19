# Landing Page Review — July 19, 2026

Full-page review conducted with Scott after the v11.9.1 widget greeting-state redesign
(triggered by Bailey + Lynndon's July 18 live test). The hero/widget items are recorded in
CHANGELOG v11.9.0–v11.9.1; this doc records the below-the-fold review: what shipped, and
what was deliberately deferred with the trigger that would un-defer it.

## Shipped July 19 (same day, approved by Scott)

1. **"Talk to Yuri Free" secondary CTA at the final CTA section** (`src/app/page.tsx`).
   Problem: every below-the-fold CTA (Get Started / View Plans / Start Your Journey) routed
   to `/register`, while the final CTA's own caption promised "Talk to Yuri free…no signup."
   The convinced-but-not-ready scroller had no path back to the converter our funnel data
   says actually works (the widget). The secondary button scrolls back to `#hero-yuri`.

2. **"How It Works" step 1 changed from "Scan or Search" to "Talk to Yuri"** (`page.tsx`
   `steps` array). Scan-first was the pre-v11.0.0 story; usage data showed scans ≈ 0 and all
   real engagement in Yuri chat. Scan/search folded into step 2's description.

## Watch-items — deliberately NOT actioned (with un-defer triggers)

3. **Testimonials are insiders.** Both "Early user" quotes are Bailey (Austin TX) and Scott
   (Sacramento CA). Real quotes, honest labels, but thin for a brand whose moat is honesty.
   → **Trigger:** first genuinely positive stranger feedback (widget conversations are already
   producing candidates — e.g. the July 7 high-intent prospect). Swap, don't stack.

4. **Feature-count vs. one-advisor story.** 6 pillar cards + 8 "Beyond the Basics" + 6
   specialists = 20 cards telling the old many-features story; hero + strategy (v11.0.0) tell
   a Yuri-as-orchestrator story. No evidence it hurts conversion today.
   → **Trigger:** next deliberate landing redesign, or GA4 showing scroll-depth die-off in the
   card sections. Direction: consolidate toward "Yuri, and everything she can do." Do NOT
   restructure speculatively under the build freeze.

5. **Community Reviews pillar card** promises skin-type-filtered community reviews while the
   community is still tiny. Aspirational-but-buildable, not false. Leave.
   → **Trigger:** if a prospect or review ever calls it out, soften the card copy.

## Review discipline notes (for future sessions)

- The page's conversion center of gravity is the HERO WIDGET; every below-fold change should
  either route attention back to it or reduce friction toward it. Full CTA inventory before
  adding any new section.
- Scott browses at 70–80% zoom — verify above-the-fold claims at 100% before declaring fit
  (the v11.9.1 clipping round-trips were zoom-related).
- Free-message counts must derive from `MAX_FREE_MESSAGES` (`src/lib/utils/widget-session.ts`),
  never hardcoded copy (the "20 messages" drift, fixed commit a9708d6).
