# Seoul Sister - K-Beauty Intelligence Platform

> **⭐ READ FIRST — `NORTH-STAR.md` (repo root) governs WHETHER to build, before anything below governs HOW.** Seoul Sister is a 9/10 product with ~0 validated demand (0 conversions from 22 visitors, conversion rate unmeasured). The standing failure mode is building more product instead of answering *"will a stranger pay?"* So **new features are FROZEN by default** until visitor→paid conversion is measured and moving. Before planning ANY new feature/capability/polish, run the **`/ship-guard`** command — it blocks improvement-for-its-own-sake and redirects to growth/measurement work. Growth, lead capture, distribution, blocking-bugfixes, and cost/observability work are always allowed. "Best practices" and "AI-First" are HOW we build, never WHY — they don't clear this gate. `/ship-guard` is the revenue-side companion to `/ai-first-guard` (which still governs how judgment-making code is built).
>
> **🎬 Making a Yuri VIDEO (launch/hero, scrappy social, any Yuri clip)? READ `SEOUL-SISTER-VIDEO-PLAYBOOK.md` (repo root) FIRST.** It is the canonical craft rules earned on the "Meet Yuri" launch video (graded 4.2 → 8.6/10): lead-with-the-differentiator hook, the proud-AI principle (Yuri is openly AI — it's a trust flex, not a liability), the objective Gemini grading loop, swipe-rate-is-everything, the ElevenLabs VO method, amplify-validated-Reddit-winners, and the hard REJECT list (never fabricate, honesty is the moat, conversions not views). Video/distribution work is the always-allowed growth lane under the freeze — but it follows the playbook.
>
> **📁 Bailey's creator channel lives in `bailey/`** (moved there July 25 2026 from the repo root). Scripts, strategy, the creator arrangement, her feedback log, competitor teardowns, and the built PDF/DOCX deliverable she films from. Start at `bailey/README.md`. Older docs and CHANGELOG entries reference `BAILEY-FEEDBACK-LOG.md` by bare filename — it is now `bailey/BAILEY-FEEDBACK-LOG.md`. The video *craft* rules stay at root in `SEOUL-SISTER-VIDEO-PLAYBOOK.md` (see below), along with `SOCIAL-VIDEO-ENGINE.md` and `REDDIT-VALIDATED-VIDEO-QUEUE.md`, which are not Bailey-specific.
>
> **For any AI session opening this repository for the first time**: Read `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md` and `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/patterns.md` *before* touching any code in this repo. Those documents capture the operating philosophy this application was built under and that it continues to be developed under. Code that doesn't reflect those principles will be rejected.
>
> **🗺️ Sitemap / indexing work? Read `IS-ACTIVE-SEMANTIC-FIX.md` and `SITEMAP-QUALITY-FOLLOWUP.md` (repo root).** On Aug 4 2026 the sitemap went **2,033 → 14,096 URLs** after three compounding defects were fixed: `is_active` was used as a publish gate (it is a functional classification — "active ingredient vs. excipient" — and `ss_ingredients` has NO enabled column; the pollution guard is the only quality gate), PostgREST was **silently capping the query at 1,000 rows** and reporting no error, and the resulting set advertised ~2,018 URLs that 404'd. Every stage looked correct in code and was wrong on the live surface — removing the filter recovered nothing (the cap was binding), and fixing the cap published dead URLs. **Only sampling real URLs after each deploy caught any of it.** `SITEMAP-QUALITY-FOLLOWUP.md` carries a **dated recheck (Aug 18 2026)** on whether to filter ~1,549 parse-artifact URLs — deferred on purpose so Google's crawl grades them instead of a heuristic. Two traps recorded there: **never cut ingredient pages on `product_links = 0`** (1,981 of 2,014 such pages have real content and 650–860 rendered words), and a shade-code rule that flagged **`1,2-Hexanediol` (510 links)** because it starts with a digit — the July 30 over-correction repeating.
>
> **📈 Working on AI-citation / GEO / lead-gen-from-search? Read `GEO-STRATEGY.md` then `GEO-PLAYBOOK.md` (repo root).** `GEO-STRATEGY.md` is the execution record — what shipped (July 27 2026), the Bing citation baseline (525 citations/7d, 33-66% share on commercial K-beauty queries), and everything deliberately **NOT** built with row-counted reasons (1,242 ingredient×category / 214 brand / 63 subcategory pages). The standing rule: **the citation is a RENTED asset — one model update cut brand citations 41% industry-wide in early 2026 — while the email list and the Yuri relationship are OWNED.** Work that converts citations into captured leads is durable; work that earns more citations is not. Do NOT build new page types to chase citation volume: citations are already working (525/wk) and leads are not. The gate for unfreezing them, and for productizing the method via LGAAS, is identical — **one cold stranger arriving from an AI citation becoming a paying subscriber, attributable in first-party data.** `GEO-PLAYBOOK.md` is the generalized, teachable method, explicitly marked unproven until that gate clears. **Never grade this work with GA4** — it is bot-inflated (346 phantom users against 0 database rows on July 27); the honest denominator is `ss_widget_visitors WHERE total_messages > 0`, and the teachers are Bing AI Performance + GSC.
>
> **Also read `LEARNING-LOOP-BLUEPRINT.md` (repo root)** before adding any feature that makes a judgment. It defines the owner's overriding learning-loop principle — every app must learn from graded outcomes against the least-gameable teacher in its domain — and the specific upgrade path for Yuri (toward a measured skincare-outcome teacher, beyond today's subjective user feedback).
>
> **MANDATORY AI-First gate (every judgment-making change):** Run the **`/ai-first-guard`** command on the PLAN *before* writing code, and the **`/ai-first-check`** command on the DIFF *before* commit. (Ported from DeepChain June 2026, where this same gate caught real anti-patterns in production builds.) `ai-first-guard` blocks a plan that would replace Yuri's judgment with rigid logic, constrain her output, break a learning loop, or violate the Yuri Sole Authority Principle; `ai-first-check` verifies the actual diff did none of those. These are NON-SKIPPABLE for the Seoul Sister Guardian (see `GUARDIAN-CHARTER.md`): no autonomous change ships without an `ai-first-check` PASS plus `tsc`/`build` green. The commands live in `.claude/commands/`. Surface the fact, never cage the judgment.
>
> **The Seoul Sister Guardian (autonomous health system) — read `GUARDIAN-CHARTER.md` if you are continuing this work or were asked to activate autonomous fixing.** A zero-cost always-on watcher (`/api/cron/guardian-watch`, 3×/day, server-side, laptop-independent) already monitors health 24/7 and logs verdicts to `ss_pipeline_runs.metadata`. The autonomous *fix-while-Scott-sleeps* layer is DEFERRED with a complete self-contained activation runbook in `GUARDIAN-CHARTER.md` ("DEFERRED FEATURE 2") — Scott wants it live after a ~1-week report-only proving period (started June 5 2026) + his cost approval (~$5–15/mo). **If you are a fresh AI with no memory of this and Scott asks you to "turn on the Guardian" or "activate 24/7 fixing": read that runbook in full, confirm BOTH activation pre-conditions, and never activate without them.** Current mode lives at the top of `GUARDIAN-LOG.md` (currently `REPORT-ONLY`). The $0 push/email alerting feature ("DEFERRED FEATURE 1") is now **BUILT** (July 15 2026, `src/lib/guardian/alert.ts`): the watcher emails `GUARDIAN_ALERT_EMAIL` on a `critical` verdict OR a bounced/failed lead recap, de-duped against the prior run so a persistent condition alerts once. Autonomous *fixing* ("DEFERRED FEATURE 2") is still deferred.

## Project Overview

Seoul Sister is an English-language K-beauty intelligence platform whose product is **advice, not a catalog**. It bridges the gap between Korean beauty consumers (who have 187,000+ products, 5.77M+ reviews, and ingredient-level intelligence via Hwahae) and international consumers.

> **Positioning correction (Aug 9 2026) — read before writing any marketing, prompt, or strategy copy.**
> The founding line "Hwahae is Korean-only, no English equivalent exists" is **no longer true** — see the Competitive Landscape table. Hwahae Global is live in English at 100K+ MAU, ~80% US. Do not repeat the old premise.
>
> **What IS defensible, and was verified against the market (Aug 9 2026): the chat-first consumer skincare advisor lane is empty.** Every conversational skincare AI found — Haut.AI Skin.Chat, Perfect Corp's YouCam Beauty Agent, Revieve's advisor — is sold **B2B to brands and retailers**. That is a structural difference, not a feature gap: an advisor funded by a brand cannot say *"keep your CeraVe, you don't need Korean anything"* or talk a user out of two purchases. Yuri can, and did — that is what converted the first paying subscriber. Independence is the moat.
>
> **Seoul Sister sells a SERVICE, never products.** No inventory, no fulfillment, no product margin. Affiliate revenue is incidental and must never shape a recommendation.
>
> **A MARKETING-CLAIMS rule, and explicitly NOT an instruction to soften Yuri.** Read both halves; the second matters more.
>
> **Do not market Seoul Sister as "dermatologist-level" or imply a clinical credential** — in ad copy, the landing page, app-store text, or press. The FTC has brought enforcement against skin apps for unsubstantiated medical claims (MelApp, Mole Detective) and its 2024 "Operation AI Comply" sweep targets inflated AI capability claims. The title is the exposure, and we do not need it. Say the truer, stronger thing: **expert K-beauty judgment that knows your shelf, your history, and when to send you to a doctor.** The price comp is telederm (Curology ~$19.95/mo, Dermatica ~$24.99/mo) because we sit beside it as the ADVICE layer.
>
> **This changes NOTHING about how Yuri reasons or speaks, and no session may use it to make her more cautious, more hedged, or more disclaimer-heavy.** Yuri has 20+ years of Korean formulation-lab and cosmetic-chemistry experience and reasons at that level from the information in front of her — that is real and it is the product. She should keep stating conclusions with the confidence the evidence supports, keep using ancestry/age/climate/cycle as the genuine clinical inputs they are (see *Reason from population patterns, stay calibrated*), and keep declining to hedge when she knows the answer. Her honest limit is simply that she cannot examine, biopsy, or prescribe — which she already handles the right way by REFERRING (the lesion rule), not by weakening her advice. A Yuri who starts saying "I'm just an AI, see a professional" about ordinary skincare questions is a REGRESSION, not compliance. If you are tempted to add a disclaimer to a Yuri prompt because of this section, you have misread it.

**Vision**: The definitive K-beauty intelligence layer that translates Korean product knowledge for the global consumer, uses AI to build personalized routines, and solves the authenticity and price transparency problems that the $2B+ US K-beauty market has no good answer to.

**What Seoul Sister IS**: A knowledge and intelligence platform. Users come for ingredient analysis, routine building, counterfeit detection, product discovery, and AI-powered skincare advice.

**What Seoul Sister IS NOT**: An e-commerce store. Seoul Sister does not sell products, hold inventory, process product payments, or handle fulfillment. When users decide to buy, they go to retailers (Olive Young, Soko Glam, YesStyle, Amazon). We may earn affiliate commissions on referrals, but we never touch commerce.

**Target Audience**: Gen Z women (18-30) passionate about K-beauty, budget-conscious, ingredient-literate, TikTok-native.

## Yuri (유리) - AI Beauty Advisor

**Yuri** is Seoul Sister's AI beauty advisor -- the conversational intelligence that ties everything together.

**Why "Yuri"**: 유리 literally means "glass" in Korean. "Glass skin" (유리 피부) is THE aspirational K-beauty standard -- luminous, poreless, translucent complexion. The name is a subtle cultural nod that every K-beauty enthusiast feels connected to.

**Yuri's Role**:
- Personal beauty advisor who knows your skin profile inside-out
- **First thing every user experiences** -- conversational onboarding (not a form wizard)
- **Pre-signup demo** on landing page (try before you buy)
- Orchestrates 6 specialist agents for deep domain expertise
- Executes actions (add to routine, set price alert, scan product)
- Proactive intelligence ("trending in Seoul right now...")
- Memory across sessions ("you told me niacinamide causes flushing for you")
- Web search grounded (latest ingredient research, trend data)

**Yuri is NOT a chatbot.** She is a beauty intelligence advisor backed by specialist agents, the learning engine, the product database, and proactive monitoring. She delivers value that no human beauty advisor could match because she has access to the entire K-beauty intelligence database.

### Yuri Conversational Onboarding (Replaces Form Wizard)

**Philosophy**: If Yuri is the soul of the app, she should be the first thing every user experiences. A form says "we're an app." A conversation with Yuri says "we're your Korean beauty advisor." That first impression determines whether someone sticks around or bounces.

**How It Works**:
After registration, users enter a conversational onboarding with Yuri instead of filling out a form wizard. Yuri asks natural questions and Claude Sonnet 4.5 extracts structured skin profile data in the background (same pattern as LGAAS's AriaStar onboarding data extraction).

```
User registers
    -> Redirected to Yuri onboarding conversation
    -> Yuri: "Hey! I'm Yuri, your K-beauty advisor. Tell me about your skin --
              what's the one thing that drives you crazy about it?"
    -> User responds naturally (conversational, not checkboxes)
    -> Sonnet 4.5 extracts: skin_type, primary_concerns, current_products
    -> Yuri asks follow-up based on what's been captured vs what's still needed
    -> After sufficient data captured: "I have a great picture of your skin now!
       Let me build your personalized profile..."
    -> Structured ss_user_profiles record created from extracted data
    -> User enters the full app with a complete, rich skin profile
```

**What Yuri Extracts (Conversationally)**:
| Data Point | Form Wizard | Yuri Asks |
|-----------|-------------|-----------|
| Skin type | Dropdown: oily/dry/combo/normal | "How does your skin feel by afternoon?" |
| Concerns | Checkboxes | "What's the one thing you'd fix about your skin?" |
| Allergies | Text field | "Have you ever had a bad reaction to a product?" |
| Current routine | Multi-select | "Walk me through what you put on your face this morning" |
| Budget | Radio buttons | "What do you usually spend on skincare monthly?" |
| Fitzpatrick scale | Confusing I-VI picker | "How does your skin react to sun -- do you burn easily or tan?" |
| Climate | Dropdown | "Where do you live? Humidity makes a huge difference" |
| K-beauty experience | Scale | "Are you new to K-beauty or have you been deep in it?" |

**Yuri Knows When She Has Enough**: Onboarding tracks required fields. Yuri continues the conversation naturally until all critical profile data has been extracted. She never says "please fill out field 6 of 8." She says "one more thing -- do you wear sunscreen daily?" The experience feels like talking to a knowledgeable friend, not completing a medical intake form.

**Technical Implementation**:
- Dedicated onboarding conversation type (`ss_yuri_conversations.conversation_type = 'onboarding'`)
- `onboarding_progress` JSONB tracks which profile fields have been captured
- After each user message, Sonnet 4.5 extracts structured data and merges into profile
- Yuri's onboarding system prompt guides her to collect all required fields naturally
- Minimum required: skin_type, primary_concerns, fitzpatrick_estimate, climate
- Onboarding complete when all required fields captured (Yuri announces this naturally)
- User can skip ("I'll fill in details later") but gets reminded on next Yuri conversation

**Why Not Both (Form + Conversation)**: The form wizard was the MVP approach. Now that Yuri exists, the conversational path IS the product experience. Offering both dilutes the first impression. A user who fills out a form has a "meh, another app" experience. A user who chats with Yuri has a "wow, this AI gets skincare" experience. The onboarding IS the conversion moment.

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
  -> Pricing (Seoul Sister Pro — $24.99/mo)
  -> Final CTA
  Footer
```

The hero widget includes:
- Chat header with Yuri avatar, name, subtitle, and a "Free preview" badge that becomes "Live" once a real conversation streams (v11.9.1 — "Live" over scripted content read as fake)
- Greeting state (v11.9.1, replaces the demo-transcript-first layout that confused testers): Yuri welcomes the visitor first-person (identify + value + next step), with the 4 quick-prompt buttons directly beneath — both visible without scrolling. The greeting is presentation copy only and never enters the server-bound history
- Labeled example exhibit below the fold-line: first exchange of one of two demo scripts (owner vs beginner, random A/B, GA4 `demo_variant` tracked) under an explicit "Example" divider — showcases the subscriber ceiling without impersonating a live chat
- High-contrast input with directive placeholder ("Type here to ask about your skin. Free, no signup.")
- Full SSE streaming with real-time responses
- After 12 lifetime free messages: conversion prompt to subscribe ($24.99/mo); after 8, an email is required to continue (lead capture gate)
- Min-height: 520px, max-height: 640px on desktop
- Component: `TryYuriSection` with `variant="hero"` prop

**Layer 2: Floating Yuri Bubble — REMOVED (not rendered).** A floating bottom-right bubble (`YuriBubble` component) was originally planned as always-present secondary access. **It was never wired into the layout and the orphaned component was deleted July 10 2026.** The hero widget (Layer 1) is the ONLY anonymous Yuri surface on the site — everything lands there, by design (the widget-as-hero decision above). Do not re-introduce a bubble without an explicit decision to change this; a July 10 2026 session wasted a fix "attributing bubble conversations" against this dead code precisely because this doc still described the bubble as live. If you're reading this and considering a bubble, it does not currently exist.

**Layer 3: Full Yuri Experience (Post-Signup)**
```
After account creation (paywall sits at the VALUE MOMENT — commit 68acafe, July 15 2026):
  -> Redirected straight to Yuri onboarding conversation (free — skin profile, preferences, concerns; capped at 50 user messages to bound Opus cost)
  -> On completion: /subscribe (payment gate, framed as continuation)
  -> Stripe Checkout ($24.99/mo Seoul Sister Pro)
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
5. After 8 free messages: email required to continue (the continue-gate — captures the lead
   and gives cross-device identity; the stashed question restores after the email lands)
6. After 12 lifetime free messages:
   -> Conversion prompt: "Subscribe — $24.99/mo"
   -> Highlights: unlimited conversations, skin profile memory, 6 specialists, routine builder
7. Visitor subscribes ($24.99/mo) -> Yuri onboarding conversation (Layer 3)
```

#### TryYuriSection Component Architecture
The `TryYuriSection` component (`src/components/widget/TryYuriSection.tsx`) supports two variants:
- `variant="hero"`: Renders as an embedded card (no section wrapper, no heading). Used in the homepage hero grid. Has chat header with "Live" badge.
- `variant="section"`: Renders with full-width section wrapper, heading, and subheading. Available for standalone use on other pages if needed.

Both variants share identical `chatContent` (demo conversation, live messages, input, error handling, streaming logic) to avoid code duplication. The variant only affects the outer container and header.

#### Widget Specifications
- **Conversation state visibility (v11.1.0/v11.2.0)**: every turn, the route injects a factual Conversation State block (visitor's message #, email-on-file) plus, when present, the feeder `source` ("this visitor arrived from a Seoul Sister guide — never deny it exists") — facts for Yuri's judgment, never triggers. All per-turn context lives in a second UNCACHED system block; the static `YURI_WIDGET_SYSTEM` sits alone in the `cache_control` block. **Do not append per-turn strings to the cached block** — that silently kills the prompt cache (the v11.1.0 regression, measured and fixed in v11.2.0).
- **History rehydration (v11.2.0)**: the client keeps history in React state but the session id in sessionStorage; when a session exists and the client sends empty history (same-tab navigation/reload), the route recovers the transcript from `ss_widget_messages` via `getSessionTranscript()` so Yuri doesn't greet a mid-conversation visitor as a stranger.
- **Preview messages (v11.9.0)**: 12 LIFETIME per visitor UUID (localStorage/cookie), with a 40-message/IP/30-day backstop that closes the device-switch quota reset (verified July 18: desktop→phone minted a fresh visitor row on the same ip_hash). Email continue-gate after 8 messages (server 429 `emailRequired`; client stashes the question, collects the email through the chat so the capture pipeline + Yuri's acknowledgment run naturally). Yuri SEES her preview usage in Conversation State — she must never claim the preview is unlimited (verified July 18 failure).
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
- Email required to continue after 8 messages (`emailRequired` 429 → client email card)
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

### Specialist Agents (Report to Yuri)

| Agent | Role | Examples |
|-------|------|----------|
| **Ingredient Analyst** | Deep ingredient science | "This retinol concentration is risky with your current BHA" |
| **Routine Architect** | Builds personalized routines | "Based on your oily T-zone + dry cheeks, here's your AM/PM routine" |
| **Authenticity Investigator** | Counterfeit detection | "This packaging has 3 red flags -- here's what to check" |
| **Trend Scout** | Tracks emerging Korean trends | "PDRN serums are trending in Seoul -- here's why they matter for your skin type" |
| **Budget Optimizer** | Finds best value | "Same key ingredients as Sulwhasoo for $12 instead of $94" |
| **Sensitivity Guardian** | Allergy/reaction prevention | "WARNING: This contains fragrance that triggered reactions in users with your profile" |

Each specialist has deep domain prompts (200-400 words), extracts intelligence after each conversation, and feeds patterns back to the learning engine.

## Silent Failure: "nothing wrong" vs "nothing checked" (LOAD-BEARING — added v11.18.0, July 30 2026)

**A result that looks clean because the check never ran is the most expensive bug class in this codebase.** v11.18.0 fixed eight defects in one day and every one was this shape. Before shipping anything on a safety, write, or context path, ask: *if this silently did nothing, would it look any different from success?*

- **Destructuring only `data` turns a failed query into an all-clear.** `ss_routine_products.product_id` is NULLABLE (custom steps), and PostgREST rejects a null inside an `.in()` on a uuid column with **22P02**. Three call sites ignored `error`, so the dead query read as an empty result and returned `{ safe: true, conflicts: [] }` — **one custom step disabled ingredient-conflict checking for the whole routine**, catalog products included, across all three of a subscriber's active routines. On any safety path, check `error` and make a failed check LOUD. Filtering nulls on one routine recovered 189 ingredient rows.
- **An AI claiming a write is not a write.** Yuri said *"Locked... all get removed"* without calling `save_routine`. The honesty rule enumerated READ verbs only, so nothing was violated. Write claims ("saved", "locked", "removed", "updated") require a tool that ran THIS turn and returned success; present-tense intent is honest, past-tense completion is a claim. A false write claim is worse than a false read claim — a wrong read is corrected next turn, but a user who believes their data was fixed stops checking it.
- **When the safe-looking action and the correct action diverge, the model picks safe and narrates correct.** Yuri stalled because revising a routine was documented only inside an error string that read as a threat. Fix the framing, not just the wording.
- **A guard test that asserts source text can pass against broken code.** Several did, while authenticated Yuri was down for every user with a product inventory. Where the defect is logic rather than wording, EXECUTE the real function on the shape that failed (transpile it if the module has DB imports at scope — `typescript` is already a dependency), then revert the bug verbatim and confirm the test fails. Also note `tsc` catches what a source-regex test cannot: one new test passed while its file did not compile.
- **Two parallel arrays joined by index is a defect waiting to happen.** Carry data with its rendered line so a desync is unrepresentable. An off-by-length read (`context.userProducts[i]` running off the end) is invisible to every string-matching test.
- **A type that lies hides every bug beneath it.** `RoutineProduct.product_id` was typed `string` while the live column was nullable — which is why all of the above typechecked cleanly. When a null bug appears, check `information_schema` against the TS type before anything else.
- **Sweeping ONE fabricated row does not find the next one.** The July 27 sweep targeted a specific product id; an LED-mask device matched to three unrelated catalog masks survived it untouched. Audit residue by SHAPE — e.g. *a catalog-linked routine step whose product is absent from the owning user's library* — never by product name.
- **Read-side filters do not stop writes.** The INCI pollution guard was applied on read for months while `matchOrCreateIngredient` kept creating junk rows. Guard the write too, and prefer a nullable return over a throw: making it nullable surfaced a second write path (`scripts/fast-link.ts`) that grep had missed.
- **`src/app/sitemap.ts` is a first-class safety surface.** It filtered ingredients on `is_active` and nothing else, publishing 15 unsplit INCI dumps as URLs we were actively asking crawlers to index. Citation is the moat; garbage URLs are the expensive version of a data bug.
- **Do not test against a real user's live account.** A reproduction probe on Bailey's account polluted her Yuri memory and made Yuri open a later answer with *"we started this exact breakdown last time"* — she read it as a scold and abandoned a complete, correct answer. Use a throwaway `ZZ TEMP` routine (`is_active: false`) and delete it.
- **Measure before fixing; three scopes here were wrong until queried.** A `NOT NULL` asserted twice from a code comment was actually nullable. A leak called "frozen since February" was still producing rows in July. A row reported as stale residue had actually been bought by the user. And a length threshold was the wrong instrument for junk INCI — `"Water, Talc"` is 11 characters.
- **Beware the over-correction.** Rejecting any ingredient name containing a comma would have destroyed 979 legitimate rows (`"Niacinamide (50,000ppm)"`); a comma signals a list only when followed by a LETTER and OUTSIDE any parenthetical. A run-together heuristic then flagged 4,898 rows including `"Hexapeptide-9"` and was discarded rather than tuned by feel. When a classifier needs repeated hand-tuning, that is the signal to stop, not to keep adjusting.
- **Verify the deployment, not the push.** A release sat unshipped after a Vercel webhook silently failed; `git ls-remote` confirmed the commit was on GitHub while no build existed. Check `vercel ls --prod` for a deployment newer than the commit.

## Diagnosing a User Report (LOAD-BEARING — added v11.16.0, July 30 2026)

**A user's words describe what they SEE. That is a symptom, not a diagnosis. Do not instrument the subsystem the words name until you have confirmed what is actually on their screen.**

Earned expensively. Bailey reported *"it logs me out every single time"* on the installed PWA. **Five rounds went at the session layer.** The cause was that the manifest's `start_url` is `/`, and `/` had no auth awareness, so it rendered the "Get Started / Talk to Yuri Free, no signup" marketing page to a paying subscriber on every launch. Her session was healthy the entire time. One screenshot — no browser chrome, logged-out page — broke it open after two days.

- **Get the screenshot first.** It cost five rounds to learn that "logged out" meant "shown the signup page," which is a routing bug two layers away from auth.
- **Check the LIVE surface, not last night's evidence.** An apex-vs-www origin finding was real when measured and stale by the time it was applied to her; a single `referer` query retired it. Twice I told Scott she needed to delete and re-add her icon. Her requests all carried `referer: https://www.seoulsister.com/` — she was already on the right origin, and one query would have shown that.
- **Ask what the DATA would look like under each hypothesis, then go look.** Sessions being *deleted* (rows vanishing) and sessions *accumulating* (rows piling up, never refreshed) are opposite fingerprints. Storage eviction is silent server-side and cannot produce a `POST /logout`. `paywall_reached_at` being NULL falsified a competing theory in one query.
- **Distrust a cause you cannot falsify.** "iOS is evicting her storage" is unprovable from a web page, which is exactly why it survived a round it should not have — and its central premise (that an explicit cookie `Max-Age` escapes Safari's 7-day cap) was **factually false**. Per WebKit ITP 2.1, `document.cookie` cookies are capped to 7 days; only HTTP `Set-Cookie` is exempt. **Verify external platform behaviour at the primary source; never recall it.**
- **A guard test that asserts source text can pass against the broken code.** Round 1's did exactly that. Execute the real code path, and prove each test **fails** when its bug is reintroduced by reverting the real code verbatim.
- **A fix that does not reach the affected user has not shipped.** `/_next/static/` is cache-first, so bump `CACHE_NAME` in `public/sw.js`. Then verify the fix is in the **served bundle** — this repo has shipped a "fix" that never reached the live chunks.
- **Shipping the guard does not retroactively clean what the bug already wrote.** When a validation/resolver fix lands, SWEEP for the rows it would now refuse. Bailey asked Yuri to save a routine step literally named *"Shower / cleanse"*; the loose resolver matched it to a real cleanser and wrote that `product_id` into her routine. Yuri warned her at save time — *"5 steps matched loosely"* — but **the warning was transient prose and the bad row was permanent**, so seven weeks later Yuri read her own routine back and planned a week around a product she has never owned. The identity floor that prevents this shipped ~7 weeks after the rows existed, and nothing swept them. Pattern to reuse: `scripts/fix-fabricated-routine-matches.ts` (blast-radius scan first, dry-run default, `--apply` to write, every update guarded on the row still holding the bad value so re-running is a no-op).

Related: `signOut()` in supabase-js defaults to `scope: 'global'`, which deletes every `auth.sessions` row for the user on **all** devices. Every call site must pass `{ scope: 'local' }`; a tree-wide guard test enforces it (`tests/signout-scope-local.test.mjs`). Two people testing the same account will otherwise log each other out, which is what made "works on my iPhone, breaks on hers" look like a per-device cause.

## Clinical Data Honesty (LOAD-BEARING — added v11.10.0, July 21 2026)

**Never default a clinical field. Never store a medical fact as an allergy.** Both rules were earned from real defects found in production.

**1. Unknown must render as unknown.** `finalizeOnboardingProfile` used to write `fitzpatrick_scale: extracted || 3`, `age_range || '25-30'`, `climate || 'temperate'`, and `memory.ts` printed them to Yuri as bare fact — a guessed Fitzpatrick III was indistinguishable from a stated one. A live user (`69f19b14`) was receiving advice against a skin type they never gave. Fitzpatrick drives retinoid strength, acid aggressiveness, PIH risk in deeper tones, and skin-cancer caution in fair ones, so a wrong guess is a clinically wrong answer delivered confidently — the v10.2.1 fake-confidence class with medical consequences.
- Clinical fields (`fitzpatrick_scale`, `age_range`, `climate`, `medical_history`, `sun_history`) are written ONLY when actually extracted. Unknown stays `NULL`.
- `fitzpatrick_source` (`'stated' | 'estimated' | NULL`) records provenance. Yuri sees `NOT ESTABLISHED — do not guess or state one` and asks instead.
- Preference fields (budget, experience level) may keep defaults — a wrong budget guess costs nothing.
- **`ss_onboarding_progress.skin_profile_data` is the provenance record of truth** — it stores what the extractor actually pulled. Join it before concluding whether a profile value was stated or defaulted.

**2. Allergies EXCLUDE an ingredient. Medical history REFRAMES the approach.** A subscriber's skin cancer history was stored in `allergies` because no other column existed; `memory.ts` injects allergies under "ALWAYS check for these before recommending any product," so Yuri read a cancer history as a contact allergen — something not to apply — instead of the standing fact that should make sun protection the treatment, add photosensitizer caution, and lower the referral threshold. `medical_history` now has its own context block explicitly framed *"these REFRAME your advice, they are not allergens."* Never conflate the two.

**3. Lesions are always a referral.** Before v11.10.0 the words *mole*, *lesion*, and *melanoma* appeared NOWHERE in any Yuri prompt; the referral rule named only "pain, spreading rashes, suspected infections." A changing, growing, asymmetric, bleeding, crusting, or new-and-unresolving spot is dermatologist territory on BOTH surfaces — said early, never answered with a product or a reassurance.

**4. Reason from population patterns, stay calibrated.** Ancestry, age, climate, sun history, and cycle phase are real clinical inputs and Yuri should use them directly without hedging. Two disciplines keep that rigorous: state confidence matching the evidence (a base rate is a starting point, not a verdict), and let the individual override the pattern. *"Melasma is more common with your background, so I'd protect pigment before I exfoliate"* is medicine; *"you're Korean so your skin is X"* is a stereotype in a lab coat.

## Shelf Visibility & the Western Shelf (LOAD-BEARING — v11.15.0, July 29 2026)

**Acquisition is Korean. Retention is the whole shelf.** Every public and acquisition surface stays 100% Korean — the catalog, `/best`, `/ingredients`, the blog, positioning. The 525 Bing citations/week exist *because* we are the one structured English source on Korean products. But once someone pays, Yuri's safety duty extends to every product they actually own, delivered by **private per-user data that is never indexed and never a catalog row**.

**The defect that earned this rule.** `ss_ingredient_conflicts` holds a HIGH-severity Retinol + Glycolic Acid rule. A subscriber running exactly that on a post-Accutane barrier got `{ safe: true, conflicts: [] }` — because both products were custom entries and `checkRoutineConflicts` joins `ss_product_ingredients` by `product_id`. **A clean result on a product whose ingredients are blank means nothing was checked, not that nothing is wrong.**

- **`check_ingredient_conflicts` accepts a raw `ingredient_names` array** with no catalog resolution (`tools.ts`). That is the ONLY custom-product-capable conflict path. `conflict-detector.ts` is catalog-only by construction (`ss_routine_products.product_id` is `NOT NULL REFERENCES ss_products(id)`) — don't rewrite it; use the tool path, which is where the safety judgment actually happens.
- **INCI on a custom entry requires provenance** (`ingredients_source`: `label_scan` | `web_lookup`, DB-enforced paired + enum). Same discipline as `fitzpatrick_source`: a value whose origin we can't name isn't a fact.
- **The variant trap is real.** Searching "Byoma toner" returns Brightening / Milky / Balancing — different actives. A near-miss INCI makes a safety check *look* done. Only record a list when the product name matches; otherwise ask for the label photo (the BACK of the bottle — a front-of-bottle photo has no INCI, which is how one subscriber's moisturizer stayed invisible).
- **Yuri sees her own coverage as a FACT, never a cap.** The visibility block blocks nothing and ends by handing the decision back. A guard test fails if it becomes a command — the widget give/gate failed twice by rewording a rule before v11.10.0 fixed it with a fact.

**Do NOT build a Western catalog.** Measured: cold widget traffic runs **~15:1 Korean-intent** (45 vs 3 across 226 messages / 54 visitors). Western ingredient lookup is free at INCI Decoder, SkinSort, Yuka. Two agents assigned opposite positions both converged here. **If a broader channel opens (Bailey's TikTok audience is not r/AsianBeauty), re-run that query before treating 15:1 as permanent.**

**Yuri may say "keep what you have."** CeraVe, Cetaphil, La Roche-Posay, Vanicream, Byoma, Naturium and Prequel are genuinely good (Cetaphil was reformulated — older criticism is stale). A Korean alternative is offered *only where it genuinely wins for THIS person*. A recommender that must always find a Korean swap is the algorithmic surface the Yuri Sole Authority Principle exists to prevent.

**The sunscreen exception (verified at Consumer Reports, Jul 10 2026).** Korean-brand sunscreens sold in US stores are **REFORMULATED** with FDA-approved filters and test substantially weaker than the Korean-market version: Beauty of Joseon SPF **36 vs 19**, Innisfree **48 vs 16**, Round Lab **46 vs 16**. "Buy it at Target" does NOT deliver the advantage. Three calibrations keep this honest: the documented advantage is **protection, not texture** (that panel found them greasy, white-casting, not lightweight — do not claim cosmetic elegance); the finding is **relative** (even Korean formulas came in under their SPF 50+ labels); and the gap is **narrowing** (FDA approved bemotrizinol June 2026, first new filter since 1999).

**Claims that must never be repeated:** the "KTRI 2022 / 68% of COSRX sunscreen failed SPF" statistic traces only to Alibaba-hosted SEO content — no primary source. Amazon **ended commingled inventory March 2026**, so that mechanism is stale. Counterfeit evidence is **failed protection** (a tested SPF 3.6 vs a claimed 45), never documented injury — there is none.

**Custom entries are not all "products we don't carry."** ~40% are devices and routine steps (ice roller, LED mask, "Shower / cleanse") that correctly have no catalog row. Any "invisible shelf" metric that counts them is lying to you. See `PHASE-2-RESULTS.md` for the decomposition.

**The resolver's all-terms strictness is correct.** A user-typed extra term ("Rice 70 **+ Ceramide** Glow Milky Toner" vs the catalog's "Rice 70 Glow Milky Toner") failing to match is the same conservatism that stops "Hero Mighty Patches" binding to Dr.ppae Honey Heel Patch. Do not loosen it.

## Location Capture — text is not coordinates (v11.14.0, July 29 2026)

**A stated location must be resolved to coordinates, and a coordinate you cannot verify must not be stored.**

Onboarding captured `location_text` and stopped. `latitude`/`longitude` were written by exactly one path — the browser-geolocation button on `/profile` — so both newest paying subscribers had a location on file and no coordinates, `get_current_weather` returned "Could not determine location," and every UV/humidity surface was dark. Yuri had told one of them that her city's humidity swing was half of why her skin seesaws, while unable to read the weather there.

- **One geocoder, shared.** `src/lib/geo/geocode.ts` is the single implementation, called by both `finalizeOnboardingProfile` and the `get_current_weather` tool. Two geocoders eventually disagree about where a user lives, and the profile row is what every weather surface reads. Do not add a second.
- **Verify, don't trust the top hit.** Query the first comma-segment, then check the result against the user's own qualifiers. The whole-string query returns NOTHING for "Seoul, Korea" and "London, UK" — the exact formats our extraction prompt asks Yuri to produce — and returns *Ness City, Kansas* for "Iowa".
- **Null beats a guess.** Wrong coordinates degrade INVISIBLY (Yuri confidently reads another state's weather); missing coordinates degrade visibly (Yuri asks). A bare region name is accepted only when the candidate actually sits in a region of that name. "Canada" alone stays unresolved on purpose.
- **Never downgrade precision.** Finalize can run more than once; a city centroid must never overwrite device-level coordinates from the `/profile` button (`IS NULL` guard).
- **Geocoding never gates onboarding.** It is best-effort, wrapped, and logged on failure — a slow API must not block a user from finishing.

`first_name` follows the same honesty posture: captured only when volunteered, **never inferred from an email address**, and injected as a fact with judgment guidance ("use it the way you'd use a friend's name") rather than a template slot — absent entirely when unknown.

## Cumulative-Give Instrument (widget — v11.10.0)

The preview's gate ("the complete build is subscriber work") is a **cumulative** boundary, but Yuri sees one turn at a time. In a real 14-message test she delivered the entire subscriber deliverable while no single reply crossed the line — she was asked to hold a boundary she had no instrument to measure. `src/lib/widget/cumulative-give.ts` reads her OWN already-sent replies and injects the running artifact count as a FACT.

**Do not turn it into a cap.** It blocks nothing, inspects no drafts, and ends by handing the decision back ("not a rule and not a cap"). A guard test fails if the fact is converted into a command. If the giveaway persists, the answer is better facts or a policy decision — **not** rewording the gate, which already names the artifacts explicitly and failed twice before for this reason. See `WIDGET-CUMULATIVE-GIVE-BLUEPRINT.md`.

## Yuri Sole Authority Principle (LOAD-BEARING ARCHITECTURE)

**This principle was earned through real lighthouse-user feedback. Read it before designing any feature that surfaces "what the user should do" with their skin.**

> **No non-Yuri surface in Seoul Sister generates personalized recommendations for the user. Every other surface is either (a) data display, (b) navigation, or (c) a Yuri-conversation entry point. Recommendation logic — what the user should DO with their skin — lives exclusively with Yuri because she has the full context (treatment phase, decision memory, corrections, routine, allergies, climate, cycle).**

### Why this principle exists

Bailey, Seoul Sister's lighthouse user and Scott's daughter, taught us this principle across five separate corrections:

1. **May 17 2026 (v10.5.2)**: Routine Intelligence widget recommended Arginine + Candelilla Wax + Stearalkonium Hectorite as "missing high-value ingredients" for combination skin. She screenshotted it to Yuri who diagnosed all three as garbage (pH buffer, thickener, clay viscosity agent). Bailey: *"I think we just get rid of the 'recommended' part all together. Whatever's recommended Yuri does it."* — Widget removed.

2. **May 17 2026 (same release)**: `ss_ingredient_effectiveness` bootstrap data scored fillers (water, glycols, waxes) as effective actors because the seed script measured frequency, not mechanism. 87 rows deleted. Yuri-mediated recommendations would have caught this; the algorithmic widget didn't.

3. **May 18 2026 (v10.6.2)**: Weather widget on dashboard recommended "Switch to a lighter gel moisturizer," "Skip face oils today," "Apply niacinamide toner to your T-zone" based on `humidity > 70%` + `skin_type = combination` lookup table. Zero awareness of Bailey's Phase 2 protocol (COSRX BHA on MWF, Goodal Vita C in AM, barrier-protective Illiyoon at night) or her current corrections. Bailey: *"Are they recommended by Yuri or generic based on location alone. I think all recommendations should be from Yuri at this point. Would just get confusing and would be misleading if not communicating with Yuri."*

4. **May 20 2026 (v10.7.1)**: Glass Skin Score Recommendations panel rendered PHA toner + niacinamide serum + vitamin C ampoule + humectant essence as standard advice for Bailey, who was on Day 23 of Phase 2 with COSRX BHA already 3x/week, niacinamide already in 5 products, vitamin C already on board via Goodal, and glycolic explicitly rejected from a past Yuri conversation. Yuri herself tore the panel apart point-by-point in chat (*"That's acid 6-7 days a week on cheeks we just rebuilt in Phase 1. Hard no."*). Bailey: *"This kinda stuff that's not Yuri I think we need to get rid of."* — Recommendations panel killed on both main results surface and historic-history accordion. Replaced with single Ask-Yuri CTA. (v10.6.2 had explicitly deferred this fix; Bailey caught what was punted.)

5. **May 20 2026 (v10.7.1 proactive sweep)**: Dashboard "Yuri's Insights" widget rendered algorithmic product recommendations from `/api/learning/recommendations` under a heading that literally said "Yuri's Insights" with a Lightbulb icon. Pure `ss_product_effectiveness` skin-type sort, no Yuri reasoning. Empty state copy actively claimed Yuri authorship: *"Yuri is learning."* Found and killed in a proactive sweep BEFORE Bailey reached it. Widget file deleted, section removed from dashboard.

6. **May 26 2026 (v10.8.9)**: "Routine Intelligence" widget on the routine page rendered a seasonal "SPRING TIP" — *"Switch to lightweight gel or water-based formulas... Emphasize: Niacinamide for sebum control, Green tea extract for antioxidants, Hyaluronic acid in lightweight serums"* — keyed only on `season + climate` via a `ss_learning_patterns` lookup, zero phase awareness. Bailey, on Phase 2 with niacinamide already in 5 products and Yuri on a "stay the course" protocol, screenshotted it: *"We were going to get rid of the tips cause it's not Yuri and she always disagrees."* The same prescription also lived on the dashboard as a "Spring Skincare Tip" with `+ niacinamide` emphasize chips. **Both survived the v10.5.2 kill (which only removed the missing-ingredients widget from the same component) and the v10.6.2 kill (which removed the weather widget's prescriptions but didn't sweep for the season-based variant elsewhere).** Killed the seasonal-tip blocks on both surfaces; kept the observational data (concern effectiveness bars, "Your Top Ingredients" list). The lesson: when killing one algorithmic recommender, grep the whole codebase for the data source it pulls from (`fetchSeasonalLearning`, `texture_advice`, `ingredients_to_emphasize`) — the same prescription often renders in more than one place, and a partial kill leaves the survivor for Bailey to find.

7. **May 26 2026 (v10.8.16, found PROACTIVELY — first one Bailey did NOT have to catch)**: a systematic sweep of Bailey's surfaces found the v10.8.9 seasonal recommender STILL LIVE on two surfaces the v10.8.9/v10.8.10 sweeps missed — Scan results (`ScanResults.tsx`) and Product Detail enrichment (`ProductEnrichment.tsx`), both rendering the `SeasonalContext` component (`EnrichmentSections.tsx`) fed by `fetchSeasonalContext()` in `enrich-scan.ts` — the exact same phase-blind `season + climate` → `ss_learning_patterns` lookup producing "switch to lightweight gel" + "Consider reducing this season" ingredient chips. The v10.8.9 changelog had even written the grep-the-whole-tree lesson, but the prescription's render path on these two surfaces used a DIFFERENT component (`SeasonalContext`) and a DIFFERENT fetcher (`fetchSeasonalContext` in enrich-scan, not `fetchSeasonalLearning`), so a name-based grep missed it. Removed the component + both render sites + the fetcher + the type. This is the seventh instance and the FIRST caught before Bailey saw it — the proactive sweep working as intended.

Each instance is the same structural failure: a non-Yuri surface generates recommendations using an algorithm that doesn't know what Yuri knows. Bailey trusts Yuri. She doesn't trust the algorithm. And she's right — Yuri has 17+ conversations of context on her, the phase she's in, the corrections she's made; the algorithm has skin type and a humidity reading.

**Proactive sweep discipline** (added v10.7.1, sharpened v10.8.9, validated v10.8.16): Each release that touches recommendation surfaces should include a sweep step — search the codebase for headings containing "Yuri's", lists labeled "Recommendations" / "Tips" / "Suggested", and any rule engine of the shape `if skin_type X && condition Y then "use Z"`. The seven incidents above prove that algorithmic recommenders sneak in at the seam between "this feels personalized" and "this is actually personalized." **And they cluster: the same prescription data source often feeds multiple surfaces, so killing one is not enough.** v10.8.16's lesson sharpens this further: a NAME-based grep is insufficient because the same prescription can render through differently-named components/fetchers (`SeasonalContext` + `fetchSeasonalContext` vs `fetchSeasonalLearning` + `texture_advice`). Grep by the underlying DATA SOURCE (`ss_learning_patterns` + `pattern_type='seasonal'`, `ingredients_to_emphasize`, `ingredients_to_reduce`, `texture_advice`) AND by prescriptive UI language ("switch to", "consider reducing", "emphasize", "good for this season"). The most reliable sweep is a periodic proactive pass across the actual user surfaces (Library, Routine, Dashboard, Scan, Product Detail, Glass Skin, Sunscreen, Trending) — v10.8.16 did exactly this and caught #7 before Bailey. Find them before Bailey does.

### How to apply this principle when building a new feature

Before shipping a surface that recommends anything, ask:

| Test | Pass | Fail |
|------|------|------|
| Does this surface tell the user what to DO? | Route through Yuri | Don't render the recommendation; route through Yuri |
| Does this surface label algorithmic output as "Yuri's" or imply Yuri authorship? | Rename honestly ("Best for [skin_type] skin") | Rename now |
| Does this surface display data (weather, prices, trends, scores)? | Ship — that's fine | Not applicable |
| Does this surface offer a CTA into Yuri with context prefilled? | Ship — that's the pattern | Not applicable |

### Acceptable surface patterns

- **Data display**: Weather conditions (26°C, 83% humidity, UV 2.1). Glass Skin Score numerical values. Trend rankings. Price comparisons.
- **Honest discovery**: Product browse sorted by ingredient effectiveness for skin type — labeled as "best matches for your skin type," NOT "Yuri's picks." Sunscreen filters that auto-populate from profile. Dupe finder showing ingredient overlap.
- **Yuri-conversation entry points**: "Ask Yuri how this weather affects your Phase 2 routine →" with `?ask=` prefill. CTAs that route to /yuri with context, never standalone recommendations.

### Unacceptable patterns (anti-patterns)

- ❌ Hardcoded `if humidity > 70% then "use BHA"` rule engines presented as recommendations
- ❌ Static recommendation lists pulled from a JSON lookup table
- ❌ Any UI element labeled "Yuri's [thing]" when Yuri's reasoning isn't actually involved
- ❌ Cycle phase / weather / Glass Skin output that says "do X" without phase-awareness and decision_memory awareness
- ❌ Bootstrap data shipped into `ss_ingredient_effectiveness` or `ss_learning_patterns` without expert validation — even one bad row poisons Yuri's effectiveness reads

### The interlock with vibetrendai/principles.md

This principle is the Seoul Sister specialization of **Principle 2 — AI-First Reasoning** from `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md`. The global principle says "trust model intelligence, give models freedom and context, not rigid templates and brittle rules." The Seoul Sister specialization says "in this app specifically, the model is Yuri, and EVERY recommendation surface routes through her — not parallel rule engines."

### For future AI sessions

If you're opening this repo and you see a recommendation surface that doesn't go through Yuri, that's tech debt — flag it. If you're adding a new feature, default to "Yuri makes the recommendations; this page just surfaces the data or offers a CTA." If you find yourself writing `const ADJUSTMENT_RULES: ...` or `if skin_type === 'oily' && humidity > 70 then "use BHA"`, stop and ask whether Yuri should be doing this instead.

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| AI Model (Primary) | Claude Opus 4.8 | All user-facing: Yuri, scanning, analysis -- NO FALLBACKS |
| AI Model (Background) | Claude Sonnet 4.5 | Data extraction, learning aggregation, translations |
| AI Model (Vision) | Claude Opus 4.8 | Label scanning, counterfeit detection, skin analysis |
| Framework | Next.js 15 (App Router) | PWA-configured, TypeScript strict |
| Database | Supabase PostgreSQL | RLS, real-time subscriptions |
| Styling | Tailwind CSS 4 | Korean-inspired design system |
| Auth | Supabase Auth | Email + social login |
| Payments | Stripe | Subscriptions only (no product commerce) |
| Hosting | Vercel | Edge functions, automatic SSL |
| Distribution | PWA | No App Store dependency, Stripe at 2.9% vs Apple 30% |
| Analytics | Google Analytics 4 | Measurement ID: G-L3VXSLT781 |
| Analytics | Vercel Analytics | Automatic page views + Web Vitals |
| Analytics | Vercel SpeedInsights | Core Web Vitals monitoring (LCP, FID, CLS) |

### Analytics & Tracking

All analytics are configured in `src/app/layout.tsx`:

| Tool | Implementation | Purpose |
|------|---------------|---------|
| **Google Analytics 4** | `<Script>` with `afterInteractive` strategy | User behavior, traffic sources, conversions |
| **Vercel Analytics** | `<Analytics />` component | Automatic page views, Web Vitals |
| **Vercel SpeedInsights** | `<SpeedInsights />` component | Core Web Vitals (LCP, FID, CLS) |
| **JSON-LD** | `dangerouslySetInnerHTML` in `<body>` | Organization schema + SearchAction for Google sitelinks |

**GA4 Measurement ID**: `G-L3VXSLT781`

**Structured Data**: Organization schema with `SearchAction` targeting `/products?search={query}` for Google sitelinks search box. Additional JSON-LD on blog posts (Article, BreadcrumbList) and product pages (Product, AggregateRating).

### PWA Architecture (Critical Decision)

Seoul Sister is a **Progressive Web App**, not a native iOS/Android app.

**Why PWA over App Store:**
- Apple takes 30% of subscriptions ($4.50/user/month at $14.99). Stripe takes 2.9% ($0.73). Difference: $3.77/user/month.
- At 5,000 subscribers, Apple takes $22,620/year more than Stripe
- PWA has full camera access (for scanning), push notifications (iOS 16.4+), home screen install, offline caching
- Instant deployment -- no 1-7 day App Store review delays
- Users discover skincare apps via TikTok/Instagram, not App Store browsing

**PWA Requirements:**
- `manifest.json` with app icons, theme color, display: standalone
- Service worker for offline caching of product database
- "Add to Home Screen" prompt after 2nd visit
- Full-screen mode (no browser chrome)
- Camera API access for label scanning

## Core Architecture

### Database Tables (prefixed `ss_`)

All tables use Row Level Security (RLS) for user isolation.

#### Products & Ingredients
```
ss_products                 - K-beauty product database (target: 10,000+)
ss_product_ingredients      - Ingredient breakdown per product (ordered)
ss_ingredients              - Master ingredient database with Korean translations
ss_ingredient_conflicts     - Known ingredient interaction warnings
ss_product_prices           - Price tracking across retailers (historical)
ss_retailers                - Retailer directory with trust scores
ss_counterfeit_markers      - Known counterfeit indicators per brand
ss_counterfeit_reports      - User-submitted counterfeit reports
```

#### Users & Profiles
```
ss_user_profiles            - Extended skin profile (first_name, type, concerns, allergies, climate, location_text + latitude/longitude/timezone, medical_history, sun_history, fitzpatrick_scale + fitzpatrick_source)
                              NOTE: surrogate `id` PK + separate `user_id` FK. ALWAYS join on user_id — a Jul 29 audit
                              joined on `id` and wrongly concluded all 37 users were missing profiles.
ss_user_routines            - Personalized routines (AM/PM, skin cycling schedule)
ss_routine_products         - Products in each routine (ordered, with timing/frequency)
ss_user_scans               - Scan history (label scans, product lookups)
ss_user_wishlists           - Wishlist with price alert preferences
ss_user_product_reactions   - "This broke me out" / "Holy grail" tracking
```

#### Community & Reviews
```
ss_reviews                  - Community reviews with skin-type metadata
ss_review_helpfulness       - Upvote/downvote tracking
ss_trending_products        - Trend detection (TikTok, Reddit, Korean market)
```

#### Yuri AI System
```
ss_yuri_conversations       - AI advisor conversations (type: onboarding, general, specialist)
ss_yuri_messages            - Individual messages (with image_urls for vision)
ss_specialist_insights      - Intelligence extracted from specialist conversations
ss_onboarding_progress      - Tracks which profile fields Yuri has captured during onboarding
ss_widget_conversations     - Anonymous pre-signup landing page widget conversations (legacy — replaced by Phase 14 tables)
ss_widget_visitors          - Persistent anonymous visitor identity with AI memory, lifetime stats, captured lead email + recap send/delivery status (recap_status: sent|delivered|bounced|... — see LEAD-EMAIL-OBSERVABILITY.md)
ss_widget_sessions          - Per-conversation session tracking (specialist domains, intent signals, message counts)
ss_widget_messages          - Full message storage with tool call JSONB logging
ss_widget_intent_signals    - Consumer intent signal detection (15 signals across 4 categories)
```

#### Intelligence & Learning
```
ss_learning_patterns        - Cross-user learning (anonymized)
ss_ingredient_effectiveness - Ingredient effectiveness by skin type (learned)
ss_product_effectiveness    - Product ratings aggregated by skin profile
ss_trend_signals            - Korean market trend detection data
ss_content_posts            - Blog/trend content for AI discoverability
```

#### Commerce (Subscriptions Only)
```
ss_subscriptions            - Stripe subscription records
ss_affiliate_clicks         - Affiliate link tracking (no product sales)
```

### Directory Structure

```
seoul-sister/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with PWA meta
│   │   ├── page.tsx                    # Landing page
│   │   ├── manifest.ts                # PWA manifest
│   │   ├── sw.ts                      # Service worker
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                      # Authenticated app routes
│   │   │   ├── dashboard/page.tsx      # Main dashboard
│   │   │   ├── scan/page.tsx           # Label scanner (camera)
│   │   │   ├── products/page.tsx       # Product browser
│   │   │   ├── products/[id]/page.tsx  # Product detail
│   │   │   ├── routine/page.tsx        # My routine builder
│   │   │   ├── yuri/page.tsx           # Yuri AI advisor
│   │   │   ├── onboarding/page.tsx    # Yuri conversational onboarding
│   │   │   ├── community/page.tsx      # Reviews & discovery
│   │   │   ├── trending/page.tsx       # Trending in Korea
│   │   │   ├── profile/page.tsx        # Skin profile settings
│   │   │   └── settings/page.tsx       # Account settings
│   │   └── api/
│   │       ├── auth/                   # Authentication endpoints
│   │       ├── products/               # Product CRUD + search
│   │       ├── scan/                   # Label scanning (Claude Vision)
│   │       ├── ingredients/            # Ingredient analysis
│   │       ├── routine/                # Routine builder
│   │       ├── yuri/                   # Yuri conversation API
│   │       ├── yuri/onboarding/       # Yuri onboarding extraction
│   │       ├── widget/                # Landing page widget (anonymous Yuri)
│   │       ├── reviews/                # Community reviews
│   │       ├── counterfeit/            # Counterfeit detection
│   │       ├── trending/               # Trend data
│   │       ├── prices/                 # Price comparison
│   │       ├── learning/               # Learning engine
│   │       ├── stripe/                 # Subscription management
│   │       └── cron/                   # Scheduled jobs
│   ├── components/
│   │   ├── ui/                         # Base UI components
│   │   ├── scan/                       # Camera scanning + enriched results display
│   │   ├── products/                   # Product display components
│   │   ├── routine/                    # Routine builder components
│   │   ├── yuri/                       # Yuri chat interface
│   │   ├── onboarding/                # Yuri onboarding conversation UI
│   │   ├── widget/                    # Landing page Yuri widget
│   │   ├── community/                  # Review components
│   │   └── layout/                     # Navigation, headers, footers
│   ├── lib/
│   │   ├── supabase.ts                 # Database client
│   │   ├── anthropic.ts                # Claude API client
│   │   ├── stripe.ts                   # Stripe client
│   │   ├── auth.ts                     # Auth utilities
│   │   ├── yuri/                       # Yuri AI system
│   │   │   ├── advisor.ts              # Main Yuri advisor logic
│   │   │   ├── specialists.ts          # Specialist agent definitions
│   │   │   ├── memory.ts               # Cross-session memory
│   │   │   ├── actions.ts              # Action execution
│   │   │   ├── onboarding.ts          # Onboarding conversation logic + extraction
│   │   │   └── widget.ts              # Landing page widget logic (anonymous)
│   │   ├── scanning/                   # Label scanning pipeline
│   │   │   ├── enrich-scan.ts          # Post-scan enrichment (personalization, pricing, community, counterfeit, trending)
│   │   │   ├── label-decoder.ts        # Korean label translation
│   │   │   ├── ingredient-parser.ts    # INCI extraction
│   │   │   └── counterfeit-check.ts    # Authenticity analysis
│   │   ├── intelligence/               # Product intelligence
│   │   │   ├── routine-builder.ts      # AI routine generation
│   │   │   ├── conflict-detector.ts    # Ingredient conflict detection
│   │   │   └── trend-analyzer.ts       # Korean trend analysis
│   │   ├── learning/                   # Learning engine
│   │   │   ├── pattern-detector.ts     # Cross-user pattern detection
│   │   │   ├── effectiveness.ts        # Product effectiveness tracking
│   │   │   └── aggregator.ts           # Learning data aggregation
│   │   └── utils/                      # Shared utilities
│   │       ├── rate-limiter.ts
│   │       ├── validation.ts
│   │       └── error-handler.ts
│   ├── hooks/                          # React hooks
│   │   ├── useAuth.ts
│   │   ├── useProducts.ts
│   │   ├── useYuri.ts
│   │   ├── useRoutine.ts
│   │   └── useScan.ts
│   └── types/                          # TypeScript types
│       ├── database.ts
│       ├── products.ts
│       ├── yuri.ts
│       └── routines.ts
├── public/
│   ├── icons/                          # PWA icons (multiple sizes)
│   ├── images/                         # Static images
│   └── fonts/                          # Custom fonts
├── scripts/
│   ├── migrations/                     # Database migrations (ordered)
│   └── seed/                           # Seed data (products, ingredients)
├── CLAUDE.md                           # This file
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json
```

## 6 Killer Features (Priority Order)

### Feature 1: Korean Label Decoder (Camera-based)
- Point phone camera at Korean product label
- Claude Vision reads Korean text, extracts ingredients
- Instant: full INCI translation, safety scoring, function explanation per ingredient
- **Post-scan enrichment pipeline** (5 parallel database queries after AI analysis):
  - **Your Skin Match**: Personalized warnings based on user's skin type, allergies, and concerns. Flags comedogenic ingredients for oily skin, irritants for sensitive skin, highlights beneficial ingredients for user's profile
  - **Price Comparison**: Retailer prices sorted lowest-first, best deal with savings %, authorized retailer badges, direct buy links
  - **Community Intelligence**: Overall rating + skin-type-specific rating, Holy Grail/Broke Out counts, repurchase %, effectiveness score with sample size
  - **Authenticity Check**: Brand-specific counterfeit markers to inspect, verified retailer list, counterfeit report count
  - **Trend Context**: Trending status, trend score, source, sentiment, active trend signals
- Conflict warnings against user's current routine
- Action buttons: Add to Routine, Price Alert, Ask Yuri, Full Details
- Client-side image compression (canvas resize to 1500px max, JPEG 80%) for mobile reliability
- 60s function timeout for Claude Vision API calls
- **Free tier**: 3 scans/month. **Pro tier**: Unlimited.

**Architecture**: The scan enrichment (`lib/scanning/enrich-scan.ts`) runs all 5 data fetchers in parallel via `Promise.all` after the Claude Vision response. Each enrichment section is non-critical — if a query fails, the scan still returns successfully with the AI analysis. The enrichment sections only render when data exists, so unknown products gracefully degrade to AI-only results. This is what separates Seoul Sister from raw AI: personalized, database-backed intelligence layered on top of vision analysis.

### Feature 2: AI Routine Builder (Ingredient-Conflict-Aware)
- Input: skin type, concerns, current products, budget, climate
- Output: personalized K-beauty routine with exact layering order
- AM/PM timing, frequency (daily, 2x week, weekly)
- Skin cycling schedule generation
- Flags ingredient conflicts before they happen
- Adapts by season, hormonal cycle
- Powered by Routine Architect specialist agent

### Feature 3: Counterfeit Detection Assistant
- Photo-based packaging comparison (Claude Vision)
- Aggregated database of known counterfeit markers per brand
- Seller reputation scoring for marketplace purchases
- Verified retailer directory with trust scores
- User-submitted counterfeit reports (crowdsourced intelligence)
- Powered by Authenticity Investigator specialist agent

### Feature 4: Product Intelligence Database
- Target: 10,000+ K-beauty products with full English translations
- Complete ingredient lists (Korean + INCI + plain English)
- Cross-platform price comparison (Korea vs US retailers)
- Community reviews filterable by skin type, age, concern, Fitzpatrick scale
- "People like me" discovery engine
- Effectiveness ratings from learning engine

### Feature 5: TikTok Moment Capture
- "I just saw this on TikTok" -- search or scan the product
- Instant: ingredient analysis, skin-type match score, authentic purchase links
- Price comparison across verified retailers
- Converts viral impulse into informed purchasing
- Trend Scout specialist agent tracks what's going viral

### Feature 6: Community with Skin-Type Filtering
- Reviews filterable by Fitzpatrick scale, skin type, age, concern
- Points for reviews, redeemable for featured placement
- "Holy Grail" and "Broke Me Out" quick reactions
- Structured version of what r/AsianBeauty does organically
- Feeds directly into learning engine

## Cron Jobs (Automated Intelligence Pipeline)

### Implemented Cron Jobs (20 active in vercel.json, 1 disabled)

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `seo-guardian` | Weekly Sunday 10 AM UTC | v11.11.0 — SEO Guardian Phase 1 (report-only). Pulls 28-day Google Search Console query+page data (zero-dep service-account client, `src/lib/seo/gsc-client.ts`), deterministic aggregation prepares FACTS (striking-distance list is "a convenience, not a boundary" — the AI may bet on anything in the data), then an **Opus 4.8** strategist writes the weekly report + 2-5 dated BETS (falsifiable expected outcomes, graded later against real GSC data — Learning Loop). Stored in `ss_seo_reports`, emailed to `GUARDIAN_ALERT_EMAIL`. Runs `not_configured` (soft) until the GSC service account exists — see `SEO-GUARDIAN-SETUP.md`. Content bets execute via LGAAS (`LGAAS-WORK-ORDER-SEO-GUARDIAN.md`). Phase 3 grader not yet built. |
| `grade-nudge-outcomes` | Weekly Sunday 8 AM UTC | v10.11.0 — The MEASURED teacher for the nudge learning loop. For each acted-but-ungraded nudge, checks whether the user's Glass Skin Score moved in the ≥14 days after she acted — gated hard on attribution + confounders (acted-only, phase-consistent, photo-quality-confidence ≥0.85, ±4-point noise band) and ABSTAINS (`insufficient_data`) rather than fabricate a verdict when data is sparse. Pure deterministic measurement, no AI. Writes `outcome_grade`/delta/score-ids/notes onto `ss_user_nudges`. The graded helped-rate per nudge_type feeds back into `pickNudgeOpportunity` (suppresses clearly-underperforming types). Backs `src/lib/intelligence/nudge-outcome-grader.ts`. See `NUDGE-OUTCOME-TEACHER-BLUEPRINT.md`. |
| `proactive-nudge` | Daily 3 PM UTC | v10.10.0 — Proactive nudge engine. Per active subscriber, computes the single best well-timed nudge opportunity (open loop ≥5d stale, treatment-phase/routine mismatch, cycle-timed actives loop in a follicular/ovulatory window, or glass-skin cadence ≥14d) via `src/lib/intelligence/nudge-eligibility.ts` (pure, no AI). Timezone-gated (only queues 9am–8pm local), capped (MAX_NUDGES=3, SPACING_DAYS=3), no-guilt escalation ladder. Generates the Yuri-voiced message with **Opus 4.8** (user-facing — Principle 1; deliberately NOT Sonnet) and writes to `ss_user_nudges` (status pending). Dashboard surfaces it via `/api/me/nudge` + `YuriNudgeCard`. Routes to Yuri via prefilled `?ask=` (Yuri Sole Authority Principle — nudge invites, doesn't recommend). See `PROACTIVE-NUDGE-BLUEPRINT.md`. |
| `rollup-durable-memory` | Weekly Sunday 7 AM UTC | v10.10.0 — Consolidates every user's `decision_memory.corrections[]` (which the Yuri context loader only reads from the 3 most recent conversations) into the durable per-user store `ss_user_memory.durable_corrections` so corrections never age out. Pure DB, no AI. Per-user failure isolation. LGAAS Blueprint 79 pattern. Backs `src/lib/yuri/durable-memory.ts`. |
| `audit-memory-health` | Weekly Sunday 7:30 AM UTC | v10.10.0 — Memory observability tripwire. Detects + LOGS (to `ss_pipeline_runs.metadata` + `console.warn`) conditions that would otherwise stay invisible: conversations with ≥6 messages but empty `decision_memory` (extraction silently failed — the v10.3.4 class), open loops unresolved >30 days, durable-store staleness. Writes nothing to memory. The observability LGAAS lacked before its May-19 extraction-truncation gap went unnoticed for a week. |
| `seasonal-adjustments` | Monthly 1st 3 AM UTC | Generate seasonal skincare recommendations for 5 climate zones (Sonnet) |
| `retry-enrichment-queue` | Monthly 1st 4:30 AM UTC | Retry stub-enrichment for products in `ss_enrichment_review_queue` due for retry. Currently a placeholder pending pipeline-helper refactor — first real retry due June 6 2026. |
| `image-health` | Daily 4:15 AM UTC | Detect & repair blank product images. Reachability-checks non-Olive-Young image URLs (the drift-prone minority), re-points dead/null ones to the product's own Olive Young image from `ss_product_staging` (strict matcher, wrong-product discipline). Keyset cursor walks the catalog across runs and wraps continuously, so newly-dead URLs are re-detected. LOGS unfixable products (no staging match → need live scrape) to `ss_pipeline_runs.metadata.unfixable_sample` + `console.warn` — makes the otherwise-silent dead-URL bug VISIBLE. Backs `src/lib/pipeline/image-health.ts`. See `PRODUCT-IMAGE-HEALTH.md`. |
| `data-quality` | Weekly Sunday 4 AM UTC | Comprehensive DB health audit: coverage, staleness, gaps, health score 0-100 |
| `aggregate-learning` | Daily 5 AM UTC | Extract patterns from reviews + Yuri conversations via Sonnet |
| `update-effectiveness` | Daily 5:30 AM UTC | Recalculate ingredient/product effectiveness from review data |
| `scan-korean-products` | Daily 6 AM UTC | Incremental Olive Young scrape (11 categories, Playwright) |
| `scan-korean-bestsellers` | Daily 6:30 AM UTC | Olive Young Global bestseller rankings (real Korean sales data) |
| `backfill-trending` | Daily 6:45 AM UTC | Backfill trending product data from external sources |
| `translate-and-index` | Daily 7 AM UTC | Sonnet extraction: categorize, describe, normalize pending products |
| `link-ingredients` | Daily 7:30 AM UTC | Parse INCI strings, match/create ingredients, link to products. **Also auto-promotes products to `is_verified=true`** when they meet hardened criteria (≥8 ingredient links, has price, has INCI raw, category != not_skincare). Prevents the May 5 P1 verified-flag gap from re-opening. |
| `scan-trends` | Daily 8 AM UTC | Detect trending products from review/reaction spikes |
| `scan-reddit-mentions` | Daily 8:30 AM UTC | Reddit K-beauty mention scanning (6 subreddits, sentiment analysis) |
| `calculate-gap-scores` | Daily 9 AM UTC | Korea-vs-US trend gap detection (emerging products intelligence) |
| `refresh-prices` | Daily 6 AM UTC | Soko Glam price scraping (Shopify JSON API, 150 products/run, 300s Pro budget), history snapshots, drop detection |
| `refresh-prices-yesstyle` | Daily 6 PM UTC | YesStyle price scraping (Playwright, 80 products/run, 300s Pro budget), history snapshots, drop detection |
| `generate-content` | Daily 10 AM UTC | Auto-generate SEO trend articles targeting AI discoverability (Opus) — **disabled in vercel.json** (route exists but not scheduled) |

**Pipeline daily chain**: `scan-korean-products` (6 AM) scrapes new Olive Young listings → `scan-korean-bestsellers` (6:30 AM) captures Korean sales rankings → `translate-and-index` (7 AM) runs Sonnet extraction on pending products → `link-ingredients` (7:30 AM) links ingredients → `scan-trends` (8 AM) detects trending products from activity spikes → `scan-reddit-mentions` (8:30 AM) scans English K-beauty communities → `calculate-gap-scores` (9 AM) cross-references Korean rankings vs US mentions.

**Price freshness**: Two dedicated price crons run daily with the full Vercel Pro 300s budget — `refresh-prices` (6 AM UTC, Soko Glam via Shopify JSON API, ~150 products/run) and `refresh-prices-yesstyle` (6 PM UTC, YesStyle via Playwright, ~80 products/run). Combined: ~230 products/day, full catalog cycle in ~25 days. Both snapshot all prices to `ss_price_history` and flag >10% price drops as trend signals. Amazon and StyleKorean remain CLI-only (CAPTCHA/AJAX issues).

### Future Cron Jobs (Not Yet Implemented)

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `scan-counterfeits` | Daily 3 AM UTC | Monitor counterfeit sources, update risk signals |
| `community-digest` | Daily 9 AM UTC | Aggregate top reviews, generate "trending today" |
| `ingredient-safety-updates` | Weekly Sunday 2 AM UTC | Cross-reference regulatory changes (Korea/US/EU FDA) |

## Learning Engine (The Moat)

Every user interaction teaches the system:

### What Gets Learned
- **Scan data**: Which products users are interested in (demand signals)
- **Routine adjustments**: What changes people make (what the AI got wrong)
- **Product reactions**: "Holy Grail" vs "Broke Me Out" by skin type
- **Review patterns**: What ingredients correlate with positive outcomes for which skin types
- **Counterfeit reports**: New markers, new sellers, new patterns
- **Seasonal patterns**: How routines change by climate and time of year

### Learning Layers (Same as LGAAS)
1. **Individual User**: Patterns specific to one user's skin
2. **Skin Type Cohort**: Patterns across users with similar skin profiles
3. **Ingredient Level**: Universal ingredient effectiveness data
4. **Temporal**: How ingredient trends and effectiveness change over time

### The Flywheel
```
More users scanning products
    -> More ingredient data + reactions
        -> Better AI recommendations
            -> More users trusting the platform
                -> More reviews and scans
                    -> Even better intelligence
```

After 10,000 users, no competitor can replicate the dataset. After 100,000 users, Seoul Sister has the most valuable K-beauty intelligence dataset outside of Korea.

## Pricing Model

### Single Tier — Seoul Sister Pro ($24.99/mo)

Seoul Sister is a paid-only platform. There is no free tier. Visitors get 20 free preview messages with Yuri on the landing page hero widget to experience the AI's quality before subscribing.

**The $24.99 price + Yuri-as-orchestrator architecture** (set June 22 2026) is the canonical pricing/positioning decision — see CHANGELOG for the full cost/market/elasticity research. Short version: the true cost to serve a typical sub is **~$1.50–2.75/mo** (grounded in real usage — the heaviest human user peaks at ~$2/mo in Claude tokens; light/bursty usage, near-zero scans). Seoul Sister's true competitive shelf is **teledermatology/Rx-skincare subscriptions** (Curology $19.95, Honeydew $25, Nurx $15–30) — a 24/7 conversational advisor with memory and specialist reasoning, NOT the freemium "scan-build-track" app shelf. $24.99 sits dead-center on that shelf, holds ~90% margin, filters out churn-prone tire-kickers (vs a $9.99 impulse tier), and the documented elasticity curve makes anything ≥$35 net *less* revenue. The single source of truth for the price is **`src/lib/pricing.ts`** (`PRICING` constant) — never hardcode the dollar amount; every UI/prompt/email string derives from it. Changing it is a one-line edit there PLUS a new Stripe Price + `STRIPE_PRICE_PRO_MONTHLY` env update (display price and charged price must not drift).

**Yuri is the single orchestrating star.** The standalone feature pages (Scan, Sunscreen, Glass Skin, Shelf Scan, Dupes) are demoted from front-door nav to surfaces Yuri drives — usage data showed essentially everyone lives in Yuri chat (scans=0, wishlists=0 across all users historically). The Sunscreen Finder and Dupe Finder are now **Yuri tools** (`find_sunscreen_match`, `find_product_dupes`) backed by shared cores in `src/lib/intelligence/{sunscreen-finder,dupe-finder}.ts` (the API routes call the same cores — DRY). They return DATA; Yuri owns the recommendation (Yuri Sole Authority). The nav (`Header.tsx`/`BottomNav.tsx`) leads with Yuri; the demoted pages live under a "More" menu, still reachable. Folding the remaining image features (scan/glass-skin/shelf-scan) into in-chat photo tools is DEFERRED until real users ask (they require in-chat image-upload UI and wrap features with zero current usage).

**Registration Flow** (paywall at the value moment — commit 68acafe, July 15 2026): Register → Yuri onboarding (free, capped at 50 user messages) → Stripe Checkout ($24.99/mo, framed as continuation) → Full app access (no email verification). AppShell gates all paid surfaces behind `plan != 'free'`; `/api/yuri/chat` checks `hasActiveSubscription` server-side — the free window is onboarding only.

**What Subscribers Get**:
- Unlimited AI label scanning (Claude Opus 4.8 Vision)
- Full Yuri advisor conversations (all 6 specialist agents)
- 8 database-backed tools (product search, price comparison, trending, conflicts, personalization, web search, weather)
- Personalized routine builder with conflict detection
- Counterfeit detection and authenticity analysis
- Price comparison across 6 retailers with drop alerts
- Glass Skin Score photo tracking
- Shelf Scan collection analysis
- Weather-adaptive routine alerts
- Hormonal cycle routine adjustments
- Cross-session memory and personalization
- Proactive intelligence notifications

**What Anonymous Visitors Get** (landing page hero widget):
- 12 lifetime preview messages with Yuri (per-visitor UUID + 40/IP/30-day backstop; email required after 8)
- 6 database tools (search products, compare prices, trending, weather, ingredient guide, counterfeit markers)
- Her #1-priority diagnosis solved fully — the complete routine build is subscriber work (v11.9.0 give/gate line)
- No account required

### Unit Economics (Pro at $24.99)
> NOTE (June 22 2026): the table below is the ORIGINAL conservative estimate that assumed daily scanning. Real usage data shows the true blended cost is **lower** for a typical sub (~$1.50–2.75/mo all-in) — light/bursty Yuri use, near-zero scans (so vision cost ≈ $0), prompt caching active. A heavy daily power-user could reach ~$5–8/mo; even then $24.99 holds ~70%+ margin. Stripe's fixed $0.30/txn is the dominant variable cost at this price. Margin at $24.99 typical: ~90%.

| Item | Cost |
|------|------|
| Claude Opus 4.8 API (scans, Yuri, analysis) | ~$1.40/mo avg |
| Claude Vision (scanning, counterfeit, Opus 4.8) | ~$0.50/mo avg |
| Supabase (storage, queries, auth) | ~$0.50/mo |
| Vercel (hosting, functions) | ~$0.25/mo |
| Stripe processing (2.9% + $0.30) | ~$1.02/mo (at $24.99) |
| **Total variable cost (conservative)** | **~$3.67/mo** |
| **Margin per Pro user (conservative)** | **~$21.32/mo (85%)** |

Using the realer cost (~$1.50–2.75 all-in for a typical sub), margin at $24.99 is **~$22–23/mo (~90%)**.

### Secondary Revenue: Affiliate Commissions
- 5-15% on purchases through affiliate links to Olive Young, Soko Glam, YesStyle, Amazon
- Average K-beauty order: $30-60
- Expected: $0.50-2.00/user/month supplemental
- This is bonus revenue, not the business model

## Design System

### Brand Identity
- **Primary Palette**: Clean whites + soft pinks + glass-inspired translucent effects
- **Accent**: Korean-inspired rose gold (#D4A574) + glass blue (#A8D8EA)
- **Typography**: Inter (body) + Poppins (display) -- clean, modern, Gen Z
- **Design Philosophy**: "Glass skin" aesthetic -- translucent, luminous, clean
- **Mobile-First**: Every component designed for 390px (iPhone) first, scales up

### Design Principles
- Feels like a Korean beauty app, not a Western tech product
- Soft, luminous UI reflecting "glass skin" aesthetic
- Card-based layouts for product and ingredient information
- Camera-first UX for scanning features
- Generous whitespace, no visual clutter
- Dark mode support (Korean beauty apps trend toward light, but respect user preference)

## AI Model Usage

- **Claude Opus 4.8** (`claude-opus-4-8`): ALL user-facing interactions -- NO FALLBACKS
  - Yuri conversations
  - Label scanning and translation
  - Ingredient analysis
  - Routine building
  - Counterfeit detection
  - Skin analysis from photos
  - Content generation
- **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`): Background processing only
  - Product data extraction and translation (cron jobs)
  - Learning pattern aggregation
  - Review summarization
  - Trend signal processing

## Development Guidelines

### MANDATORY: Best Practices Always Apply

Every line of code, every database schema, every API endpoint MUST follow industry best practices. This is NON-NEGOTIABLE.

### Core Rules
1. Always look for existing code to iterate on instead of creating new code
2. Prefer simple solutions (but never sacrifice best practices)
3. Avoid duplication -- check for similar code elsewhere first
4. TypeScript strict mode everywhere -- no `any` types
5. Only make changes that are requested or clearly related to the task
6. Keep files under 200-300 lines -- refactor at that point
7. Never mock data for dev or prod -- only for tests
8. Never overwrite .env files without asking first
9. Always implement proper error handling and logging
10. Handle loading, error, and empty states for all data fetching

### Code Style
- TypeScript strict mode (no `any`, no `as` casts without justification)
- React Server Components by default, Client Components only when needed
- Async/await for all async operations
- Zod for runtime validation on all API inputs
- Error responses include `error` field
- Success responses include `success: true` or meaningful data

### API Design
- Next.js App Router API routes
- RESTful with proper HTTP status codes
- JWT authentication on all protected endpoints
- Rate limiting on public endpoints
- Input validation with Zod on every endpoint

### Database Conventions
- All tables prefixed with `ss_`
- Use JSONB for flexible data
- Enable RLS on all user-specific tables
- Use `user_id` foreign key for user isolation
- Proper indexes on all foreign keys and commonly queried columns
- Never create duplicate data models for the same concept

## Security Requirements

### Authentication & Authorization
- Supabase Auth with JWT tokens
- RLS on all user-data tables
- Service role key for server-side operations only
- Never expose service role key to frontend

### Data Protection
- Learning data completely anonymized (no PII in patterns)
- Rate limiting on all endpoints
- Input validation and sanitization via Zod
- XSS protection via Next.js defaults + CSP headers
- CORS properly configured

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
ANTHROPIC_API_KEY=your_anthropic_key
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key
```

## Trust Signal Progression

Track user engagement through the trust funnel:

```
Browser -> Scanner -> Reviewer -> Subscriber -> Purchaser -> Advocate
```

| Level | Trigger | Unlock |
|-------|---------|--------|
| **Browser** | Visits site | Product browsing, basic info |
| **Scanner** | First label scan | Full ingredient translation |
| **Reviewer** | First review submitted | Community points, "early reviewer" badge |
| **Subscriber** | Pro subscription | Full Yuri, unlimited scans, routine builder |
| **Purchaser** | Clicks affiliate link | "Verified buyer" review badge |
| **Advocate** | Refers 3+ friends | Beta features, brand sampling access |

## AI Discoverability (From LGAAS)

Seoul Sister must rank when someone asks ChatGPT/Perplexity: "What's the best Korean moisturizer for oily skin?"

- JSON-LD @graph on all product pages (Product, AggregateRating, FAQPage, BreadcrumbList)
- Article schema on all trend content
- SpeakableSpecification for voice assistant citation
- Dynamic robots.txt allowing GPTBot, Claude-Web, PerplexityBot
- Dynamic sitemap.xml for all product, ingredient, best-of, and content pages (~14K URLs)
- llms.txt with product database summary, best-of category links, ingredient encyclopedia links
- Blog pipeline auto-generates K-beauty trend content from data (`generate-content` cron, daily 10 AM UTC)
- **Ingredient Encyclopedia** (`/ingredients`, `/ingredients/[slug]`): 8,200+ active ingredient pages with JSON-LD (Article, FAQPage, BreadcrumbList), effectiveness by skin type, known interactions, products containing each ingredient
- **Best-of Category Pages** (`/best`, `/best/[category]`): 12 category landing pages with JSON-LD (CollectionPage, ItemList with top 20 products, FAQPage, BreadcrumbList), targeting "best Korean [category]" queries

## Development Phases

### Phase 1: Foundation (COMPLETE)
- [x] Clean rebuild: remove all legacy code from previous version
- [x] PWA configuration (manifest, service worker, icons)
- [x] Database schema (all `ss_` tables with RLS)
- [x] Supabase Auth integration
- [x] Basic product database with seed data (55 products, 30 ingredients, 6 retailers)
- [x] Landing page with glass skin design system
- [x] Skin profile wizard (to be replaced by Yuri onboarding in Phase 3B)

### Phase 2: Product Intelligence (COMPLETE)
- [x] Product search API with filters, pagination, sorting
- [x] Product detail API with joined ingredients, prices, review summary
- [x] Ingredient search/list API with function, safety, active filters
- [x] Korean Label Scanner API (Claude Opus 4.7 Vision, base64 image analysis)
- [x] Price comparison API across 6 retailers with best deal, savings %
- [x] 130 product-ingredient links, 35 retailer price records
- [x] ProductCard, ProductFilters, IngredientList, PriceComparison components
- [x] Full product browse, product detail (tabbed), and scan pages

### Phase 3: Yuri AI Advisor (COMPLETE)
- [x] Yuri conversation system (SSE streaming via Claude Opus 4.7)
- [x] 6 specialist agents with deep domain prompts (200-400 words each)
- [x] Keyword-based specialist routing
- [x] Cross-session memory (skin profile, past conversations, product reactions)
- [x] Action execution (add to routine, wishlist, log reactions, search, check conflicts)
- [x] Auto-generated conversation titles (Sonnet 4.5)
- [x] Full chat UI with specialist picker, conversation history sidebar

### Phase 3B: Yuri Conversational Onboarding (COMPLETE)
- [x] ss_onboarding_progress table with completion tracking
- [x] onboarding_completed flag on ss_user_profiles
- [x] conversation_type column on ss_yuri_conversations (general, onboarding, specialist)
- [x] Required fields tracking (skin_type, skin_concerns, age_range)
- [x] completion_percentage with 0-100 range validation
- [x] RLS policies for user data isolation
- [x] Auto-update trigger on updated_at

### Phase 4: Community & Discovery (COMPLETE)
- [x] Review system with skin-type, Fitzpatrick scale, age range filtering
- [x] "Holy Grail" / "Broke Me Out" reaction badges
- [x] Upvote/downvote with community points
- [x] Trending products feed (TikTok/Reddit/Instagram/Korean market sources)
- [x] TikTok Moment Capture ("Just saw this on TikTok" instant product match)
- [x] Points system: 4-tier leveling (Newcomer -> Skin Scholar -> Glow Getter -> K-Beauty Expert)
- [x] 6 new components, 3 pages built/replaced, migration with seed data

### Phase 5: Counterfeit Detection & Safety (COMPLETE)
- [x] ss_batch_code_verifications table (batch code lookup)
- [x] ss_safety_alerts table with severity/category/ingredient targeting
- [x] ss_user_dismissed_alerts table (user can dismiss alerts)
- [x] ss_counterfeit_scans table (scan history tracking)
- [x] Extended ss_counterfeit_reports with additional fields
- [x] Extended ss_retailers with trust verification data
- [x] 20 counterfeit markers seeded (COSRX, Sulwhasoo, Laneige, Dr. Jart+, generic)
- [x] Retailer verification data seeded (Olive Young, Soko Glam authorized; Amazon medium risk)
- [x] 3 safety alerts seeded
- [x] RLS policies on all new tables

### Phase 6: Learning Engine & Automation (COMPLETE)
- [x] Enhanced ss_learning_patterns with concern_filter and pattern_description
- [x] Enhanced ss_ingredient_effectiveness with positive/negative/neutral report counts
- [x] ss_routine_outcomes table (track routine results over time, 1-5 scoring, before/after photos)
- [x] ss_price_history table (historical price tracking by product/retailer/currency)
- [x] Enhanced ss_trend_signals with trend_name, trend_type, status (emerging/growing/peak/declining)
- [x] learning_contributed flag on ss_reviews and ss_yuri_conversations
- [x] RLS policies on routine_outcomes and price_history
- [x] Indexes on skin_type, pattern_type, recorded_at, trend_status
- [x] Triggers for updated_at on ingredient_effectiveness and learning_patterns

### Phase 7: Subscriptions & Monetization (COMPLETE)
- [x] ss_subscriptions table (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
- [x] ss_subscription_events table (webhook audit log with stripe_event_id)
- [x] ss_affiliate_clicks table (product_id, retailer_id, affiliate_url tracking)
- [x] Plan column on ss_user_profiles (free, pro_monthly, pro_annual, student)
- [x] Indexes on user_id, stripe_customer, status, stripe_event
- [x] RLS policies on all subscription/affiliate tables
- [x] Updated_at trigger on ss_subscriptions
- [x] Service role manages subscriptions (webhook access)
- [x] Users can read own subscription and affiliate click data

### Phase 8: Value Enrichment Features (COMPLETE — All 11 features built)
- [x] Feature 8.1: Product Detail Page Enrichment (enrichment API endpoint, shared EnrichmentSections components)
- [x] Feature 8.2: Routine Builder Intelligence (routine CRUD API, conflict detection, layering order, AI generation)
- [x] Feature 8.3: K-Beauty Dupe Finder (ingredient overlap algorithm, AI dupes, dupe page + API)
- [x] Feature 8.4: Ingredient Include/Exclude Search (products API extension, IngredientPicker component)
- [x] Feature 8.5: Expiration/PAO Tracking (tracking page, PAO API, dashboard widget)
- [x] Feature 8.6: Reformulation Tracker (formulation change detection, alert system, version history)
- [x] Feature 8.7: Sunscreen Finder (K-beauty filters: PA rating, white cast, finish, under-makeup)
- [x] Feature 8.8: Hormonal Cycle Routine Adjustments (cycle tracking, phase-aware routine suggestions)
- [x] Feature 8.9: Glass Skin Score Photo Tracking (Claude Vision, radar chart, progress timeline, share card)
- [x] Feature 8.10: Weather-Adaptive Routine Alerts (Open-Meteo API, weather-to-skincare mapping)
- [x] Feature 8.11: Shelf Scan Collection Analysis (multi-product Vision identification, routine grade)

### Phase 9: Automated Product Intelligence Pipeline (COMPLETE)
- [x] Feature 9.1: Olive Young Global Scraper (5,656 listings scraped)
- [x] Feature 9.2: Sonnet AI Extraction & Normalization (5,530 products extracted, $49.15 Sonnet cost)
- [x] Feature 9.3: Ingredient Auto-Linking Pipeline (14,400+ ingredients, 207,000+ links)
- [x] Feature 9.4: Multi-Retailer Price Integration (YesStyle, Soko Glam, Amazon, StyleKorean)
- [x] Feature 9.5: Daily Automation Cron Jobs + Admin Dashboard (9 cron jobs configured)
- [x] Feature 9.6: Initial Import Execution (6,200+ products, 550+ brands, $55.97 total pipeline cost)

### Phase 10: Real-Time Trend Intelligence (COMPLETE)
- [x] Feature 10.1: Olive Young Bestseller Scraper (daily Korean sales rankings via Playwright, 3-tier product matching, non-skincare filtering)
- [x] Feature 10.2: Reddit K-Beauty Mention Scanner (OAuth 2.0, 6 subreddits incl. r/koreanskincare, sentiment analysis, brand alias mapping)
- [x] Feature 10.3: Trend Gap Detector & UI Updates ("Emerging from Korea" tab, gap_score calculation, fabricated seed data deleted)
- [x] 3 new cron jobs: scan-korean-bestsellers (6:30 AM), scan-reddit-mentions (8:30 AM), calculate-gap-scores (9:00 AM)
- [x] Migration: ss_trending_products restructured (12 new columns), ss_trend_data_sources tracking table

### Phase 11: Yuri Intelligence Upgrades (COMPLETE)
- [x] Feature 11.1: Product Database Tools (6 tools via Claude tool use / function calling)
- [x] Feature 11.2: Web Search Integration (Brave Search API, 7th tool)
- [x] Feature 11.3: Location Capture in Onboarding (location_text column, backfill)
- [x] Feature 11.4: Learning Engine Bootstrap (47 effectiveness rows, 20 seasonal patterns, 8 trends)

### Phase 12: Platform-Wide Intelligence Upgrade (COMPLETE)
- [x] Feature 12.0: Shared Intelligence Context Helper (`src/lib/intelligence/context.ts` — centralized `loadIntelligenceContext()`)
- [x] Feature 12.1: Widget Intelligence (4 tools for anonymous landing page widget: search, prices, trending, weather)
- [x] Feature 12.2: Scan Intelligence Layer (learning engine queries replace hardcoded ingredient arrays)
- [x] Feature 12.3: Glass Skin Score Personalization (user profile + effectiveness injected into Vision prompt)
- [x] Feature 12.4: Shelf Scan Personalization (allergens, skin type, concerns injected into collection analysis)
- [x] Feature 12.5: Sunscreen Climate + UV Intelligence (auto-populated filters, real-time UV index, effectiveness ranking)
- [x] Feature 12.6: Products Discovery Intelligence (`sort_by=recommended` with personalized match scoring)
- [x] Feature 12.7: Trending Relevance ("For You" tab with skin-type-filtered trends, cohort labels)
- [x] Feature 12.8: Dupe Effectiveness Scoring (ingredient effectiveness weighting, user context in AI dupes)
- [x] Feature 12.9: Weather Learning-Driven Adjustments (learning patterns supplement hardcoded rules)
- [x] Feature 12.10: Routine Effectiveness Intelligence (combined effectiveness score from ingredient data)
- [x] Feature 12.11: Dashboard Intelligence Widgets ("Your Top Ingredients" + "Seasonal Tip" widgets)
- [x] Feature 12.12: Community Cohort Intelligence (effectiveness data per review, skin-type cohort analysis)

### Phase 13: AI Conversation Engine Hardening (COMPLETE)
- [x] Feature 13.1: Prompt Caching (cache_control ephemeral on system prompt, last assistant message, tool definitions — 20-30% token cost reduction)
- [x] Feature 13.2: API Retry Logic (callAnthropicWithRetry with exponential backoff, retryable status codes 529/503/502)
- [x] Feature 13.3: Decision Memory (structured JSON extraction of decisions/preferences/commitments, topic-keyed merging across sessions)
- [x] Feature 13.4: Intent-Based Context Loading (classifyIntent per message, conditional loading of routine/reactions/learning/specialist data)
- [x] Feature 13.5: Onboarding Quality Scoring (field specificity scoring, vague answer detection, natural follow-up suggestions)
- [x] Feature 13.6: Voice Quality Post-Processing (cleanYuriResponse regex post-processor, AI-ism removal)

### Phase 14: Widget Conversation Intelligence (COMPLETE)
- [x] Feature 14.1: Widget Database Schema (4 tables: ss_widget_visitors, ss_widget_sessions, ss_widget_messages, ss_widget_intent_signals)
- [x] Feature 14.2: Widget Chat Route Rewrite (message storage, tool logging, cross-session AI memory via Sonnet)
- [x] Feature 14.3: Specialist Preview System (conversion FOMO via specialist name-dropping)
- [x] Feature 14.4: Intent Signal Detection (15 consumer skincare signals across 4 categories)
- [x] Feature 14.5: Admin Widget Dashboard (conversation viewer, intent analytics, conversion funnel at /admin/widget)

### Remaining Work

**Future Work** (when traffic/revenue justifies)
- [ ] **Push Notifications** — Requires service worker push events, web-push library, subscription management
- [ ] **Remaining Cron Jobs** — scan-counterfeits, community-digest
- [ ] **Supabase Attack Protection** — Captcha on auth endpoints (requires captcha widget), leaked password protection (requires custom SMTP). Enable when traffic justifies it.

**Product Image Health** (see `PRODUCT-IMAGE-HEALTH.md` for the full system-of-record — pipeline, three blank-image causes, wrong-product discipline, reusable audit/backfill tooling). State after v10.8.13 catalog-wide backfill (May 26 2026): 5,417 products on reliable Olive Young CDN images, 153 on drift-prone brand-direct URLs (some dead), 354 null. New products auto-capture images via the daily `scan-korean-products` cron (verified working), so the problem is NOT growing — it's the legacy Feb-2026 cohort + URL drift. Remaining work, priority order:
- [x] **Image-health cron** — DONE v10.8.15 (May 26 2026). `/api/cron/image-health` daily 4:15 AM UTC, backed by `src/lib/pipeline/image-health.ts`. Reachability-checks non-OY URLs, re-points dead/null to own Olive Young image from staging (strict matcher), keyset cursor sweeps the catalog continuously, logs unfixable products to `ss_pipeline_runs.metadata` + `console.warn`. Verified dry-run against live DB: correctly detects dead+null, finds 0 fixable now (v10.8.13 backfill already swept staging-matchable products) — its forward value is catching NEWLY-dead URLs before users see them.
- [ ] **Live-scrape backfill for ~507 no-staging-match blank products** (~1 day). Extend `OliveYoungScraper` with search-by-name (Playwright — OY search is JS-rendered), confidence-gate the match per the wrong-product discipline, write OY images. Closes the "all products eventually have photos" promise for real catalog products.
- [ ] **Live Olive Young price refresher + daily cron** (~1 day, deferred from v10.8.19 B). Currently 4,917 Olive Young price records have only 2 distinct `last_checked` dates (Feb 17 + April 7) — no live refresher exists; the daily `refresh-prices` cron only handles Soko Glam, and `refresh-prices-yesstyle` only YesStyle. Build a Playwright-based scraper that hits the 4,908 valid `prdtNo=GA...` URLs and refreshes `price_usd` + `last_checked`. 5-10s per page → multi-day rolling refresh (similar to image-health cron's keyset-cursor sweep pattern). Until built, Yuri's price-staleness honesty rule covers the UX. v10.8.19 cleared the 25 fake-URL price records that 404'd, so the visible-bug surface is fixed; this is the deeper data-freshness fix.
- [ ] **Custom-entry relink sweep** (~few hours). Find real products mis-saved as custom entries (NULL product_id) across all users; relink EXACT matches only (restores images AND catalog enrichment/pricing). Strict matching per `scripts/relink-bailey-custom-entries.ts`.
- [ ] **(Optional) image reliability tier column** on `ss_products` so `/browse` ordering + health checks don't re-derive reliability from the hostname each run.

**Cron Pipeline Improvements** (deferred — system is healthy, these are efficiency/UX upgrades not bug fixes)
- [ ] **Olive Young price refresh frequency boost** (~1-2 hours of work). Current state per Apr 26 2026 audit: 4,917 Olive Young price records, 0 fresh in last 7 days, 4,908 fresh in last 30 days. Daily `refresh-prices` cron uses 150 products/day batch size, which means full catalog cycles every ~33 days. Increase batch size to 400-500/day so full cycle completes in ~10 days. Trade-off: more Vercel function time per run — must be tested carefully against the 60s cron timeout. Trigger condition: when Yuri starts citing Olive Young prices that turn out to be wrong, OR when user feedback specifically mentions stale Olive Young pricing.
- [ ] **Price staleness UX warning** (~30 min of work). When `compare_prices` tool returns a price with `last_checked > 14 days ago`, append "(price last verified X days ago)" to the response. Same honesty pattern as v10.2.1 tool-call honesty rule. Trigger condition: when traffic grows to the point where stale price citations become a noticeable share of conversations.
- [ ] **Trend signal generation at scale** (no work needed yet — this is monitoring). `ss_trend_signals` table currently has 8 rows from Feb 23. The `scan-trends` cron runs daily but produces 0 signals because Seoul Sister has ~2 active users — there's no community activity to detect trends from. Working as designed for current scale. Re-audit when monthly active users exceed 100 — at that point the cron should start producing signals. If it doesn't, investigate the detection thresholds in `src/lib/learning/trends.ts`.

**Cron Pipeline Health** (verified Apr 26 2026, NOTE: superseded by May 5 2026 audit below — cron health has degraded since)
- All 14 crons in `vercel.json` are running on schedule. Most recent successful runs visible in `ss_pipeline_runs` and via downstream table writes (`ss_price_history` showed 14,001 snapshots in the last 7 days across 6 retailers).
- Pricing pipeline writing to `ss_price_history` daily for Soko Glam, YesStyle, Stylevana, Amazon, iHerb. Olive Young also writing daily but on a slow rolling cycle.
- Reddit + Olive Young bestseller scrapers actively populating `ss_trending_products` (670 Reddit + 76 Olive Young entries, 126+45 updated last 7 days).
- Aggregate-learning + update-effectiveness writing to `ss_ingredient_effectiveness` daily.

---

### Database & Pipeline Health Audit — May 5 2026 (post-Bailey diagnostic)

Captured at the end of a 7-release session focused on Bailey's account. Surfaced multiple silent regressions that the Apr 26 audit didn't catch because they happened *after* that audit. **Do these in priority order when next session opens.**

**Database snapshot (May 5 2026):**
- Products: 5,901 (588 verified — only 10%)
- Brands: 569
- Ingredient links: 209,230 across 5,204 products (~88% linked)
- Ingredients master: 14,468
- Price records: 5,047 across 6 retailers
- Trending: 411 Reddit rows + 82 Olive Young bestsellers, both fresh in last 7 days
- Ingredient effectiveness: 143 rows total

**P0 — Olive Young scrapers silently broken**
- **Olive Young product scraper has been zero-result for 2+ weeks**. Apr 22-30 returned 96 products/run all duplicates (no NEW products); May 1-4 returns 0 products. Either Olive Young changed their HTML structure, hit rate-limit/CAPTCHA, or the scraper script is silently failing. Pipeline fires, looks "completed" in `ss_pipeline_runs`, but produces nothing. **This is a v10.3.4-class silent failure** — the v10.3.5 fire-and-forget logging audit did NOT cover scraper success-with-zero-results paths.
- **Olive Young price scraping stopped Apr 7** (~28 days stale). 4,917 Olive Young price rows, ZERO fresh in last 7 days. Soko Glam (Shopify API) and YesStyle (Playwright) ARE still updating, so the working-scraper paths function. Olive Young is the largest pricing source — when Yuri quotes Olive Young prices via `compare_prices`, she's quoting month-old data. K-beauty prices fluctuate monthly.
- **Action**: 30-60 min investigation of `src/lib/pipeline/sources/olive-young.ts` and `olive-young-bestsellers.ts`. Check what response Olive Young is actually returning. Look for HTML structure changes, IP blocks, or selector-mismatch silent failures. Add `console.error('[olive-young scrape] expected products, got 0')` so future regressions surface in Vercel logs.

**P1 — Verification rate suppressing search visibility — ✅ RESOLVED (verified Jun 22 2026)**
- ~~Only 588 of 5,901 products have `is_verified = true`...~~ **STALE (May 5 figure). The auto-promotion below HAS SINCE BEEN RUN.** Live DB Jun 22 2026: **5,311 of 5,946 products verified (~89%)** — the catalog is discoverable, not 90%-invisible. Of the 635 still-unverified, only 153 are complete-with-price / 557 complete-without — the genuine long tail (missing price or INCI); do NOT force-promote (thin records hurt AI-citation quality). Daily `translate-and-index`/`link-ingredients` crons enrich the tail at $0 marginal cost. See `SEOUL-SISTER-GEO-AUDIT.md` for the full GEO context.
- Historical action (already executed): `UPDATE ss_products SET is_verified = true WHERE name_en IS NOT NULL AND brand_en IS NOT NULL AND category IS NOT NULL AND ingredients_raw IS NOT NULL AND id IN (SELECT product_id FROM ss_product_prices)`. No further action needed — kept here as the record of what fixed it.

**P2 — Combination skin effectiveness data is sparse**
- `ss_ingredient_effectiveness` skin-type distribution: dry 85 rows, sensitive 31, oily 12, **combination 9**, normal 6.
- Bailey is combination. The "Missing high-value ingredients" widget rotates the same 5 ingredients (HA / Tranexamic / Retinol / Salicylic Acid / Snail Mucin) because that's effectively all the combination-skin data available. Once those are excluded by phase filter or already in routine, the widget runs out.
- Phase 11.4 originally bootstrapped this; combination got under-seeded.
- **Action**: Run a research-backed seed script adding 30-40 combination-skin effectiveness rows covering more concerns (sebum control, pore visibility, T-zone shine, combination dehydration). Estimated cost ~$1 in Sonnet. Pattern is already in `scripts/seed-learning-data.ts` (Phase 11.4 reference).

**P3 — `not_skincare` cleanup**
- 18 products tagged `category = 'not_skincare'` (8 with ingredients_raw). Either contamination from the Olive Young scraper or correctly-classified makeup/hair/body. Quick query to inspect, then delete or recategorize.
- **Action**: 10 min. Query: `SELECT id, name_en, brand_en, description_en FROM ss_products WHERE category = 'not_skincare' ORDER BY created_at`. Manually classify and either recategorize or delete.

**P4 — Stale price retailers (Amazon, Stylevana, iHerb)**
- Amazon: 10 rows, all from Feb 17 seed, never updated.
- Stylevana: 4 rows, same.
- iHerb: 1 row, same.
- These retailers never had working scrapers. Either build them, mark them as "unsupported retailer" in the price-quoting logic, or remove the rows so Yuri stops citing 3-month-old prices.
- **Action**: Lower priority. Either build scrapers (~half-day per retailer) or delete the rows and remove from `ss_retailers` allowlist.

**Cross-cutting observation: scraper-zero-result is its own bug class.**
The Olive Young silent failure (P0) is structurally the same shape as the v10.3.4 decision memory crash — fire-and-forget with success-on-empty masking real failures. The v10.3.5 logging audit added `console.error` to fire-and-forget catches but did NOT add "expected non-zero, got zero" alerts. Worth adding a generic pattern: any scraper job that returns 0 rows when historical baseline is >0 should log a warning. ~2 hours of work, prevents another 2-week silent regression.


## Phase Build Specifications (8–15) — Archived

The detailed step-by-step build specifications for Phases 8 through 15 (Value Enrichment, Automated Product Pipeline, Real-Time Trend Intelligence, Yuri Intelligence Upgrades, Platform-Wide Intelligence, AI Conversation Engine Hardening, Widget Conversation Intelligence, LGAAS Memory Architecture Port) have been moved to **`PHASES-ARCHIVE.md`** (repo root) to keep this file focused on current architecture. **All those features shipped** — the `## Development Phases` checklist above is the current-state summary. Read `PHASES-ARCHIVE.md` when you need the original implementation detail for one of those features (exact files, schemas, prompts, rationale). Dated version history is in `CHANGELOG.md`.

---


## Competitive Landscape

### Why Seoul Sister Wins

| Gap | Current State | Seoul Sister Solution |
|-----|--------------|----------------------|
| Hwahae is display-only in English | **Hwahae Global launched an English site Nov 12 2024** (8.8M LLM-translated reviews, ~360K products, category rankings) and passed **100K+ MAU within two months, ~80% United States**. The "no English equivalent exists" premise this project was founded on is STALE — do not repeat it. What is still true: it is a **ranking-and-review display surface**, free, with no conversational advisor, no memory of you, and no one to tell you your barrier is stripped | Advice, not display: an advisor that knows your shelf, your history and what burned you |
| $362M counterfeit losses | Fragmented per-brand apps | Unified AI counterfeit detection |
| Ingredient conflict anxiety | Generic tools (INCI Decoder) | K-beauty-specific AI routine builder |
| Price markup opacity | No K-beauty price comparison | Cross-platform Korea vs US pricing |
| Discovery fatigue | TikTok, influencers (unstructured) | Skin-type-matched discovery with real reviews |
| Routine overwhelm | No personalized K-beauty routines | AI routine builder with conflict detection |

### Defensible Moat
1. **Data depth**: 10,000+ translated products with ingredient analysis -- hard to replicate
2. **Language moat**: Beauty-domain-specific Korean translation, not generic Google Translate
3. **Authenticity signals**: Crowdsourced counterfeit intelligence grows with every user
4. **Learning engine**: Cross-user skin effectiveness data improves every recommendation
5. **Community**: Structured reviews with skin-type filtering -- Reddit r/AsianBeauty with a product database
6. **AI discoverability**: First to rank for K-beauty queries in ChatGPT/Perplexity

## Relationship to LGAAS

Seoul Sister is a completely separate application with its own:
- Git repository
- Supabase project
- Vercel deployment
- Domain and branding

It inherits proven architectural patterns from LGAAS:
- Learning engine architecture (cross-user pattern detection)
- Specialist agent system (deep domain AI agents with intelligence extraction)
- Trust signal progression
- Content intelligence pipeline
- AI discoverability optimization (JSON-LD, llms.txt, sitemaps)
- Proactive intelligence alerts
- Cron job infrastructure
- Human Voice Agent (for generated content)
- Conversational onboarding (AriaStar pattern adapted for consumer onboarding)
- SSE streaming widget architecture (adapted for Yuri landing page widget)

### When Seoul Sister Subscribes to LGAAS

Seoul Sister will subscribe to LGAAS for marketing automation, but with a clear separation of responsibilities:

| Responsibility | Handled By | Details |
|---------------|-----------|---------|
| Reddit K-beauty discovery | LGAAS | Scans r/AsianBeauty, r/SkincareAddiction, r/KoreanBeauty |
| Blog content generation | LGAAS | SEO articles about K-beauty trends, ingredients, routines |
| Social content | LGAAS | TikTok, Instagram, Threads strategy |
| Email sequences | LGAAS | Nurture campaigns, re-engagement |
| Competitive intelligence | LGAAS | Tracking Hwahae, Glowpick, competitor apps |
| Marketing learning engine | LGAAS | What content drives signups |
| **Landing page + widget** | **Seoul Sister (Yuri)** | NOT replaced by AriaStar |
| **Visitor conversion** | **Seoul Sister (Yuri)** | Yuri widget handles on-site conversion |
| **Product experience** | **Seoul Sister (Yuri)** | All post-signup AI interactions |

**AriaStar's role**: Business advisor to Seoul Sister's team (marketing strategy, content performance, competitive insights). She advises the business, not the visitors.

**Yuri's role**: Visitor-facing and user-facing AI. Handles pre-signup demo (widget), onboarding, and all product interactions.

**Clean separation**: AriaStar drives traffic TO seoulsister.com. Yuri handles conversion and retention ON seoulsister.com.

## Quick Reference

### Local Development
```bash
npm install          # Install dependencies
npm run dev          # Start Next.js dev server
```

### Deployment
Automatic via Vercel on push to `main` branch.

### Key URLs
- Production: https://seoulsister.com
- Supabase Dashboard: Check .env.local for project URL
- Vercel Dashboard: Check Vercel account

---

**Created**: February 2026
**Current version**: 11.24.0 (August 9 2026 — **Five leaks around one good conversation, and the cow.** An India visitor got an excellent diagnosis — Yuri read her five-product lineup, found two BHA sources stacked on one chin, and told her to **remove** a product rather than buy one — with **zero tool calls** the entire conversation. (1) `shouldWidgetForceToolUse` keys on a ~28-brand mostly-Korean hardcoded list; her lineup (Neutrogena, Dr. Sheth, Pond's, Re'equil) matched none. **The obvious fix is WRONG and was measured before shipping**: of the seven brands Yuri recommended, only **Aestura (108 rows) and Round Lab (105) exist** — CeraVe, Dr. Sheth, Re'equil, Minimalist, Deconstruct, Dot & Key are **ZERO**. Forcing would ground 2 of 7 and return empty for five, and an empty search on a Western brand risks making "not in our catalog" sound like "not good". Across all traffic the 57 ungrounded brand-naming replies split **44 groundable / 13 structurally immune**. A brand list was blind to Western lineups in ffcede9, blind to Indian here, and would be blind to Thai next — so `BRAND_SIGNALS` is NOT expanded (a test fails if it grows a Western arm) and `tool-grounding.ts` surfaces the FACT instead. It never says "unverified" — hedging on CeraVe is a documented regression. (2) **The cow.** The Aug 8 TikTok visitor got **three complete lineups** (Korean → Target/Ulta → re-textured), and in the Target reply Yuri **stated the gate out loud and crossed it in the same message**. Not Yuri ignoring the rule: replaying the transcript, when she wrote the SECOND lineup `lineupBuilds` was 1 and the gate required 2, so the instrument **returned null and she rebuilt with no visibility**. The counter reports builds already SENT; the note informs the build she is ABOUT TO write. Threshold 2→1, plus a note naming the real mechanism — **a rebuild is a REPEAT, not a new question** (the gate was defined by ARTIFACT; the leak is REPETITION). **The give itself was deliberately NOT tightened** — Kim Wells converted because Yuri talked her OUT of purchases, and a test asserts silence before any lineup exists. Caveat: **n=1, and 0 of ~58 widget visitors have ever converted** — the giveaway is not established as the cause. (3) A quota countdown ("6 free messages left") volunteered at the exact midpoint, violating the prompt's own last-2-3-messages rule. (4) The email ask stapled to a warning that she'd "drift back into old habits" — she replied "No. I'm good." 735 → 770 tests, each confirmed to FAIL when its bug is reintroduced. Details in CHANGELOG and `WIDGET-GROUNDING-FIX.md`.) Prior: 11.23.0 (August 3-5 2026 — **Four leaks at the moment someone decides.** Three visitors were trying to say yes and our plumbing made it hard. (1) A visitor replied ***"Can I use gmail instead of email?"*** — she read "email" as a service she might not have, not an address to type, and the lead was lost. Worse, the defect behind it: **confusion in reply to the ask silently spent the one permitted ask**, so a puzzled visitor could never give it no matter how clear the wording got. (2) Yuri quoted a sun serum at **$22.10 from a 0-review row when a $15.50/5,800-review row existed** — a 43% overquote at purchase intent. **The obvious fix is WRONG and was measured before shipping**: "prefer the highest-review row" would quote a two-pack's price as a single unit, because *Extreme Cream Ampoule ≠ Extreme Cream* and *All Clean Balm Mandarin ≠ All Clean Balm*; identical-INCI fails as a discriminator too. Nothing deterministic separates duplicate listing from different SKU, so the classifier was abandoned and the sibling rows are surfaced as a FACT with review counts — a test fails if the note becomes a preference rule. (3) A TikTok visitor who lands and doesn't chat was **invisible in BOTH systems** — our DB by design (we count conversations, not pageviews), and GA4 because `?from=` isn't a UTM; the `/tt` redirect now appends `utm_source` server-side while the bio link stays bare. (4) The best cold conversation on record — a woman in Kolkata with PCOS, 45 min, closed in Korean — ended with **no purchase path**, because our price feeds are US/Korea-direct. The reasoning already travels (INCI is INCI; Yuri read her Plum/Re'equil/Pond's correctly), so only the last mile was patched: regional retailer routing plus a `shopper_outside_us` signal that records the REGION, because 3 grep hits across 58 visitors can't tell 5% from 15%. **A regional catalog was deliberately NOT built** — measure first. 429 → 658 tests. Details in CHANGELOG.) Prior: 11.22.0 (August 2 2026 — **The ingredient was in 169 products and she couldn't find one.** Two defects, and in BOTH Yuri did exactly what she was told. (1) She recommended tranexamic acid for Bailey's PIH, then said *"there isn't a clean K-beauty tranexamic acid serum in our catalog"* — true at the NAME level (3 products) but false in fact (**169 contain it, 32 of them serums**). Her tool call was correct; `include_ingredients` was only ever a **post-filter over name-search results**, so an ingredient common in formulas and rare in names was structurally unfindable. It now runs its own `ingredients_raw` candidate query and UNIONs into the name results (name path untouched). Three silent-failure hardenings alongside: the link join ignored `error` (a dead query would empty the list and read as *"we don't carry this"*), ids weren't null-filtered before `.in()` (22P02), and the raw-INCI fallback had to actually FETCH `ingredients_raw` since the candidate selects omit it. Verified live: **12 TXA serums under $30**, previously zero. (2) She quoted raw tool output at the user — *"here's exactly what landed, verbatim from the system"* — because `advisor.ts` **ordered** it ("MUST quote... Never paraphrase") while a `save_routine`-scoped rule said "NEVER narrate the machinery." **The prompt contradicted itself.** Verbatim mandate → enumerated-facts mandate (same disclosures, Yuri's own words); the machinery rule is hoisted to govern EVERY tool, with an explicit clause that it "never licenses hiding a fact the user needs — it governs the REGISTER, not the content." 469 → 476 tests. Details in CHANGELOG.) Prior: 11.21.0 (August 1 2026 — **She bought a cleanser she never needed.** Bailey couldn't finish a TikTok take. Three defects. (1) A **corrected fact sat beside a live instruction contradicting it**: a June 7 loose match wrote "Beplain Makiol" into her routine from a step named *"Shower / cleanse"*; when she said she'd never heard of it, the CORRECTION was captured but the two DECISIONS built on it stayed under the heading "### Active Decisions", so Yuri kept prescribing it and **Bailey bought it**. A flag-the-decision classifier was built and **measured before shipping — 23% precision historically, 0% at render time** (it flagged remediation decisions as contradictions, and durable corrections would have made the noise permanent); dates carry no signal since all 22 pairs are same-date. Discarded rather than tuned. The fix is at **extraction time**, where the model sees the whole conversation and rewrites/drops the stale decision (topic-keyed merge replaces it), plus ONE static "the correction wins" line — no per-row classifier. (2) A Medicube balm photo returned **Bushman sun sticks**: the fallback ordered ANY-term matches by `rating_avg` and applied `LIMIT 10` **server-side before scoring**, so a window with zero Medicube rows was unrecoverable. Now over-fetches, ranks by coverage with **brand terms weighted 3×**, then trims. (3) "You haven't tried this yet" rendered **above her own Recent Scans** — the banner counted from the 1st of the month. 464 → 469 tests. Details in CHANGELOG.) Prior: 11.20.0 (August 1 2026 — **She denied a product she had just recommended.** Yuri recommended the Melixir Vegan Daily Skin Tint, then told Bailey *"our catalog doesn't actually have that exact product on file"*, then *"it IS in our catalog after all (I found it this time)."* **Yuri did nothing wrong.** The catalog omits the word "Vegan" (Melixir's marketing name, which Yuri added herself); that one token made the ALL-terms post-filter unsatisfiable, so Strategy 2 discarded a window that CONTAINED the right row, and Strategy 3's rating-ordered window — a large pool of tied 5.00s, so ordering among them is arbitrary — missed it at limit 10. The resolver landed on a 2-of-6 decoy, flagged it `partial`, and Yuri obeyed that warning exactly. **A missing term is not evidence of a wrong product**: the fetched window is now coverage-ranked (within one term of the query) instead of discarded, and the partial payload NAMES the unmatched words, because "PARTIAL MATCH" alone can't distinguish a different product from the right product under a shorter name. Writes untouched — strict still refuses `partial`. Also: all four strategies destructured only `data`, so a failed query read as "product not found". 459 → 464 tests; verified against the LIVE catalog with Celimax/Torriden/BoJ/Hero-patch behavior unchanged. Details in CHANGELOG.) Prior: 11.19.0 (July 31 2026 — **The scan history led nowhere.** Bailey tapped a Recent Scans card showing a real safety score and landed on the empty upload page. Not a regression — **a scan detail page had never been built**; `RecentScansWidget` linked to `/products/[id]` or, for anything outside the Korean catalog (`product_id` NULL — the *normal* case under the Western Shelf rule), to `/scan`. The stored analysis was, per a comment written three days earlier about Bailey's exact Cetaphil scan, *"read back by exactly one thing: a count on a dashboard widget."* Now `GET /api/scans/[id]` + `/scan/[id]` render it — as a **historical record, not a live re-analysis**: the stored `enrichment` snapshot is deliberately NOT returned (one row quotes Soko Glam at $20.90 from July 26 and names YesStyle, a never-recommend retailer), so prices route to the product page and meaning routes to Yuri, and conflicts carry explicit "checked on [date], your routine may have changed" provenance. Data display only — no rule engine, no prescriptive copy. 429 → 459 tests; the routing tests evaluate the real transpiled href expression, since a regex test passes against the broken code. Details in CHANGELOG.) Prior: 11.18.0 (July 30 2026 — **Eight failures that all looked like success.** Bailey hit *"Something went wrong on Yuri's end"*; chasing that one report surfaced seven more defects, **every one the same shape: code that could not tell "nothing is wrong" from "nothing was checked."** See the LOAD-BEARING *Silent Failure* section above. The three that were actively harming users: authenticated Yuri was **down for every user with a product inventory** (an index-desync in context assembly that threw BEFORE the Anthropic call, which is why conversations were created with zero messages); Yuri claimed **"Locked"** on a routine save she never performed (the honesty rule covered READ verbs only, and revising a routine was documented solely inside a threatening error string, so stalling felt safer than acting); and **one custom step disabled ingredient-conflict checking for an ENTIRE routine** — a NULL `product_id` inside an `.in()` throws 22P02, and only `data` was destructured, so a dead query read as `safe: true` across all three of Bailey's routines while her prescription **ADAPALENE** was invisible to Yuri entirely. Fixing that exposed a latent O(n²) (20,880 `or` clauses / 105 round-trips) that had never run because the null bug short-circuited it. Also: custom routine steps were **undeletable by anyone including Yuri** (every path keyed on `product_id`); a memory callback read as a **scold** and cost a good answer (my own test probe polluted her account and caused it); an LED **device** was saved as three masks she doesn't own; and 15 unsplit INCI dumps were **live in the sitemap** because `sitemap.ts` had no pollution guard, while the write path kept creating more. Nearly shipped two over-corrections, both caught by measuring: a comma rule that would have destroyed 979 legitimate ingredients, and a heuristic that flagged 4,898 rows including "Hexapeptide-9". 375 → 429 tests, each confirmed to FAIL when its bug is reintroduced. Details in CHANGELOG.) Prior: 11.17.0 (July 30 2026 — the interlocked SS monogram from Playfair glyph outlines, everything measured not asserted; the favicon redrawn at target size rather than downscaled; and the fabricated Beplain cleanser swept out of Bailey's routines. Details in CHANGELOG.)
**AI Advisor**: Yuri (유리) — "Glass"

**Full version history**: See `CHANGELOG.md` (repo root). The detailed, dated changelog — every version from v3.0.0 through the current release — lives there, not in this file. Per the project's documentation standard: CLAUDE.md is for current architecture and how the system works NOW; CHANGELOG.md is for what changed and when. When shipping a feature, update the relevant architecture section here and put the detailed entry in CHANGELOG.md.
