# Phase 4 — Contextual Yuri Nudge on Products & Ingredients (Funnel Feeder)

**Created:** June 29 2026
**Status:** Building
**Depends on:** PR #14 (single-front-door funnel) + PR #15 (land-at-hero-top). This extends the same funnel: every "Ask Yuri" entry point routes to the landing hero widget (`/?ask=<question>&from=<source>`), the one optimized conversion surface.

## Goal

Turn the Products and Ingredients pages into **feeders** to the landing Yuri widget — the same way blog posts now feed it. A visitor reading about a specific product or ingredient is high-intent; a contextual, well-timed nudge to "ask Yuri about this" converts that interest into a conversation.

## The strategy (Scott's call, June 29 2026)

Single front door: ONE conversion surface (the landing hero widget). Every other page is a feeder. On Products/Ingredients, surface a nudge that:
1. **References what they're looking at** (the specific product or ingredient name), not a generic "chat with our AI."
2. **Routes to the landing widget with the question prefilled** (`/?ask=...&from=product` / `&from=ingredient`).

## Best-practices guardrails (NOT a random popup)

Scott's instinct was "random messages encouraging them to chat." The best-practice refinement, to protect the honest-insider brand (a spammy popup destroys the trust the whole product is built on):

| Rule | Why |
|---|---|
| **Contextual, references the page's product/ingredient** | Relevance, not interruption |
| **Engagement-triggered** (after scroll depth ~40% OR ~18s dwell, whichever first) | Only nudge an interested visitor, not on instant arrival |
| **Inline/slide-in, never a blocking modal** | A modal that hijacks the screen kills trust |
| **Dismissible, and stays dismissed** (per-page-type, sessionStorage) | Don't re-nudge someone who said no |
| **One per page** | No nagging |

## Scope (this PR)

- **Product DETAIL page** (`/products/[id]`) — nudge references `{brand} {product}`.
- **Ingredient DETAIL page** (`/ingredients/[slug]`) — nudge references the ingredient name.
- Detail pages only (high intent). NOT the browse/list pages this pass (lower intent, can add later if data justifies).

## Architecture

- New client component `src/components/widget/ContextualYuriNudge.tsx`.
  - Props: `kind: 'product' | 'ingredient'`, `name: string` (display name), optional `brand`.
  - Builds the visitor question from the name (e.g. product → `"Is {brand} {name} right for my skin?"`; ingredient → `"Is {name} good for my skin?"`).
  - Trigger: `useEffect` sets up a scroll listener + a dwell timer; first one to fire shows the nudge (then both are torn down).
  - Render: a fixed bottom-center slide-in card (not corner, not modal), gold-accented, with a dismiss "×". On click → `router.push('/?ask=<question>&from=<kind>')`. On dismiss → set sessionStorage key so it won't re-show for that page-type this session.
  - GA4: fire `yuri_nudge_shown` and `yuri_nudge_click` (with `kind`) — reuse the analytics helper. The landing side already records `yuri_prefill_arrived` with `source`, so the full feeder funnel (shown → click → arrived → first message) is measurable.
- Embed the (client) component into the two (server) detail pages, passing the already-fetched name/brand. Server→client prop pass, no new fetch.

## Analytics events (add to `DemoEvent` or a new `NudgeEvent` in `src/lib/analytics.ts`)

- `yuri_nudge_shown` `{ kind }`
- `yuri_nudge_click` `{ kind }`

These plus the existing `yuri_prefill_arrived { source }` give the per-feeder funnel.

## AI-First

Pure funnel/UX + the visitor's own seeded question. Yuri owns every answer. No rules, no templates constraining her. Feeds MORE measured conversations into the one instrumented surface — strengthens the learning loop. Expected: PASS.

## Out of scope (future)

- Browse/list page nudges (lower intent).
- A/B testing nudge copy/timing (do once volume justifies).
- Exit-intent trigger (start with scroll+dwell; add exit-intent later if it lifts clicks).

## Verify

1. `tsc` + `build` clean, AI-First PASS.
2. On a product detail page: nudge does NOT appear instantly; appears after scrolling ~40% or ~18s; references the product; dismiss makes it stay gone (reload same page-type → still gone this session); click navigates to `/?ask=...&from=product` and the landing widget prefills.
3. Same on an ingredient detail page (`&from=ingredient`).
4. Mobile: slide-in card readable, doesn't cover critical content, dismiss tappable.
