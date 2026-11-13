---
paths:
  - "src/app/api/widget/**"
  - "src/lib/widget/**"
  - "src/components/widget/**"
  - "src/app/page.tsx"
  - "src/lib/trial*.ts"
  - "src/lib/offers*.ts"
  - "src/lib/stripe-params.ts"
  - "src/lib/pricing.ts"
  - "src/app/api/stripe/**"
  - "src/app/api/me/**"
  - "src/app/api/cron/yuri-wakes-up/**"
  - "src/lib/yuri/setup-carry.ts"
  - "src/lib/yuri/turn-facts.ts"
  - "src/lib/yuri/widget.ts"
---

# Landing widget and sign-up funnel (moved from CLAUDE.md, Nov 11 2026)

### The landing chat is CLOSED (v11.60.0, Nov 13 2026) — read this before anything below

Talking to Yuri starts with a free account. **Everything below this section describes the OPEN
chat**, which exists in the code and returns when `NEXT_PUBLIC_LANDING_CHAT=open` is set and the
site is redeployed. `src/lib/landing-chat.ts` is the only place the mode is decided.
**The full runbook is `LANDING-CHAT-GATE.md` (repo root):** why, how to grade it, how to reopen, and
what the switch does not reach.

- Closed: `/api/widget/chat` refuses first; the hero shows `GatedYuriIntro` (static copy, the
  visitor's own `?ask=` question, a sign-up button, a labelled example). `TryYuriSection` still
  mounts so emailed resume links are stripped and a saved conversation can be read.
- Every sentence about how to reach Yuri comes from the helpers in `landing-chat.ts`. Do not write
  "free, no signup" anywhere else; `tests/landing-chat-gate.test.mjs` scans the tree closed-world.
- `GatedYuriIntro.tsx`, `src/content/yuri-example.ts` and the closed nurture emails are pinned by
  SHA-256. Change a word, get a second-model review, then update the fingerprint.
- A real conversation goes in `yuri-example.ts` only when the member has approved the exact text.
- Grade it by `auth.users.raw_user_meta_data->>'signup_from' LIKE 'gate%'`. Fewer than about 4
  real new accounts a month means reopen.
- Blog post bodies in `ss_content_posts` are written by LGAAS and are NOT covered by the source
  scan. Check them (and the LGAAS recipe) whenever the mode changes.

### Yuri Landing Page Widget -- Widget-as-Hero Architecture (v9.5.0)

**Philosophy**: Trust-first conversion. Let Yuri sell herself through free value before asking anyone to create an account. A visitor who's had a real conversation with Yuri before signing up is 5-10x more likely to convert than someone who just read marketing copy.

**Why Widget-as-Hero (Changed in v9.5.0)**: The original design buried Yuri mid-page (section 6 of 11) behind feature grids, specialist lists, and "How It Works" sections. Result: organic search traffic reached the site but zero visitors engaged with Yuri. Meanwhile, LGAAS subscriber sites using the "widget-as-hero" pattern (softcominternet.com, myweekendceo.com) saw 10+ conversations per weekend. The data was clear — if visitors don't see Yuri above the fold, they don't talk to her.

**Previous reasoning** was that Seoul Sister has many features to showcase, so the conversation shouldn't dominate the hero. But features below the fold don't matter if visitors bounce before seeing them. Yuri IS the differentiator — she's what no competitor has. Leading with her is the right call.

#### Widget Architecture (hero-only; the once-planned floating bubble was removed — see Layer 2 below)

**Layer 1: Hero Widget (Above the Fold — the ONLY anonymous Yuri surface)**

```
Homepage Layout (v9.5.0):
  Navigation (sticky)
  Hero Section (50/50 grid):
    LEFT (50%):  Badge + Headline + Subheadline + Stats Grid + CTAs
    RIGHT (50%): Yuri chat widget (live, interactive, streaming)
  -> Core Intelligence Features (6 cards)
  -> Advanced Features (8 badges)
  -> Meet the Specialists (6 agents)
  -> How It Works (4 steps)
  -> Why Seoul Sister Exists (3 differentiators)
  -> Social Proof (testimonials)
  -> Pricing (Seoul Sister Pro — $9.99/mo)
  -> Final CTA
  Footer
```

The hero widget includes:
- Chat header with Yuri avatar, name, subtitle, and a "Free preview" badge that becomes "Live" once a real conversation streams (v11.9.1 — "Live" over scripted content read as fake)
- Greeting state (v11.9.1, replaces the demo-transcript-first layout that confused testers): Yuri welcomes the visitor first-person (identify + value + next step), with the 4 quick-prompt buttons directly beneath — both visible without scrolling. The greeting is presentation copy only and never enters the server-bound history
- Labeled example exhibit below the fold-line: first exchange of one of two demo scripts (owner vs beginner, random A/B, GA4 `demo_variant` tracked) under an explicit "Example" divider — showcases the subscriber ceiling without impersonating a live chat
- High-contrast input with directive placeholder ("Type here to ask about your skin. Free, no signup.")
- Full SSE streaming with real-time responses
- After 12 lifetime free messages: conversion prompt to subscribe ($9.99/mo); after 6 (was 8 until Oct 30 2026), an email is required to continue (lead capture gate)
- Min-height: 520px, max-height: 640px on desktop
- Component: `TryYuriSection` with `variant="hero"` prop

**Layer 2: Floating Yuri Bubble — REMOVED (not rendered).** A floating bottom-right bubble (`YuriBubble` component) was originally planned as always-present secondary access. **It was never wired into the layout and the orphaned component was deleted July 10 2026.** The hero widget (Layer 1) is the ONLY anonymous Yuri surface on the site — everything lands there, by design (the widget-as-hero decision above). Do not re-introduce a bubble without an explicit decision to change this; a July 10 2026 session wasted a fix "attributing bubble conversations" against this dead code precisely because this doc still described the bubble as live. If you're reading this and considering a bubble, it does not currently exist.

**Layer 3: Full Yuri Experience (Post-Signup)**
```
After account creation (paywall sits at the VALUE MOMENT — commit 68acafe, July 15 2026):
  -> Redirected straight to Yuri onboarding conversation (free — skin profile, preferences, concerns; capped at 50 user messages to bound Opus cost)
  -> On completion: /subscribe (payment gate, framed as continuation)
  -> Stripe Checkout ($9.99/mo Seoul Sister Pro)
  -> /yuri page with full specialist routing
  -> 6 specialist agents (no message limits)
  -> Cross-session memory and personalization
  -> Deep-dive conversations with product recommendations
```

#### Visitor Journey (v9.5.0)
```
1. Visitor lands on seoulsister.com
2. IMMEDIATELY sees Yuri in the hero (right column, above the fold)
   -> Demo conversation shows Yuri's counterfeit detection knowledge
   -> 4 quick prompt buttons reduce friction to first message
3. Visitor types a question OR clicks a quick prompt
   -> Yuri gives a genuinely helpful, streaming response
   -> Backed by real product database (5,800+ products)
4. (Feeder pages — blog, ingredient, product, nav — route "Ask Yuri" CTAs to the hero widget with `?ask=`/`?from=` prefill; there is no floating bubble)
5. After 6 free messages (was 8 until Oct 30 2026): email required to continue (the continue-gate — captures the lead
   and gives cross-device identity; the stashed question restores after the email lands)
6. After 12 lifetime free messages:
   -> Conversion prompt: "Subscribe — $9.99/mo"
   -> Highlights: unlimited conversations, skin profile memory, 6 specialists, routine builder
7. Visitor subscribes ($9.99/mo) -> Yuri onboarding conversation (Layer 3)
```

#### TryYuriSection Component Architecture
The `TryYuriSection` component (`src/components/widget/TryYuriSection.tsx`) supports two variants:
- `variant="hero"`: Renders as an embedded card (no section wrapper, no heading). Used in the homepage hero grid. Has chat header with "Live" badge.
- `variant="section"`: Renders with full-width section wrapper, heading, and subheading. Available for standalone use on other pages if needed.

Both variants share identical `chatContent` (demo conversation, live messages, input, error handling, streaming logic) to avoid code duplication. The variant only affects the outer container and header.

#### Widget Specifications
- **Conversation state visibility (v11.1.0/v11.2.0)**: every turn, the route injects a factual Conversation State block (visitor's message #, email-on-file) plus, when present, the feeder `source` ("this visitor arrived from a Seoul Sister guide — never deny it exists") — facts for Yuri's judgment, never triggers. All per-turn context lives in a second UNCACHED system block; the static `YURI_WIDGET_SYSTEM` sits alone in the `cache_control` block. **Do not append per-turn strings to the cached block** — that silently kills the prompt cache (the v11.1.0 regression, measured and fixed in v11.2.0).
- **History rehydration (v11.2.0)**: the client keeps history in React state but the session id in sessionStorage; when a session exists and the client sends empty history (same-tab navigation/reload), the route recovers the transcript from `ss_widget_messages` via `getSessionTranscript()` so Yuri doesn't greet a mid-conversation visitor as a stranger.
- **Where the routine is built (v11.51.0, Nov 10 2026 owner decision)**: after the trial starts, as the first thing in the first member chat (`/onboarding` sends a just-paid member with setup complete to `/yuri?ask=`). Not in the preview and not in onboarding. Reading and ordering products a visitor already owns is the give; new picks for every slot, multi-week schedules and rebuilds are the build. Yuri's facts about the path (free account, free setup, same-browser carryover, trial, allowance) are the conditional paragraph in `subscriber-surface.ts`, pinned sentence by sentence in `tests/funnel-path-facts.test.mjs`. A "Create a free account" link sits under the chat once Yuri has answered. Do not add copy anywhere that says a routine exists before membership.
- **Weekly rhythm (v11.53.0, Nov 10 2026, owner decision)**: `yuri-wakes-up` judges each member on their local Sunday and a trial member on trial days 3 and 6 only. The judge prompt (`CHECKIN_SYSTEM`, pinned by SHA-256 in `tests/weekly-rhythm.test.mjs`) says a note goes out most weeks: one or two questions, WHETHER before HOW. Silence is still Yuri's call, from facts (`unansweredFact`), never a coded threshold. Check-ins are no longer under `MAX_NUDGES`; the gate is "not within 2 days of any proactive contact". `proactive-nudge` skips anyone `weeklyCheckinCovers` (check-ins live and a timezone on file). The trial-ending notice is a separate plain email (`src/lib/trial-notices.ts`), sent ~48h before `trial_end` regardless of `YURI_WAKES_UP_MODE`; never put price or billing text in Yuri's own note. Customer copy says "most weeks", never "every week". Chat-Yuri gets her last check-in per turn (`src/lib/yuri/turn-facts.ts`). A profile with no timezone gets the device's (`/api/me/timezone`, set-once into an empty field).
- **Setup carries into the member chat (v11.54.2, Nov 11 2026)**: `src/lib/yuri/setup-carry.ts` gives the member chat and `get_routine_context` the routine items noted during setup (`ss_onboarding_progress.skin_profile_data.current_routine`), and shows the setup conversation directly while it has no summary (the summary is written by `settle-memory` after 30 idle minutes, and a new member usually starts chatting within minutes). The wording never says the person owns an item or that we do not carry it. `ss_ai_usage.stop_reason` records why a landing-chat reply ended.
- **Creator codes (v11.54.0, Nov 10 2026)**: a code (first: BAILEY) is a Stripe promotion code marked `metadata.creator_offer=1` on a coupon that is a whole-number percent off, `repeating`, 1 month. Stripe enforces the cap; the app never states how many are left. Client-safe helpers and ALL price wording live in `src/lib/offers.ts` (`chargePhrase`, `addCardPhrase`, `priceWithOffer`); the Stripe lookup is `src/lib/offers-server.ts`. Never write a charge sentence with `PRICING.monthly_display_long` directly: a member with a code would be told the wrong first charge. The recorded discount comes from the subscription's own `discount` (`offerFromSubscription`), not from checkout metadata. Yuri gets one per-turn fact about a visitor's code on the widget and in setup chat (`offerFactForYuri`, v11.54.1), pinned whole in `tests/no-card-trial.test.mjs`; the lookup never holds a chat turn more than 1.5s.
- **Free trial (v11.52.0, Nov 10 2026)**: 7 days, NO card to start (`PRICING.trial_requires_card: false`; `NO_CARD_TRIAL_ENABLED=false` is an emergency stop for the checkout only, the copy does not follow it). Rules live in `src/lib/trial.ts` and are shared by the checkout and the paywall (`/api/me/trial`): one trial per canonical inbox (`ss_trial_starts`, no account foreign key, survives deletion), 3 per network per 30 days. Stripe parameters are built by pure functions in `src/lib/stripe-params.ts`. A member adds a card from `TrialNotice` (top of every app page) through `/api/stripe/add-card` (setup-mode Checkout; the webhook sets it as the subscription default). No card on day 7: Stripe cancels, plan clears, "nothing was charged" email. **A trial is not a paid conversion**: `converted_user_id` and the One Metric are stamped by `onInvoicePaid` (`src/lib/trial-events.ts`) on the first invoice with `amount_paid > 0`, never at checkout for a trial. Any "who paid?" count must exclude unpaid trials with `isUnpaidTrialSubscription`. The live endpoint sends `invoice.paid` (not `invoice.payment_succeeded`) and is not subscribed to `trial_will_end`.
- **Funnel step rows (v11.51.0)**: `ss_widget_visitors.register_clicked_at` (first sign-up click from the chat), `registered_user_id` (account that confirmed the preview in onboarding; NOT paid, `converted_user_id` still means paid), `ss_user_profiles.checkout_clicked_at`, and `widget_visitor_id` in `auth.users.raw_user_meta_data`.
- **Preview messages (v11.9.0)**: 12 LIFETIME per visitor UUID (localStorage/cookie), with a 40-message/IP/30-day backstop that closes the device-switch quota reset (verified July 18: desktop→phone minted a fresh visitor row on the same ip_hash). Email continue-gate after 6 messages (8 until Oct 30 2026; first showing recorded in `ss_widget_visitors.email_gate_shown_at`) (server 429 `emailRequired`; client stashes the question, collects the email through the chat so the capture pipeline + Yuri's acknowledgment run naturally). Yuri SEES her preview usage in Conversation State — she must never claim the preview is unlimited (verified July 18 failure).
- **The give and the gate (v11.9.0, replaces "give 100%")**: Yuri qualifies first (skin type/location/current products/history — judgment guidance, not a form), then fully solves the visitor's #1 concern with one specific pick. The COMPLETE routine build (full AM/PM construction, multi-week schedule, picks for every slot, lineup conflict-checking) is named subscriber work and is NOT delivered in the preview — Bailey/Lynndon's July 18 test proved a full-blueprint giveaway leaves no reason to subscribe. The recap email is scoped the same way (diagnosis + #1 priority, never a complete take-home plan).
- **No login required**: Anonymous conversations streamed (and stored in ss_widget_* for learning/lead-gen)
- **Surface-level routing**: Anonymous questions get helpful answers but not deep specialist dives
- **Data capture**: Anonymous conversation data feeds the learning engine
- **Mobile-responsive**: Hero stacks to single column on mobile
- **SSE streaming**: Real-time streamed responses (not waiting for full response)
- **Quick prompts**: 4 in hero widget — reduce friction to first message

#### Rate Limiting (Cost Control)
- 12 free messages LIFETIME per visitor UUID (server truth: ss_widget_visitors.total_messages; client localStorage counter is UX-only)
- 40 preview messages per IP per 30 days (Supabase-persisted backstop against device/browser-hopping quota resets)
- 25 messages per IP per day (abuse prevention; distinct `rateLimited` semantics so shared-IP false-trips never show the paywall)
- Email required to continue after 6 messages (`emailRequired` 429 → client email card)
- max_tokens 1500 for widget responses
- 6 database tools available (search_products, compare_prices, get_trending_products, get_current_weather, get_ingredient_guide, get_counterfeit_markers) but no specialist agent deep-dives

#### What This Is NOT
- NOT the LGAAS AriaStar widget (which is white-labeled for subscriber businesses)
- NOT a lead generation tool for other businesses
- This is Seoul Sister's OWN conversion tool on its OWN landing page
- Seoul Sister may subscribe to LGAAS for marketing (Reddit, blog, social, email), but the landing page widget is Yuri, not AriaStar

#### Relationship to LGAAS When Seoul Sister Is a Subscriber
When Seoul Sister subscribes to LGAAS for marketing automation:
- **LGAAS provides**: Reddit K-beauty discovery, blog generation, social content, email sequences, competitive intelligence, learning engine for marketing
- **Seoul Sister keeps**: Its own landing page with Yuri widget (NOT replaced by AriaStar)
- **AriaStar's role**: Business advisor to Seoul Sister's team (marketing strategy, content performance) — not visitor-facing
- **Clean separation**: AriaStar drives traffic TO seoulsister.com. Yuri handles conversion ON seoulsister.com.

#### Strategic Open Question — Widget Memory Honesty (Rule #3) — Surfaced Apr 26 2026

**The question**: Should the widget tell cold prospects when it doesn't remember details from prior visits, or should it stay silent about memory gaps?

**Current behavior (Rule #3 in LGAAS widget system prompt)**: The widget is instructed to never confess memory fragmentation to prospects. If a returning visitor references a prior conversation and the visitor-memory injection is empty (e.g., they cleared cookies, switched devices, hit visitor-ID rotation), the widget plays along rather than admitting "I don't have memory of our earlier chat." The reasoning was conversion-rate optimization — prospects who sense AI limitations bounce.

**The challenge**: Seoul Sister's v10.2.0-v10.3.0 hardening on the authenticated Yuri side proved that *honest gaps build more trust than fake confidence*. Phase 15.1 corrections memory + Tool-Call Honesty rules + age-aware rendering all assume that authentic limitations communicated honestly outperform confident wrong claims. The v10.2.1 incident (where Yuri claimed "I checked our database" without firing a tool) proved the cost of fake confidence in real production. This evidence comes from authenticated, paying users.

**The unresolved part**: Does this trust-from-honesty pattern translate to a *cold prospect* who has invested ~30 seconds and zero dollars? They have no existing trust to deepen — the entire interaction is the first impression. A prospect hearing "I don't have memory of our previous conversation" might think:
- (a) "This AI is honest, I trust it more" (Yuri's authenticated-user pattern transfers)
- (b) "This AI is broken/limited, why bother subscribing" (Rule #3 was right)

**The widget's job is trust-building toward subscription conversion.** Yuri's evidence does not automatically settle which interpretation prospects have. These are genuinely different conversion contexts.

**Decision deferred — needs A/B test, not unilateral change**. Future work: when widget traffic justifies (~100+ daily visitors with measurable conversion rate baseline), A/B test "Honest Mode" (tells prospects when memory is empty) vs current "Rule #3 Mode" (stays silent, plays along). Measure subscription conversion rate. Whichever wins becomes the canonical rule.

**Until A/B data exists, do NOT unilaterally change Rule #3.** This isn't a bug to fix — it's a hypothesis to test. If a future Claude session reads Yuri's hardening philosophy and proposes extending it to widget without A/B data, it's wrong about the conversion context.

**Related deferred follow-ups** (also surfaced during the LGAAS Blueprint 53 audit):
- **Member Portal Memory Honesty extension** (LGAAS): broaden the existing rule at `utils/specialist-agents.js:557-562` to cover "external data not in current prompt," not just past sessions. Polish ship, queue for after LGAAS P3 ships and is measured.


## Cumulative-Give Instrument (widget — v11.10.0)

The preview's gate ("the complete build is subscriber work") is a **cumulative** boundary, but Yuri sees one turn at a time. In a real 14-message test she delivered the entire subscriber deliverable while no single reply crossed the line — she was asked to hold a boundary she had no instrument to measure. `src/lib/widget/cumulative-give.ts` reads her OWN already-sent replies and injects the running artifact count as a FACT.

**Do not turn it into a cap.** It blocks nothing, inspects no drafts, and ends by handing the decision back ("not a rule and not a cap"). A guard test fails if the fact is converted into a command. If the giveaway persists, the answer is better facts or a policy decision — **not** rewording the gate, which already names the artifacts explicitly and failed twice before for this reason. See `WIDGET-CUMULATIVE-GIVE-BLUEPRINT.md`.
