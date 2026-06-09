# Seoul Sister - K-Beauty Intelligence Platform

> **For any AI session opening this repository for the first time**: Read `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md` and `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/patterns.md` *before* touching any code in this repo. Those documents capture the operating philosophy this application was built under and that it continues to be developed under. Code that doesn't reflect those principles will be rejected.
>
> **Also read `LEARNING-LOOP-BLUEPRINT.md` (repo root)** before adding any feature that makes a judgment. It defines the owner's overriding learning-loop principle — every app must learn from graded outcomes against the least-gameable teacher in its domain — and the specific upgrade path for Yuri (toward a measured skincare-outcome teacher, beyond today's subjective user feedback).
>
> **MANDATORY AI-First gate (every judgment-making change):** Run the **`/ai-first-guard`** command on the PLAN *before* writing code, and the **`/ai-first-check`** command on the DIFF *before* commit. (Ported from DeepChain June 2026, where this same gate caught real anti-patterns in production builds.) `ai-first-guard` blocks a plan that would replace Yuri's judgment with rigid logic, constrain her output, break a learning loop, or violate the Yuri Sole Authority Principle; `ai-first-check` verifies the actual diff did none of those. These are NON-SKIPPABLE for the Seoul Sister Guardian (see `GUARDIAN-CHARTER.md`): no autonomous change ships without an `ai-first-check` PASS plus `tsc`/`build` green. The commands live in `.claude/commands/`. Surface the fact, never cage the judgment.
>
> **The Seoul Sister Guardian (autonomous health system) — read `GUARDIAN-CHARTER.md` if you are continuing this work or were asked to activate autonomous fixing.** A zero-cost always-on watcher (`/api/cron/guardian-watch`, 3×/day, server-side, laptop-independent) already monitors health 24/7 and logs verdicts to `ss_pipeline_runs.metadata`. The autonomous *fix-while-Scott-sleeps* layer is DEFERRED with a complete self-contained activation runbook in `GUARDIAN-CHARTER.md` ("DEFERRED FEATURE 2") — Scott wants it live after a ~1-week report-only proving period (started June 5 2026) + his cost approval (~$5–15/mo). **If you are a fresh AI with no memory of this and Scott asks you to "turn on the Guardian" or "activate 24/7 fixing": read that runbook in full, confirm BOTH activation pre-conditions, and never activate without them.** Current mode lives at the top of `GUARDIAN-LOG.md` (currently `REPORT-ONLY`). A $0 push/email alerting feature is also spec'd-but-deferred there ("DEFERRED FEATURE 1").

## Project Overview

Seoul Sister is the world's first English-language K-beauty intelligence platform -- "Hwahae for the World." It bridges the information gap between Korean beauty consumers (who have access to 187,000+ products, 5.77M+ reviews, and ingredient-level intelligence via Hwahae) and international consumers who have no equivalent resource.

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

#### Two-Layer Architecture

**Layer 1: Hero Widget (Above the Fold — Primary Conversion Mechanic)**

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
  -> Pricing (Seoul Sister Pro — $39.99/mo)
  -> Final CTA
  Footer
```

The hero widget includes:
- Chat header with Yuri avatar, name, "K-Beauty AI Advisor" subtitle, "Live" badge
- Pre-populated demo conversation (COSRX authenticity check) showing Yuri's personality
- 4 quick prompt buttons: "Is my COSRX Snail Mucin real?", "Best serum for glass skin?", "Build me a routine", "Find me a sunscreen dupe"
- Live input field — visitor can type immediately without scrolling
- Full SSE streaming with real-time responses
- After 20 messages: conversion prompt to subscribe ($39.99/mo)
- Min-height: 520px, max-height: 640px on desktop
- Component: `TryYuriSection` with `variant="hero"` prop

**Layer 2: Floating Yuri Bubble (Always Present — Secondary Access)**
```
- Bottom-right corner, all pages, always visible
- Collapsed state: Yuri avatar + "Ask me about K-beauty" tooltip on hover
- Expands to chat window on click (400px wide, 70vh tall)
- 20 free preview messages (shared with hero widget via localStorage)
- Quick prompts when empty: "Best serum for glass skin?", "Is this sunscreen legit?", "Build me a routine"
- SSE streaming for real-time responses
- Component: YuriBubble
```

**Layer 3: Full Yuri Experience (Post-Signup)**
```
After account creation + Stripe payment:
  -> Redirected to /subscribe (payment gate)
  -> Stripe Checkout ($39.99/mo Seoul Sister Pro)
  -> On success: Yuri onboarding conversation (skin profile, preferences, concerns)
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
4. OR visitor scrolls first, then clicks floating bubble at any point
5. After 20 preview messages (shared across layers):
   -> Conversion prompt: "Subscribe — $39.99/mo"
   -> Highlights: unlimited conversations, skin profile memory, 6 specialists, routine builder
6. Visitor subscribes ($39.99/mo) -> Yuri onboarding conversation (Layer 3)
```

#### TryYuriSection Component Architecture
The `TryYuriSection` component (`src/components/widget/TryYuriSection.tsx`) supports two variants:
- `variant="hero"`: Renders as an embedded card (no section wrapper, no heading). Used in the homepage hero grid. Has chat header with "Live" badge.
- `variant="section"`: Renders with full-width section wrapper, heading, and subheading. Available for standalone use on other pages if needed.

Both variants share identical `chatContent` (demo conversation, live messages, input, error handling, streaming logic) to avoid code duplication. The variant only affects the outer container and header.

#### Widget Specifications
- **Preview messages**: 20 per session (IP+UA hash tracked, 30-day window, shared between hero widget and floating bubble)
- **No login required**: Anonymous conversations streamed and forgotten (not stored)
- **Genuine value**: Yuri gives real, helpful answers backed by database tools — not teaser responses
- **Natural conversion**: After 20 messages, Yuri highlights what subscribers unlock (personalized routines, unlimited scans, specialist agents)
- **Surface-level routing**: Anonymous questions get helpful answers but not deep specialist dives
- **Data capture**: Anonymous conversation data feeds the learning engine
- **Mobile-responsive**: Hero stacks to single column on mobile; floating bubble remains accessible
- **SSE streaming**: Real-time streamed responses (not waiting for full response)
- **Quick prompts**: 4 in hero widget, 3 in floating bubble — reduce friction to first message

#### Rate Limiting (Cost Control)
- 20 messages per session (IP+UA hash, 30-day window, shared across layers)
- 25 messages per IP per day (prevents abuse)
- Shorter max_tokens for anonymous visitors (300 vs 600 for subscribers)
- Anonymous conversations not saved to database (just streamed and forgotten)
- 4 database tools available (search_products, compare_prices, get_trending, get_weather) but no specialist agent deep-dives

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
ss_user_profiles            - Extended skin profile (type, concerns, allergies, climate)
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
ss_widget_visitors          - Persistent anonymous visitor identity with AI memory and lifetime stats
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

### Single Tier — Seoul Sister Pro ($39.99/mo)

Seoul Sister is a paid-only platform. There is no free tier. Visitors get 20 free preview messages with Yuri on the landing page hero widget to experience the AI's quality before subscribing.

**Registration Flow**: Register → Stripe Checkout ($39.99/mo) → Yuri onboarding → Full app access (no email verification)

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
- 20 preview messages with Yuri (IP+UA tracked, 30-day window)
- 4 database tools (search products, compare prices, trending, weather)
- Real, helpful answers backed by 5,800+ product database
- No account required, no data stored

### Unit Economics (Pro at $39.99)
| Item | Cost |
|------|------|
| Claude Opus 4.8 API (scans, Yuri, analysis) | ~$1.40/mo avg |
| Claude Vision (scanning, counterfeit, Opus 4.8) | ~$0.50/mo avg |
| Supabase (storage, queries, auth) | ~$0.50/mo |
| Vercel (hosting, functions) | ~$0.25/mo |
| Stripe processing (2.9% + $0.30) | ~$1.46/mo |
| **Total variable cost** | **~$4.11/mo** |
| **Margin per Pro user** | **~$35.88/mo (90%)** |

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

**P1 — Verification rate is suppressing search visibility**
- Only 588 of 5,901 products have `is_verified = true`. The widget's `search_products` tool filters by verified by default. **~90% of catalog is invisible to public Yuri's search results.**
- Most thin: lip_care (10/284 verified, 4%), spot_treatment (8/197, 4%), mist (8/76, 11%), eye_care (20/206, 10%), exfoliator (20/177, 11%).
- Verification was a manual flag set during the original Feb 17 seed; never auto-bumped by the Sonnet pipeline. Products with full data (name, brand, category, ingredients, AND a price record) are structurally complete and should be auto-promoted.
- **Action**: Single SQL update — `UPDATE ss_products SET is_verified = true WHERE name_en IS NOT NULL AND brand_en IS NOT NULL AND category IS NOT NULL AND ingredients_raw IS NOT NULL AND id IN (SELECT product_id FROM ss_product_prices)`. Estimated impact: 5,000+ products newly visible in search. Spot-check sample for false positives before running.

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

## Phase 8: Value Enrichment Features (11 Features)

These features were identified through deep codebase audit and skincare industry gap analysis. They are designed to be built independently — each in a fresh Claude Code session that reads this document for context. Build in priority order (Tier 1 first).

**Build Strategy**: Each feature below contains everything needed for implementation: exact files to create/modify, database schema changes, API endpoints, component structure, and step-by-step instructions. A fresh Claude Code session should read this section and build one feature per session.

---

### Feature 8.1: Product Detail Page Enrichment (Tier 1 — High Impact, Quick Win)

**Strategic Rationale**: The scan enrichment pipeline (`lib/scanning/enrich-scan.ts`) already does personalized skin matching, price comparison, community intelligence, authenticity checking, and trend context — but ONLY for scanned products. Product detail pages (`src/app/(app)/products/[id]/page.tsx`, 420 lines) show generic data with zero personalization. This feature reuses the existing enrichment infrastructure to make every product page personalized.

**The Insight**: We already built the intelligence — we just need to surface it in the right place. A user browsing products should get the same "Your Skin Match" intelligence they get from scanning.

#### Current State
- **Product Detail Page** (`src/app/(app)/products/[id]/page.tsx`, 420 lines): Shows product header, description, review summary badges, three tabs (Ingredients, Prices, Reviews). NO personalization, no skin match, no trend context.
- **Product API** (`src/app/api/products/[id]/route.ts`, 113 lines): Fetches product, ingredients, prices, review summary. Does NOT check user auth or skin profile. Uses anon Supabase client.
- **Enrichment Module** (`src/lib/scanning/enrich-scan.ts`): Already has `fetchPersonalization()`, `fetchPricing()`, `fetchCommunity()`, `fetchCounterfeit()`, `fetchTrending()` — all parameterized by product ID and user ID.

#### Implementation Plan

**Step 1: Create Product Enrichment API Endpoint**

Create `src/app/api/products/[id]/enrichment/route.ts`:
```
GET /api/products/:id/enrichment
Authorization: Bearer <token> (optional — returns null personalization if anonymous)
Response: ScanEnrichment (same shape as scan enrichment)
```

This endpoint:
- Calls `requireAuth()` (soft — catch error and continue as anonymous)
- Reads product from `ss_products` to get brand
- Reads product ingredients from `ss_product_ingredients` joined with `ss_ingredients` to get ingredient names
- Reads user skin profile from `ss_user_profiles` if authenticated
- Calls `enrichScanResult()` from `lib/scanning/enrich-scan.ts` with the product's data
- Returns enrichment JSON (same shape as scan response)

**Step 2: Create ProductEnrichment Client Component**

Create `src/components/products/ProductEnrichment.tsx`:
- Takes `productId: string` prop
- Fetches `/api/products/${productId}/enrichment` on mount (with auth token if available)
- Reuses the same sub-components from `ScanResults.tsx`: `PersonalizedMatch`, `TrendContext`, `PriceComparison` (rename to avoid confusion with existing `PriceComparison` component), `CommunityIntelligence`, `AuthenticityCheck`
- **Important**: Extract the shared enrichment UI sub-components from `ScanResults.tsx` into a new `src/components/shared/EnrichmentSections.tsx` file so both Scan and Product Detail can use them without duplication.

**Step 3: Refactor Shared Enrichment UI Components**

Create `src/components/shared/EnrichmentSections.tsx`:
- Move these components out of `ScanResults.tsx`: `PersonalizedMatch`, `PriceComparison` (the enrichment version, not the product tab version), `CommunityIntelligence`, `AuthenticityCheck`, `TrendContext`, `SectionHeader`
- Export each component individually
- Update `ScanResults.tsx` to import from the shared location
- Update `ProductEnrichment.tsx` to import from the shared location

**Step 4: Integrate into Product Detail Page**

Modify `src/app/(app)/products/[id]/page.tsx`:
- Add `ProductEnrichment` component between the description section and the tab navigation
- Lazy-load with `next/dynamic` (enrichment is below the fold, not critical for first paint)
- Component shows loading skeleton while fetching, then renders enrichment sections
- If user is not authenticated, show a CTA: "Sign in to see your personalized skin match"
- If user is authenticated but no profile, show: "Complete your skin profile for personalized intelligence"

**Step 5: Add "Add to Routine" and "Ask Yuri" quick actions to product header**

Currently the product header has Wishlist, Scan Label, Share buttons. Add:
- "Add to Routine" button → opens a dropdown to select AM/PM routine and step position
- "Ask Yuri" button → navigates to `/yuri?ask=Tell me about ${product.name_en}`

#### Files to Create
- `src/app/api/products/[id]/enrichment/route.ts` (~60 lines)
- `src/components/products/ProductEnrichment.tsx` (~80 lines)
- `src/components/shared/EnrichmentSections.tsx` (~350 lines, extracted from ScanResults)

#### Files to Modify
- `src/components/scan/ScanResults.tsx` — Remove extracted components, import from shared
- `src/app/(app)/products/[id]/page.tsx` — Add ProductEnrichment component

#### Database Changes
None — uses existing tables and the existing `enrichScanResult()` function.

#### Estimated Complexity
Low-medium. Mostly refactoring existing code into shared components and wiring up a new API endpoint.

---

### Feature 8.2: Routine Builder Intelligence (Tier 1 — High Impact, Core Feature Gap)

**Strategic Rationale**: The routine page (`src/app/(app)/routine/page.tsx`, 205 lines) is the thinnest core feature. It's a basic list display with no intelligence. There is no `/api/routine` endpoint. Users can only "Ask Yuri to build my routine" which sends them to chat — there's no structured routine creation, no conflict detection when adding products, no layering order logic, no wait time suggestions.

**The Gap**: Every K-beauty platform needs a routine builder. Seoul Sister has the database schema (`ss_user_routines`, `ss_routine_products`) and the Routine Architect specialist agent prompt — but no actual routine builder UI or API.

#### Current State
- **Routine Page** (`src/app/(app)/routine/page.tsx`, 205 lines): Lists active routines with products. Empty state says "Ask Yuri to build this routine." No add/remove/reorder. No conflict detection.
- **Database Tables**: `ss_user_routines` (id, name, routine_type, is_active, user_id), `ss_routine_products` (id, routine_id, product_id, step_order, frequency, notes). Schema exists but has no API.
- **No API**: There is NO `src/app/api/routine/` directory at all.
- **Ingredient Conflicts Table**: `ss_ingredient_conflicts` (5 rows) — exists but only used in scan flow.
- **Routine Architect Agent**: Full system prompt exists in `src/lib/yuri/specialists.ts` with deep Korean skincare routine knowledge (layering order, wait times, skin cycling, seasonal adjustments).

#### Implementation Plan

**Step 1: Create Routine CRUD API**

Create `src/app/api/routine/route.ts`:
```
GET /api/routine — List user's routines with products (replaces direct Supabase client query)
POST /api/routine — Create a new routine (name, routine_type: 'am'|'pm'|'weekly')
```

Create `src/app/api/routine/[id]/route.ts`:
```
GET /api/routine/:id — Get single routine with full product details
PUT /api/routine/:id — Update routine (name, is_active)
DELETE /api/routine/:id — Deactivate routine (soft delete: is_active = false)
```

Create `src/app/api/routine/[id]/products/route.ts`:
```
POST /api/routine/:id/products — Add product to routine
  Body: { product_id, step_order?, frequency? }
  Response: Updated routine with conflict check results
DELETE /api/routine/:id/products/:productId — Remove product from routine
PUT /api/routine/:id/products/reorder — Reorder products
  Body: { product_ids: string[] } (in new order)
```

**Step 2: Create Conflict Detection Module**

Create `src/lib/intelligence/conflict-detector.ts`:
- `checkRoutineConflicts(supabase, routineId, newProductId)`: Check if adding a product creates ingredient conflicts with existing routine products
- Query `ss_product_ingredients` for the new product AND all existing routine products
- Cross-reference against `ss_ingredient_conflicts` table
- Return: `{ safe: boolean, conflicts: Array<{ ingredient_a: string, ingredient_b: string, severity: string, description: string, recommendation: string }> }`
- This already partially exists in `src/app/api/scan/route.ts` (lines 140-231) — extract and generalize

**Step 3: Create Layering Order Logic**

Create `src/lib/intelligence/layering-order.ts`:
- `suggestLayeringOrder(products)`: Given a list of products with categories, suggest optimal step order
- Korean layering rules (from Routine Architect system prompt):
  - AM: Oil cleanser → Water cleanser → Toner → Essence → Serum/Ampoule → Eye cream → Moisturizer → Sunscreen
  - PM: Oil cleanser → Water cleanser → Toner → Essence → Serum/Ampoule → Eye cream → Moisturizer → Sleeping mask
- Category-to-step mapping: `cleanser → 1-2, toner → 3, essence → 4, serum/ampoule → 5, eye_care → 6, moisturizer → 7, sunscreen → 8 (AM only), mask → 8 (PM only)`
- `suggestWaitTimes(products)`: Return wait time suggestions between steps
  - Vitamin C products: 10-15 min after application
  - AHA/BHA products: 15-20 min after application
  - Retinoid products: can layer immediately if tolerated
- `detectMissingSteps(routineType, products)`: Identify gaps (e.g., "Your AM routine is missing sunscreen")

**Step 4: Create AI Routine Generation Endpoint**

Create `src/app/api/routine/generate/route.ts`:
```
POST /api/routine/generate
Authorization: Bearer <token>
Body: { routine_type: 'am'|'pm', concerns?: string[], budget_range?: string }
```
- Reads user's skin profile from `ss_user_profiles`
- Reads user's existing routines to avoid conflicts
- Calls Claude Opus 4.8 with the Routine Architect system prompt
- Claude returns structured JSON with recommended products (matched from `ss_products` database)
- Returns routine suggestion with products, order, wait times, and rationale
- User can then accept (creates routine) or modify

**Step 5: Build Routine Builder UI**

Rewrite `src/app/(app)/routine/page.tsx` (~300-350 lines):
- Keep the existing `RoutineCard` display but enhance:
  - Drag-to-reorder products (or simple up/down arrows for mobile)
  - Remove product button (X icon)
  - "Add Product" button → opens product search modal
  - Conflict warnings inline (red border on conflicting products with tooltip)
  - Wait time indicators between steps (e.g., "⏱ Wait 15 min" between BHA and moisturizer)
  - Missing step alerts (e.g., yellow banner "Your AM routine needs sunscreen!")
- Empty state upgrade: Replace "Ask Yuri" link with two options:
  1. "Generate with AI" — calls `/api/routine/generate`, shows preview, user accepts
  2. "Build manually" — starts with empty AM/PM routine, user adds products
- Skin cycling toggle: Show skin cycling schedule for PM routines (Night 1-4 rotation)

Create supporting components:
- `src/components/routine/AddProductModal.tsx` — Search and select product to add
- `src/components/routine/ConflictWarning.tsx` — Inline conflict display
- `src/components/routine/WaitTimeIndicator.tsx` — Between-step timing suggestion
- `src/components/routine/RoutineGenerator.tsx` — AI generation UI with preview

#### Files to Create
- `src/app/api/routine/route.ts` (~100 lines)
- `src/app/api/routine/[id]/route.ts` (~80 lines)
- `src/app/api/routine/[id]/products/route.ts` (~120 lines)
- `src/app/api/routine/generate/route.ts` (~150 lines)
- `src/lib/intelligence/conflict-detector.ts` (~80 lines)
- `src/lib/intelligence/layering-order.ts` (~100 lines)
- `src/components/routine/AddProductModal.tsx` (~120 lines)
- `src/components/routine/ConflictWarning.tsx` (~40 lines)
- `src/components/routine/WaitTimeIndicator.tsx` (~30 lines)
- `src/components/routine/RoutineGenerator.tsx` (~100 lines)

#### Files to Modify
- `src/app/(app)/routine/page.tsx` — Complete rewrite with intelligence features

#### Database Changes
None — `ss_user_routines`, `ss_routine_products`, `ss_ingredient_conflicts` already exist with correct schema.

#### Estimated Complexity
High. This is the largest feature — new API layer, intelligence modules, and UI rewrite.

---

### Feature 8.3: K-Beauty Dupe Finder (Tier 1 — High Engagement, Unique Differentiator)

**Strategic Rationale**: "What's a cheaper alternative to Sulwhasoo?" is one of the most common K-beauty questions. The Budget Optimizer specialist agent already has deep dupe knowledge in its system prompt, but there's no standalone feature for it. This converts Yuri conversations into a structured, searchable tool.

#### Current State
- **Budget Optimizer Agent** (`src/lib/yuri/specialists.ts`): Has detailed system prompt about Korean pricing, formulation equivalents, dupe analysis at the ingredient level. Keywords: budget, cheap, dupe, alternative, value.
- **Product Database**: 56 products with full ingredient links (130 `ss_product_ingredients` rows). Products have `category`, `brand_en`, and joined ingredients.
- **No Dupe Finder UI or API**: Nothing exists.

#### Implementation Plan

**Step 1: Create Dupe Finder API**

Create `src/app/api/dupes/route.ts`:
```
GET /api/dupes?product_id=<uuid>
Authorization: Bearer <token>
Response: { original: Product, dupes: Array<{ product: Product, match_score: number, shared_ingredients: string[], price_savings_pct: number, notes: string }> }
```

Algorithm:
1. Fetch the target product's ingredient list from `ss_product_ingredients` joined with `ss_ingredients`
2. For each other product in the same category, fetch their ingredient lists
3. Calculate ingredient overlap score: `shared_key_actives / total_key_actives` (only count active ingredients and functional ingredients, not fillers like water/glycerin)
4. Filter to products with >40% active ingredient overlap AND lower price
5. Sort by match_score descending
6. Optionally: Call Claude Opus 4.8 for nuanced comparison (texture, feel, notable differences)
7. Return top 5 dupes with savings calculations

Create `src/app/api/dupes/ai/route.ts`:
```
POST /api/dupes/ai
Authorization: Bearer <token>
Body: { product_name: string, budget?: number }
Response: { dupes: Array<{ name, brand, why_its_a_dupe, key_differences, estimated_price }> }
```

This endpoint uses Claude with the Budget Optimizer system prompt to find dupes even for products not in our database. Useful when a user describes a product rather than selecting one.

**Step 2: Create Dupe Finder Page**

Create `src/app/(app)/dupes/page.tsx`:
- Header: "K-Beauty Dupe Finder" with description
- Search input: "Find dupes for..." — searches product database with autocomplete
- OR: "Paste a product name or URL" — uses AI endpoint for products not in DB
- Results display: DupeCard component showing:
  - Original product (top card) with price
  - Dupe products below with: ingredient overlap %, price comparison (original vs dupe), savings badge, shared key actives, key differences
  - "View Full Comparison" expands to show side-by-side ingredient lists
  - "Ask Yuri" button to get Budget Optimizer deep analysis
- Popular dupes section at bottom (pre-computed from database): "Most searched dupes this week"

**Step 3: Add Dupe CTA to Product Detail Page**

Modify `src/app/(app)/products/[id]/page.tsx`:
- Add "Find Cheaper Alternatives" button in the product header
- Links to `/dupes?product_id=${product.id}`
- Show a "budget-friendly alternative" badge if the product has known dupes with >60% match score

#### Files to Create
- `src/app/api/dupes/route.ts` (~120 lines)
- `src/app/api/dupes/ai/route.ts` (~80 lines)
- `src/app/(app)/dupes/page.tsx` (~250 lines)
- `src/components/dupes/DupeCard.tsx` (~100 lines)
- `src/components/dupes/IngredientComparison.tsx` (~80 lines)

#### Files to Modify
- `src/app/(app)/products/[id]/page.tsx` — Add "Find Dupes" CTA
- `src/components/layout/BottomNav.tsx` or sidebar — Add navigation link (optional)

#### Database Changes
None initially — uses existing `ss_products`, `ss_product_ingredients`, `ss_ingredients` tables with ingredient overlap calculation. Consider adding `ss_product_dupes` cache table later if performance needs it.

#### Estimated Complexity
Medium. Ingredient matching algorithm is the core work; UI is straightforward.

---

### Feature 8.4: Ingredient Include/Exclude Search (Tier 1 — Power User Feature)

**Strategic Rationale**: The product search page (`src/app/(app)/products/page.tsx`) has category and sort filters but no ingredient-based filtering. "Show me all serums with niacinamide but without fragrance" is a core power-user need that no K-beauty platform does well.

#### Current State
- **Product Filters** (`src/components/products/ProductFilters.tsx`, 142 lines): Has search query, 14 category buttons, 4 sort options. No ingredient filtering.
- **Products API** (`src/app/api/products/route.ts`): Supports `query`, `category`, `sort_by`, `page`, `limit` params. No ingredient params.
- **Ingredient Data**: `ss_ingredients` (30 rows) with `name_inci`, `name_en`, `function`, `is_active`, `is_fragrance`, `safety_rating`, `comedogenic_rating`. `ss_product_ingredients` (130 rows) links products to ingredients.

#### Implementation Plan

**Step 1: Extend Products API**

Modify `src/app/api/products/route.ts`:
- Add query params: `include_ingredients=niacinamide,hyaluronic acid` and `exclude_ingredients=fragrance,alcohol`
- SQL logic: Join `ss_products` → `ss_product_ingredients` → `ss_ingredients`
- For includes: Product must have ALL listed ingredients (AND logic)
- For excludes: Product must have NONE of the listed ingredients (NOT EXISTS subquery)
- Also add: `fragrance_free=true` shortcut (excludes products where any ingredient has `is_fragrance = true`)
- Also add: `comedogenic_max=2` to filter products where no ingredient exceeds a comedogenic rating

**Step 2: Create Ingredient Picker Component**

Create `src/components/products/IngredientPicker.tsx`:
- Two-section pill picker:
  - "Must contain" (green pills): User types or selects ingredients to include
  - "Must NOT contain" (red pills): User types or selects ingredients to exclude
- Autocomplete dropdown searching `ss_ingredients` table (fetch on mount, cache client-side — only 30 rows)
- Pre-built shortcut buttons:
  - "Fragrance-free" → adds fragrance, parfum to exclude list
  - "Low comedogenic" → sets comedogenic_max=2
  - "Active-rich" → shows only products with 3+ active ingredients
  - "Sensitive skin safe" → excludes alcohol denat, fragrance, essential oils

**Step 3: Integrate into ProductFilters**

Modify `src/components/products/ProductFilters.tsx`:
- Add IngredientPicker below the existing category/sort filters
- Show in the expandable filter panel (already has `showFilters` toggle)
- Pass `includeIngredients` and `excludeIngredients` up to the page component
- Page component includes them in API query params

**Step 4: Create Ingredient Search API**

Create `src/app/api/ingredients/search/route.ts`:
```
GET /api/ingredients/search?query=nia
Response: { ingredients: Array<{ id, name_inci, name_en, function, is_active, is_fragrance }> }
```
For the autocomplete in IngredientPicker.

#### Files to Create
- `src/components/products/IngredientPicker.tsx` (~150 lines)
- `src/app/api/ingredients/search/route.ts` (~40 lines)

#### Files to Modify
- `src/app/api/products/route.ts` — Add ingredient filter SQL logic
- `src/components/products/ProductFilters.tsx` — Add IngredientPicker to filter panel
- `src/app/(app)/products/page.tsx` — Wire up ingredient filter state + API params

#### Database Changes
None — uses existing tables. May want to add an index: `CREATE INDEX idx_pi_ingredient_id ON ss_product_ingredients(ingredient_id)` if not already present.

#### Estimated Complexity
Medium. The SQL join logic is the trickiest part.

---

### Feature 8.5: Expiration / PAO Tracking (Tier 2 — Unique, High Retention)

**Strategic Rationale**: Korean beauty products have specific PAO (Period After Opening) indicators but most users don't track when they opened products. A user scans or adds a product, taps "I just opened this," and Seoul Sister tracks the expiry and sends alerts. No competitor does this well.

#### Current State
- No expiration tracking exists anywhere in the codebase.
- `ss_routine_products` has `notes` field (could store open date) but no dedicated columns.
- `ss_user_scans` table exists for scan history.

#### Implementation Plan

**Step 1: Database Migration**

Create migration `add_product_expiration_tracking`:
```sql
CREATE TABLE ss_user_product_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID REFERENCES ss_products(id),
  custom_product_name TEXT,  -- For products not in DB
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,  -- Calculated from PAO
  pao_months INTEGER,  -- Period After Opening in months (e.g., 12 = 12M)
  purchase_date DATE,
  manufacture_date DATE,
  batch_code TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'finished', 'discarded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add PAO data to products table
ALTER TABLE ss_products ADD COLUMN pao_months INTEGER;
ALTER TABLE ss_products ADD COLUMN shelf_life_months INTEGER;  -- Unopened shelf life

-- RLS
ALTER TABLE ss_user_product_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own product tracking" ON ss_user_product_tracking
  FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_upt_user_expiry ON ss_user_product_tracking(user_id, expiry_date);
```

**Step 2: Create Tracking API**

Create `src/app/api/tracking/route.ts`:
```
GET /api/tracking — List all tracked products for user (sorted by expiry_date)
POST /api/tracking — Start tracking a product
  Body: { product_id?, custom_product_name?, pao_months?, opened_date? }
  - If product_id provided and product has pao_months, auto-calculate expiry_date
  - If pao_months provided manually, use that
  - Default PAO by category if unknown: serum 6M, moisturizer 12M, sunscreen 6M, cleanser 12M, mask 6M
PUT /api/tracking/:id — Update tracking (change status, update dates)
DELETE /api/tracking/:id — Remove tracking
```

Create `src/app/api/tracking/expiring/route.ts`:
```
GET /api/tracking/expiring?days=30
Response: Products expiring within N days
```

**Step 3: Create Tracking UI**

Create `src/app/(app)/tracking/page.tsx`:
- Header: "Product Shelf Life" with description
- Three status sections: "Expiring Soon" (red, <30 days), "Active" (green), "Expired" (gray)
- Each tracked product shows: Product name, opened date, days remaining, progress bar (full→empty as expiry approaches)
- "I just opened this" button prominently displayed → opens modal to select product from routine/DB/custom name
- Integration points:
  - After scan results: "Track this product" button → starts tracking with auto-detected PAO
  - In routine view: Small clock icon next to each product → tap to start tracking
  - On product detail: "Track expiry" action button

Create `src/components/tracking/ExpiryCard.tsx`:
- Product name, brand, category
- Visual progress bar (green→yellow→red as expiry approaches)
- Days remaining counter
- Status badge (Active / Expiring Soon / Expired)
- Quick actions: Mark finished, Mark discarded, Extend (adjust PAO)

**Step 4: Add to Dashboard**

Modify `src/app/(app)/dashboard/page.tsx`:
- Add "Expiring Soon" widget between Yuri's Insights and Trending
- Shows up to 3 products expiring within 30 days
- "View all" links to `/tracking`

#### Files to Create
- `src/app/api/tracking/route.ts` (~100 lines)
- `src/app/api/tracking/expiring/route.ts` (~40 lines)
- `src/app/(app)/tracking/page.tsx` (~200 lines)
- `src/components/tracking/ExpiryCard.tsx` (~80 lines)

#### Files to Modify
- `src/app/(app)/dashboard/page.tsx` — Add expiring soon widget
- `src/components/scan/ScanResults.tsx` — Add "Track this product" action button
- `src/app/(app)/routine/page.tsx` — Add expiry indicator per product
- Navigation (bottom nav or sidebar) — Add tracking page link

#### Database Changes
- New table: `ss_user_product_tracking`
- Alter `ss_products`: Add `pao_months`, `shelf_life_months` columns
- Seed PAO data for existing products by category

#### Estimated Complexity
Medium. New table + CRUD + UI, but conceptually straightforward.

---

### Feature 8.6: Reformulation Tracker (Tier 2 — Moat Builder, Intelligence Differentiator)

**Strategic Rationale**: Korean brands reformulate frequently (every 12-18 months). When COSRX changes the Snail Mucin formula, users need to know. No platform tracks this systematically. Seoul Sister can detect changes and alert affected users.

#### Current State
- `ss_product_ingredients` links products to ingredients with `position` and `concentration_pct`.
- No version tracking or change history exists.
- `ss_products` has no `version`, `reformulated_at`, or `previous_formula_id` fields.

#### Implementation Plan

**Step 1: Database Migration**

Create migration `add_reformulation_tracking`:
```sql
CREATE TABLE ss_product_formulation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES ss_products(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  change_date DATE,
  change_type TEXT CHECK (change_type IN ('reformulation', 'packaging', 'both', 'minor_tweak')),
  ingredients_added TEXT[],    -- INCI names added
  ingredients_removed TEXT[],  -- INCI names removed
  ingredients_reordered BOOLEAN DEFAULT FALSE,
  change_summary TEXT,         -- AI-generated summary of what changed
  impact_assessment TEXT,      -- AI-generated: "This removes fragrance — good for sensitive skin users"
  detected_by TEXT DEFAULT 'manual' CHECK (detected_by IN ('manual', 'scan_comparison', 'cron_job')),
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ss_user_reformulation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES ss_products(id),
  formulation_history_id UUID NOT NULL REFERENCES ss_product_formulation_history(id),
  seen BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add version tracking to products
ALTER TABLE ss_products ADD COLUMN current_formulation_version INTEGER DEFAULT 1;
ALTER TABLE ss_products ADD COLUMN last_reformulated_at DATE;

-- RLS
ALTER TABLE ss_product_formulation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_user_reformulation_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read formulation history" ON ss_product_formulation_history FOR SELECT USING (true);
CREATE POLICY "Users can manage own alerts" ON ss_user_reformulation_alerts FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Reformulation Detection Logic**

Create `src/lib/intelligence/reformulation-detector.ts`:
- `detectReformulation(supabase, productId, newIngredients)`: Compare new ingredient list against stored ingredients
- Called during scan (if product matches DB) and during cron jobs
- Returns: `{ changed: boolean, added: string[], removed: string[], reordered: boolean }`
- If changed: Create `ss_product_formulation_history` record
- Generate `ss_user_reformulation_alerts` for all users who have this product in routines or wishlists

**Step 3: Create Reformulation API**

Create `src/app/api/reformulations/route.ts`:
```
GET /api/reformulations — Get reformulation alerts for authenticated user
GET /api/reformulations/product/:id — Get formulation history for a product
POST /api/reformulations/:id/dismiss — Dismiss an alert
```

**Step 4: Create UI**

- Add reformulation badge on product detail page: "Reformulated Feb 2026 — see what changed"
- Add alert bell notification on dashboard for users with unseen reformulation alerts
- Product detail page: "Formulation History" section showing version timeline
- Alert component: "COSRX Snail 96 was reformulated: Fragrance removed, Panthenol concentration increased. [See details]"

#### Files to Create
- `src/lib/intelligence/reformulation-detector.ts` (~80 lines)
- `src/app/api/reformulations/route.ts` (~80 lines)
- `src/components/products/FormulationHistory.tsx` (~100 lines)
- `src/components/dashboard/ReformulationAlert.tsx` (~60 lines)

#### Files to Modify
- `src/app/(app)/products/[id]/page.tsx` — Add FormulationHistory section
- `src/app/(app)/dashboard/page.tsx` — Add reformulation alerts widget
- `src/app/api/scan/route.ts` — Trigger reformulation detection after scan match

#### Database Changes
- New tables: `ss_product_formulation_history`, `ss_user_reformulation_alerts`
- Alter `ss_products`: Add `current_formulation_version`, `last_reformulated_at`

#### Estimated Complexity
Medium-high. Detection logic and alert system require careful design.

---

### Feature 8.7: Sunscreen Finder (Tier 2 — High Search Volume, Niche Tool)

**Strategic Rationale**: "Best Korean sunscreen for [skin type/concern]" is the #1 most-searched K-beauty query. A dedicated sunscreen finder with K-beauty-specific filters (PA rating, white cast, finish, under-makeup compatibility) would capture high-intent traffic and demonstrate Seoul Sister's specialization.

#### Implementation Plan

**Step 1: Add Sunscreen-Specific Fields to Products**

Create migration `add_sunscreen_fields`:
```sql
ALTER TABLE ss_products ADD COLUMN spf_rating INTEGER;
ALTER TABLE ss_products ADD COLUMN pa_rating TEXT CHECK (pa_rating IN ('PA+', 'PA++', 'PA+++', 'PA++++'));
ALTER TABLE ss_products ADD COLUMN sunscreen_type TEXT CHECK (sunscreen_type IN ('chemical', 'physical', 'hybrid'));
ALTER TABLE ss_products ADD COLUMN white_cast TEXT CHECK (white_cast IN ('none', 'minimal', 'moderate', 'heavy'));
ALTER TABLE ss_products ADD COLUMN finish TEXT CHECK (finish IN ('matte', 'dewy', 'natural', 'satin'));
ALTER TABLE ss_products ADD COLUMN under_makeup BOOLEAN;
ALTER TABLE ss_products ADD COLUMN water_resistant BOOLEAN;
ALTER TABLE ss_products ADD COLUMN suitable_for_active TEXT CHECK (suitable_for_active IN ('daily', 'outdoor', 'water_sports'));
```

Seed sunscreen-specific data for existing sunscreen products in `ss_products`.

**Step 2: Create Sunscreen API**

Create `src/app/api/sunscreen/route.ts`:
```
GET /api/sunscreen?skin_type=oily&white_cast=none&finish=matte&pa_rating=PA%2B%2B%2B%2B&under_makeup=true
Response: Filtered sunscreen products with match scoring
```

Logic:
- Filter `ss_products` WHERE `category = 'sunscreen'`
- Apply all filter params
- Score matches based on user's skin profile (if authenticated): skin type compatibility, concern relevance
- Sort by match score, then rating

**Step 3: Create Sunscreen Finder Page**

Create `src/app/(app)/sunscreen/page.tsx`:
- Prominent filter bar with K-beauty-specific options:
  - Skin type: Oily / Dry / Combo / Sensitive / Normal
  - PA rating: PA++ / PA+++ / PA++++ (minimum)
  - White cast: None / Minimal / Any
  - Finish: Matte / Dewy / Natural / Any
  - Under makeup: Yes / Any
  - Type: Chemical / Physical (mineral) / Hybrid / Any
  - Activity: Daily / Outdoor / Water sports
- Results as product cards with sunscreen-specific badges (SPF, PA, finish, white cast)
- "Yuri's Pick for Your Skin" — highlighted recommendation based on user profile
- Educational section at bottom: "Korean Sunscreen Guide" (SPF vs PA explained, reapplication, etc.)

#### Files to Create
- `src/app/api/sunscreen/route.ts` (~80 lines)
- `src/app/(app)/sunscreen/page.tsx` (~250 lines)
- `src/components/sunscreen/SunscreenFilters.tsx` (~120 lines)
- `src/components/sunscreen/SunscreenCard.tsx` (~80 lines)

#### Database Changes
- Alter `ss_products`: Add 8 sunscreen-specific columns
- Seed data for existing sunscreen products

#### Estimated Complexity
Medium. Straightforward filter UI + API, but needs sunscreen data seeding.

---

### Feature 8.8: Hormonal Cycle Routine Adjustments (Tier 2 — Unique Differentiator)

**Strategic Rationale**: Skin changes predictably through the menstrual cycle. No skincare app offers cycle-aware routine recommendations. This is a deeply personal, high-engagement feature that builds retention.

#### Implementation Plan

**Step 1: Database Migration**

Create migration `add_cycle_tracking`:
```sql
CREATE TABLE ss_user_cycle_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cycle_start_date DATE NOT NULL,
  cycle_length_days INTEGER DEFAULT 28,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ss_user_profiles ADD COLUMN cycle_tracking_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE ss_user_profiles ADD COLUMN avg_cycle_length INTEGER DEFAULT 28;

ALTER TABLE ss_user_cycle_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cycle data" ON ss_user_cycle_tracking FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Create Cycle-Aware Routine Logic**

Create `src/lib/intelligence/cycle-routine.ts`:
- Cycle phases and skin behavior:
  - **Menstrual (Days 1-5)**: Skin is drier, more sensitive. Recommend: gentle hydration, avoid actives
  - **Follicular (Days 6-13)**: Estrogen rising, skin improving. Recommend: introduce actives, lighter moisturizers
  - **Ovulatory (Days 14-16)**: Skin at its best, naturally glowing. Recommend: maintenance routine
  - **Luteal (Days 17-28)**: Progesterone rising, increased oil/breakouts. Recommend: BHA/niacinamide, lighter textures, spot treatments
- `getCyclePhase(cycleStartDate, cycleLength)`: Returns current phase
- `getRoutineAdjustments(phase, skinType, currentRoutine)`: Returns product swap/addition/removal suggestions

**Step 3: Create API and UI**

Create `src/app/api/cycle/route.ts`: CRUD for cycle data + current phase + routine adjustments
Create cycle adjustment display in routine page: "Based on your cycle (Luteal phase), consider adding BHA tonight"
Add to Yuri's context: Yuri's Sensitivity Guardian can reference cycle phase when making recommendations

#### Files to Create
- `src/lib/intelligence/cycle-routine.ts` (~100 lines)
- `src/app/api/cycle/route.ts` (~80 lines)
- `src/components/routine/CycleAdjustment.tsx` (~80 lines)

#### Files to Modify
- `src/app/(app)/routine/page.tsx` — Show cycle-phase adjustment banner
- `src/app/(app)/profile/page.tsx` — Add cycle tracking opt-in
- `src/lib/yuri/advisor.ts` — Include cycle phase in Yuri's context

#### Database Changes
- New table: `ss_user_cycle_tracking`
- Alter `ss_user_profiles`: Add `cycle_tracking_enabled`, `avg_cycle_length`

#### Estimated Complexity
Medium. Core logic is phase calculation + routine mapping. Privacy sensitivity requires opt-in UX.

---

### Feature 8.9: Glass Skin Score — Photo Tracking (Tier 3 — Viral, Brand-Building)

**Strategic Rationale**: "Glass Skin" (유리 피부) is the aspirational K-beauty standard and Seoul Sister's AI advisor is literally named after it. A photo-based skin scoring feature that tracks progress over time creates shareable moments ("My glass skin score went from 62 to 78!") and reinforces the brand.

#### Implementation Plan

**Step 1: Create Glass Skin Analysis API**

Create `src/app/api/skin-score/route.ts`:
```
POST /api/skin-score
Authorization: Bearer <token>
Body: { image: base64 data URL }
Response: { overall_score: number, dimensions: { luminosity, smoothness, clarity, hydration, evenness }, recommendations: string[], comparison_to_previous: { score_change, improved, declined } }
```

Uses Claude Opus 4.8 Vision with specialized prompt:
- Analyze skin photo for 5 glass skin dimensions (each 0-100)
- Overall glass skin score (weighted average)
- Compare to previous score if exists
- Generate specific recommendations targeting lowest-scoring dimension

**Step 2: Database**

Create migration `add_glass_skin_scores`:
```sql
CREATE TABLE ss_glass_skin_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  luminosity_score INTEGER CHECK (luminosity_score BETWEEN 0 AND 100),
  smoothness_score INTEGER CHECK (smoothness_score BETWEEN 0 AND 100),
  clarity_score INTEGER CHECK (clarity_score BETWEEN 0 AND 100),
  hydration_score INTEGER CHECK (hydration_score BETWEEN 0 AND 100),
  evenness_score INTEGER CHECK (evenness_score BETWEEN 0 AND 100),
  recommendations TEXT[],
  photo_url TEXT,  -- Optional: store in Supabase Storage if user consents
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ss_glass_skin_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scores" ON ss_glass_skin_scores FOR ALL USING (auth.uid() = user_id);
```

**Step 3: Create Glass Skin Score Page**

Create `src/app/(app)/glass-skin/page.tsx`:
- Camera capture / upload (reuse pattern from LabelScanner)
- Animated score reveal (large glass skin score with 5-dimension radar chart)
- Progress timeline showing scores over time (line chart)
- Before/after comparison (if multiple scores)
- "Share your Glass Skin Score" button (generate shareable image card)
- Dimension-specific recommendations: "Your hydration score is 54. Try adding a hyaluronic acid toner."
- "Improve with Yuri" CTA linking to Yuri with pre-filled message about lowest dimension

#### Files to Create
- `src/app/api/skin-score/route.ts` (~120 lines)
- `src/app/(app)/glass-skin/page.tsx` (~300 lines)
- `src/components/glass-skin/ScoreRadarChart.tsx` (~100 lines)
- `src/components/glass-skin/ProgressTimeline.tsx` (~80 lines)
- `src/components/glass-skin/ShareCard.tsx` (~60 lines)

#### Database Changes
- New table: `ss_glass_skin_scores`

#### Estimated Complexity
Medium-high. Claude Vision prompt engineering + visualization components.

---

### Feature 8.10: Weather-Adaptive Routine Alerts (Tier 3 — Proactive Intelligence)

**Strategic Rationale**: Skin needs change with weather — humidity, UV index, temperature, wind. Korean dermatologists adjust routines seasonally. Seoul Sister can do this proactively based on real weather data.

#### Implementation Plan

**Step 1: Weather API Integration**

Create `src/lib/intelligence/weather-routine.ts`:
- Use free weather API (OpenWeatherMap or WeatherAPI.com) — requires API key in env
- `getWeatherForUser(lat, lng)`: Fetch current conditions + 3-day forecast
- `getRoutineAdjustments(weather, skinType, currentRoutine)`: Map weather to skincare adjustments:
  - High humidity (>70%): Lighter moisturizer, skip oils, increase BHA frequency
  - Low humidity (<30%): Heavier moisturizer, add ceramides, reduce actives
  - High UV (>7): Reapply sunscreen reminder, add antioxidant serum
  - Cold (<5°C): Add occlusives, reduce water-based products
  - Wind + cold: Barrier protection priority
  - Hot + humid: Oil control priority

**Step 2: Create Weather Alert API**

Create `src/app/api/weather/routine/route.ts`:
```
GET /api/weather/routine?lat=37.5665&lng=126.9780
Authorization: Bearer <token>
Response: { weather: CurrentWeather, adjustments: Array<{ type: 'add'|'remove'|'swap', product_category, reason, suggestion }> }
```

**Step 3: Dashboard Integration**

- Add weather-routine widget to dashboard
- Request location permission (one-time, stored in profile)
- Show: "Today's weather: 32°C, 80% humidity → Tip: Skip your heavy cream tonight, use a gel moisturizer instead"
- Daily proactive notification (future: push notification when weather triggers adjustment)

#### Files to Create
- `src/lib/intelligence/weather-routine.ts` (~120 lines)
- `src/app/api/weather/routine/route.ts` (~60 lines)
- `src/components/dashboard/WeatherRoutineWidget.tsx` (~100 lines)

#### Files to Modify
- `src/app/(app)/dashboard/page.tsx` — Add weather widget
- `src/app/(app)/profile/page.tsx` — Add location/climate preference

#### Database Changes
- Alter `ss_user_profiles`: Add `latitude`, `longitude`, `climate_zone` columns

#### Environment Variables
- `WEATHER_API_KEY` — OpenWeatherMap or similar

#### Estimated Complexity
Medium. External API integration + mapping logic.

---

### Feature 8.11: Shelf Scan — Collection Analysis (Tier 3 — Viral, Camera-First)

**Strategic Rationale**: "Take a photo of your entire skincare shelf and get a full analysis" is a social media moment. Claude Vision can identify multiple products from a single photo. This creates a shareable, viral experience and drives product database growth through real-world product identification.

#### Implementation Plan

**Step 1: Create Shelf Scan API**

Create `src/app/api/shelf-scan/route.ts`:
```
POST /api/shelf-scan
Authorization: Bearer <token>
Body: { image: base64 data URL }
Response: {
  products_identified: Array<{
    name, brand, confidence,
    matched_product_id: string | null,
    position_in_image: string
  }>,
  collection_analysis: {
    total_estimated_value: number,
    ingredient_overlap_warnings: string[],
    missing_categories: string[],
    redundant_products: string[],
    overall_routine_grade: 'A'|'B'|'C'|'D'|'F',
    recommendations: string[]
  }
}
```

Uses Claude Opus 4.8 Vision with specialized prompt:
- Identify all visible Korean beauty products in the photo
- Match against Seoul Sister product database where possible
- Analyze the collection as a whole: gaps, redundancies, conflicts, estimated value
- Generate an overall "routine grade" and actionable recommendations

**Step 2: Create Shelf Scan Page**

Create `src/app/(app)/shelf-scan/page.tsx`:
- Camera/upload interface (reuse from LabelScanner pattern)
- Results display:
  - Grid of identified products with confidence scores
  - Collection stats: total value, product count, category breakdown
  - Routine grade (large letter grade with color)
  - "Gaps in your collection" — missing categories with product suggestions
  - "Redundant products" — products that overlap significantly
  - "Ingredient conflicts" — products that shouldn't be used together
  - "Your collection is worth $X — here's how to optimize it"
- "Add all to My Routine" — bulk-add identified products
- "Share Collection Analysis" — shareable summary card

**Step 3: Integration Points**

- Dashboard: "Scan your shelf" CTA in quick actions
- Yuri context: After shelf scan, Yuri knows what products the user owns
- Routine builder: Can import from shelf scan results

#### Files to Create
- `src/app/api/shelf-scan/route.ts` (~150 lines)
- `src/app/(app)/shelf-scan/page.tsx` (~300 lines)
- `src/components/shelf-scan/CollectionGrid.tsx` (~100 lines)
- `src/components/shelf-scan/RoutineGrade.tsx` (~60 lines)
- `src/components/shelf-scan/CollectionStats.tsx` (~80 lines)

#### Database Changes
Optional: `ss_shelf_scans` table to store scan history. Can defer to future.

#### Estimated Complexity
Medium-high. Multi-product identification prompt engineering is the challenge.

---

### Feature Implementation Priority Summary

| # | Feature | Tier | Complexity | Key Files |
|---|---------|------|-----------|-----------|
| 8.1 | Product Detail Enrichment | 1 | Low-Med | Shared EnrichmentSections, new API endpoint |
| 8.2 | Routine Builder Intelligence | 1 | High | Full API layer, conflict detector, layering logic, UI rewrite |
| 8.3 | K-Beauty Dupe Finder | 1 | Medium | Ingredient matching algorithm, new page + API |
| 8.4 | Ingredient Include/Exclude | 1 | Medium | Products API extension, IngredientPicker component |
| 8.5 | Expiration/PAO Tracking | 2 | Medium | New table, CRUD, dashboard widget |
| 8.6 | Reformulation Tracker | 2 | Med-High | Detection logic, alert system, version history |
| 8.7 | Sunscreen Finder | 2 | Medium | Product schema extension, filter page |
| 8.8 | Hormonal Cycle Adjustments | 2 | Medium | Cycle logic, routine integration, opt-in UX |
| 8.9 | Glass Skin Score | 3 | Med-High | Claude Vision prompt, radar chart, progress tracking |
| 8.10 | Weather-Adaptive Alerts | 3 | Medium | External API, weather→routine mapping |
| 8.11 | Shelf Scan Collection | 3 | Med-High | Multi-product Vision prompt, collection analysis |

**Build Order Recommendation**: 8.1 → 8.4 → 8.2 → 8.3 → 8.5 → 8.7 → 8.6 → 8.8 → 8.9 → 8.10 → 8.11

Rationale: Start with 8.1 (quick win, shared components used by later features), then 8.4 (enhances existing page), then 8.2 (core feature gap), then continue down the priority list. Each feature is self-contained and can be built in a single Claude Code session.

---

## Phase 9: Automated Product Intelligence Pipeline (10,000 Products)

**Strategic Rationale**: Seoul Sister's product database is the core moat. At 626 manually-seeded products, the database demonstrates the concept but lacks the depth needed for real user value. Hwahae has 187,000+ products. We need 10,000+ to be credible as "the" K-beauty intelligence platform. Manual seeding via Claude Code sessions costs $3,000-5,000 and doesn't scale. An automated pipeline using Sonnet for extraction costs ~$200-400 total and maintains itself going forward.

**Current State** (Post-Pipeline):
- 6,222 products across 593 brands and 14 categories
- 14,400+ ingredients with 207,000+ product-ingredient links (89% of products linked)
- Automated pipeline built and executed (Phases 9.1-9.3 + 9.6, plus additional enrichment + linking passes)
- `ss_product_staging` tracks all scraped products with status (4,895 processed, 760 duplicate, 0 pending)
- `ss_products` table has full schema including ingredients, prices, PAO, sunscreen fields
- `ss_product_ingredients` links exist for 5,550+ products (avg 39.9 links per product)
- `ss_ingredients` has 14,400+ master ingredient records with Sonnet-enriched metadata
- 5,509 products have `ingredients_raw` data; remaining 713 are listing-only (no ingredient data from source)

**Target**: 10,000+ products with ingredients, prices, and descriptions — achieved via automated pipeline that continues growing the database after initial import.

**Build Strategy**: Same as Phase 8 — each feature below is self-contained with full context for a fresh Claude Code session. Build in order (9.1 first, each builds on the previous).

**Cost Estimate**: ~$200-400 in Sonnet API costs for initial 10K import, then ~$25-50/month ongoing maintenance.

---

### Feature 9.1: Olive Young Global Scraper (Tier 1 — Foundation)

**Strategic Rationale**: Olive Young is Korea's largest health & beauty retailer (1,300+ stores, dominant online platform). Their global English site (global.oliveyoung.com) has 8,000-12,000 K-beauty products with structured data: English names, Korean names, prices (KRW), categories, ingredient lists, images, ratings, and reviews. This is the single best data source for building the product database.

#### Data Source Analysis

**Primary: Olive Young Global** (global.oliveyoung.com)
- Product listings with pagination by category
- Each product page contains: English name, Korean name, brand, category, price (KRW + USD), full ingredient list (INCI), description, images, rating, review count, volume/size
- Categories map well to our 14 categories
- Estimated 8,000-12,000 unique K-beauty SKUs
- No official API — requires HTML scraping

**Secondary Sources** (Phase 9.4):
- **YesStyle** (yesstyle.com/k-beauty): ~3,000 products, international pricing, good English descriptions
- **Soko Glam** (sokoglam.com): ~300 curated products, expert descriptions, US pricing
- **incidecoder.com**: Ingredient analysis data (INCI breakdowns, function, safety ratings)
- **Hwahae API** (if accessible): Korean ratings, ingredient analysis, 187K products

#### Implementation Plan

**Step 1: Create Scraper Infrastructure**

Create `src/lib/pipeline/scraper-base.ts`:
- Base scraper class with: rate limiting (1 request/2 seconds), retry logic (3 retries with exponential backoff), user-agent rotation, error logging
- `fetchPage(url)`: Fetch HTML with proper headers, handle 429/503 responses
- `parseHTML(html)`: Return parsed DOM (use `cheerio` or `node-html-parser`)
- Request queue with concurrency limit (max 3 parallel requests)
- Progress tracking: log every 100 products scraped

**Step 2: Create Olive Young Category Scraper**

Create `src/lib/pipeline/sources/olive-young.ts`:
- `scrapeCategories()`: Fetch the category tree from Olive Young Global
  - Map Olive Young categories → Seoul Sister categories:
    - Skincare > Cleanser → cleanser
    - Skincare > Toner/Mist → toner (or mist based on subcategory)
    - Skincare > Essence/Serum/Ampoule → essence, serum, or ampoule
    - Skincare > Cream/Moisturizer → moisturizer
    - Skincare > Eye Care → eye_care
    - Skincare > Sun Care → sunscreen
    - Skincare > Mask/Pack → mask
    - Skincare > Exfoliator/Peeling → exfoliator
    - Skincare > Oil → oil
    - Skincare > Spot Treatment → spot_treatment
    - Lip Care → lip_care
- `scrapeProductList(categoryUrl, page)`: Extract product URLs from category listing pages
  - Handle pagination (Olive Young uses page numbers or infinite scroll)
  - Extract: product URL, name, brand, price, thumbnail
  - Deduplicate within and across categories
- `scrapeProductDetail(productUrl)`: Extract full product data from product page
  - Return `RawProductData` interface:
    ```typescript
    interface RawProductData {
      source: 'olive_young';
      source_url: string;
      source_id: string;        // Olive Young product ID
      name_en: string;
      name_ko: string | null;
      brand_en: string;
      brand_ko: string | null;
      category_raw: string;     // Original Olive Young category
      price_krw: number | null;
      price_usd: number | null;
      description_raw: string;
      ingredients_raw: string;  // Full INCI list as string
      image_url: string | null;
      volume_display: string | null;
      rating_avg: number | null;
      review_count: number | null;
      scraped_at: Date;
    }
    ```

**Step 3: Create Raw Data Staging Table**

Database migration `add_product_pipeline_staging`:
```sql
-- Staging table for raw scraped data (before AI processing)
CREATE TABLE ss_product_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                    -- 'olive_young', 'yesstyle', 'soko_glam'
  source_id TEXT NOT NULL,                 -- External product ID
  source_url TEXT,
  raw_data JSONB NOT NULL,                 -- Full RawProductData
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'duplicate')),
  processed_product_id UUID REFERENCES ss_products(id),  -- Link to created product
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)                -- Prevent duplicate scrapes
);

CREATE INDEX idx_staging_status ON ss_product_staging(status);
CREATE INDEX idx_staging_source ON ss_product_staging(source, source_id);

-- Track pipeline runs
CREATE TABLE ss_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('full_scrape', 'incremental', 'reprocess')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  products_scraped INTEGER DEFAULT 0,
  products_processed INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  products_duplicates INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Step 4: Create Scrape Orchestrator API**

Create `src/app/api/admin/pipeline/scrape/route.ts`:
```
POST /api/admin/pipeline/scrape
Authorization: Bearer <service-role-key>  -- Admin only
Body: { source: 'olive_young', mode: 'full' | 'incremental', categories?: string[] }
```
- Kicks off a scraping run
- Full mode: Scrape all categories from page 1
- Incremental mode: Scrape only first 2-3 pages per category (catches new products)
- Writes raw data to `ss_product_staging` with status='pending'
- Returns pipeline_run_id for tracking
- Protected by service role key (not user-accessible)

**Step 5: Create Pipeline Status API**

Create `src/app/api/admin/pipeline/status/route.ts`:
```
GET /api/admin/pipeline/status?run_id=<uuid>
Response: { run: PipelineRun, staged_counts: { pending, processing, processed, failed, duplicate } }
```

#### Files to Create
- `src/lib/pipeline/scraper-base.ts` (~150 lines)
- `src/lib/pipeline/sources/olive-young.ts` (~300 lines)
- `src/lib/pipeline/types.ts` (~60 lines)
- `src/app/api/admin/pipeline/scrape/route.ts` (~100 lines)
- `src/app/api/admin/pipeline/status/route.ts` (~50 lines)

#### Dependencies to Add
- `cheerio` or `node-html-parser` (HTML parsing)

#### Database Changes
- New table: `ss_product_staging`
- New table: `ss_pipeline_runs`

#### Environment Variables
None new — uses existing Supabase service role key for admin auth.

#### Estimated Complexity
High. Web scraping with rate limiting, pagination, and error handling. HTML structure analysis of Olive Young Global required.

#### Important Notes
- Olive Young's HTML structure may change — build with selectors that are easy to update
- Respect robots.txt and rate limits (1 req/2 sec minimum)
- Run scraping during off-peak hours (Korean night time = US morning)
- Store raw HTML in staging for reprocessing without re-scraping
- The scraper should be idempotent — re-running with same source_id updates rather than duplicates

---

### Feature 9.2: Sonnet AI Extraction & Normalization (Tier 1 — Core Intelligence)

**Strategic Rationale**: Raw scraped data needs AI processing to become useful product records. Sonnet 4.5 normalizes messy HTML descriptions into clean English, categorizes products into our schema, extracts volume/size, and generates Seoul Sister-quality descriptions — all at $3/$15 per million tokens instead of Opus's $15/$75.

#### Current State
- `ss_product_staging` table holds raw scraped data (from 9.1)
- Products need: category normalization, description generation, volume extraction, PAO estimation, Korean name verification, subcategory assignment

#### Implementation Plan

**Step 1: Create Sonnet Extraction Module**

Create `src/lib/pipeline/extractor.ts`:
- `extractProductData(rawData: RawProductData): Promise<ProcessedProductData>`
- Uses Claude Sonnet 4.5 with a structured extraction prompt
- System prompt (~300 words):
  ```
  You are a K-beauty product data specialist. Given raw product data scraped from
  a Korean beauty retailer, extract and normalize the following fields into a
  structured JSON response.

  Rules:
  - category: Must be one of: cleanser, toner, essence, serum, ampoule, moisturizer,
    sunscreen, mask, exfoliator, lip_care, eye_care, oil, mist, spot_treatment
  - subcategory: A 2-3 word descriptor (e.g., "foam cleanser", "sleeping mask",
    "vitamin c serum", "cleansing oil", "sheet mask", "gel moisturizer")
  - description_en: Write a 1-2 sentence product description in the Seoul Sister voice.
    Focus on key active ingredients, what the product does, and who it's for.
    Keep it factual and concise. Do NOT use marketing superlatives.
  - volume_ml: Extract numeric volume in milliliters. Convert from oz if needed.
    For pads/sheets, use total product weight if available, otherwise NULL.
  - pao_months: Estimate Period After Opening. Serums/ampoules=6, moisturizers=12,
    cleansers=12, sunscreens=6, masks=6, toners=12, lip products=12, eye care=6
  - shelf_life_months: Unopened shelf life. Most K-beauty = 24-36 months.
  - For sunscreens: Extract spf_rating, pa_rating, sunscreen_type, white_cast,
    finish, under_makeup, water_resistant from description/ingredients
  - Korean name (name_ko): Keep as-is if present. If only English available, leave null.
  - rating_avg: Pass through if present from source. Round to 1 decimal.
  - review_count: Pass through if present from source.

  Return ONLY valid JSON matching the ProcessedProductData schema.
  ```

- `ProcessedProductData` interface:
  ```typescript
  interface ProcessedProductData {
    name_en: string;
    name_ko: string | null;
    brand_en: string;
    brand_ko: string | null;
    category: ProductCategory;
    subcategory: string | null;
    description_en: string;
    volume_ml: number | null;
    volume_display: string | null;
    price_krw: number | null;
    price_usd: number | null;
    rating_avg: number | null;
    review_count: number | null;
    pao_months: number | null;
    shelf_life_months: number | null;
    image_url: string | null;
    is_verified: boolean;
    // Sunscreen-specific (null for non-sunscreens)
    spf_rating: number | null;
    pa_rating: string | null;
    sunscreen_type: string | null;
    white_cast: string | null;
    finish: string | null;
    under_makeup: boolean | null;
    water_resistant: boolean | null;
  }
  ```

**Step 2: Create Batch Processing Module**

Create `src/lib/pipeline/batch-processor.ts`:
- `processBatch(batchSize: number = 20)`: Process pending staged products
  - Fetch `batchSize` rows from `ss_product_staging` WHERE status='pending'
  - Mark them as status='processing'
  - For each: call `extractProductData()` via Sonnet
  - Dedup check: `SELECT id FROM ss_products WHERE name_en ILIKE $1 AND brand_en ILIKE $2`
  - If duplicate: Mark staging row as status='duplicate', skip
  - If new: INSERT into `ss_products`, mark staging as status='processed', link via processed_product_id
  - If error: Mark as status='failed' with error_message
  - Batch Sonnet calls with concurrency limit (5 parallel) to manage API rate limits
  - Update `ss_pipeline_runs` counts after each batch
- `reprocessFailed()`: Re-attempt failed extractions

**Step 3: Create Processing API**

Create `src/app/api/admin/pipeline/process/route.ts`:
```
POST /api/admin/pipeline/process
Authorization: Bearer <service-role-key>
Body: { batch_size?: number, run_id?: string }
Response: { processed: number, failed: number, duplicates: number, remaining: number }
```
- Processes one batch of pending staged products
- Can be called repeatedly (by cron or manually) until all pending are processed
- Returns counts for monitoring

**Step 4: Token Cost Tracking**

Add to `src/lib/pipeline/cost-tracker.ts`:
- Track input_tokens and output_tokens per extraction call
- Accumulate per pipeline run
- Log cost estimates based on Sonnet pricing ($3/$15 per M tokens)
- Store in `ss_pipeline_runs` as `estimated_cost_usd`

#### Files to Create
- `src/lib/pipeline/extractor.ts` (~200 lines)
- `src/lib/pipeline/batch-processor.ts` (~200 lines)
- `src/lib/pipeline/cost-tracker.ts` (~50 lines)
- `src/app/api/admin/pipeline/process/route.ts` (~80 lines)

#### Database Changes
- Alter `ss_pipeline_runs`: Add `estimated_cost_usd DECIMAL(10,4)`

#### Estimated Complexity
Medium. Sonnet prompt engineering + batch processing logic. The extraction prompt is the key piece.

#### Cost Estimate for 10K Products
- Average tokens per product: ~500 input + ~300 output (raw data in, structured JSON out)
- 10,000 products: 5M input + 3M output tokens
- Sonnet cost: (5 × $3) + (3 × $15) = $15 + $45 = **~$60 for extraction alone**
- With retries and overhead: **~$80-100 total**

---

### Feature 9.3: Ingredient Auto-Linking Pipeline (Tier 1 — Data Completeness)

**Strategic Rationale**: Products without ingredient links are second-class citizens in Seoul Sister. The scan enrichment pipeline, dupe finder, conflict detector, and ingredient search all depend on `ss_product_ingredients` links. Currently only 130 links exist (for original seed products). With 10K products, we need automated ingredient parsing and linking.

#### Current State
- `ss_ingredients`: 30 master records with name_inci, name_en, function, safety_rating, comedogenic_rating, is_active, is_fragrance
- `ss_product_ingredients`: 130 links (position, concentration_pct)
- Raw ingredient lists (INCI strings) are available from scraped product data
- No automated parsing exists

#### Implementation Plan

**Step 1: Create Ingredient Parser**

Create `src/lib/pipeline/ingredient-parser.ts`:
- `parseInciString(inciString: string): ParsedIngredient[]`
  - Split INCI string by commas (handling parenthetical sub-ingredients)
  - Clean each ingredient name: trim whitespace, normalize casing
  - Return ordered array with position (INCI order = concentration order)
  - Handle common patterns: "Water (Aqua)", "Fragrance (Parfum)", CI numbers
- `ParsedIngredient`: `{ name_inci: string, position: number }`

**Step 2: Create Ingredient Matching Module**

Create `src/lib/pipeline/ingredient-matcher.ts`:
- `matchOrCreateIngredient(nameInci: string, supabase): Promise<UUID>`
  - Exact match: `SELECT id FROM ss_ingredients WHERE name_inci ILIKE $1`
  - Fuzzy match: Handle common variations (e.g., "Sodium Hyaluronate" vs "Hyaluronic Acid")
  - If no match found: Create new ingredient with Sonnet-generated metadata:
    - Call Sonnet with: "For the cosmetic ingredient '{name_inci}', provide: name_en (plain English name), function (primary skin function in 3-5 words), is_active (boolean — is this an active ingredient or a filler/preservative/solvent?), is_fragrance (boolean), safety_rating ('safe', 'generally_safe', 'caution', or 'avoid'), comedogenic_rating (0-5 scale)"
    - INSERT into `ss_ingredients` and return new ID
- Cache matched ingredients in memory during batch runs to avoid repeated lookups

**Step 3: Create Ingredient Linking Pipeline**

Create `src/lib/pipeline/ingredient-linker.ts`:
- `linkProductIngredients(productId: UUID, inciString: string, supabase)`
  - Parse INCI string → array of ingredient names with positions
  - For each ingredient: matchOrCreate → get ingredient_id
  - Batch INSERT into `ss_product_ingredients` (product_id, ingredient_id, position)
  - Skip if product already has ingredient links
- `linkBatch(batchSize: number = 50)`: Process products without ingredient links
  - `SELECT id, raw_inci FROM ss_products WHERE id NOT IN (SELECT DISTINCT product_id FROM ss_product_ingredients) LIMIT $1`
  - Note: `raw_inci` needs to be stored — either in ss_products or retrieved from staging

**Step 4: Store Raw INCI on Products**

Database migration: `ALTER TABLE ss_products ADD COLUMN ingredients_raw TEXT;`
- Populated during the extraction step (9.2)
- Used by the ingredient linker to parse and link

**Step 5: Create Linking API**

Create `src/app/api/admin/pipeline/link-ingredients/route.ts`:
```
POST /api/admin/pipeline/link-ingredients
Authorization: Bearer <service-role-key>
Body: { batch_size?: number }
Response: { products_linked: number, ingredients_created: number, ingredients_matched: number }
```

#### Files to Create
- `src/lib/pipeline/ingredient-parser.ts` (~80 lines)
- `src/lib/pipeline/ingredient-matcher.ts` (~120 lines)
- `src/lib/pipeline/ingredient-linker.ts` (~100 lines)
- `src/app/api/admin/pipeline/link-ingredients/route.ts` (~60 lines)

#### Database Changes
- Alter `ss_products`: Add `ingredients_raw TEXT`
- Alter `ss_ingredients`: May grow from 30 to 2,000-5,000 unique ingredients

#### Estimated Complexity
Medium-high. INCI parsing has edge cases. Ingredient matching/dedup requires careful fuzzy matching.

#### Cost Estimate
- New ingredient enrichment via Sonnet: ~100 tokens per ingredient × ~3,000 new ingredients = 300K tokens
- Cost: < $5 total
- The bulk of ingredients (~80%) will be common across products and cached after first match

---

### Feature 9.4: Multi-Retailer Price Integration (Tier 2 — Price Intelligence)

**Strategic Rationale**: Price comparison is a core Seoul Sister feature. With 10K products, we need automated price tracking across multiple retailers. Currently `ss_product_prices` has 35 manual records. This feature scrapes prices from 6+ retailers and keeps them updated.

#### Implementation Plan

**Step 1: Add Retailer Scrapers**

Create `src/lib/pipeline/sources/yesstyle.ts`:
- Product search by name/brand → extract USD price, availability, URL
- Structured data is more accessible than Olive Young

Create `src/lib/pipeline/sources/soko-glam.ts`:
- Curated catalog (~300 products) — scrape all, match to our database
- High-quality editorial descriptions (bonus data)

Create `src/lib/pipeline/sources/amazon.ts`:
- Search Amazon for K-beauty products by name + brand
- Extract price, Prime eligibility, seller rating
- Flag marketplace sellers vs authorized retailers

Create `src/lib/pipeline/sources/stylekorean.ts`:
- Korean retail prices, international shipping
- Good for KRW reference pricing

**Step 2: Create Price Matching Module**

Create `src/lib/pipeline/price-matcher.ts`:
- `matchProductToRetailer(product: Product, retailer: string)`: Search retailer for matching product
- Fuzzy name matching (product names vary across retailers)
- Confidence scoring: exact match > brand+name > brand+category
- Store match in `ss_product_prices` with retailer_id, price, currency, URL, last_checked

**Step 3: Create Price Refresh Cron**

Update `src/app/api/cron/refresh-prices/route.ts`:
- Currently exists but likely a stub
- Replace with: iterate products with stale prices (>24h old), refresh from all matched retailers
- Batch processing: 100 products per cron run (Vercel cron has 60s timeout)
- Priority: refresh trending products and recently-viewed products first
- Store historical prices in `ss_price_history` for price trend analysis

**Step 4: Create Price Pipeline API**

Create `src/app/api/admin/pipeline/prices/route.ts`:
```
POST /api/admin/pipeline/prices
Authorization: Bearer <service-role-key>
Body: { retailer: string, batch_size?: number }
Response: { matched: number, updated: number, new_prices: number }
```

#### Files to Create
- `src/lib/pipeline/sources/yesstyle.ts` (~200 lines)
- `src/lib/pipeline/sources/soko-glam.ts` (~150 lines)
- `src/lib/pipeline/sources/amazon.ts` (~200 lines)
- `src/lib/pipeline/sources/stylekorean.ts` (~150 lines)
- `src/lib/pipeline/price-matcher.ts` (~120 lines)
- `src/app/api/admin/pipeline/prices/route.ts` (~80 lines)

#### Files to Modify
- `src/app/api/cron/refresh-prices/route.ts` — Replace stub with real implementation

#### Database Changes
None — uses existing `ss_product_prices`, `ss_retailers`, `ss_price_history` tables.

#### Estimated Complexity
High. Multiple retailer HTML structures, fuzzy product matching across naming conventions.

---

### Feature 9.5: Daily Automation Cron Jobs (Tier 2 — Self-Maintaining Pipeline)

**Strategic Rationale**: After the initial 10K import, the pipeline needs to run daily to catch new products, update prices, and detect changes. This feature creates the cron jobs that make the database self-maintaining.

#### Implementation Plan

**Step 1: Create scan-korean-products Cron**

Create `src/app/api/cron/scan-korean-products/route.ts`:
- Runs daily at 6 AM UTC
- Incremental scrape: first 2-3 pages per Olive Young category (catches new arrivals)
- Writes to `ss_product_staging` with status='pending'
- Skips products already in staging (UNIQUE constraint on source+source_id)
- Logs run in `ss_pipeline_runs`

**Step 2: Create translate-and-index Cron**

Create `src/app/api/cron/translate-and-index/route.ts`:
- Runs daily at 7 AM UTC (after scan-korean-products)
- Processes up to 100 pending staged products per run
- Calls the batch processor from 9.2
- Links ingredients from 9.3
- Updates `ss_pipeline_runs` with counts

**Step 3: Create data-quality Cron**

Create `src/app/api/cron/data-quality/route.ts`:
- Runs weekly (Sunday 4 AM UTC)
- Checks for: products without descriptions, products without ingredient links, products with stale prices (>7 days), duplicate detection, missing Korean names
- Generates a quality report stored in `ss_pipeline_runs` with run_type='quality_check'
- Marks products needing attention

**Step 4: Update vercel.json**

Add new cron schedules:
```json
{
  "path": "/api/cron/scan-korean-products",
  "schedule": "0 6 * * *"
},
{
  "path": "/api/cron/translate-and-index",
  "schedule": "0 7 * * *"
},
{
  "path": "/api/cron/data-quality",
  "schedule": "0 4 * * 0"
}
```

**Step 5: Create Admin Dashboard Page**

Create `src/app/(app)/admin/pipeline/page.tsx`:
- Protected admin page (check user role or email whitelist)
- Pipeline run history with status, counts, costs
- Staged product counts by status (pending, processing, processed, failed, duplicate)
- Manual trigger buttons: "Run Full Scrape", "Process Batch", "Link Ingredients", "Refresh Prices"
- Product database stats: total products, products with ingredients, products with prices, by category, by brand

#### Files to Create
- `src/app/api/cron/scan-korean-products/route.ts` (~80 lines)
- `src/app/api/cron/translate-and-index/route.ts` (~80 lines)
- `src/app/api/cron/data-quality/route.ts` (~100 lines)
- `src/app/(app)/admin/pipeline/page.tsx` (~250 lines)

#### Files to Modify
- `vercel.json` — Add 3 new cron entries

#### Database Changes
None — uses tables from 9.1.

#### Estimated Complexity
Medium. Individual crons are simple; the admin dashboard is the largest piece.

---

### Feature 9.6: Initial 10K Import Execution (Tier 1 — One-Time Run)

**Strategic Rationale**: This is not code — it's the operational execution plan for running the pipeline to reach 10,000 products. After features 9.1-9.3 are built, this describes how to actually run the import.

#### Execution Plan

**Step 1: Run Full Olive Young Scrape**
```
POST /api/admin/pipeline/scrape
Body: { source: "olive_young", mode: "full" }
```
- Expected: 8,000-12,000 raw products scraped into `ss_product_staging`
- Duration: ~4-6 hours at 1 req/2 sec rate limit
- Can be run in segments by category if needed (to avoid timeout issues)
- Monitor via status API

**Step 2: Process Staged Products (Batch)**
```
POST /api/admin/pipeline/process
Body: { batch_size: 50 }
```
- Call repeatedly until all pending products are processed
- ~200 batches of 50 = 10,000 products
- Each batch takes ~30-60 seconds (Sonnet API calls)
- Total: ~3-5 hours of processing
- Monitor for failures, reprocess failed batch

**Step 3: Link Ingredients**
```
POST /api/admin/pipeline/link-ingredients
Body: { batch_size: 100 }
```
- Call repeatedly until all products have ingredient links
- Will create ~2,000-5,000 new ingredient records in `ss_ingredients`
- Total: ~2-3 hours

**Step 4: Verify and Quality Check**
- Run data-quality cron manually
- Check: category distribution, brand coverage, products without ingredients
- Spot-check: Random sample of 50 products for accuracy
- Fix any systematic extraction errors by adjusting Sonnet prompt and reprocessing

**Step 5: Dedup Against Existing 626 Products**
- The batch processor (9.2) handles dedup automatically via name+brand matching
- After import, run: `SELECT name_en, brand_en, COUNT(*) FROM ss_products GROUP BY name_en, brand_en HAVING COUNT(*) > 1`
- Resolve any remaining duplicates

#### Expected Results After Import
| Metric | Target |
|--------|--------|
| Total products | 10,000+ |
| Total brands | 200+ |
| Categories covered | All 14 |
| Products with ingredient links | 90%+ |
| Products with prices | 60%+ (Olive Young pricing minimum) |
| Products with Korean names | 80%+ |
| Products with ratings | 70%+ |
| Master ingredients | 3,000-5,000 |

#### Cost Breakdown
| Component | Estimated Cost |
|-----------|---------------|
| Scraping (compute/bandwidth) | ~$0 (Vercel functions) |
| Sonnet extraction (10K products) | ~$60-80 |
| Sonnet ingredient enrichment (~3K new) | ~$5 |
| Sonnet description generation | Included in extraction |
| Total one-time import cost | **~$65-85** |

---

### Feature Implementation Priority Summary

| # | Feature | Tier | Complexity | Key Deliverable |
|---|---------|------|-----------|----------------|
| 9.1 | Olive Young Scraper | 1 | High | Raw product data pipeline |
| 9.2 | Sonnet Extraction | 1 | Medium | AI-processed product records |
| 9.3 | Ingredient Auto-Linking | 1 | Med-High | Automated ingredient database |
| 9.4 | Multi-Retailer Prices | 2 | High | Cross-retailer price comparison |
| 9.5 | Daily Automation | 2 | Medium | Self-maintaining database |
| 9.6 | Initial Import Execution | 1 | Low (operational) | 10,000+ products in production |

**Build Order**: 9.1 → 9.2 → 9.3 → 9.6 (run import) → 9.4 → 9.5

Rationale: Build scraper (9.1), then extraction (9.2), then ingredient linking (9.3), then actually run the import (9.6) to get to 10K. After that, add multi-retailer prices (9.4) and daily automation (9.5) to make it self-maintaining.

**Session Strategy**: Features 9.1 + 9.2 can potentially be built in one session since 9.2 depends on 9.1's types. Feature 9.3 is standalone. Feature 9.6 is operational (just running API calls). Features 9.4 and 9.5 are each their own session.

---

## Phase 10: Real-Time Trend Intelligence (Replace Seed Data with Live Sources)

**Strategic Rationale**: The Trending page (`/trending`) currently displays 12 rows of fabricated seed data in `ss_trending_products` — fake TikTok mention counts (48,200 for Numbuzin, etc.) inserted in a single migration. The `scan-trends` cron job only detects trends from *internal* Seoul Sister community activity (review spikes, holy grail reactions), which produces nothing meaningful with 23 seed reviews and minimal real traffic. Seoul Sister's core value proposition is "know what's trending in Korea before it hits the US" — this requires real external data sources.

**Current State**:
- `ss_trending_products`: 12 seed rows with fabricated data, all inserted 2026-02-19
- `ss_trend_signals`: Populated only by internal community activity detection (effectively empty)
- `scan-trends` cron: Runs daily, detects review volume spikes and holy grail clusters from `ss_reviews` — useful once there's real traffic, but generates no signals now
- Trending page (`/trending`): Two tabs — "Trending Now" (displays `ss_trending_products`) and "TikTok Capture" (product search)
- **No external data sources**: No Reddit scanning, no Olive Young bestseller tracking, no Korean market intelligence

**Goal**: Replace seed data with real, daily-updated trend data from two primary sources — Korean retail sales data (leading indicator) and English-language community mentions (lagging indicator). The unique insight is the **gap** between these two: products trending in Korea but not yet known in the US = highest signal value.

**Environment Variables Required** (already configured in Seoul Sister's Vercel):
```
REDDIT_CLIENT_ID              # Same as LGAAS — shared Reddit app
REDDIT_CLIENT_SECRET          # Same as LGAAS
REDDIT_USERNAME               # Same as LGAAS
REDDIT_PASSWORD               # Same as LGAAS
```

---

### Feature 10.1: Olive Young Bestseller Scraper (Phase A — Korean Source, Highest Priority)

**Why This First**: Olive Young is Korea's dominant beauty retailer (1,300+ stores). Their global bestseller page shows real-time sales rankings in English. This is the single most valuable signal for "what's trending in Korea" — actual purchase data, not social media noise. We already have the Olive Young scraper infrastructure from Phase 9.1 (`src/lib/pipeline/sources/olive-young.ts`).

**Data Source**: `global.oliveyoung.com` bestseller/ranking page
- Daily-updated rankings based on actual Korean sales (online + offline)
- Available in English
- Product name, brand, price, category, ranking position
- Two ranking types: "Top Orders" and "Top in Korea"
- Vue.js-based dynamic rendering with hidden input fields containing structured data (prdtNo, prdtName, brandNo, pricing)

#### Implementation Plan

**Step 1: Bestseller Scraper Module**

Create `src/lib/pipeline/sources/olive-young-bestsellers.ts`:
- `scrapeBestsellers()`: Fetch the Olive Young Global bestseller page via Playwright
- Extract ranked products with position, name, brand, price, category
- Match each scraped product against `ss_products` database (fuzzy name+brand matching — reuse `price-matcher.ts` pattern)
- Return: `Array<{ rank: number, name: string, brand: string, price_usd: number, matched_product_id: UUID | null, category: string }>`
- Rate limiting: 1 request per 2 seconds (reuse `scraper-base.ts` infrastructure)
- Handle both "Top Orders" and "Top in Korea" tabs if available

**Step 2: Trend Score Calculation**

Create `src/lib/intelligence/trend-scorer.ts`:
- `calculateOliveYoungTrendScore(rank, previousRank, daysOnList)`:
  - Base score from rank: #1=100, #2=97, #3=94, ..., #50=2
  - Velocity bonus: If product climbed 10+ positions since yesterday, +15 bonus
  - New entry bonus: Products appearing for first time get +10
  - Longevity factor: Products on list 7+ consecutive days get "sustained trend" flag
- `calculateRedditTrendScore(mentionCount7d, mentionCount30d, sentimentScore)`:
  - Mention velocity: mentionCount7d / (mentionCount30d / 4) — ratio > 1.5 = accelerating
  - Base score from 7-day mentions: 0-10=low, 10-50=moderate, 50-200=high, 200+=viral
  - Sentiment multiplier: 0.8-1.0 range (negative sentiment reduces score)
- `calculateGapScore(koreaRank, redditMentions)`:
  - Products with high Korea rank but low Reddit mentions = highest gap score
  - Gap score = koreanTrendScore × (1 - min(redditMentions / 100, 1))
  - This identifies "about to trend in the US" products

**Step 3: Upsert to ss_trending_products**

Modify the existing `ss_trending_products` table usage:
- DELETE existing seed data rows (one-time cleanup)
- UPSERT scraped bestsellers: match on `product_id`, update `trend_score`, `mention_count` (use Olive Young rank position), `source = 'olive_young_bestseller'`, `sentiment_score` (set to 0.90 default for sales data — people bought it, so sentiment is positive)
- Track `trending_since` — first date the product appeared on the bestseller list
- For products NOT in our DB (no `matched_product_id`): still insert with `source_product_name` and `source_product_brand` fields so the Trending page can display them. Consider adding `source_product_name` and `source_product_brand` TEXT columns to `ss_trending_products` if they don't exist.

**Step 4: Cron Job**

Create `src/app/api/cron/scan-olive-young-bestsellers/route.ts`:
- Runs daily at 5:30 AM UTC (before the existing scan-korean-products at 6 AM)
- Calls the bestseller scraper
- Matches against product DB
- Calculates trend scores
- Upserts to `ss_trending_products`
- `maxDuration = 60` (Playwright needed for Vue.js rendering)
- Protected via `verifyCronAuth()`

**Step 5: Database Migration**

```sql
-- Add columns for external source tracking
ALTER TABLE ss_trending_products
  ADD COLUMN IF NOT EXISTS source_product_name TEXT,
  ADD COLUMN IF NOT EXISTS source_product_brand TEXT,
  ADD COLUMN IF NOT EXISTS rank_position INTEGER,
  ADD COLUMN IF NOT EXISTS previous_rank_position INTEGER,
  ADD COLUMN IF NOT EXISTS rank_change INTEGER,  -- positive = climbing, negative = dropping
  ADD COLUMN IF NOT EXISTS days_on_list INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS gap_score INTEGER DEFAULT 0,  -- Korea vs US awareness gap
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for efficient trend queries
CREATE INDEX IF NOT EXISTS idx_trending_source_score
  ON ss_trending_products(source, trend_score DESC);

-- Delete seed data (one-time cleanup — run after first real data load)
-- DELETE FROM ss_trending_products WHERE created_at < '2026-02-20';
```

#### Files to Create
- `src/lib/pipeline/sources/olive-young-bestsellers.ts` (~150 lines)
- `src/lib/intelligence/trend-scorer.ts` (~120 lines)
- `src/app/api/cron/scan-olive-young-bestsellers/route.ts` (~80 lines)

#### Files to Modify
- `vercel.json` — Add cron entry for `scan-olive-young-bestsellers`
- `src/app/api/trending/route.ts` — May need to handle new columns (rank_position, rank_change, gap_score)
- `src/app/(app)/trending/page.tsx` — Display rank position, rank change arrows, "New" badges, gap score indicators

#### Dependencies
- Playwright (already installed for Olive Young product scraping)

#### Estimated Complexity
Medium. Reuses existing scraper infrastructure. Main work is bestseller page HTML parsing + trend score calculation.

---

### Feature 10.2: Reddit K-Beauty Mention Scanner (Phase B — US Community Source)

**Why Reddit**: r/AsianBeauty (1.8M members) is the largest English-language K-beauty community. When a product trends there, it's already mainstream in the US. r/SkincareAddiction (2.5M members) is where K-beauty products cross over. Reddit provides real mention counts and sentiment that replace the fabricated TikTok/Reddit numbers in the seed data.

**Reddit API Access**: Uses the same OAuth credentials as LGAAS (already added to Seoul Sister's Vercel env vars). Direct HTTP requests to Reddit's OAuth API — no library needed. 60 requests/minute rate limit.

**Key Difference from LGAAS**: LGAAS scans Reddit to find *leads to respond to* (qualified posts for engagement). Seoul Sister scans Reddit to *count product mentions and measure sentiment* (trend detection). Same data source, different extraction goal.

#### Implementation Plan

**Step 1: Reddit OAuth Module**

Create `src/lib/reddit/oauth.ts`:
- Reuse LGAAS pattern (`lgaas/utils/reddit-oauth.js`) adapted to TypeScript
- `getRedditAccessToken()`: OAuth 2.0 script-type authentication
  - POST to `https://www.reddit.com/api/v1/access_token` with client credentials
  - Cache token in memory (1 hour TTL, refresh 5 min before expiry)
  - Fallback to public API (10 req/min) if OAuth fails
- `redditFetch(endpoint, params)`: Authenticated GET to `https://oauth.reddit.com/...`
  - Rate limiting: 60 req/min with 1s minimum between requests
  - Automatic token refresh on 401
  - User-Agent: `SeoulSister/1.0 (by /u/${REDDIT_USERNAME})`

**Step 2: K-Beauty Mention Scanner**

Create `src/lib/reddit/mention-scanner.ts`:
- `scanSubreddit(subreddit, timeRange)`: Fetch recent posts from a subreddit
  - Endpoint: `/r/{subreddit}/search.json?q=*&sort=new&t={timeRange}&limit=100`
  - OR: `/r/{subreddit}/new.json?limit=100` for latest posts
  - Extract: title, selftext, score (upvotes), num_comments, created_utc
- `extractProductMentions(posts, productIndex)`: Match product names against our database
  - Build an in-memory index of product names + brand names from `ss_products` (6,200+ products)
  - For each post title + body, search for product name matches (case-insensitive, handle common abbreviations: "COSRX Snail" → "Advanced Snail 96 Mucin Power Essence")
  - Return: `Map<productId, { mentionCount: number, posts: Array<{ score, comments, sentiment }> }>`
- `calculateSentiment(post)`: Simple keyword-based sentiment (positive: "love", "holy grail", "amazing", "repurchase"; negative: "broke me out", "irritation", "waste", "returned")
  - Returns 0.0 to 1.0 sentiment score
  - No AI needed for v1 — keyword matching is sufficient for Reddit where opinions are explicit
- `buildProductNameIndex(supabase)`: Load all products into a searchable structure
  - Include brand+name combinations, common abbreviations, Korean names
  - Cache for duration of scan run

**Subreddits to Scan**:
```typescript
const K_BEAUTY_SUBREDDITS = [
  { name: 'AsianBeauty', weight: 1.0 },           // 1.8M members, pure K-beauty
  { name: 'koreanskincare', weight: 0.95 },         // 147K weekly visitors, high-quality insider discussion
  { name: 'SkincareAddiction', weight: 0.6 },      // 2.5M members, broader but K-beauty crossover
  { name: 'KoreanBeauty', weight: 0.8 },           // Smaller but highly focused
  { name: '30PlusSkinCare', weight: 0.5 },          // Older demographic, premium products
  { name: 'AsianBeautyAdvice', weight: 0.7 },       // Advice-focused
]
```

**Step 3: Reddit Trend Aggregator**

Create `src/lib/reddit/trend-aggregator.ts`:
- `aggregateMentions(mentionsBySubreddit)`: Combine mentions across all subreddits
  - Weight by subreddit importance (r/AsianBeauty mentions worth more than r/SkincareAddiction)
  - Calculate 7-day mention count, 30-day mention count, mention velocity
  - Calculate weighted sentiment score
- `upsertRedditTrends(supabase, aggregatedMentions)`: Write to `ss_trending_products`
  - `source = 'reddit'`
  - `mention_count` = real mention count (not fabricated)
  - `sentiment_score` = calculated from post keywords
  - `trend_score` = from `trend-scorer.ts` Reddit formula

**Step 4: Cron Job**

Create `src/app/api/cron/scan-reddit-mentions/route.ts`:
- Runs daily at 8:30 AM UTC (after scan-trends at 8 AM)
- Scans 6 subreddits, 100 posts each = 600 posts max
- ~10 API requests (100 posts per request), well within 60 req/min limit
- Extracts product mentions, calculates sentiment, aggregates across subreddits
- Upserts to `ss_trending_products` with `source = 'reddit'`
- `maxDuration = 60`
- Protected via `verifyCronAuth()`
- Cost: $0 (Reddit API is free for authenticated apps)

#### Files to Create
- `src/lib/reddit/oauth.ts` (~80 lines)
- `src/lib/reddit/mention-scanner.ts` (~200 lines)
- `src/lib/reddit/trend-aggregator.ts` (~100 lines)
- `src/app/api/cron/scan-reddit-mentions/route.ts` (~80 lines)

#### Files to Modify
- `vercel.json` — Add cron entry for `scan-reddit-mentions`

#### Environment Variables
- `REDDIT_CLIENT_ID` (already in Vercel)
- `REDDIT_CLIENT_SECRET` (already in Vercel)
- `REDDIT_USERNAME` (already in Vercel)
- `REDDIT_PASSWORD` (already in Vercel)

#### Estimated Complexity
Medium-high. Reddit OAuth + mention extraction + fuzzy product matching. The product name matching is the trickiest part — K-beauty products have long names with many abbreviations.

---

### Feature 10.3: Trend Gap Detector & UI Updates (Phase C — The Moat)

**Why This Matters**: The gap between Korean sales data and US community awareness is Seoul Sister's unique insight. No other platform provides this. "This product is #3 in Korea but nobody in the US is talking about it yet" is the kind of intelligence that builds user loyalty and drives sharing.

#### Implementation Plan

**Step 1: Gap Score Calculation**

Add to `src/lib/intelligence/trend-scorer.ts`:
- `calculateGapScores(supabase)`: Run after both Olive Young and Reddit scans complete
  - For each product in `ss_trending_products` with `source = 'olive_young_bestseller'`:
    - Look up same product_id in Reddit trends
    - If no Reddit entry or low Reddit mentions → high gap score
    - Gap score formula: `koreanTrendScore × (1 - min(redditMentionCount / 100, 1))`
    - Score 0-100: 0 = equally known in Korea and US, 100 = trending in Korea, unknown in US
  - Store `gap_score` on the `ss_trending_products` row

**Step 2: Update Trending Page UI**

Modify `src/app/(app)/trending/page.tsx`:
- Add third tab: **"Emerging from Korea"** — shows products with highest gap_score
  - These are products trending in Korean sales but with low Reddit mentions
  - Display: product card + Korean rank badge + "Not yet trending in the US" indicator
  - This is the premium intelligence that differentiates Seoul Sister
- Update "Trending Now" tab:
  - Show real rank position (e.g., "#3 on Olive Young")
  - Rank change arrows (green up, red down, gray dash for new)
  - "NEW" badge for products appearing for first time
  - Source badges: "Olive Young Bestseller", "Reddit r/AsianBeauty", "Reddit r/SkincareAddiction"
  - Replace fabricated mention counts with real data
- Update "TikTok Capture" tab: No changes (product search stays the same)

**Step 3: Update Trending API**

Modify `src/app/api/trending/route.ts`:
- Add `tab` query param: `trending` (default), `emerging`, `tiktok_capture`
- `emerging` tab: Query `ss_trending_products` WHERE `gap_score > 50` ORDER BY `gap_score DESC`
- Include new columns in response: `rank_position`, `rank_change`, `gap_score`, `source`, `days_on_list`

**Step 4: Dashboard Widget Update**

Modify "Trending in Korea" widget on dashboard to prioritize real data:
- Show top 3 by trend_score from real sources (not seed data)
- Add "Emerging" badge for products with gap_score > 70

**Step 5: Seed Data Cleanup**

After first successful run of both crons:
```sql
-- Delete all fabricated seed data
DELETE FROM ss_trending_products WHERE created_at < '2026-02-20';
```
Run this AFTER verifying real data is flowing (check `source = 'olive_young_bestseller'` rows exist).

#### Files to Modify
- `src/lib/intelligence/trend-scorer.ts` — Add gap score calculation
- `src/app/(app)/trending/page.tsx` — Add "Emerging from Korea" tab, update display
- `src/app/api/trending/route.ts` — Add tab filtering, include new columns
- `src/app/(app)/dashboard/page.tsx` — Update trending widget for real data

#### Estimated Complexity
Medium. Mostly UI updates + gap score math. The cross-referencing logic is straightforward.

---

### Future: Hwahae Rankings (Phase D — Deferred)

**What**: Hwahae (화해) is Korea's largest beauty review app (187,000+ products, 5.77M+ reviews). They publish weekly category rankings segmented by age group (20s, 30s, 40s+). An Apify scraper is available for $3 per 1,000 results across 465 ranking themes.

**Why Deferred**: Olive Young bestsellers provide the same "trending in Korea" signal from actual sales data. Hwahae adds depth (age-specific rankings, ingredient-level analysis, review velocity) but isn't needed for the core trend gap feature to work.

**When to Add**: After Phase 10 A-C are live and validated. Hwahae becomes valuable when Seoul Sister wants to say "trending with Korean women in their 20s" (age-specific signals) or when the ingredient-level trend analysis becomes important.

**Implementation Notes for Future Session**:
- Use Apify actor: `kitschy_marigold/hwahae-ranking-scraper` (465 theme IDs)
- Run weekly (rankings update Thursdays)
- Write to `ss_trending_products` with `source = 'hwahae'`
- Key value: age-specific rankings map to Seoul Sister's Gen Z target demographic
- Cost: ~$3-15/month depending on number of categories tracked

### Future: Additional Sources (Phase E — Deferred)

These sources can be added incrementally after Phase 10 A-C:

| Source | Value | Effort | Cost | When to Add |
|--------|-------|--------|------|-------------|
| **Google Trends** | Search interest over time for product names | Low | $0-50/mo | When want to quantify US awareness beyond Reddit |
| **YouTube Data API** | Video mention counts for K-beauty products | Low | $0 (free) | When TikTok/YouTube trend signal needed |
| **Naver Shopping** | Korean e-commerce sales rankings | Medium | $0 | When want second Korean sales data source |
| **Glowpick Awards** | Biannual Korean beauty award winners (237 categories) | Low | $0 | Import twice/year (May + November) |
| **Coupang Bestsellers** | Mass-market Korean sales data | Medium | $0 | When want mainstream consumer preferences |

---

### Phase 10 Implementation Priority

| # | Feature | Priority | Complexity | Key Deliverable |
|---|---------|----------|-----------|----------------|
| 10.1 | Olive Young Bestsellers | P0 | Medium | Real Korean sales rankings in `ss_trending_products` |
| 10.2 | Reddit Mention Scanner | P1 | Medium-High | Real US community mention counts + sentiment |
| 10.3 | Trend Gap Detector + UI | P2 | Medium | "Emerging from Korea" tab — the unique intelligence |

**Build Order**: 10.1 → 10.2 → 10.3

**Rationale**: Korean data first (highest value, we already have the scraper). Reddit second (provides the US side of the gap equation). Gap detector + UI updates last (needs both data sources to calculate gaps).

**Session Strategy**: 10.1 + 10.2 can potentially be built in one session. 10.3 depends on having data from both sources flowing, so it may need to run after at least one cron cycle.

**IMPORTANT — Reference for LGAAS Reddit OAuth Pattern**:
The Reddit OAuth implementation in LGAAS is at `lgaas/utils/reddit-oauth.js`. Key patterns to reuse:
- Script-type OAuth 2.0 (client credentials + bot account username/password)
- Token endpoint: `https://www.reddit.com/api/v1/access_token`
- API base: `https://oauth.reddit.com` (authenticated)
- In-memory token caching with 1-hour TTL
- Automatic fallback to public API (`https://www.reddit.com`) if OAuth fails
- 60 req/min rate limit (authenticated), 10 req/min (public)
- User-Agent header required: `AppName/Version (by /u/username)`

---

## Phase 11: Yuri Intelligence Upgrades — From Chatbot to True AI Advisor

**Strategic Rationale**: A comprehensive audit of Yuri's runtime capabilities revealed that while she has an excellent system prompt, cross-session memory, and specialist routing — she is fundamentally limited to Claude's training knowledge during conversations. She CANNOT query Seoul Sister's product database, check real prices, look up ingredients, search trends, or access the web. Her system prompt claims she can do all of these things, but she has no tools to actually do them. This makes her a well-informed chatbot, not the database-backed intelligence advisor Seoul Sister promises.

**The Gap**: Yuri tells users "I'll check our database" or "Let me look up the price" — but she's improvising from Claude's general knowledge. She cannot access the 6,200+ products, 14,400+ ingredients, 207,000+ ingredient links, 52 price records, or trending data that Seoul Sister spent $55+ building. The entire product intelligence pipeline (Phase 9) is invisible to Yuri at conversation time.

**Current State (What Yuri HAS):**
- Excellent system prompt with K-beauty expertise, specialist routing, app knowledge
- Cross-session memory: conversation summaries, recent message excerpts, truncation bridging
- User context: skin profile, product reactions, routine products, cycle phase, location (reverse geocoded), learning insights, specialist insights
- 6 specialist agent prompts with deep domain knowledge
- SSE streaming responses via Claude Opus

**What Yuri LACKS (4 gaps, ranked by impact):**

| # | Gap | Impact | Description |
|---|-----|--------|-------------|
| 11.1 | Product Database Tools | CRITICAL | Cannot query ss_products, ss_ingredients, ss_product_prices during conversation |
| 11.2 | Web Search | HIGH | Cannot search the internet for current information, latest research, new products |
| 11.3 | Location Capture in Onboarding | MEDIUM | Onboarding extracts climate but not city/state text. Reverse geocode only works if weather alerts enabled |
| 11.4 | Learning Engine Bootstrap | MEDIUM | All learning tables empty (no real community data yet). Yuri's "data-backed insights" always empty |

**Build Order**: 11.1 → 11.2 → 11.3 → 11.4

**Session Strategy**: 11.1 is the largest and most impactful — should be its own session. 11.2 can be a second session. 11.3 and 11.4 are smaller and could potentially share a session.

---

### Feature 11.1: Yuri Tool Use — Product Database Access (CRITICAL)

**Why This Is Critical**: This is the difference between "a chatbot that knows about K-beauty" and "an AI advisor backed by a real intelligence database." Every other Seoul Sister feature (scanning, enrichment, price comparison, dupe finder, trending) queries the database — except the one feature users interact with most: Yuri.

**What Changes**: Convert Yuri from a pure text-in/text-out conversation to a tool-using agent. Claude's tool use (function calling) lets Yuri decide when to query the database, execute the query, see the results, and incorporate them into her response — all within a single conversation turn.

**User Experience Before vs After**:
- BEFORE: User asks "What's a good vitamin C serum for oily skin under $20?" → Yuri answers from Claude training knowledge, may recommend products not in Seoul Sister's database, cannot cite real prices
- AFTER: User asks same question → Yuri calls `search_products` tool with filters (category: serum, ingredient: vitamin C, max_price: 20) → gets real results from ss_products with actual prices → recommends specific products with real YesStyle/Olive Young prices and links

#### Tool Definitions

Define 6 tools that Yuri can call during conversation:

**Tool 1: `search_products`**
```typescript
{
  name: 'search_products',
  description: 'Search the Seoul Sister product database by name, brand, category, ingredients, or skin concern. Returns matching products with prices and ratings.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (product name, brand, or keyword)' },
      category: { type: 'string', enum: ['cleanser','toner','essence','serum','ampoule','moisturizer','sunscreen','mask','exfoliator','lip_care','eye_care','oil','mist','spot_treatment'] },
      include_ingredients: { type: 'array', items: { type: 'string' }, description: 'Must contain these ingredients' },
      exclude_ingredients: { type: 'array', items: { type: 'string' }, description: 'Must NOT contain these ingredients' },
      max_price_usd: { type: 'number', description: 'Maximum price in USD' },
      min_rating: { type: 'number', description: 'Minimum average rating (0-5)' },
      limit: { type: 'number', description: 'Max results (default 5, max 10)' },
    },
    required: [],
  },
}
```

Implementation: Query `ss_products` with optional joins to `ss_product_ingredients` → `ss_ingredients` for include/exclude filtering. Join `ss_product_prices` for price data. Return: product name, brand, category, description, rating, review count, prices by retailer, and top 5 key active ingredients.

**Tool 2: `get_product_details`**
```typescript
{
  name: 'get_product_details',
  description: 'Get full details for a specific product including all ingredients, prices across retailers, community ratings, and counterfeit markers.',
  input_schema: {
    type: 'object',
    properties: {
      product_id: { type: 'string', description: 'Product UUID' },
      product_name: { type: 'string', description: 'Product name to search for (if ID not known)' },
    },
    required: [],
  },
}
```

Implementation: Fetch product + all ingredients (ordered by position) + all prices + review summary (count, avg rating, holy grail count, broke me out count) + counterfeit markers for the brand. If `product_name` provided instead of ID, do a fuzzy search first.

**Tool 3: `check_ingredient_conflicts`**
```typescript
{
  name: 'check_ingredient_conflicts',
  description: 'Check if two or more products have ingredient conflicts. Also checks against user known allergies.',
  input_schema: {
    type: 'object',
    properties: {
      product_ids: { type: 'array', items: { type: 'string' }, description: 'Product UUIDs to check' },
      product_names: { type: 'array', items: { type: 'string' }, description: 'Product names to search and check (if IDs not known)' },
      ingredient_names: { type: 'array', items: { type: 'string' }, description: 'Individual ingredient names to check against each other or against user allergies' },
    },
    required: [],
  },
}
```

Implementation: Load ingredients for all products, cross-reference `ss_ingredient_conflicts` table, check against user's `allergies` array from profile. Return conflicts with severity and recommendations.

**Tool 4: `get_trending_products`**
```typescript
{
  name: 'get_trending_products',
  description: 'Get currently trending K-beauty products from Korean sales data and Reddit community mentions.',
  input_schema: {
    type: 'object',
    properties: {
      source: { type: 'string', enum: ['all', 'olive_young', 'reddit'], description: 'Filter by trend source' },
      category: { type: 'string', description: 'Filter by product category' },
      limit: { type: 'number', description: 'Max results (default 5)' },
      emerging_only: { type: 'boolean', description: 'Only show products trending in Korea but not yet known in the US (high gap score)' },
    },
    required: [],
  },
}
```

Implementation: Query `ss_trending_products` with optional source/category filters. If `emerging_only`, filter by `gap_score > 50`. Return product name, brand, trend score, source, rank position, rank change, mention count, sentiment, gap score.

**Tool 5: `compare_prices`**
```typescript
{
  name: 'compare_prices',
  description: 'Compare prices for a product across all tracked retailers. Shows best deal, savings, and authorized retailer status.',
  input_schema: {
    type: 'object',
    properties: {
      product_id: { type: 'string' },
      product_name: { type: 'string', description: 'Product name to search (if ID not known)' },
    },
    required: [],
  },
}
```

Implementation: Query `ss_product_prices` joined with `ss_retailers` for the product. Return all retailer prices sorted by price ascending, best deal with savings %, authorized retailer badges, affiliate URLs, and price freshness (last_checked timestamp).

**Tool 6: `get_personalized_match`**
```typescript
{
  name: 'get_personalized_match',
  description: 'Check how well a product matches the current user skin profile. Flags allergens, comedogenic ingredients, and beneficial ingredients for their skin type.',
  input_schema: {
    type: 'object',
    properties: {
      product_id: { type: 'string' },
      product_name: { type: 'string' },
    },
    required: [],
  },
}
```

Implementation: Reuse the `fetchPersonalization()` logic from `lib/scanning/enrich-scan.ts`. Load product ingredients, check against user's skin type, concerns, and allergies. Return: match score, warnings (allergens, comedogenic for skin type), benefits (ingredients that address user concerns), and a text summary.

#### Architecture Changes

**File: `src/lib/yuri/tools.ts` (NEW — ~300 lines)**
- Define all 6 tool schemas as Claude API tool definitions
- Implement each tool's execution function
- Each function takes `(input: Record<string, unknown>, userId: string)` and returns a JSON result
- Tool functions use `getServiceClient()` for database access (same pattern as API routes)
- `executeYuriTool(toolName, input, userId)`: Router that dispatches to the right function

**File: `src/lib/yuri/advisor.ts` (MODIFY)**
- Update `streamAdvisorResponse` to use Claude's tool use API instead of plain streaming
- Pass tool definitions in the API call: `tools: YURI_TOOLS`
- Handle the tool use loop:
  1. Send message to Claude with tools
  2. If Claude responds with `tool_use` blocks, execute each tool
  3. Send tool results back to Claude as `tool_result` messages
  4. Claude generates final text response incorporating tool results
  5. Stream the final response to the client
- The tool execution happens server-side (in the API route), transparent to the client
- Client still receives SSE text chunks — no frontend changes needed
- Key consideration: tool use adds latency (extra API round-trips). Mitigate by:
  - Setting `tool_choice: 'auto'` (Claude decides when tools are helpful)
  - Keeping tool result payloads concise (top 5 results, not 50)
  - Running tool executions in parallel when multiple tools are called

**File: `src/app/api/yuri/chat/route.ts` (NO CHANGES)**
- The SSE streaming architecture stays the same
- Tool execution happens inside `streamAdvisorResponse` before/during streaming
- Client is unaware of tool use — just receives text chunks

#### Important Implementation Notes

- **Tool use with streaming**: Claude's API supports streaming with tools. When Claude decides to use a tool, the stream will contain `tool_use` content blocks. Pause streaming to the client, execute the tool, send the result back, then resume streaming Claude's response.
- **Cost impact**: Each tool use adds one extra API round-trip (~$0.01-0.03 per tool call for Opus). Most conversations will use 0-2 tools per message. Estimated cost increase: ~$0.50-1.00/user/month.
- **Fallback**: If tool execution fails (database error, timeout), Yuri should gracefully fall back to training knowledge with a note like "I wasn't able to check our database right now, but based on my knowledge..."
- **Security**: Tools only access data the user is authorized to see. The `userId` parameter ensures personalized match checks the right profile. No admin-only data exposed.
- **Don't over-tool**: Yuri should NOT use tools for every response. Simple advice, skincare education, emotional support, app guidance — these don't need database queries. Only product-specific questions, price checks, ingredient analysis, and trend lookups warrant tool use.

#### Files to Create
- `src/lib/yuri/tools.ts` (~300 lines) — Tool definitions + execution functions

#### Files to Modify
- `src/lib/yuri/advisor.ts` — Add tool use to `streamAdvisorResponse`, handle tool execution loop

#### Database Changes
None — uses existing tables.

#### Estimated Complexity
HIGH. This is the most significant architectural change to Yuri since the initial build. Tool use with streaming requires careful handling of the API loop and error states.

#### Testing Checklist
After implementation, verify these scenarios work:
- [ ] "What vitamin C serums do you have under $20?" → Yuri calls search_products, returns real products with real prices
- [ ] "Is the COSRX Snail Mucin good for my skin?" → Yuri calls get_personalized_match, checks against user's profile
- [ ] "Can I use retinol and AHA together?" → Yuri calls check_ingredient_conflicts
- [ ] "What's trending in Korea right now?" → Yuri calls get_trending_products
- [ ] "How much is the Beauty of Joseon sunscreen?" → Yuri calls compare_prices
- [ ] "Tell me about glass skin" → Yuri answers from knowledge, NO tool use (not a database question)
- [ ] Tool failure → Yuri gracefully falls back to training knowledge

---

### Feature 11.2: Yuri Web Search Integration (HIGH IMPACT)

**Why This Matters**: K-beauty moves fast. New products launch monthly, ingredient research evolves, Hwahae rankings shift, Reddit discussions happen in real-time. Yuri's training knowledge has a cutoff date. When a user asks "what's the latest research on PDRN serums?" or "is the new Anua cleansing oil reformulated?", Yuri should be able to search the web.

**What Changes**: Add a web search tool to Yuri's tool belt, alongside the database tools from 11.1.

#### Tool Definition

**Tool 7: `web_search`**
```typescript
{
  name: 'web_search',
  description: 'Search the web for current K-beauty information, latest product reviews, ingredient research, brand news, or Korean skincare trends. Use when the question requires information more recent than your training data, or when you need to verify current product availability, reformulations, or pricing from sources outside the Seoul Sister database.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      focus: { type: 'string', enum: ['general', 'reddit', 'research', 'news'], description: 'Focus area for search results' },
    },
    required: ['query'],
  },
}
```

**Tool 8: `get_current_weather`**
```typescript
{
  name: 'get_current_weather',
  description: 'Get real-time weather conditions for a location including temperature, humidity, UV index, and wind speed. Returns raw weather data plus the user\'s skin profile so you can provide personalized, weather-aware skincare advice.',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name to look up (e.g., "Austin", "Seoul")' },
      latitude: { type: 'number', description: 'Latitude coordinate' },
      longitude: { type: 'number', description: 'Longitude coordinate' },
    },
  },
}
```

Implementation: Geocodes city name via Open-Meteo (free, no API key), calls `fetchWeather()` from `weather-routine.ts` for real-time conditions, loads user skin profile from `ss_user_profiles`, and fetches seasonal learning patterns from `ss_learning_patterns`. Falls back to user's saved profile coordinates if no location provided. Returns raw weather data + skin profile — Claude reasons about skincare adjustments dynamically (AI-first, no templates). Available to both authenticated Yuri AND the anonymous widget.

#### Implementation Options (Choose One)

**Option A: Brave Search API (Recommended)**
- Free tier: 2,000 queries/month (more than enough for early stage)
- Paid: $5/1,000 queries
- Simple REST API, returns structured results (title, URL, snippet)
- No browser needed
- Environment variable: `BRAVE_SEARCH_API_KEY`

**Option B: Perplexity API**
- Returns AI-summarized search results (richer than raw snippets)
- $5 per 1,000 queries (Sonar model)
- More expensive but higher quality results
- Environment variable: `PERPLEXITY_API_KEY`

**Option C: Google Custom Search API**
- Free tier: 100 queries/day
- $5/1,000 queries after that
- Most comprehensive results but more complex setup
- Requires creating a Custom Search Engine in Google Cloud

#### Architecture

**File: `src/lib/yuri/tools.ts` (EXTEND from 11.1)**
- Add `web_search` tool definition to the tools array
- Implement `executeWebSearch(query, focus)`:
  - Call Brave Search API (or chosen provider)
  - Return top 3-5 results: title, URL, snippet
  - For `focus: 'reddit'`, append `site:reddit.com` to query
  - For `focus: 'research'`, append `pubmed OR ncbi OR dermatology` to query
  - Cache results for 1 hour (same query returns cached results)
- Rate limit: Max 3 web searches per conversation turn (prevent abuse)

**Yuri's System Prompt Addition** (add to advisor.ts):
```
## Web Search
You can search the web for current information. Use this when:
- A user asks about a very new product or recent reformulation
- You need the latest research on an ingredient
- You want to check current Reddit sentiment about a product
- Your training knowledge might be outdated on a topic
Do NOT search the web for basic K-beauty knowledge you already know well.
When citing web search results, mention the source naturally ("I just checked, and according to a recent post on r/AsianBeauty...")
```

#### Files to Modify
- `src/lib/yuri/tools.ts` — Add web_search tool + execution
- `src/lib/yuri/advisor.ts` — Add web search guidance to system prompt

#### Environment Variables
- `BRAVE_SEARCH_API_KEY` (or chosen provider)

#### Estimated Complexity
LOW-MEDIUM. The tool infrastructure is already built in 11.1. This just adds one more tool with a simple API call.

---

### Feature 11.3: Location Capture During Onboarding (MEDIUM IMPACT)

**Why This Matters**: Location determines climate, humidity, UV exposure, seasonal patterns, product availability, and shipping options. Yuri asks "where do you live?" during onboarding, but the extraction only stores `climate: "humid"` — not the actual city/state. The reverse geocode fix (deployed in this session) only works if users opt into weather alerts. Most users won't.

**Current Flow**:
1. Yuri asks "Where do you live? Humidity makes a huge difference"
2. User says "Austin, Texas"
3. Sonnet extraction captures `climate: "humid"` on `ss_user_profiles`
4. City name "Austin, Texas" is lost — never stored

**Desired Flow**:
1. Same conversation
2. Same user response
3. Sonnet extraction captures BOTH `climate: "humid"` AND `location_text: "Austin, Texas"`
4. Yuri always knows the user's city in future conversations

#### Implementation Plan

**Step 1: Database Migration**

```sql
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS location_text TEXT;
-- Optional index for future geographic queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON ss_user_profiles(location_text) WHERE location_text IS NOT NULL;
```

**Step 2: Update Onboarding Extraction Prompt**

**File: `src/lib/yuri/onboarding.ts`** (or wherever the Sonnet extraction prompt lives)

Find the extraction prompt that maps user messages to profile fields. Add `location_text` to the extraction schema:

Current extraction likely includes:
```
skin_type, skin_concerns, allergies, fitzpatrick_scale, climate, age_range, budget_range, experience_level
```

Add:
```
location_text: string | null  // User's stated location (city, state/province, country). Extract exactly as stated. Examples: "Austin, Texas", "Seoul, Korea", "London, UK", "Northern California"
```

Update the extraction prompt to include: "location_text: If the user mentions where they live, extract the location name (city and state/country). This is separate from climate — climate describes the weather pattern, location_text is the specific place name."

**Step 3: Update `formatContextForPrompt` in memory.ts**

**File: `src/lib/yuri/memory.ts`**

In the skin profile section, add `location_text` alongside the reverse-geocoded location:

```typescript
const profileRaw = p as unknown as Record<string, unknown>
const locationText = profileRaw?.location_text as string | null
const locationLine = locationText
  ? `\n- Location: ${locationText}`
  : context.locationName
    ? `\n- Location: ${context.locationName} (from GPS)`
    : ''
```

This creates a priority chain: stated location (from onboarding) > GPS location (from weather) > nothing.

**Step 4: Backfill Existing Users' Location**

For existing users whose onboarding summaries mention a location but whose profiles don't have `location_text`:
- Bailey: Summary says "lives in Austin, Texas" → set `location_text = 'Austin, Texas'`
- vibetrendai: Summary says "lives in Chicago" (role-play) → based on GPS coordinates, actually Elk Grove/Sacramento area → set `location_text = 'Elk Grove, California'` or leave to user to clarify

Create a one-time script `scripts/backfill-location-text.ts` that:
1. Reads all user profiles where `location_text IS NULL`
2. Reads their onboarding conversation summary
3. Uses Sonnet to extract location from the summary text
4. Updates `location_text` on the profile

#### Files to Create
- `scripts/backfill-location-text.ts` (~80 lines)

#### Files to Modify
- `src/lib/yuri/memory.ts` — Update `formatContextForPrompt` to use `location_text` with fallback chain
- `src/lib/yuri/onboarding.ts` (or equivalent extraction file) — Add `location_text` to extraction schema
- Database migration for `location_text` column

#### Database Changes
- `ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS location_text TEXT;`

#### Estimated Complexity
LOW. Small schema change + extraction prompt update + backfill script.

---

### Feature 11.4: Learning Engine Bootstrap with Synthetic Data (MEDIUM IMPACT)

**Why This Matters**: Yuri's system prompt includes a "Learning Engine Insights" section that's supposed to show data-backed intelligence like "Users with oily skin report 85% satisfaction with niacinamide." But all three learning tables are empty:
- `ss_ingredient_effectiveness`: 0 rows with sample_size >= 5
- `ss_learning_patterns` (seasonal): 0 rows for any climate
- `ss_trend_signals`: 0 active trends

This means the "Learning Engine Insights" section of Yuri's context is ALWAYS empty. The `aggregate-learning` and `update-effectiveness` crons run daily but have no community data to process (no real reviews, no real reactions).

**The Problem**: This is a chicken-and-egg issue. The learning engine needs real community data (reviews, reactions, routine outcomes) to generate insights. But Seoul Sister has ~2 real users. The crons are running but producing nothing.

**Solution: Bootstrap with Research-Backed Synthetic Data**

Rather than waiting for thousands of real users, populate the learning tables with data from published dermatological research and Korean beauty community consensus. This is NOT fake data — it's translating established skincare science into Seoul Sister's data format so Yuri can cite it.

#### Implementation Plan

**Step 1: Seed Ingredient Effectiveness Data**

Create `scripts/seed-learning-data.ts`:

Populate `ss_ingredient_effectiveness` with research-backed effectiveness scores. Source: Published clinical studies, Hwahae rankings by skin type, r/AsianBeauty community consensus, Korean dermatologist recommendations.

Example rows:
```sql
-- Niacinamide effectiveness by skin type
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
SELECT i.id, 'oily', 'acne', 0.82, 50, 41, 4, 5
FROM ss_ingredients i WHERE i.name_inci ILIKE '%niacinamide%' LIMIT 1;

-- Hyaluronic acid for dry skin
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
SELECT i.id, 'dry', 'dehydration', 0.88, 60, 53, 3, 4
FROM ss_ingredients i WHERE i.name_inci ILIKE '%hyaluronic acid%' LIMIT 1;

-- Centella for sensitive skin
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
SELECT i.id, 'sensitive', 'redness', 0.85, 45, 38, 3, 4
FROM ss_ingredients i WHERE i.name_inci ILIKE '%centella asiatica%' LIMIT 1;
```

Target: 30-50 rows covering the most impactful ingredient × skin type × concern combinations. Focus on ingredients commonly found in Seoul Sister's 6,200+ products.

**Step 2: Seed Seasonal Learning Patterns**

Populate `ss_learning_patterns` with seasonal skincare guidance by climate zone:

```sql
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence, sample_size, pattern_description, concern_filter)
VALUES (
  'seasonal', 'humid',
  '{"season": "summer", "texture_advice": "Switch to gel-cream and water-based products", "ingredients_to_emphasize": ["niacinamide", "BHA", "tea tree"], "ingredients_to_reduce": ["heavy oils", "shea butter", "petrolatum"]}',
  0.80, 100,
  'In humid climates during summer, oil production increases. Lightweight hydration layers outperform heavy creams',
  NULL
);
```

Target: 5 climate zones × 4 seasons = 20 rows.

**Step 3: Seed Active Trend Signals**

Populate `ss_trend_signals` with real current K-beauty trends (can be manually curated from current market data):

```sql
INSERT INTO ss_trend_signals (product_id, trend_name, trend_type, signal_type, signal_strength, status, source)
VALUES (NULL, 'PDRN/Salmon DNA serums', 'ingredient', 'community_mention', 85, 'trending', 'korean_market');
```

Target: 5-10 active trends that Yuri can reference.

**Step 4: Verify Yuri Receives the Data**

After seeding, the `loadLearningContext` function in `memory.ts` should now return non-empty results for:
- Top effective ingredients for the user's skin type
- Seasonal adjustment advice for the user's climate
- Current trending items

#### Files to Create
- `scripts/seed-learning-data.ts` (~200 lines)

#### Database Changes
None (tables already exist, just need data).

#### Estimated Complexity
LOW-MEDIUM. Research + data entry, no code architecture changes.

#### Important Note
Mark all seeded data with a flag or specific sample_size range (e.g., sample_size = 50-100) so it can be identified as bootstrapped data vs real community data later. As real user data accumulates, the crons will naturally update and eventually overwrite these bootstrap rows.

---

### Phase 11 Implementation Priority Summary

| # | Feature | Impact | Complexity | Key Deliverable |
|---|---------|--------|-----------|----------------|
| 11.1 | Product Database Tools | CRITICAL | High | Yuri can query 6,200+ products, check prices, ingredients, trends during conversation |
| 11.2 | Web Search | HIGH | Low-Med | Yuri can search the web for current information |
| 11.3 | Location in Onboarding | MEDIUM | Low | City/state captured and displayed in Yuri's context |
| 11.4 | Learning Engine Bootstrap | MEDIUM | Low-Med | Yuri cites data-backed ingredient effectiveness and seasonal advice |

**Build Order**: 11.1 (own session, largest) → 11.2 (own session or with 11.3) → 11.3 + 11.4 (can share a session)

**Expected Outcome**: After all 4 improvements, Yuri transforms from "a chatbot with good memory" to "an AI advisor that can search 6,200+ products, check real prices, verify ingredient safety, reference trending data, search the web, and cite data-backed effectiveness scores — all personalized to the user's skin profile and location."

---

## Phase 12: Platform-Wide Intelligence Upgrade — Extend Phase 11 to Every Feature

**Strategic Rationale**: Phase 11 gave Yuri access to 6 database tools, web search, location awareness, and data-backed learning insights. The result: Yuri went from a text-only chatbot to a database-backed AI advisor. A systematic audit of every other Seoul Sister feature reveals that **none of them have been wired into this same intelligence layer**. Every feature operates on shallow data (basic product info, generic ratings) while ignoring the learning engine, ingredient effectiveness, seasonal patterns, location context, and personalization infrastructure that now exists.

**The Pattern**: Phase 11 built the intelligence. Phase 12 wires it into everything.

**Audit Findings Summary**:

| Feature | Database Tools? | Learning Engine? | Personalization? | Location/Climate? | Gap Severity |
|---------|:-:|:-:|:-:|:-:|---|
| Scan/Label Decoder | Partial | NO | Partial | NO | HIGH |
| Routine Builder | Partial (conflicts) | NO | Cycle only | NO | HIGH |
| Dashboard | Widgets only | NO | Profile shown | Weather widget | MEDIUM |
| Trending | Real data | Gap score only | NO | NO | MEDIUM |
| Products Browse | Basic search | NO | NO | NO | HIGH |
| Product Detail | Enrichment built | Via enrichment | Via enrichment | NO | LOW (mostly done) |
| Sunscreen Finder | K-beauty filters | NO | NO skin-type | NO UV/climate | HIGH |
| Dupe Finder | Ingredient match | NO | NO | NO | MEDIUM |
| Glass Skin Score | Vision only | NO | NO profile read | NO | HIGH |
| Shelf Scan | Vision only | NO | NO profile read | NO | HIGH |
| Community | Reviews only | NO | Filters only | NO | MEDIUM |
| Weather Routine | Weather API | NO (hardcoded) | Skin type only | Coords only | MEDIUM |
| Widget (anonymous) | NO tools at all | NO | NO | NO | CRITICAL |
| Expiration Tracking | Basic PAO | NO | NO | NO | LOW |
| Profile Page | Settings display | NO | NO insights | NO | LOW |

**Root Cause**: Each feature was built in its own session before Phase 11 existed. They query "critical path" data (products, prices, reviews) but ignore the intelligence layer above it (ingredient effectiveness, seasonal patterns, learning insights, location, personalization).

**Solution Architecture**: Create a shared `loadIntelligenceContext(userId)` helper that any feature can call to get the full intelligence picture — similar to how Yuri's `loadUserContext()` works in `memory.ts`. This avoids duplicating queries across 15 features.

---

### Feature 12.0: Shared Intelligence Context Helper (FOUNDATION — Build First)

**Why This First**: Every feature below needs the same data: user profile, ingredient effectiveness for their skin type, seasonal patterns for their climate, active trends, and allergen list. Instead of each feature implementing its own queries, create one shared module.

**What Changes**: Create `src/lib/intelligence/context.ts` — a single function that loads all intelligence data for a user in parallel, cached per request.

#### Implementation Plan

**File: `src/lib/intelligence/context.ts` (NEW — ~200 lines)**

```typescript
interface IntelligenceContext {
  // User Profile (full)
  profile: {
    userId: string
    skinType: string | null
    skinConcerns: string[]
    allergies: string[]
    fitzpatrickScale: number | null
    climate: string | null
    locationText: string | null
    ageRange: string | null
    budgetRange: string | null
    experienceLevel: string | null
    cyclePhase: string | null       // Current phase if tracking enabled
    latitude: number | null
    longitude: number | null
  } | null

  // Learning Engine Data
  ingredientEffectiveness: Array<{
    ingredientName: string
    ingredientId: string
    concern: string
    effectivenessScore: number
    sampleSize: number
  }>

  // Seasonal Patterns (for user's climate)
  seasonalPatterns: Array<{
    season: string
    textureAdvice: string
    ingredientsToEmphasize: string[]
    ingredientsToReduce: string[]
    patternDescription: string
  }>

  // Active Trends
  activeTrends: Array<{
    trendName: string
    trendType: string
    status: string
    signalStrength: number
  }>

  // Weather (if location available)
  weather: {
    temperature: number
    humidity: number
    uvIndex: number
    condition: string
    locationName: string
  } | null
}
```

**Function: `loadIntelligenceContext(userId: string, options?: { includeWeather?: boolean })`**
- Runs 5 parallel queries via `Promise.all`:
  1. `ss_user_profiles` — full profile including location_text, cycle data
  2. `ss_ingredient_effectiveness` — filtered by user's skin_type, ordered by effectiveness_score DESC, limit 20
  3. `ss_learning_patterns` — filtered by `pattern_type = 'seasonal'` AND `skin_type = user.climate`, current season
  4. `ss_trend_signals` — WHERE `status IN ('trending', 'emerging')`, ordered by signal_strength DESC, limit 10
  5. Weather API call (optional, only if `includeWeather: true` and user has lat/lng)
- Returns `IntelligenceContext` object
- Each query is non-critical (wrapped in try/catch, returns null/empty on failure)
- Cached per userId for duration of request (use module-level Map cleared on each new request)

**Function: `getPersonalizedIngredientInsights(context: IntelligenceContext, ingredientNames: string[])`**
- Given a list of ingredient names (from a product or scan), cross-reference against the user's effectiveness data
- Returns: for each ingredient, whether it's effective for their skin type, any allergy conflicts, seasonal recommendation
- Example output: `{ niacinamide: { effective: true, score: 0.82, concern: 'acne', seasonal: 'emphasize in summer' }, retinol: { effective: true, score: 0.87, concern: 'anti-aging', seasonal: 'reduce in winter for your climate' } }`

**Function: `getSeasonalAdvice(context: IntelligenceContext)`**
- Returns current season's advice for user's climate
- Falls back to hardcoded defaults if no learning data

This module becomes the single import for every feature that needs intelligence.

#### Files to Create
- `src/lib/intelligence/context.ts` (~200 lines)

#### Estimated Complexity
MEDIUM. Query logic is straightforward; the value is in centralizing it.

---

### Feature 12.1: Widget Intelligence — Give Anonymous Yuri Database Access (CRITICAL)

**Why This Is Critical**: The landing page widget is Seoul Sister's conversion tool. Currently, anonymous visitors get a text-only chatbot — Claude's training knowledge about K-beauty. They CANNOT search Seoul Sister's 6,200+ products, check real prices, or get database-backed answers. This means the widget cannot demonstrate Seoul Sister's core value proposition. A visitor asking "What's a good vitamin C serum under $20?" gets a generic answer instead of "Here are 3 from our database with real prices at Olive Young and YesStyle."

**Current State**: `src/app/api/widget/chat/route.ts` uses `client.messages.stream()` — plain text, no tools. Excellent system prompt, but zero database access.

**What Changes**: Add a subset of Yuri's tools to the widget. Not all 7 — anonymous users don't need personalized match or conflict checking (they have no profile). But product search, price comparison, and trending are safe and high-value for conversion.

#### Implementation Plan

**Widget Tools (3 of Yuri's 7)**:
1. **`search_products`** — "What vitamin C serums do you have?" → Real product results with real prices
2. **`compare_prices`** — "How much is the Beauty of Joseon sunscreen?" → Multi-retailer pricing
3. **`get_trending_products`** — "What's trending in Korea?" → Real Olive Young/Reddit data

NOT included for anonymous users:
- `get_personalized_match` (requires profile)
- `check_ingredient_conflicts` (requires profile/routine)
- `get_product_details` (included via search_products results)
- `web_search` (cost control for anonymous)

**File: `src/app/api/widget/chat/route.ts` (MODIFY)**
- Import tool definitions and execution from `src/lib/yuri/tools.ts`
- Filter to widget-safe tools (search_products, compare_prices, get_trending_products)
- Replace `client.messages.stream()` with tool use loop (same pattern as `advisor.ts`)
- Pass `userId = null` to tool execution (no personalization for anonymous)
- Keep existing rate limiting (5 messages/session, 10/IP/day)
- Keep existing max_tokens (300) for cost control
- Limit tool calls to 1 per message (prevent abuse)

**System Prompt Addition**:
```
## Database Access
You have access to Seoul Sister's product database with 6,200+ K-beauty products.
When users ask about specific products, prices, or what's trending, use your tools
to search the database and provide real data. This is what makes Seoul Sister
different from generic AI — you have real product intelligence.
For anonymous users, focus on showing the value of the database rather than
personalized recommendations (those require a profile).
```

**Why This Matters for Conversion**: A visitor who asks a question and gets a real product recommendation with a real price from a real retailer is 5-10x more likely to sign up than one who gets generic advice. This is the difference between "another AI chatbot" and "this actually has real data."

#### Files to Modify
- `src/app/api/widget/chat/route.ts` — Add tool use loop with 3 widget-safe tools

#### Estimated Complexity
MEDIUM. Tool infrastructure exists; this wires it into the widget with appropriate restrictions.

---

### Feature 12.2: Scan Intelligence Layer — Learning Engine + Location + Seasonal (HIGH)

**Why This Matters**: The scan is Seoul Sister's flagship feature — camera-to-intelligence. The enrichment pipeline already does 5 parallel queries (personalization, pricing, community, counterfeit, trending). But it completely ignores ingredient effectiveness data, seasonal patterns, location context, and cycle phase. A scan in January should show different intelligence than a scan in July.

**Current State**: `src/lib/scanning/enrich-scan.ts` runs `fetchPersonalization()` which checks allergies and comedogenic ratings using hardcoded ingredient lists (80 lines of static arrays). Does NOT query `ss_ingredient_effectiveness` or `ss_learning_patterns`.

#### Implementation Plan

**Step 1: Add Ingredient Effectiveness to Scan Enrichment**

Modify `src/lib/scanning/enrich-scan.ts` — add 6th enrichment fetcher:

```typescript
async function fetchIngredientInsights(
  supabase: SupabaseClient,
  ingredientNames: string[],
  skinType: string | null
): Promise<IngredientInsight[]> {
  if (!skinType || ingredientNames.length === 0) return []

  // Match ingredient names to ss_ingredients IDs
  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci, name_en')
    .in('name_inci', ingredientNames)

  if (!ingredients?.length) return []

  // Fetch effectiveness for user's skin type
  const { data: effectiveness } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score, sample_size')
    .in('ingredient_id', ingredients.map(i => i.id))
    .eq('skin_type', skinType)
    .gte('sample_size', 5)
    .order('effectiveness_score', { ascending: false })

  // Map back to ingredient names with scores
  return effectiveness?.map(e => ({
    ingredientName: ingredients.find(i => i.id === e.ingredient_id)?.name_en || '',
    concern: e.concern,
    effectivenessScore: e.effectiveness_score,
    sampleSize: e.sample_size,
  })) || []
}
```

**Step 2: Add Seasonal Context to Scan Enrichment**

Add 7th enrichment fetcher:

```typescript
async function fetchSeasonalContext(
  supabase: SupabaseClient,
  climate: string | null,
  ingredientNames: string[]
): Promise<SeasonalContext | null> {
  if (!climate) return null

  const currentSeason = getCurrentSeason() // helper: month → season

  const { data: patterns } = await supabase
    .from('ss_learning_patterns')
    .select('data, pattern_description')
    .eq('pattern_type', 'seasonal')
    .eq('skin_type', climate) // climate stored in skin_type column
    .limit(4) // all seasons for this climate

  const currentPattern = patterns?.find(p => {
    const d = p.data as Record<string, unknown>
    return d.season === currentSeason
  })

  if (!currentPattern) return null

  const data = currentPattern.data as Record<string, unknown>
  const toEmphasize = (data.ingredients_to_emphasize as string[]) || []
  const toReduce = (data.ingredients_to_reduce as string[]) || []

  // Cross-reference with scanned product's ingredients
  const emphasized = ingredientNames.filter(i =>
    toEmphasize.some(e => i.toLowerCase().includes(e.toLowerCase()))
  )
  const reduced = ingredientNames.filter(i =>
    toReduce.some(r => i.toLowerCase().includes(r.toLowerCase()))
  )

  return {
    season: currentSeason,
    climate,
    textureAdvice: data.texture_advice as string,
    goodIngredients: emphasized,
    cautionIngredients: reduced,
    patternDescription: currentPattern.pattern_description,
  }
}
```

**Step 3: Replace Hardcoded Ingredient Lists**

In `fetchPersonalization()`, replace the 80 lines of hardcoded arrays (`COMEDOGENIC_INGREDIENTS`, `COMMON_IRRITANTS`, `BENEFICIAL_INGREDIENTS`) with database queries:

```typescript
// Instead of hardcoded: const COMEDOGENIC_INGREDIENTS = ['isopropyl myristate', ...]
const { data: comedogenic } = await supabase
  .from('ss_ingredients')
  .select('name_inci')
  .gte('comedogenic_rating', 3)

// Instead of hardcoded: const COMMON_IRRITANTS = ['alcohol denat', ...]
const { data: irritants } = await supabase
  .from('ss_ingredients')
  .select('name_inci')
  .eq('safety_rating', 'caution')
  .or('safety_rating.eq.avoid')

// Instead of hardcoded: const BENEFICIAL = { oily: [...], dry: [...] }
// Use ss_ingredient_effectiveness for the user's skin type
const { data: beneficial } = await supabase
  .from('ss_ingredient_effectiveness')
  .select('ingredient_id, concern, effectiveness_score')
  .eq('skin_type', skinType)
  .gte('effectiveness_score', 0.70)
```

**Step 4: Add Location Context to Scan Response**

In `src/app/api/scan/route.ts`, fetch `location_text` and `climate` from user profile (currently only fetches `skin_type`). Pass to enrichment for seasonal context.

**Step 5: New UI Component — IngredientEffectivenessSection**

Add to `src/components/shared/EnrichmentSections.tsx`:
- Shows top 3 effective ingredients found in the scanned product for user's skin type
- Shows any ingredients flagged as "reduce this season" for user's climate
- Example: "Niacinamide — 82% effective for acne with oily skin (based on 60 user reports)"
- Example: "Heavy oils detected — seasonal note: reduce in summer for humid climates"

#### Files to Modify
- `src/lib/scanning/enrich-scan.ts` — Add 2 new fetchers, replace hardcoded lists
- `src/app/api/scan/route.ts` — Fetch full profile including climate/location
- `src/components/shared/EnrichmentSections.tsx` — Add IngredientInsights + SeasonalContext sections
- `src/components/scan/ScanResults.tsx` — Render new sections

#### Database Changes
None — uses existing tables.

#### Estimated Complexity
MEDIUM-HIGH. Core enrichment refactor + 2 new fetchers + 2 new UI components.

---

### Feature 12.3: Glass Skin Score — Personalized Vision Analysis (HIGH)

**Why This Matters**: The Glass Skin Score feature sends a selfie to Claude Vision for analysis, but the Claude prompt has ZERO context about the user. It doesn't know their skin type, concerns, allergies, climate, or what products they use. This means recommendations are generic — the same advice for a 19-year-old with oily skin in Houston as a 45-year-old with dry skin in Seoul.

**Current State**: `src/app/api/skin-score/route.ts` calls `requireAuth()` but never reads `ss_user_profiles`. The Vision prompt says "provide 3-5 K-beauty tips" without knowing anything about the user.

#### Implementation Plan

**Step 1: Read User Profile Before Vision Call**

In `src/app/api/skin-score/route.ts`, after auth:
```typescript
const { data: profile } = await supabase
  .from('ss_user_profiles')
  .select('skin_type, skin_concerns, climate, location_text, age_range, allergies, fitzpatrick_scale')
  .eq('user_id', user.id)
  .single()
```

**Step 2: Inject Profile + Learning Data Into Vision Prompt**

Load ingredient effectiveness for user's skin type:
```typescript
const { data: topIngredients } = await supabase
  .from('ss_ingredient_effectiveness')
  .select('ingredient_id, concern, effectiveness_score')
  .eq('skin_type', profile?.skin_type || 'normal')
  .gte('effectiveness_score', 0.70)
  .order('effectiveness_score', { ascending: false })
  .limit(10)
```

Add to the Vision system prompt:
```
## User Context (Personalize Your Analysis)
- Skin type: ${profile?.skin_type || 'unknown'}
- Primary concerns: ${profile?.skin_concerns?.join(', ') || 'unknown'}
- Climate: ${profile?.climate || 'unknown'} (${profile?.location_text || 'unknown location'})
- Age range: ${profile?.age_range || 'unknown'}
- Allergies: ${profile?.allergies?.join(', ') || 'none known'}

## Top Effective Ingredients for This User's Skin Type
${topIngredients.map(i => `- ${i.ingredientName}: ${Math.round(i.effectiveness_score * 100)}% effective for ${i.concern}`).join('\n')}

When recommending products or ingredients, prioritize those proven effective
for this specific skin type. Avoid recommending ingredients in their allergy list.
Reference specific Seoul Sister product categories when suggesting improvements.
```

**Step 3: Link Recommendations to Real Products**

After the Vision response, for each recommended ingredient/category, query `ss_products`:
```typescript
// For each recommended ingredient, find top-rated products containing it
const { data: recommendedProducts } = await supabase
  .from('ss_products')
  .select('id, name_en, brand_en, rating_avg')
  .textSearch('description_en', recommendedIngredient)
  .order('rating_avg', { ascending: false })
  .limit(2)
```

Return these product links alongside the Glass Skin Score so the UI can show:
"Hydration score: 54. Try adding a hyaluronic acid toner → [Klairs Supple Preparation Toner — $23 at Olive Young]"

#### Files to Modify
- `src/app/api/skin-score/route.ts` — Read profile + learning data, inject into prompt, link products

#### Estimated Complexity
MEDIUM. Profile query + prompt injection + product linking.

---

### Feature 12.4: Shelf Scan — Personalized Collection Intelligence (HIGH)

**Why This Matters**: Shelf Scan identifies products from a photo and grades the collection, but does so generically. It doesn't know the user's allergies, skin type, or concerns. A collection grade should factor in "3 of your 8 products contain fragrance (you're allergic)" or "your collection is missing ceramides (critical for dry skin in winter)."

**Current State**: `src/app/api/shelf-scan/route.ts` matches products against `ss_products` but never reads `ss_user_profiles`. The Claude prompt for collection analysis has no user context.

#### Implementation Plan

**Step 1: Read User Profile**

After auth, load full profile + allergies:
```typescript
const { data: profile } = await supabase
  .from('ss_user_profiles')
  .select('skin_type, skin_concerns, allergies, climate, location_text')
  .eq('user_id', user.id)
  .single()
```

**Step 2: Inject Into Collection Analysis Prompt**

Add to the Claude Vision prompt:
```
## User Skin Profile
- Skin type: ${profile?.skin_type}
- Concerns: ${profile?.skin_concerns?.join(', ')}
- Known allergies: ${profile?.allergies?.join(', ')}
- Climate: ${profile?.climate} (${profile?.location_text})

When analyzing this collection:
- Flag any products containing ingredients the user is allergic to
- Assess whether the collection addresses the user's stated concerns
- Recommend missing product categories based on their skin type and climate
- Grade should factor in personal relevance, not just generic completeness
```

**Step 3: Post-Match Enrichment**

For matched products (those found in `ss_products`), load their ingredients and check against user allergies:
```typescript
for (const matched of matchedProducts) {
  const { data: ingredients } = await supabase
    .from('ss_product_ingredients')
    .select('ingredient:ss_ingredients(name_inci, name_en, is_fragrance)')
    .eq('product_id', matched.id)

  // Check allergen overlap
  const allergenHits = ingredients?.filter(i =>
    profile.allergies.some(a => i.ingredient.name_inci.toLowerCase().includes(a.toLowerCase()))
  )
  matched.allergenWarnings = allergenHits
}
```

#### Files to Modify
- `src/app/api/shelf-scan/route.ts` — Read profile, inject into prompt, post-match allergen check

#### Estimated Complexity
MEDIUM. Profile query + prompt injection + allergen cross-reference.

---

### Feature 12.5: Sunscreen Finder — Climate + UV + Skin-Type Intelligence (HIGH)

**Why This Matters**: Sunscreen is the #1 searched K-beauty category. The finder has excellent K-beauty-specific filters (PA rating, white cast, finish) but zero personalization. A user in tropical Houston with oily skin should see different defaults than a user in cold Minneapolis with dry skin. The sunscreen finder should auto-set filters based on the user's profile and show UV-aware recommendations.

**Current State**: `src/app/(app)/sunscreen/page.tsx` has manual filters. No auto-population from profile. No UV index integration.

#### Implementation Plan

**Step 1: Auto-Populate Filters from Profile**

On page load, fetch user profile and pre-fill filters:
```typescript
// Oily skin → default finish: matte, under_makeup: true
// Dry skin → default finish: dewy
// Sensitive → default type: physical (mineral), fragrance_free: true
// Tropical/humid climate → default PA++++, water_resistant: true
// Cold/dry climate → default finish: dewy (less drying)
```

**Step 2: Add UV Index Integration**

If user has lat/lng, fetch current UV from Open-Meteo (already used by weather module):
```typescript
const uvIndex = await getCurrentUvIndex(profile.latitude, profile.longitude)
// UV ≥ 7: Show banner "High UV today — PA++++ recommended"
// UV ≥ 10: Show banner "Extreme UV — reapply every 90 min"
```

**Step 3: "Yuri's Pick for Your Skin" Section**

Add a highlighted section above results:
- Query `ss_ingredient_effectiveness` for sunscreen-active ingredients (zinc oxide, tinosorb, etc.) by user's skin type
- Cross-reference with products matching filters
- Show top 3 "best match for your skin" with effectiveness reasoning

**Step 4: Skin-Type Effectiveness Ranking**

Instead of sorting only by `rating_avg`, add a `match_score` that factors:
- Community rating for user's skin type (from `ss_reviews` filtered by skin_type)
- Ingredient effectiveness for user's concerns
- Climate suitability (PA++++ weighted higher for tropical users)

#### Files to Modify
- `src/app/(app)/sunscreen/page.tsx` — Auto-populate filters, UV banner, Yuri's Pick section
- `src/app/api/sunscreen/route.ts` — Add skin_type matching + effectiveness scoring

#### Estimated Complexity
MEDIUM. Filter pre-population + UV fetch + effectiveness scoring.

---

### Feature 12.6: Products Browse — Learning-Powered Discovery (HIGH)

**Why This Matters**: The products page is the main browsing experience for 6,200+ products. Currently sorted by rating only. Every user sees the identical product order. With 47 ingredient effectiveness rows and user profiles, we can show "recommended for your skin" sorting.

**Current State**: `src/app/api/products/route.ts` supports `sort_by` (rating_avg, price_asc, price_desc, newest). No personalized sort. No skin-type filtering.

#### Implementation Plan

**Step 1: Add `sort_by=recommended` to Products API**

New sort option that calculates a personalized match score:
```typescript
if (sortBy === 'recommended' && userId) {
  // Fetch user profile
  const profile = await getUserProfile(userId)

  // For each product in results, calculate match score:
  // 1. Query ss_ingredient_effectiveness for product's ingredients × user's skin_type
  // 2. Average effectiveness scores for matching ingredients
  // 3. Bonus: product addresses user's stated concerns
  // 4. Penalty: product contains user's allergens
  // 5. Sort by match_score DESC
}
```

**Step 2: Add "For Your Skin" Filter Toggle**

In `ProductFilters.tsx`, add a toggle: "Show recommended for my skin"
- When enabled, adds `sort_by=recommended` + `skin_type=<user's type>` to API query
- Products with ingredients known to be ineffective for user's skin type are deprioritized

**Step 3: Trending Badge Overlay**

Products currently in `ss_trending_products` should show a small badge on their ProductCard:
- "Trending in Korea" (source = olive_young)
- "Trending on Reddit" (source = reddit)
- "Emerging" (gap_score > 50)

**Step 4: "People With Your Skin Type Love" Section**

On the products page, above the product grid, show a horizontal scroll of 5-8 products:
- Query `ss_product_effectiveness` filtered by user's skin_type
- Show effectiveness score + "holy grail" count for that skin type
- Acts as personalized curation above the generic browse

#### Files to Modify
- `src/app/api/products/route.ts` — Add `recommended` sort with match scoring
- `src/components/products/ProductFilters.tsx` — Add "For Your Skin" toggle
- `src/components/products/ProductCard.tsx` — Add trending badge overlay
- `src/app/(app)/products/page.tsx` — Add "People With Your Skin Type Love" section

#### Estimated Complexity
MEDIUM-HIGH. Match scoring algorithm + new UI sections.

---

### Feature 12.7: Trending — Personalized Trend Relevance (MEDIUM)

**Why This Matters**: The trending page shows what's trending globally. But a user with dry skin doesn't care about trending oil-control products. Personalized trending = "trending AND relevant to your skin."

**Current State**: `src/app/api/trending/route.ts` returns all trending products sorted by trend_score. No skin-type filtering.

#### Implementation Plan

**Step 1: Add Personalized Relevance Score**

In the trending API, when user is authenticated:
```typescript
// For each trending product, calculate skin relevance:
// 1. Does the product's category match user's concerns?
// 2. Does it contain ingredients effective for their skin type?
// 3. Is it in their price range?
// Relevance-weighted trend score = trend_score × relevance_multiplier
```

**Step 2: "Trending for Your Skin" Tab**

Add a 4th tab: "For You" — shows trending products filtered by skin-type relevance:
- Products with ingredients that score >0.70 effectiveness for user's skin type
- Products in categories matching user's concerns
- Sorted by trend_score × relevance_multiplier

**Step 3: Skin-Type Cohort Labels**

On each trending product card, show: "Popular with oily skin (78% positive)" or "Mixed reviews from sensitive skin (54% positive)" — pulled from `ss_ingredient_effectiveness` or `ss_product_effectiveness`.

#### Files to Modify
- `src/app/api/trending/route.ts` — Add relevance scoring, "for_you" tab filter
- `src/app/(app)/trending/page.tsx` — Add 4th tab, cohort labels on cards

#### Estimated Complexity
MEDIUM. Relevance calculation + UI tab.

---

### Feature 12.8: Dupe Finder — Effectiveness-Weighted Dupes (MEDIUM)

**Why This Matters**: The dupe finder matches products by ingredient overlap %. But two products can share 80% of ingredients and perform very differently for a specific skin type. A dupe should be scored by "how effective is it for YOUR skin?" not just ingredient similarity.

**Current State**: `src/app/api/dupes/route.ts` calculates ingredient overlap. `src/app/api/dupes/ai/route.ts` calls Claude without reading user profile.

#### Implementation Plan

**Step 1: Add Effectiveness Weighting to Database Dupes**

In `/api/dupes/route.ts`, after calculating ingredient overlap:
```typescript
// For each dupe candidate, also calculate:
// 1. Load ingredient effectiveness for dupe's ingredients × user's skin_type
// 2. Compare average effectiveness vs original product's ingredients
// 3. Effectiveness-weighted match = ingredient_overlap × avg_effectiveness_ratio
// A dupe with 70% overlap but 90% effectiveness for your skin beats 90% overlap with 60% effectiveness
```

**Step 2: Pass User Profile to AI Dupes**

In `/api/dupes/ai/route.ts`, read `ss_user_profiles` and inject into Budget Optimizer prompt:
```
User's skin type: ${profile.skin_type}
User's concerns: ${profile.skin_concerns.join(', ')}
User's budget: ${profile.budget_range}
User's allergies: ${profile.allergies.join(', ')}

Find dupes that work specifically for THIS user's skin profile, not generic dupes.
```

**Step 3: Show Effectiveness Comparison**

In `DupeCard.tsx`, show:
- Original: "Niacinamide 82% effective for your skin"
- Dupe: "Niacinamide 82% effective (same ingredient, same concentration range)"
- Key difference: "Dupe has tea tree (76% effective for your acne) — original doesn't"

#### Files to Modify
- `src/app/api/dupes/route.ts` — Add effectiveness weighting
- `src/app/api/dupes/ai/route.ts` — Read profile, inject into prompt
- `src/components/dupes/DupeCard.tsx` — Show effectiveness comparison

#### Estimated Complexity
MEDIUM. Effectiveness query + AI prompt enhancement.

---

### Feature 12.9: Weather Routine — Learning-Driven Adjustments (MEDIUM)

**Why This Matters**: The weather-routine module (`src/lib/intelligence/weather-routine.ts`) has 170 lines of hardcoded adjustment rules. Meanwhile, `ss_learning_patterns` now has 20 rows of research-backed seasonal advice per climate. The hardcoded rules should be supplemented (or replaced) with learned patterns.

**Current State**: `ADJUSTMENT_RULES` array at lines 129-299 of `weather-routine.ts` is static. Never queries `ss_learning_patterns`.

#### Implementation Plan

**Step 1: Query Learning Patterns in Adjustment Logic**

In `getWeatherAdjustments()`, after checking hardcoded rules, also query:
```typescript
const { data: seasonalPatterns } = await supabase
  .from('ss_learning_patterns')
  .select('data, pattern_description, confidence_score')
  .eq('pattern_type', 'seasonal')
  .eq('skin_type', userClimate)

const currentSeason = getCurrentSeason()
const seasonalAdvice = seasonalPatterns?.find(p => p.data.season === currentSeason)
```

**Step 2: Merge Learned Patterns with Weather Triggers**

Combine real-time weather triggers (humidity > 70%, UV > 7) with seasonal learned patterns:
- Weather trigger: "High humidity today" + Seasonal pattern: "In humid summer, emphasize niacinamide + BHA"
- Combined output: "High humidity today — emphasize niacinamide (82% effective for your oily skin) and BHA"

**Step 3: Use location_text in Weather Messaging**

Instead of generic "Your location", show "Today in Austin, Texas: 92°F, 78% humidity"

#### Files to Modify
- `src/lib/intelligence/weather-routine.ts` — Query learning patterns, merge with weather triggers
- `src/app/api/weather/routine/route.ts` — Fetch climate + location_text from profile

#### Estimated Complexity
LOW-MEDIUM. Query + merge logic.

---

### Feature 12.10: Routine Builder — Seasonal + Effectiveness Intelligence (MEDIUM)

**Why This Matters**: The routine page has conflict detection but no effectiveness insights. A user's AM routine could show "This routine's combined effectiveness for your skin: 78%. Adding a vitamin C serum would increase it to 85%."

#### Implementation Plan

**Step 1: Routine Effectiveness Score**

For each routine, calculate combined ingredient effectiveness:
```typescript
// Load all ingredients across all products in the routine
// Cross-reference with ss_ingredient_effectiveness for user's skin type
// Calculate weighted average effectiveness per concern
// Display: "Your AM routine effectiveness: Acne control 82%, Hydration 74%"
```

**Step 2: Seasonal Routine Suggestions**

Query `ss_learning_patterns` for user's climate and current season. If seasonal advice says "emphasize ceramides in winter" but user's routine has no ceramide products, show a banner: "Seasonal tip: Add a ceramide product for winter in your climate."

**Step 3: Missing Ingredient Alerts**

Based on `ss_ingredient_effectiveness`, if high-effectiveness ingredients for the user's skin type + top concern are not present in any routine product, suggest: "Niacinamide is 82% effective for your acne concern but isn't in your current routine."

#### Files to Modify
- `src/app/(app)/routine/page.tsx` — Add effectiveness score display + seasonal suggestions
- Create helper: `src/lib/intelligence/routine-effectiveness.ts` (~100 lines)

#### Estimated Complexity
MEDIUM. Effectiveness calculation + seasonal cross-reference.

---

### Feature 12.11: Dashboard Intelligence Widgets (LOW-MEDIUM)

**Why This Matters**: The dashboard is the home screen. It shows basic widgets but no intelligence insights. Should surface the learning engine's top findings.

#### Implementation Plan

**Step 1: "Your Top Ingredients" Widget**

New widget between Yuri's Insights and Skin Profile:
- Query `ss_ingredient_effectiveness` for user's skin type
- Show top 5 most effective ingredients with scores
- Link each to product search: "Find products with niacinamide →"

**Step 2: "Seasonal Tip" Widget**

Add a seasonal advice card:
- Query `ss_learning_patterns` for user's climate + current season
- Show texture_advice and top 2 ingredients to emphasize
- Rotates with each season change

**Step 3: Trending Relevance in Existing Widget**

The existing "Trending in Korea" widget shows generic top 3. Enhance:
- Filter trending by skin-type relevance
- Show "Trending AND good for your skin" badge

#### Files to Modify
- `src/app/(app)/dashboard/page.tsx` — Add 2 new widgets, enhance trending widget

#### Estimated Complexity
LOW-MEDIUM. Query + render new widgets.

---

### Feature 12.12: Community Page — Cohort Intelligence (LOW)

**Why This Matters**: The community page shows reviews filterable by skin type. But it doesn't surface patterns: "Users with your skin type rate this product 4.6/5" or "Most repurchased product among oily skin users."

#### Implementation Plan

**Step 1: "Community Insights for Your Skin" Section**

Above the review list, show:
- "Most loved by [skin_type] skin: [top 3 products by that skin type's reviews]"
- "Most effective ingredients for [skin_type]: [from ss_ingredient_effectiveness]"

**Step 2: Effectiveness Badges on Reviews**

For each reviewed product, show a small badge:
- "This product's key ingredient (niacinamide) is 82% effective for your skin type"
- Pulled from `ss_ingredient_effectiveness`

#### Files to Modify
- `src/app/(app)/community/page.tsx` — Add insights section + badges

#### Estimated Complexity
LOW. Query + display.

---

### Phase 12 Implementation Priority Summary

| # | Feature | Impact | Complexity | Prerequisite |
|---|---------|--------|-----------|--------------|
| 12.0 | Shared Intelligence Context Helper | FOUNDATION | Medium | None |
| 12.1 | Widget Database Tools | CRITICAL | Medium | 12.0 |
| 12.2 | Scan Intelligence Layer | HIGH | Med-High | 12.0 |
| 12.3 | Glass Skin Personalization | HIGH | Medium | 12.0 |
| 12.4 | Shelf Scan Personalization | HIGH | Medium | 12.0 |
| 12.5 | Sunscreen Climate + UV | HIGH | Medium | 12.0 |
| 12.6 | Products Discovery | HIGH | Med-High | 12.0 |
| 12.7 | Trending Relevance | MEDIUM | Medium | 12.0 |
| 12.8 | Dupe Effectiveness | MEDIUM | Medium | 12.0 |
| 12.9 | Weather Learning-Driven | MEDIUM | Low-Med | 12.0 |
| 12.10 | Routine Effectiveness | MEDIUM | Medium | 12.0 |
| 12.11 | Dashboard Widgets | LOW-MED | Low-Med | 12.0 |
| 12.12 | Community Insights | LOW | Low | 12.0 |

**Build Order**: 12.0 (foundation) → 12.1 (critical conversion) → 12.2 (flagship feature) → 12.3 + 12.4 (vision features) → 12.5 (high search volume) → 12.6 (browse experience) → 12.7 → 12.8 → 12.9 → 12.10 → 12.11 → 12.12

**Session Strategy**: 12.0 + 12.1 together (foundation + critical widget upgrade). 12.2 own session (scan refactor is substantial). 12.3 + 12.4 together (both are "read profile → inject into Vision prompt" pattern). 12.5 + 12.6 together (both enhance product discovery). 12.7-12.12 can be grouped 2-3 per session as they're lower complexity.

**Expected Outcome**: Every feature in Seoul Sister becomes personalized, data-backed, and seasonally aware. The same intelligence that makes Yuri a 10x advisor now powers every scan, every product page, every routine, every trending feed. The platform goes from "features that exist" to "features that know you."

---

## Phase 13: AI Conversation Engine Hardening — Learned from LGAAS Audit

**Strategic Rationale**: A comprehensive cross-application audit comparing Seoul Sister's Yuri and LGAAS's AriaStar revealed 6 architectural gaps in Yuri's conversation engine. LGAAS has battle-tested patterns for prompt caching, API retry logic, decision memory, intent-based context loading, onboarding quality scoring, and voice quality cleanup — all proven in production with paying subscribers. Seoul Sister has NONE of these. Meanwhile, LGAAS is missing patterns that Seoul Sister pioneered: Claude native tool use, recent message excerpts as memory safety net, and structured product recommendation extraction.

**The Audit**: Every file in both applications' chat systems was reviewed line-by-line. LGAAS's `advisor-conversation.js` (2,207 lines), `widget-conversation.js` (1,392 lines), `advisor-prompt-helpers.js` (1,350 lines), and `advisor-actions.js` (3,581 lines) were compared against Seoul Sister's `advisor.ts` (764 lines), `memory.ts` (899 lines), `chat/route.ts` (178 lines), and `widget/chat/route.ts` (248 lines).

**Key Findings**:

| Capability | LGAAS | Seoul Sister | Gap |
|-----------|-------|-------------|-----|
| Prompt Caching | `cache_control: { type: 'ephemeral' }` on system prompt + last assistant turn + tool defs | **NONE** | HIGH — 20-30% token waste per conversation |
| API Retry Logic | `callAnthropicWithRetry()` — 3 attempts, exponential backoff (2s, 4s, 8s), retryable status codes | **NONE** | HIGH — any transient failure kills the conversation |
| Decision Memory | Structured JSON extraction (decisions, preferences, commitments), topic-keyed merging | Prose summaries only | MEDIUM — loses structured decisions between sessions |
| Intent-Based Context | `classifyAdvisorIntent()` → load only relevant sections (10 topic categories) | Loads ALL context every turn | MEDIUM — unnecessary token usage and Supabase queries |
| Onboarding Quality | `calculateOnboardingQualityScore()`, vague data detection, improvement sessions | Basic field completion % only | MEDIUM — no detection of thin/vague profile data |
| Voice Quality Layer | `cleanBannedPatterns()`, `detectAIPatterns()`, `humanizeText()` on every response | **NONE** | LOW — Yuri's system prompt handles voice, but no post-processing cleanup |

**What Seoul Sister Has That LGAAS Doesn't** (documented in LGAAS blueprint for them to adopt):
- Claude native tool use API (8 tools with `tool_choice: auto`)
- Recent message excerpts (last 6 messages from 3 recent conversations as memory safety net)
- Structured product recommendation extraction from prose summaries
- Specialist agent system with deep domain prompts (200-400 words each)

**Build Strategy**: 6 features, ranked by impact. Each is self-contained for a fresh Claude Code session. Features 13.1-13.3 are the highest priority — they directly improve reliability, reduce costs, and prevent the memory denial bugs that damaged Bailey's trust.

---

### Feature 13.1: Prompt Caching — 20-30% Token Cost Reduction (HIGH PRIORITY)

**Why This First**: Yuri's system prompt is ~1,900 lines (~2,200 tokens). User context adds 2,000-5,000 tokens. Specialist prompts add 250-500 tokens. On a 10-message conversation, the system prompt is re-sent 10 times unchanged. With prompt caching, messages 2+ reuse the cached system prompt at 90% discount. At Opus pricing ($15/$75 per M tokens), this saves $1-3 per active subscriber per month.

**What LGAAS Does** (lines 573-592 of `widget-conversation.js`, lines 737-763 of `advisor-conversation.js`):
```javascript
// Cache system prompt
{ role: 'system', content: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] }

// Cache last assistant message in conversation history
if (msg.role === 'assistant' && idx === conversationHistory.length - 2) {
  return { role: msg.role, content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }] };
}

// Cache tool definitions
tools: [{ ...webSearchTool, cache_control: { type: 'ephemeral' } }]
```

**Ephemeral cache** lasts ~5 minutes. Within a conversation, messages come every 10-60 seconds, so the cache is almost always warm. First message in a new conversation pays full price; subsequent messages pay 10%.

#### Implementation Plan

**File: `src/lib/yuri/advisor.ts` (MODIFY — ~20 lines changed)**

Currently (line ~360):
```typescript
const response = await client.messages.create({
  model: MODELS.primary,
  max_tokens: 2048,
  system: fullSystemPrompt,
  messages: formattedMessages,
  tools: YURI_TOOLS,
  tool_choice: { type: 'auto' },
})
```

Change to:
```typescript
const response = await client.messages.create({
  model: MODELS.primary,
  max_tokens: 2048,
  system: [{ type: 'text', text: fullSystemPrompt, cache_control: { type: 'ephemeral' } }],
  messages: formattedMessages.map((msg, idx) => {
    // Cache the last assistant message (second-to-last in history)
    if (msg.role === 'assistant' && idx === formattedMessages.length - 2) {
      return {
        role: msg.role,
        content: typeof msg.content === 'string'
          ? [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }]
          : msg.content, // Already content blocks (images)
      }
    }
    return msg
  }),
  tools: YURI_TOOLS.map((tool, idx) => idx === YURI_TOOLS.length - 1
    ? { ...tool, cache_control: { type: 'ephemeral' } }
    : tool
  ),
  tool_choice: { type: 'auto' },
})
```

**Also apply to**: The tool use loop's follow-up API call (line ~390) — same caching pattern.

**File: `src/app/api/widget/chat/route.ts` (MODIFY — ~10 lines changed)**

Same pattern: cache system prompt + tool definitions. Widget has shorter conversations (5 messages max) so savings are smaller but still worthwhile.

**File: `src/lib/yuri/onboarding.ts` (MODIFY — ~5 lines changed)**

Cache the onboarding system prompt. Onboarding conversations are typically 15-20 turns, so caching saves significantly.

#### Files to Modify
- `src/lib/yuri/advisor.ts` — Cache system prompt, last assistant message, tool definitions
- `src/app/api/widget/chat/route.ts` — Cache system prompt, tool definitions
- `src/lib/yuri/onboarding.ts` — Cache system prompt

#### Database Changes
None.

#### Testing Checklist
- [ ] Verify `cache_creation_input_tokens` and `cache_read_input_tokens` appear in API response usage
- [ ] Confirm message 1 shows `cache_creation_input_tokens` > 0
- [ ] Confirm message 2+ shows `cache_read_input_tokens` > 0
- [ ] Verify response quality is unchanged (caching doesn't affect output)
- [ ] Check widget works with cached system prompt
- [ ] Check onboarding works with cached system prompt

#### Estimated Complexity
LOW. This is a 20-30 line change across 3 files. The LGAAS pattern is directly copy-adaptable.

#### Cost Impact
- Current: ~$4.00/mo avg per Pro subscriber (Opus API)
- After: ~$2.80-3.20/mo avg (20-30% reduction on input tokens)
- At 100 subscribers: saves $80-120/month

---

### Feature 13.2: API Retry Logic — Graceful Failure Handling (HIGH PRIORITY)

**Why This Matters**: When Anthropic's API is overloaded (status 529), has a gateway error (502/503), or drops a connection, Yuri's response simply fails. The user sees an error message. LGAAS handles this gracefully with exponential backoff — the user never sees the transient failure.

**What LGAAS Does** (lines 65-88 of `advisor-conversation.js`):
```javascript
async function callAnthropicWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error) {
      const isRetryable =
        error.message?.includes('Connection error') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('socket hang up') ||
        error.status === 529 ||
        error.status === 503 ||
        error.status === 502;
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

#### Implementation Plan

**File: `src/lib/anthropic.ts` (MODIFY — add retry wrapper)**

Add a retry utility alongside the existing Anthropic client export:

```typescript
export async function callAnthropicWithRetry(
  fn: () => Promise<Anthropic.Messages.Message>,
  maxRetries = 3
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number }
      const isRetryable =
        err.message?.includes('Connection error') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('socket hang up') ||
        err.status === 529 ||
        err.status === 503 ||
        err.status === 502

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.warn(`[YURI] Attempt ${attempt}/${maxRetries} failed (${err.message || err.status}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Unreachable')
}
```

**File: `src/lib/yuri/advisor.ts` (MODIFY)**

Replace `client.messages.create(...)` calls with `callAnthropicWithRetry(() => client.messages.create(...))`:
- Main conversation call (~line 360)
- Tool use loop follow-up call (~line 390)
- Title generation call (~line 435): Use `maxRetries = 1` (non-critical)
- Summary generation call (~line 510): Use `maxRetries = 1`
- Insight extraction call (~line 555): Use `maxRetries = 1`

**File: `src/app/api/widget/chat/route.ts` (MODIFY)**

Same pattern for widget's `client.messages.create()` call.

**File: `src/lib/yuri/onboarding.ts` (MODIFY)**

Same pattern for onboarding's `client.messages.stream()` call. Note: streaming uses `.stream()` not `.create()` — need to handle the stream retry differently:
```typescript
// For streaming, retry the entire stream creation
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const stream = client.messages.stream({...})
    // If stream starts successfully, return it
    return stream
  } catch (error) {
    // Same retry logic
  }
}
```

#### Files to Modify
- `src/lib/anthropic.ts` — Add `callAnthropicWithRetry()` utility
- `src/lib/yuri/advisor.ts` — Wrap API calls with retry
- `src/app/api/widget/chat/route.ts` — Wrap API calls with retry
- `src/lib/yuri/onboarding.ts` — Wrap streaming call with retry

#### Database Changes
None.

#### Testing Checklist
- [ ] Verify normal conversation works (no false retries)
- [ ] Simulate 529 by temporarily using invalid model name and verify retry attempts logged
- [ ] Verify non-retryable errors (400 Bad Request, 401 Auth) are NOT retried
- [ ] Verify background tasks (title, summary, learning) use maxRetries = 1

#### Estimated Complexity
LOW. One utility function + 5-10 call site wraps across 4 files.

---

### Feature 13.3: Decision Memory — Structured Cross-Session Intelligence (HIGH PRIORITY)

**Why This Matters**: Yuri currently stores cross-session memory as prose summaries. This works for narrative context but loses structured decisions. When Bailey tells Yuri "I prefer fragrance-free products" or "I've decided to do a 3-phase barrier repair," that's a DECISION that should persist as a structured record — not buried in a 500-word summary that Claude may or may not parse correctly on the next session.

The memory denial bug (Bailey incident) happened partly because Claude didn't "see" specific recommendations in the prose summary. A structured decision memory format — where decisions are explicit key-value pairs — would have prevented this.

**What LGAAS Does** (lines 98-220 of `advisor-conversation.js`):
- After each conversation, Sonnet extracts structured JSON:
  ```json
  {
    "decisions": [{ "topic": "barrier_repair", "decision": "3-phase approach starting with ceramides", "date": "2026-02-23" }],
    "preferences": [{ "topic": "fragrance", "preference": "fragrance-free only" }],
    "commitments": [{ "item": "Try COSRX Snail Mucin for 2 weeks", "date": "2026-02-23" }]
  }
  ```
- Stored on conversation record as JSONB
- Merged across sessions: latest decision per topic wins, commitments append with dedup
- Injected into system prompt as structured data

#### Implementation Plan

**Step 1: Add decision_memory column to conversations**

Database migration:
```sql
ALTER TABLE ss_yuri_conversations
  ADD COLUMN IF NOT EXISTS decision_memory JSONB DEFAULT '{}';
```

**Step 2: Create Decision Memory Extraction Function**

Add to `src/lib/yuri/memory.ts`:

```typescript
interface DecisionMemory {
  decisions: Array<{ topic: string; decision: string; date: string }>
  preferences: Array<{ topic: string; preference: string }>
  commitments: Array<{ item: string; date: string }>
  extracted_at: string
}

async function extractDecisionMemory(
  messages: Array<{ role: string; content: string }>,
  existingMemory: DecisionMemory | null
): Promise<DecisionMemory> {
  // Call Sonnet to extract structured decisions
  // Prompt: "Extract any decisions, preferences, or commitments from this conversation..."
  // Parse JSON response
  // Merge with existing memory (latest per topic wins)
}

function mergeDecisionMemory(
  existing: DecisionMemory | null,
  extracted: DecisionMemory
): DecisionMemory {
  // Latest decision per topic overwrites previous
  // Preferences: latest per topic overwrites
  // Commitments: append with dedup by lowercase item text
}
```

**Step 3: Call extraction in advisor.ts background tasks**

In `streamAdvisorResponse()`, add decision memory extraction alongside summary generation:
```typescript
// After streaming completes
void extractAndSaveDecisionMemory(userId, conversationId, conversationHistory).catch(() => {})
```

Trigger: Every 5 messages (same cadence as summary generation). Don't extract on every message — too expensive.

**Step 4: Load decision memory into user context**

In `loadUserContext()` in memory.ts:
- Query the 3 most recent conversations' `decision_memory` JSONB columns
- Merge them (latest timestamp wins per topic)
- Return merged DecisionMemory in UserContext

**Step 5: Format decision memory in system prompt**

In `formatContextForPrompt()`:
```
## Your Decisions & Preferences (Structured Memory)
These are structured decisions and preferences you've recorded from conversations with this user.

### Active Decisions
- **barrier_repair**: 3-phase approach starting with ceramides (decided 2026-02-23)
- **sunscreen**: Switched to Beauty of Joseon PA++++ (decided 2026-02-20)

### User Preferences
- **fragrance**: Fragrance-free only
- **texture**: Prefers gel-cream over heavy creams
- **budget**: Max $25 per product

### User Commitments
- Try COSRX Snail Mucin for 2 weeks (committed 2026-02-23)
- Take Glass Skin Score photo weekly (committed 2026-02-20)
```

This gives Claude EXPLICIT structured data instead of hoping it parses the right items from prose summaries.

#### Files to Modify
- `src/lib/yuri/memory.ts` — Add extraction function, merge function, load function, format function
- `src/lib/yuri/advisor.ts` — Call extraction in background tasks

#### Database Changes
- `ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS decision_memory JSONB DEFAULT '{}';`

#### Estimated Complexity
MEDIUM. The extraction prompt and merge logic are the core work. ~150 lines of new code.

---

### Feature 13.4: Intent-Based Context Loading — Load What's Needed (MEDIUM PRIORITY)

**Why This Matters**: Currently, `loadUserContext()` in memory.ts runs 7 parallel queries EVERY conversation turn regardless of what the user asked. If a user says "what's trending?", Yuri still loads their full routine, product reactions, specialist insights, learning context, and recent excerpts. This wastes ~200-500ms of Supabase query time and adds unnecessary tokens to the prompt.

**What LGAAS Does** (lines 23-80 of `advisor-prompt-helpers.js`):
```javascript
function classifyAdvisorIntent(message, isFirstMessage = false) {
  if (isFirstMessage) return new Set(['general']); // Load everything on first message
  const topics = new Set();
  if (/routine|order|layer|morning|night/i.test(message)) topics.add('routine');
  if (/ingredient|inci|ph|concentration/i.test(message)) topics.add('ingredients');
  if (/price|budget|cheap|dupe/i.test(message)) topics.add('pricing');
  if (/trending|popular|viral|korea/i.test(message)) topics.add('trending');
  // ... 10 topic categories
  return topics.size ? topics : new Set(['general']);
}
```

Then only loads relevant context sections based on detected topics.

#### Implementation Plan

**Step 1: Create Intent Classifier**

Add to `src/lib/yuri/memory.ts`:

```typescript
type ConversationTopic = 'routine' | 'ingredients' | 'pricing' | 'trending' | 'skin_profile' | 'products' | 'counterfeit' | 'general'

function classifyIntent(message: string, isFirstMessage: boolean): Set<ConversationTopic> {
  if (isFirstMessage) return new Set(['general'])
  const topics = new Set<ConversationTopic>()

  if (/routine|order|layer|morning|night|pm|am|step|cycle/i.test(message)) topics.add('routine')
  if (/ingredient|inci|ph|concentration|formula|niacinamide|retinol|hyaluronic/i.test(message)) topics.add('ingredients')
  if (/price|budget|cheap|dupe|alternative|save|cost|afford/i.test(message)) topics.add('pricing')
  if (/trending|popular|viral|korea|tiktok|olive young|new product/i.test(message)) topics.add('trending')
  if (/skin type|concern|allergy|sensitive|oily|dry|combo|acne|aging/i.test(message)) topics.add('skin_profile')
  if (/product|recommend|suggest|best|which|compare/i.test(message)) topics.add('products')
  if (/fake|counterfeit|authentic|batch code|real/i.test(message)) topics.add('counterfeit')

  return topics.size ? topics : new Set(['general'])
}
```

**Step 2: Modify `loadUserContext()` to accept topics**

```typescript
export async function loadUserContext(
  userId: string,
  conversationId: string,
  options?: { topics?: Set<ConversationTopic>; message?: string; isFirstMessage?: boolean }
): Promise<UserContext> {
  const topics = options?.topics
    || classifyIntent(options?.message || '', options?.isFirstMessage ?? false)

  // ALWAYS load (cheap, critical)
  const profilePromise = loadProfile(userId)
  const memoriesPromise = loadConversationMemories(userId)

  // CONDITIONAL loads (skip if not relevant)
  const routinePromise = topics.has('routine') || topics.has('general')
    ? loadRoutineProducts(userId) : Promise.resolve(null)
  const reactionsPromise = topics.has('products') || topics.has('ingredients') || topics.has('general')
    ? loadProductReactions(userId) : Promise.resolve(null)
  const learningPromise = topics.has('ingredients') || topics.has('skin_profile') || topics.has('general')
    ? loadLearningContext(profile) : Promise.resolve(null)
  const specialistPromise = topics.has('general')
    ? loadSpecialistInsights(userId) : Promise.resolve(null)
  const excerptsPromise = topics.has('general')
    ? loadRecentExcerpts(userId) : Promise.resolve(null)

  // Run in parallel
  const [profile, memories, routine, reactions, learning, specialist, excerpts] =
    await Promise.all([profilePromise, memoriesPromise, routinePromise, reactionsPromise,
                       learningPromise, specialistPromise, excerptsPromise])

  return { profile, memories, routine, reactions, learning, specialist, excerpts }
}
```

**Step 3: Pass intent from advisor.ts**

In `streamAdvisorResponse()`:
```typescript
const isFirstMessage = conversationHistory.length === 0
const context = await loadUserContext(userId, conversationId, {
  message, isFirstMessage
})
```

**Fallback**: First message of any conversation always loads everything (`general` topic). This ensures Yuri has full context for new conversations. Subsequent messages in the same conversation load selectively.

#### Files to Modify
- `src/lib/yuri/memory.ts` — Add intent classifier, modify `loadUserContext()` signature and logic
- `src/lib/yuri/advisor.ts` — Pass message and isFirstMessage to context loader

#### Database Changes
None.

#### Estimated Complexity
MEDIUM. Intent classification is simple regex; the refactor of `loadUserContext()` to conditional loading needs careful null handling.

---

### Feature 13.5: Onboarding Quality Scoring — Detect Vague Profiles (MEDIUM PRIORITY)

**Why This Matters**: Yuri's onboarding currently tracks field completion percentage (0-100%). But "completion" doesn't mean "quality." A user who says "I have normal skin" and "no concerns" gets 100% completion but a useless profile. LGAAS detects vague/thin answers and follows up.

**What LGAAS Does** (line 251 of `onboarding-conversation.js`):
```javascript
function calculateOnboardingQualityScore(extractedData) {
  // Scores each field for specificity
  // "normal" skin type = low specificity (30%)
  // "combination with oily T-zone" = high specificity (90%)
  // Identifies thin areas requiring improvement
  // Returns overall quality score + thin_areas array
}
```

#### Implementation Plan

**Step 1: Add Quality Scoring to Onboarding**

Add to `src/lib/yuri/onboarding.ts`:

```typescript
interface OnboardingQuality {
  overallScore: number           // 0-100
  fieldScores: Record<string, number>
  thinAreas: string[]            // Fields needing more specificity
  suggestions: string[]          // Natural follow-up prompts for Yuri
}

function calculateOnboardingQuality(extracted: ExtractedSkinProfile): OnboardingQuality {
  const scores: Record<string, number> = {}

  // Skin type specificity
  if (extracted.skin_type) {
    scores.skin_type = ['oily', 'dry', 'normal'].includes(extracted.skin_type) ? 50 : 85
    // "combination with oily T-zone and dry cheeks" = 85
    // "normal" = 50 (vague — most people think they're normal)
  }

  // Concerns specificity
  if (extracted.skin_concerns?.length) {
    scores.skin_concerns = extracted.skin_concerns.length >= 2 ? 90 : 60
    // Single concern = okay, multiple = better profiling
  }

  // Allergies: any answer is good (including "none")
  scores.allergies = extracted.allergies ? 90 : 0

  // Climate: specific city > general zone
  scores.climate = extracted.location_text ? 90 : (extracted.climate ? 60 : 0)

  // Budget: specific range better than vague
  scores.budget_preference = extracted.budget_preference ? 70 : 0

  // Current routine: named products > "I use cleanser and moisturizer"
  scores.current_routine = (extracted.current_routine?.length || 0) >= 3 ? 90
    : (extracted.current_routine?.length || 0) >= 1 ? 60 : 0

  const thinAreas = Object.entries(scores)
    .filter(([, score]) => score > 0 && score < 65)
    .map(([field]) => field)

  const suggestions = thinAreas.map(field => {
    switch (field) {
      case 'skin_type': return "Can you tell me more about how your skin feels throughout the day? Like, is your T-zone different from your cheeks?"
      case 'skin_concerns': return "Besides that, is there anything else about your skin that bugs you? Even small things count."
      case 'current_routine': return "What specific products are you using right now? Brand names help me give better advice."
      default: return null
    }
  }).filter(Boolean) as string[]

  const filled = Object.values(scores).filter(s => s > 0)
  const overallScore = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : 0

  return { overallScore, fieldScores: scores, thinAreas, suggestions }
}
```

**Step 2: Inject quality feedback into onboarding system prompt**

When Yuri has captured the required fields but quality is low (<70), inject a hint:
```
## Profile Quality Assessment
The user's profile is technically complete but some answers are vague:
- Skin type: They said "normal" — this is often a default answer. Ask a clarifying question naturally.
- Current routine: Only 1 product mentioned — gently ask if they use anything else.

Ask ONE follow-up question to improve specificity. Don't be clinical about it — be curious and conversational.
```

**Step 3: Store quality score**

Add `quality_score` column to `ss_onboarding_progress`:
```sql
ALTER TABLE ss_onboarding_progress ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;
```

Track quality score alongside completion percentage. Only mark onboarding as "truly complete" when quality_score >= 65 (not just field completion).

#### Files to Modify
- `src/lib/yuri/onboarding.ts` — Add quality scoring function, inject into system prompt, track in progress
- Database migration for `quality_score` column

#### Database Changes
- `ALTER TABLE ss_onboarding_progress ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;`

#### Estimated Complexity
MEDIUM. Quality scoring logic + prompt injection + database tracking.

---

### Feature 13.6: Voice Quality Post-Processing — Clean AI Artifacts (LOW PRIORITY)

**Why This Matters**: Despite Yuri's excellent system prompt guiding her voice, Claude occasionally produces AI-isms: em-dashes everywhere, "I'd be happy to help!", "Let me break this down", excessive bullet points, corporate filler phrases. LGAAS catches these with a post-processing layer before saving to the database.

**What LGAAS Does** (from `utils/human-voice-agent.js`):
```javascript
function cleanBannedPatterns(rawText) {
  // Remove em-dashes (—) — replace with comma or period
  // Remove "I'd be happy to", "Great question!", "Absolutely!"
  // Remove "Let me break this down", "Here's what I think"
  // Remove excessive bullet points (convert to prose if >5 bullets in a row)
}

function detectAIPatterns(text) {
  // Counts: em-dashes, exclamation marks, "in conclusion", "furthermore"
  // Returns AI score 0-100
  // If >50: flag for review
}
```

#### Implementation Plan

**Step 1: Create Voice Cleanup Module**

Create `src/lib/yuri/voice-cleanup.ts`:

```typescript
const BANNED_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Opener clichés
  { pattern: /^(Great question!|That's a great question!|I'd be happy to help!?)\s*/i, replacement: '' },
  { pattern: /^(Absolutely!|Of course!|Sure thing!)\s*/i, replacement: '' },
  { pattern: /^(Let me break this down\.?|Here's what I think\.?)\s*/i, replacement: '' },

  // Em-dash overuse (replace with comma when between words)
  { pattern: / — /g, replacement: ', ' },

  // Corporate filler
  { pattern: /\b(it's worth noting that|it's important to note that)\b/gi, replacement: '' },
  { pattern: /\b(in conclusion|to summarize|to sum up)\b/gi, replacement: '' },
  { pattern: /\b(furthermore|moreover|additionally)\b/gi, replacement: 'also' },
  { pattern: /\b(utilize)\b/gi, replacement: 'use' },

  // Double spaces from removal
  { pattern: /  +/g, replacement: ' ' },
  // Leading/trailing whitespace per line
  { pattern: /^\s+|\s+$/gm, replacement: '' },
]

export function cleanYuriResponse(text: string): string {
  let cleaned = text
  for (const { pattern, replacement } of BANNED_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement)
  }
  return cleaned.trim()
}
```

**Step 2: Apply in advisor.ts**

In `streamAdvisorResponse()`, after collecting the full response text but before saving to DB:
```typescript
const cleanedText = cleanYuriResponse(fullResponseText)
// Save cleanedText to database
// Stream cleanedText chunks to client
```

**Important**: Apply cleanup AFTER streaming, not during. Users see the raw stream (latency-sensitive), but the saved version is cleaned. This means the user's real-time experience might have a few AI-isms, but conversation history and summaries will be clean.

**Alternative**: Apply during streaming by cleaning each chunk. Risk: regex replacements on partial text can break words. Only viable if patterns are line-boundary safe.

#### Files to Create
- `src/lib/yuri/voice-cleanup.ts` (~60 lines)

#### Files to Modify
- `src/lib/yuri/advisor.ts` — Apply cleanup before DB save

#### Database Changes
None.

#### Estimated Complexity
LOW. Simple regex post-processor. The pattern list can grow over time as AI-isms are identified.

---

### Phase 13 Implementation Priority Summary

| # | Feature | Impact | Complexity | Key Deliverable |
|---|---------|--------|-----------|----------------|
| 13.1 | Prompt Caching | HIGH | Low | 20-30% token cost reduction |
| 13.2 | API Retry Logic | HIGH | Low | Graceful handling of transient API failures |
| 13.3 | Decision Memory | HIGH | Medium | Structured cross-session decisions/preferences/commitments |
| 13.4 | Intent-Based Context | MEDIUM | Medium | Load only relevant context per message |
| 13.5 | Onboarding Quality | MEDIUM | Medium | Detect vague profiles, follow up naturally |
| 13.6 | Voice Quality Cleanup | LOW | Low | Remove AI-isms from saved responses |

**Build Order**: 13.1 + 13.2 (one session — both are low complexity, high impact) → 13.3 (own session — medium complexity, core architecture) → 13.4 + 13.5 (one session — both medium complexity) → 13.6 (can be combined with any other session)

**Session Strategy**: 3 sessions total:
- Session 1: 13.1 (prompt caching) + 13.2 (retry logic) — Quick wins
- Session 2: 13.3 (decision memory) — Core architecture change
- Session 3: 13.4 (intent context) + 13.5 (onboarding quality) + 13.6 (voice cleanup) — Remaining improvements

**Expected Outcome**: Yuri's conversation engine matches LGAAS's battle-tested reliability (prompt caching, retry logic) while adding structured decision memory that prevents memory denial bugs. Cost reduced 20-30%, transient failures handled gracefully, vague profiles detected and improved, AI artifacts cleaned.

---

## Phase 14: Widget Conversation Intelligence — From Stateless Chat to Conversion Engine

**Strategic Rationale**: The landing page widget is Seoul Sister's primary conversion mechanism. A visitor who talks to Yuri before signing up is 5-10x more likely to convert. But today, every widget conversation is stateless — messages stream and vanish. There is zero persistence, zero cross-session memory, zero intent tracking, and zero observability into what visitors ask, what tools Yuri uses, or which conversations lead to subscriptions. The `ss_widget_analytics` table stores only session-level counters (messages_sent, tool_calls_made) — not the actual content.

**The LGAAS Comparison**: LGAAS's widget-conversation.js (1,392 lines) stores every message, generates cross-session AI memory via Sonnet, tracks trust signals, assigns persistent visitor identities, and provides a full admin conversation viewer. Seoul Sister's widget/chat/route.ts (408 lines) streams responses and fires-and-forgets a counter increment. The gap is fundamental.

**What This Phase Delivers**:
1. Full message persistence (every widget message stored, tool calls logged)
2. Persistent anonymous visitor identity (survives page refreshes, browser restarts, multi-day returns)
3. Cross-session AI memory (Sonnet-generated summaries so Yuri remembers returning visitors)
4. Intent signal detection (~15 consumer skincare signals that indicate purchase readiness)
5. Specialist preview system (name-drop specialist expertise to drive conversion FOMO)
6. Admin widget dashboard (conversation viewer, intent analytics, conversion funnel)

**Reference**: LGAAS `lgaas/api/widget-conversation.js` patterns — `handleStartAndMessage()` (lines 292-393), `getPreviousConversationContext()` (lines 945-1045), `generateConversationMemory()` (lines 1304-1367), `detectAndRecordSignals()`.

---

### Feature 14.1: Widget Database Schema — Conversation Persistence Layer (FOUNDATION)

**Why This First**: Every other feature depends on having tables to store data. This migration creates 4 tables that replace the shallow `ss_widget_analytics` table with a full conversation persistence layer.

**Design Decisions**:
- **Persistent visitor identity**: Client-generated UUID stored in localStorage + 365-day cookie (belt and suspenders). Server stores the visitor record with first_seen/last_seen timestamps, total message count, and AI-generated cross-session memory.
- **Ghost conversation prevention**: Sessions are created on FIRST MESSAGE, not page load. LGAAS learned this the hard way — their `handleStart` creates a conversation on widget open, resulting in hundreds of empty conversation records. Seoul Sister's `handleStartAndMessage` pattern (from LGAAS lines 292-393) only creates the session when the visitor actually sends a message.
- **Tool call logging**: Stored as JSONB array on assistant messages (`tool_calls` column) rather than a separate table. Each entry: `{ name: string, input: object, result_summary: string }`. This avoids JOIN overhead for the common read path (viewing a conversation) while keeping full auditability.
- **Rate limiting migration**: Currently uses `ss_rate_limits` table with IP+UA hash. Phase 14 migrates to visitor-record-based counting — `ss_widget_visitors.total_messages` replaces the hash-based rate limit for the 20-message session limit. The 25/IP/day abuse limit stays on `ss_rate_limits`.

#### Database Migration

Create `supabase/migrations/20260310000001_widget_conversation_persistence.sql`:

```sql
-- ============================================================
-- Phase 14.1: Widget Conversation Persistence Layer
-- Replaces shallow ss_widget_analytics with full message storage
-- ============================================================

-- 1. Persistent anonymous visitor identity
CREATE TABLE ss_widget_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,           -- Client-generated UUID (localStorage + cookie)
  ip_hash TEXT,                               -- For abuse detection (NOT for identity)
  user_agent_hash TEXT,                       -- For analytics (NOT for identity)
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_tool_calls INTEGER NOT NULL DEFAULT 0,
  ai_memory JSONB DEFAULT '{}',              -- Sonnet-generated cross-session memory
  -- { summary: string, topics_discussed: string[], skin_concerns: string[],
  --   products_interested_in: string[], interest_level: 'browsing'|'curious'|'engaged'|'ready_to_buy',
  --   recommended_approach: string }
  converted_at TIMESTAMPTZ,                  -- Set when visitor creates an account
  converted_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_visitors_visitor_id ON ss_widget_visitors(visitor_id);
CREATE INDEX idx_widget_visitors_last_seen ON ss_widget_visitors(last_seen_at DESC);
CREATE INDEX idx_widget_visitors_converted ON ss_widget_visitors(converted_user_id) WHERE converted_user_id IS NOT NULL;

-- 2. Widget conversation sessions (created on first message, not page load)
CREATE TABLE ss_widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL REFERENCES ss_widget_visitors(visitor_id),
  session_number INTEGER NOT NULL DEFAULT 1, -- Nth session for this visitor
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  specialist_domains_detected TEXT[] DEFAULT '{}', -- Which specialist areas were triggered
  intent_signals_detected TEXT[] DEFAULT '{}',     -- Signal types detected this session
  ai_summary TEXT,                            -- Sonnet-generated session summary (fire-and-forget)
  ended_naturally BOOLEAN DEFAULT FALSE,      -- True if visitor hit 20-msg limit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_sessions_visitor ON ss_widget_sessions(visitor_id, started_at DESC);
CREATE INDEX idx_widget_sessions_recent ON ss_widget_sessions(started_at DESC);

-- 3. Widget messages (every message stored with tool call logging)
CREATE TABLE ss_widget_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ss_widget_sessions(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,                   -- Denormalized for fast queries
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,                           -- Array of { name, input, result_summary } (assistant only)
  -- result_summary is truncated to ~200 chars per tool call to avoid bloat
  specialist_detected TEXT,                   -- Which specialist domain was detected (user msgs only)
  intent_signals TEXT[] DEFAULT '{}',         -- Signals detected on this specific message
  tokens_used INTEGER,                        -- For cost tracking (assistant only)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_messages_session ON ss_widget_messages(session_id, created_at);
CREATE INDEX idx_widget_messages_visitor ON ss_widget_messages(visitor_id, created_at DESC);

-- 4. Intent signals — individual signal events for analytics
CREATE TABLE ss_widget_intent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL REFERENCES ss_widget_visitors(visitor_id),
  session_id UUID NOT NULL REFERENCES ss_widget_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ss_widget_messages(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,                  -- e.g., 'described_skin_concern', 'asked_product_price'
  signal_data JSONB DEFAULT '{}',             -- Context: { product: "COSRX Snail", concern: "acne" }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_signals_visitor ON ss_widget_intent_signals(visitor_id, created_at DESC);
CREATE INDEX idx_widget_signals_type ON ss_widget_intent_signals(signal_type, created_at DESC);

-- RLS Policies: service_role writes, admin reads
ALTER TABLE ss_widget_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_intent_signals ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API route uses getServiceClient)
CREATE POLICY "Service role manages widget visitors"
  ON ss_widget_visitors FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget sessions"
  ON ss_widget_sessions FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget messages"
  ON ss_widget_messages FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget signals"
  ON ss_widget_intent_signals FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Admin users can read (for dashboard)
CREATE POLICY "Admins can read widget visitors"
  ON ss_widget_visitors FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget sessions"
  ON ss_widget_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget messages"
  ON ss_widget_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget signals"
  ON ss_widget_intent_signals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

-- Updated_at trigger for visitors
CREATE TRIGGER set_widget_visitors_updated
  BEFORE UPDATE ON ss_widget_visitors
  FOR EACH ROW
  EXECUTE FUNCTION ss_set_updated_at();
```

#### Files to Create
- `supabase/migrations/20260310000001_widget_conversation_persistence.sql` (~120 lines)

#### Database Changes
- New table: `ss_widget_visitors` (persistent anonymous identity + AI memory)
- New table: `ss_widget_sessions` (conversation sessions, created on first message)
- New table: `ss_widget_messages` (every message with tool call JSONB)
- New table: `ss_widget_intent_signals` (individual signal events)
- RLS: service_role for API writes, admin read via `is_admin`
- `ss_widget_analytics` preserved (not dropped) for historical data; new code writes to new tables

#### Estimated Complexity
LOW. Pure SQL migration, no application code.

---

### Feature 14.2: Widget Chat Route Rewrite — Full Persistence + Tool Logging (CORE)

**Why This Is The Core**: This rewrites `src/app/api/widget/chat/route.ts` to persist every message, log tool calls, generate cross-session memory, and support returning visitors. The SSE streaming architecture and tool use loop stay intact — this adds persistence around them.

**What Changes From Current Route**:
- Request body gains `visitor_id` (client-generated UUID) and `session_id` (null on first message)
- Session created on first message (ghost prevention)
- Every user message and assistant response saved to `ss_widget_messages`
- Tool calls logged as JSONB on assistant messages
- Cross-session memory injected into system prompt for returning visitors
- Sonnet memory generation fires after conversation (fire-and-forget, non-blocking)
- Rate limiting migrates from IP+UA hash to visitor record `total_messages`

**Architecture**: Extract persistence logic into 3 new modules under `src/lib/widget/` to keep the route file under 300 lines:

#### New Module: `src/lib/widget/visitor.ts` (~80 lines)

```typescript
/**
 * Persistent anonymous visitor identity management.
 * Adapted from LGAAS's getOrCreateProspect() (widget-conversation.js lines 879-913).
 */

interface WidgetVisitor {
  id: string           // UUID (database PK)
  visitor_id: string   // Client-generated UUID
  total_messages: number
  total_sessions: number
  ai_memory: Record<string, unknown> | null
}

/**
 * getOrCreateVisitor(visitorId, ipHash, uaHash)
 *
 * - If visitor_id exists in ss_widget_visitors: update last_seen_at, return record
 * - If new: INSERT with first_seen_at = now, return new record
 * - Uses UPSERT (ON CONFLICT visitor_id DO UPDATE) for atomicity
 */

/**
 * incrementVisitorCounters(visitorId, messagesDelta, toolCallsDelta)
 *
 * Atomic increment of total_messages, total_tool_calls on the visitor record.
 * Called after each successful message exchange.
 */

/**
 * isVisitorAtLimit(visitor): boolean
 *
 * Returns true if visitor.total_messages >= MAX_FREE_MESSAGES (20).
 * Replaces the current IP+UA hash rate limit for the session message cap.
 */
```

#### New Module: `src/lib/widget/session.ts` (~100 lines)

```typescript
/**
 * Widget session lifecycle management.
 * Sessions created on first message only (ghost prevention).
 * Adapted from LGAAS's handleStartAndMessage() (widget-conversation.js lines 292-393).
 */

interface WidgetSession {
  id: string           // UUID
  visitor_id: string
  session_number: number
  message_count: number
}

/**
 * createSession(visitorId)
 *
 * Creates a new ss_widget_sessions row. Session number = visitor.total_sessions + 1.
 * Called ONLY when first message arrives (not on page load).
 * Also increments visitor.total_sessions.
 */

/**
 * incrementSessionCounters(sessionId, toolCallsDelta)
 *
 * Atomic increment of message_count, tool_calls_count on the session record.
 * Updates last_message_at.
 */

/**
 * updateSessionMetadata(sessionId, specialistDomains, intentSignals)
 *
 * Appends detected specialist domains and intent signals to the session arrays.
 * Uses array_cat for atomic append.
 */
```

#### New Module: `src/lib/widget/persistence.ts` (~120 lines)

```typescript
/**
 * Message persistence and cross-session memory.
 * Every message stored. Tool calls logged as JSONB. Memory generated via Sonnet.
 */

interface ToolCallLog {
  name: string
  input: Record<string, unknown>
  result_summary: string  // Truncated to ~200 chars
}

/**
 * saveUserMessage(sessionId, visitorId, content, specialistDetected, intentSignals)
 *
 * INSERT into ss_widget_messages with role='user'.
 */

/**
 * saveAssistantMessage(sessionId, visitorId, content, toolCalls, tokensUsed)
 *
 * INSERT into ss_widget_messages with role='assistant'.
 * toolCalls: Array<ToolCallLog> — truncated result summaries to avoid bloat.
 */

/**
 * truncateToolResult(result: string, maxLength = 200): string
 *
 * Truncate tool execution results for storage. Keep first 200 chars + "..." indicator.
 * Full results don't need to be stored — the tool name + input tells the story.
 */

/**
 * getPreviousConversationContext(visitorId)
 *
 * Adapted from LGAAS's getPreviousConversationContext() (lines 945-1045).
 * Loads the visitor's ai_memory and injects it into the system prompt as:
 *
 *   ## Returning Visitor Context
 *   This visitor has chatted with you before. Here's what you know about them:
 *   - Summary: {ai_memory.summary}
 *   - Topics discussed: {ai_memory.topics_discussed}
 *   - Skin concerns: {ai_memory.skin_concerns}
 *   - Products interested in: {ai_memory.products_interested_in}
 *   - Interest level: {ai_memory.interest_level}
 *   - Recommended approach: {ai_memory.recommended_approach}
 *
 *   Use this context naturally. Don't say "I remember you" explicitly — just
 *   demonstrate knowledge. If they asked about vitamin C serums last time,
 *   naturally reference that when relevant.
 *
 * Returns null for first-time visitors (no memory to inject).
 */

/**
 * generateAndSaveMemory(visitorId, sessionMessages)
 *
 * Fire-and-forget Sonnet call after conversation.
 * Adapted from LGAAS's generateConversationMemory() (lines 1304-1367).
 *
 * Merges existing ai_memory with current session to produce updated memory.
 * Prompt asks Sonnet to extract:
 *   - summary: 2-3 sentence overview of all conversations with this visitor
 *   - topics_discussed: array of topics across all sessions
 *   - skin_concerns: extracted skin concerns (acne, dryness, sensitivity, etc.)
 *   - products_interested_in: products they asked about or showed interest in
 *   - interest_level: browsing | curious | engaged | ready_to_buy
 *   - recommended_approach: how Yuri should approach this visitor next time
 *
 * Trigger: after every 3rd message in a session (not every message — cost control).
 * Uses Sonnet 4.5 (cheap), max_tokens 400.
 * Estimated cost: ~$0.005 per memory generation.
 */
```

#### Route Rewrite: `src/app/api/widget/chat/route.ts`

**Request body changes**:
```typescript
const widgetSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(40).optional(),
  visitor_id: z.string().uuid().optional(),  // NEW: client-generated UUID
  session_id: z.string().uuid().optional(),  // NEW: null on first message
})
```

**Flow changes (pseudocode)**:
```
1. Parse request, extract visitor_id + session_id
2. IP rate limit check (25/IP/day abuse limit — KEEP as-is)
3. getOrCreateVisitor(visitor_id, ipHash, uaHash)
4. isVisitorAtLimit(visitor) → 429 if true
5. If no session_id → createSession(visitor.visitor_id) → get session_id
6. Load previous conversation context (getPreviousConversationContext)
7. Inject context into system prompt (append after YURI_WIDGET_SYSTEM)
8. detectSpecialist(message) → for logging, NOT for routing (widget doesn't route)
9. saveUserMessage(session_id, visitor_id, message, specialist, signals)
10. --- EXISTING STREAMING + TOOL LOOP (unchanged) ---
11. Collect tool calls during loop: Array<ToolCallLog>
12. saveAssistantMessage(session_id, visitor_id, fullResponse, toolCalls, tokens)
13. incrementVisitorCounters(visitor_id, 1, toolCallCount)
14. incrementSessionCounters(session_id, toolCallCount)
15. Fire-and-forget: generateAndSaveMemory (every 3rd message)
16. Fire-and-forget: detectAndRecordSignals (Feature 14.4)
```

**What stays identical**: The entire streaming architecture, TransformStream, SSE event format, tool use loop with BUFFER/STREAM modes, `shouldWidgetForceToolUse()`, prompt caching, voice cleanup, and `CACHED_WIDGET_TOOLS`. This feature adds persistence AROUND the existing streaming, not inside it.

#### Client-Side Changes

**`src/lib/utils/widget-session.ts`** — Add visitor identity:
```typescript
const VISITOR_ID_KEY = 'yuri_visitor_id'

/**
 * getOrCreateVisitorId(): string
 *
 * Returns a persistent UUID for this browser:
 * 1. Check localStorage for existing visitor_id
 * 2. Check cookie for existing visitor_id (fallback if localStorage cleared)
 * 3. Generate new UUID (crypto.randomUUID()), save to both localStorage + cookie
 *
 * Cookie: 365-day expiry, SameSite=Strict, path=/
 * This gives us two-layer persistence: localStorage (primary) + cookie (backup).
 */

/**
 * getSessionId(): string | null
 * setSessionId(id: string): void
 *
 * Session ID stored in sessionStorage (dies with tab).
 * Set after first message response includes the server-generated session_id.
 */
```

**`src/components/widget/TryYuriSection.tsx`** — Modify `sendMessage()`:
- Import `getOrCreateVisitorId`, `getSessionId`, `setSessionId` from widget-session
- Add `visitor_id` and `session_id` to fetch body
- Parse `session_id` from SSE done event (route returns it on first message)
- Call `setSessionId()` after receiving it

**`src/components/widget/YuriBubble.tsx`** — Same changes as TryYuriSection.

#### SSE Response Changes

The `done` event gains a `session_id` field:
```json
{ "type": "done", "message": "cleaned response text", "session_id": "uuid" }
```

Client stores this for subsequent messages in the same browser session.

#### Files to Create
- `src/lib/widget/visitor.ts` (~80 lines)
- `src/lib/widget/session.ts` (~100 lines)
- `src/lib/widget/persistence.ts` (~120 lines)

#### Files to Modify
- `src/app/api/widget/chat/route.ts` — Add persistence calls around existing streaming loop
- `src/lib/utils/widget-session.ts` — Add `getOrCreateVisitorId()`, session ID storage
- `src/components/widget/TryYuriSection.tsx` — Send visitor_id + session_id, store session_id from response
- `src/components/widget/YuriBubble.tsx` — Same changes as TryYuriSection

#### Database Changes
None beyond Feature 14.1 migration.

#### Estimated Complexity
HIGH. This is the largest feature — route rewrite with 3 new modules, client changes to both widget components, and SSE response format change. The streaming architecture is preserved but persistence wraps around it.

#### Testing Checklist
- [ ] First-time visitor: sends message, session created, messages stored, response streams correctly
- [ ] Same visitor returns (new tab): visitor_id persists, session_id is new, previous memory injected
- [ ] Tool calls logged: search_products call appears in assistant message tool_calls JSONB
- [ ] 20-message limit: visitor hits limit, gets conversion prompt, server returns 429
- [ ] Memory generation: after 3rd message, Sonnet fire-and-forget runs, ai_memory updated on visitor
- [ ] Cross-session memory: returning visitor's system prompt includes memory context
- [ ] Hero widget + floating bubble share visitor_id (same visitor, different components)
- [ ] Rate limiting: 25/IP/day abuse limit still works alongside visitor-based counting
- [ ] SSE streaming performance: no perceptible latency increase from persistence calls

---

### Feature 14.3: Specialist Preview System — Conversion Through FOMO (MEDIUM)

**Why This Matters**: The widget currently gives visitors the same Yuri for every question. Subscribers get 6 specialist agents with deep domain expertise. The specialist preview system lets widget Yuri name-drop specialist capabilities when she detects a question in a specialist's domain — creating natural conversion FOMO without being salesy.

**How It Works**: When a visitor's message triggers `detectSpecialist()` (the existing function from `specialists.ts`), the widget prompt gets a one-time injection telling Yuri to acknowledge the specialist domain and hint at subscriber depth.

**What This Is NOT**: This is NOT full specialist routing for widget visitors. The specialist system prompt is NOT injected. Yuri answers with her general knowledge + tools. She simply acknowledges that a deeper specialist experience exists.

#### Implementation Plan

**Step 1: Detect Specialist Domain on Each Message**

In the widget route, after parsing the message:
```typescript
import { detectSpecialist, SPECIALISTS } from '@/lib/yuri/specialists'

const detectedSpecialist = detectSpecialist(parsed.message)
```

Store on the user message record (`specialist_detected` column) and append to session's `specialist_domains_detected` array.

**Step 2: Add Specialist Preview Injection to System Prompt**

When `detectedSpecialist` is not null, append to the system prompt BEFORE sending to Claude:

```typescript
const specialistPreviewPrompt = detectedSpecialist ? `

## Specialist Knowledge Available
This question touches on ${SPECIALISTS[detectedSpecialist].name} territory. You have deep expertise here and can give a solid answer. But subscribers get access to a dedicated ${SPECIALISTS[detectedSpecialist].name} mode with even deeper analysis — ingredient-level formulation breakdowns, personalized conflict detection against their full routine, and intelligence extraction that improves over time.

When answering, naturally weave in ONE brief mention of what the specialist mode adds. Examples:
- "My Ingredient Analyst mode could cross-check this against your full routine for conflicts..."
- "Subscribers get my Routine Architect mode which builds step-by-step layered routines with wait times..."
- "My Authenticity Investigator could do a full packaging comparison if you upload a photo..."

Keep it to ONE sentence, naturally embedded. Not a sales pitch. Just a glimpse of depth.
` : ''
```

**Step 3: Track Specialist Domain Frequency**

In session metadata, accumulate which specialist domains were triggered:
```typescript
if (detectedSpecialist) {
  await updateSessionMetadata(sessionId, [detectedSpecialist], [])
}
```

This feeds the admin dashboard: "60% of widget conversations trigger Ingredient Analyst" tells us what visitors care about.

#### Files to Modify
- `src/app/api/widget/chat/route.ts` — Add specialist detection + prompt injection
- `src/lib/widget/session.ts` — Use `updateSessionMetadata()` for specialist tracking

#### Database Changes
None beyond Feature 14.1 (specialist_detected column already on ss_widget_messages).

#### Estimated Complexity
LOW. One import, one function call, one conditional string append to the system prompt.

---

### Feature 14.4: Intent Signal Detection Engine — Know When Visitors Are Ready (HIGH)

**Why This Matters**: Not all widget conversations are equal. A visitor who asks "how much is the COSRX snail mucin?" is closer to buying than one who asks "what is glass skin?" Intent signals detect purchase readiness from message content and conversation patterns. This feeds the admin dashboard and could drive future automated follow-up (email capture, targeted conversion prompts).

**LGAAS Reference**: `detectAndRecordSignals()` in widget-conversation.js iterates an array of signal definitions, each with a `detect(message, context)` function. Adapted for B2C consumer skincare context.

#### Signal Definitions (~15 signals)

Create `src/lib/widget/signals.ts` (~150 lines):

```typescript
interface IntentSignal {
  type: string
  category: 'skin_awareness' | 'product_interest' | 'purchase_intent' | 'engagement'
  detect: (message: string, context: SignalContext) => SignalMatch | null
}

interface SignalContext {
  messageNumber: number        // Nth message in this session
  totalVisitorMessages: number // Across all sessions
  toolsUsedThisSession: string[]
  specialistsDetected: string[]
}

interface SignalMatch {
  signal_type: string
  signal_data: Record<string, unknown>
}
```

**Skin Awareness Signals** (visitor knows their skin):
| Signal | Detection Logic | Example |
|--------|----------------|---------|
| `described_skin_type` | Message contains "my skin is [oily/dry/combo/sensitive/normal]" or "I have [oily/dry] skin" | "I have really oily skin" |
| `described_skin_concern` | Message contains concern keywords: acne, wrinkles, dark spots, redness, dehydration, pores, texture, hyperpigmentation | "I'm trying to fix my acne scars" |
| `mentioned_current_routine` | Message references current products or routine: "I use", "my routine", "currently using", "I've been using" | "I currently use COSRX cleanser and Laneige moisturizer" |
| `mentioned_skin_reaction` | Message describes a reaction: "broke me out", "irritation", "redness from", "allergic to" | "The last serum broke me out badly" |

**Product Interest Signals** (visitor is evaluating products):
| Signal | Detection Logic | Example |
|--------|----------------|---------|
| `asked_about_specific_product` | Tool forced (brand mention) OR message contains specific product name | "Is the Beauty of Joseon sunscreen good?" |
| `asked_product_comparison` | Message contains comparison words + products: "vs", "or", "better", "difference between" | "COSRX snail mucin vs the Mixsoon one?" |
| `asked_product_price` | Message contains price keywords: "how much", "price", "cost", "where to buy" | "How much is the Anua cleansing oil?" |
| `asked_for_recommendation` | Message asks for rec: "recommend", "suggest", "best", "what should I" | "What's the best vitamin C serum for dark spots?" |
| `asked_about_authenticity` | Authenticity keywords: "fake", "real", "authentic", "counterfeit" | "Is the one on Amazon real?" |

**Purchase Intent Signals** (visitor is close to buying):
| Signal | Detection Logic | Example |
|--------|----------------|---------|
| `asked_where_to_buy` | "where can I buy", "where to get", "which retailer", "olive young" | "Where's the cheapest place to buy it?" |
| `asked_about_subscription` | "subscribe", "subscription", "$39", "pro", "how much is Seoul Sister" | "What do I get with the subscription?" |
| `multiple_product_questions` | 3+ different products asked about in same session (tracked via tool calls) | (Pattern detection, not single message) |
| `deep_routine_question` | Routine-specific: "what order", "layering", "can I use X with Y", "am and pm" | "Can I use retinol and vitamin C in the same routine?" |

**Engagement Signals** (visitor is invested):
| Signal | Detection Logic | Example |
|--------|----------------|---------|
| `returned_visitor` | session_number > 1 (detected from visitor record) | (Automatic on return visit) |
| `long_conversation` | message_count >= 8 in a single session | (Pattern detection) |

#### Signal Detection Function

```typescript
/**
 * detectSignals(message, context): SignalMatch[]
 *
 * Runs all signal definitions against the message + context.
 * Returns array of matched signals (0 or more per message).
 */

/**
 * recordSignals(signals, visitorId, sessionId, messageId)
 *
 * Batch INSERT into ss_widget_intent_signals.
 * Also appends signal types to message.intent_signals and session.intent_signals_detected.
 * Fire-and-forget (non-blocking).
 */
```

#### Integration with Route

In the widget chat route, after saving the user message:
```typescript
// Fire-and-forget signal detection
const signalContext: SignalContext = {
  messageNumber: session.message_count + 1,
  totalVisitorMessages: visitor.total_messages,
  toolsUsedThisSession: toolCallsThisSession.map(t => t.name),
  specialistsDetected: session.specialist_domains_detected || [],
}

void detectAndRecordSignals(parsed.message, signalContext, visitor.visitor_id, sessionId, messageId)
  .catch(() => {}) // Never break the stream
```

#### Files to Create
- `src/lib/widget/signals.ts` (~150 lines)

#### Files to Modify
- `src/app/api/widget/chat/route.ts` — Add signal detection call after user message save

#### Database Changes
None beyond Feature 14.1 (ss_widget_intent_signals table already created).

#### Estimated Complexity
MEDIUM. ~15 regex/keyword detectors + batch insert logic. No AI calls — all detection is pattern-based.

---

### Feature 14.5: Admin Widget Dashboard — Conversation Viewer + Analytics (MEDIUM)

**Why This Matters**: Without a dashboard, all the data stored by Features 14.1-14.4 is invisible. The admin dashboard provides: conversation viewer (read every widget conversation), intent analytics (which signals fire most often), conversion funnel (how many visitors reach N messages), and visitor detail view.

#### API Endpoints

**`src/app/api/admin/widget/conversations/route.ts`** (~80 lines):
```
GET /api/admin/widget/conversations
  ?page=1&limit=20&sort=recent|longest|most_signals
  Authorization: via requireAdmin()
  Response: { conversations: Array<{
    session_id, visitor_id, started_at, message_count,
    tool_calls_count, specialist_domains_detected, intent_signals_detected,
    first_message_preview: string (first 100 chars of first user message)
  }>, total: number, page: number }
```

**`src/app/api/admin/widget/conversations/[id]/route.ts`** (~50 lines):
```
GET /api/admin/widget/conversations/:session_id
  Authorization: via requireAdmin()
  Response: {
    session: WidgetSession,
    visitor: WidgetVisitor (minus ip_hash),
    messages: Array<WidgetMessage>,
    signals: Array<IntentSignal>
  }
```

**`src/app/api/admin/widget/analytics/route.ts`** (~100 lines):
```
GET /api/admin/widget/analytics?days=7
  Authorization: via requireAdmin()
  Response: {
    period: { start, end },
    totals: { visitors, sessions, messages, tool_calls, unique_visitors_with_signals },
    signal_breakdown: Array<{ signal_type, count, percentage }>,
    specialist_breakdown: Array<{ domain, count, percentage }>,
    conversion_funnel: {
      visited: number,         // Unique visitors who sent at least 1 message
      engaged: number,         // Visitors who sent 3+ messages
      deep_engaged: number,    // Visitors who sent 8+ messages
      hit_limit: number,       // Visitors who hit 20-message limit
      converted: number,       // Visitors who later created an account
    },
    daily_volume: Array<{ date, visitors, messages, tool_calls }>,
    top_first_questions: Array<{ question: string, count: number }>,
  }
```

#### Admin Dashboard Page

Create `src/app/(app)/admin/widget/page.tsx` (~300 lines):

**Layout**:
- **Summary Cards** (top): Total visitors (7d), Total conversations, Messages, Tool calls, Conversion rate
- **Conversion Funnel** (left): Visual funnel showing visited -> engaged -> deep engaged -> hit limit -> converted
- **Signal Breakdown** (right): Bar chart of intent signal types by frequency
- **Specialist Domains** (right): Pie chart of which specialist areas widget visitors trigger most
- **Daily Volume** (center): Line chart of daily visitors, messages, tool calls
- **Top First Questions** (below): Table of most common first messages (helps understand what visitors come for)
- **Conversation List** (bottom): Paginated table with session date, message count, first message preview, signals detected, specialist domains. Click to expand full conversation.

**Conversation Detail View** — expandable or modal:
- Full message thread (user messages left-aligned, assistant right-aligned, matching widget styling)
- Tool call indicators on assistant messages (collapsible: tool name + input + truncated result)
- Intent signal badges on messages where signals were detected
- Visitor context card: first_seen, last_seen, total_messages, total_sessions, AI memory summary, interest_level

#### Navigation

Add "Widget Intel" link to admin dropdown in `Header.tsx`, visible only when `is_admin = true`.

#### Files to Create
- `src/app/api/admin/widget/conversations/route.ts` (~80 lines)
- `src/app/api/admin/widget/conversations/[id]/route.ts` (~50 lines)
- `src/app/api/admin/widget/analytics/route.ts` (~100 lines)
- `src/app/(app)/admin/widget/page.tsx` (~300 lines)

#### Files to Modify
- `src/components/layout/Header.tsx` — Add "Widget Intel" link to admin dropdown

#### Database Changes
None beyond Feature 14.1.

#### Estimated Complexity
MEDIUM. 3 API endpoints + 1 page with visualization components. The analytics query is the most complex piece (signal aggregation + funnel calculation).

---

### Phase 14 Implementation Priority Summary

| # | Feature | Impact | Complexity | Key Deliverable |
|---|---------|--------|-----------|----------------|
| 14.1 | Database Schema | FOUNDATION | Low | 4 tables for full widget conversation persistence |
| 14.2 | Chat Route Rewrite | CORE | High | Every message stored, tool calls logged, cross-session memory |
| 14.3 | Specialist Preview | MEDIUM | Low | Name-drop specialist expertise for conversion FOMO |
| 14.4 | Intent Signals | HIGH | Medium | ~15 consumer intent signals detected from message patterns |
| 14.5 | Admin Dashboard | MEDIUM | Medium | Conversation viewer, intent analytics, conversion funnel |

**Build Order**: 14.1 (migration) → 14.2 (route rewrite + client changes) → 14.4 (intent signals) → 14.3 (specialist preview) → 14.5 (admin dashboard)

**Rationale**: Schema first (14.1), then the core persistence rewrite (14.2) which is the largest piece and must work before anything else. Intent signals (14.4) next because they feed both the specialist preview logic and the admin dashboard. Specialist preview (14.3) is a small prompt injection that depends on specialist detection already being wired in. Dashboard (14.5) last because it's read-only — it consumes data from 14.1-14.4.

**Session Strategy**: 3 sessions total:
- Session 1: 14.1 (migration) + 14.2 (route rewrite + client changes) — Foundation + core. Largest session.
- Session 2: 14.4 (intent signals) + 14.3 (specialist preview) — Detection + conversion layer.
- Session 3: 14.5 (admin dashboard) — Read-only analytics UI.

**Expected Outcome**: Every widget conversation is fully persisted with message content, tool call logs, specialist domain detection, and intent signals. Returning visitors get cross-session AI memory (Yuri remembers them). Specialist preview creates natural conversion FOMO. Admin dashboard provides full observability into what visitors ask, which tools Yuri uses, and where visitors are in the conversion funnel.

**Cost Impact**:
- Supabase storage: ~1KB per message, 20 messages per visitor = ~20KB per visitor. At 1,000 visitors/month = 20MB/month. Negligible.
- Sonnet memory generation: ~$0.005 per call, triggered every 3rd message. At 1,000 visitors averaging 6 messages = 2,000 memory calls/month = $10/month.
- No additional Claude Opus costs — the streaming call is already happening; persistence is just saving what already exists.

**Relationship to Existing Systems**:
- `ss_widget_analytics` is NOT dropped — preserved for historical data. New code writes to new tables. Can be dropped after 30 days of Phase 14 running.
- The 25/IP/day abuse rate limit in `ss_rate_limits` is preserved. The 20-message session limit migrates from IP+UA hash to visitor-record-based counting.
- `widget-session.ts` client-side localStorage counter is preserved as UX display ("N messages remaining") but is no longer the source of truth for limiting — server-side visitor record is authoritative.

---

## Phase 15: LGAAS Memory Architecture Port — Cross-Application Audit Findings

**Strategic Rationale**: A line-by-line audit of LGAAS AriaStar's memory architecture (advisor-prompt-helpers.js 2,553 lines, advisor-conversation.js 4,616 lines) against Yuri's (memory.ts 1,326 lines, advisor.ts 1,118 lines) confirmed Yuri is more architecturally complete than expected. She already has structured tools, Sonnet bridge summaries, recent message excerpts, smart truncation, and explicit price/packaging confabulation guards. **Most LGAAS Blueprints don't apply** — Yuri solved the equivalent problems differently or already.

**Five real gaps identified, ranked by impact**. Each is self-contained for a fresh Claude Code session.

### Phase 15 Implementation Priority Summary

| # | Feature | Impact | Complexity | Status |
|---|---------|--------|-----------|--------|
| 15.1 | Corrections Memory | HIGHEST | Low | COMPLETE (v10.2.0) |
| 15.2 | Heat Check / Tempo Matching | HIGH | Low | COMPLETE (v10.3.0) |
| 15.3 | Draft Preservation on Send Error | MEDIUM | Low | COMPLETE (v10.3.0) |
| 15.4 | Age-Aware Memory Rendering | MEDIUM | Low-Med | COMPLETE (v10.3.0) |
| 15.5 | Textarea Max-Height Conflict Fix | LOW | Trivial | COMPLETE (v10.2.0) |

**Phase 15 status: COMPLETE.** All 5 items from the LGAAS memory architecture audit shipped across v10.2.0 (Session 1) and v10.3.0 (Session 2).

### Feature 15.1: Corrections Memory — Persistent "You Were Wrong" Records (COMPLETE)

**Problem**: Yuri's `decision_memory` JSONB schema captured decisions/preferences/commitments but had no field for "user told me X was wrong." K-beauty brands reformulate every 2-3 years (Yuri's own system prompt admits this), so when a user said "actually the COSRX Snail Mucin was reformulated to 92% with added niacinamide last year," the correction never persisted — Yuri repeated the outdated 96% claim in the next session. Same memory denial pattern as v8.0.1, but for factual corrections instead of past recommendations.

**LGAAS reference**: `advisor-conversation.js:369-394` (extraction prompt), `advisor-prompt-helpers.js:1898-1908` (rendering with 60-day age tag), `advisor-conversation.js:308-316` (merge logic).

**Solution shipped (v10.2.0)**:
- Extended `DecisionMemory` interface (`memory.ts:62-79`) with `corrections: Array<{ topic, yuri_said, truth, category, date }>`. New `CorrectionCategory` type union: `reformulation | discontinued | price | ingredient | brand_identity | other` (K-beauty-tuned, replacing LGAAS's `factual | brand_identity | platform_rule | timeline | other`).
- Updated Sonnet extraction prompt (`memory.ts:~1060`) to extract corrections as 4th category. Prompt explicitly distinguishes opinion disagreements (NOT extracted) from factual errors (extracted). Includes K-beauty-specific examples for each category.
- Added corrections normalization in incoming pipeline with `validCategories` Set and graceful fallback to `'other'` for unknown categories.
- Added topic-keyed merge logic in `mergeDecisionMemory()` — latest correction per topic wins, defaults `base.corrections || []` for backwards compat with rows lacking the field.
- Updated `loadDecisionMemory` empty-row skip guard to count corrections so a corrections-only row still loads.
- Updated incoming-empty skip guard so a corrections-only extraction still saves.
- Rendered new section **above** decisions/preferences/commitments (highest trust): `### Corrections That Stick (Trust These Over Your Training Data)`. Includes 60-day age tag (`[60+ days ago — verify with a tool if still current]`) prompting Yuri to use `search_products` / `get_product_details` for stale corrections rather than blindly trusting.

**Why corrections render first**: They override training data. Decisions/preferences are choices made WITH Yuri; corrections are facts Yuri got WRONG. Higher trust ranking.

**Backwards compatibility**: Old `decision_memory` JSONB rows lack the `corrections` field. The rendering guard `dm.corrections && dm.corrections.length > 0` handles this cleanly. The merge logic uses `base.corrections || []` so old rows merge without throwing.

### Feature 15.5: Textarea Max-Height Conflict Fix (COMPLETE)

**Problem**: `ChatInput.tsx:165` had `max-h-[120px]` Tailwind class while the inline `style.height` recalc capped at 400px (`:63`). CSS `max-height` always wins regardless of inline `style.height`, so users were capped at 120px — the inline 400px calc was dead code. For long product histories (skincare users do this constantly), 120px was painfully cramped.

**Solution shipped (v10.2.0)**: Replaced `max-h-[120px]` with `max-h-[400px]` so the Tailwind class matches the inline JS calc. Users now get up to 400px of textarea height for long messages.

### Skipped After Verification

- **Dictation rAF wrap** (LGAAS Blueprint 45) — Already implemented at `ChatInput.tsx:59-65`. The audit confirmed correct `requestAnimationFrame` usage. (Real bug found there was the max-height conflict, fixed as 15.5.)
- **Validation guidance** — Already at `advisor.ts:221-227` ("Validate their feeling first. One sentence of genuine empathy"). Heat Check (15.2) is the narrower companion for the specific heat + accusation + evidence pattern.
- **Confabulation guards** — Already at `advisor.ts:63-78` with explicit price + packaging rules.
- **Recent excerpts / smart truncation** — Already implemented (`memory.ts:1149-1204` for excerpts, `:811-896` for truncation with bridge summaries).

### Phase 15 Session 2 Implementation Notes (v10.3.0)

- **15.2 Heat Check** (`src/lib/yuri/advisor.ts`): New `## Heat Check: Match Tempo, Not Temperature` section in `YURI_SYSTEM_PROMPT`, between `## Emotional Intelligence` and the closing backtick. Distinguishes itself from Emotional Intelligence (which handles distress about THE USER's skin) by targeting anger/accusation about a THIRD PARTY (brand, derm, influencer, retailer). Trigger requires all three signals simultaneously: emotional heat + third-party accusation + cited evidence. Response pattern: ONE clarifying question that surfaces missing context (regional batch, reformulation, screenshot verification) BEFORE engaging with the substance. Three concrete examples included. Explicitly framed as "defending the user from looking foolish later," NOT defending the third party.
- **15.3 Draft Preservation** (`src/hooks/useYuri.ts`, `src/components/yuri/ChatInput.tsx`, `src/app/(app)/yuri/page.tsx`): The existing useYuri catch block already preserved partial *streamed* content (lines 215-237). The gap was when the request fails BEFORE any text streams (403, network error, abort) — the user's typed message disappeared because ChatInput optimistically clears `value` on submit. New `lastFailedDraft: string \| null` state in useYuri, set in the catch block when no partial content was preserved. New `restoredValue` and `onRestoreConsumed` props on ChatInput. useEffect restores into local `value` when restoredValue arrives, with a guard that skips restore if the user has already started typing (don't clobber active input). Auto-resizes the textarea and focuses it after restore.
- **15.4 Age-Aware Memory** (`src/lib/yuri/memory.ts`): Three rendering surfaces now carry inline date tags. (1) Product reactions: `ProductReaction` interface gained `recordedAt: string \| null`, Supabase select adds `created_at` with `order('created_at', desc)`, render appends `(recorded YYYY-MM-DD)`. Section headers add one observational sentence ("Older entries may be stale — feel free to ask if it's still working for them"). (2) Specialist insights: existing `SpecialistInsightMemory.createdAt` field now surfaces in `### {specialist_type} (recorded YYYY-MM-DD)` heading, with section guidance "older insights may need a quick check-in before you act on them." (3) Preferences: `DecisionMemory.preferences` interface gained `date: string`, normalization defaults to today when Sonnet doesn't provide one (Sonnet prompt unchanged to avoid wasting tokens). Merge logic preserves the original date when preference content is unchanged so age renders accurately. Render: `- **{topic}**: {preference} (stated YYYY-MM-DD)`. All three follow LGAAS Blueprint 46: surface raw timestamps, don't bucket, don't instruct — let Opus 4.7 calibrate confidence from the dates themselves.

---

## Competitive Landscape

### Why Seoul Sister Wins

| Gap | Current State | Seoul Sister Solution |
|-----|--------------|----------------------|
| Hwahae is Korean-only | No English equivalent exists | Full K-beauty intelligence in English |
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
**Current version**: 10.13.0 (Seoul Sister Guardian — governance + always-on watcher, June 5 2026; plus v10.12.0 Widget Conversion / Continuity-Is-the-Gate, June 4 2026).
**AI Advisor**: Yuri (유리) — "Glass"

**Full version history**: See `CHANGELOG.md` (repo root). The detailed, dated changelog — every version from v3.0.0 through the current release — lives there, not in this file. Per the project's documentation standard: CLAUDE.md is for current architecture and how the system works NOW; CHANGELOG.md is for what changed and when. When shipping a feature, update the relevant architecture section here and put the detailed entry in CHANGELOG.md.
