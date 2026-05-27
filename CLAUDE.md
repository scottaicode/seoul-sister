# Seoul Sister - K-Beauty Intelligence Platform

> **For any AI session opening this repository for the first time**: Read `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/principles.md` and `/Users/scottmartin/Downloads/Vibe_Coding/VibeTrendAI/vibetrendai/patterns.md` *before* touching any code in this repo. Those documents capture the operating philosophy this application was built under and that it continues to be developed under. Code that doesn't reflect those principles will be rejected.
>
> **Also read `LEARNING-LOOP-BLUEPRINT.md` (repo root)** before adding any feature that makes a judgment. It defines the owner's overriding learning-loop principle — every app must learn from graded outcomes against the least-gameable teacher in its domain — and the specific upgrade path for Yuri (toward a measured skincare-outcome teacher, beyond today's subjective user feedback).

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

Each instance is the same structural failure: a non-Yuri surface generates recommendations using an algorithm that doesn't know what Yuri knows. Bailey trusts Yuri. She doesn't trust the algorithm. And she's right — Yuri has 17+ conversations of context on her, the phase she's in, the corrections she's made; the algorithm has skin type and a humidity reading.

**Proactive sweep discipline** (added v10.7.1, sharpened v10.8.9): Each release that touches recommendation surfaces should include a sweep step — search the codebase for headings containing "Yuri's", lists labeled "Recommendations" / "Tips" / "Suggested", and any rule engine of the shape `if skin_type X && condition Y then "use Z"`. The six incidents above prove that algorithmic recommenders sneak in at the seam between "this feels personalized" and "this is actually personalized." **And they cluster: the same prescription data source often feeds multiple surfaces, so killing one is not enough — grep the data-fetching function (e.g. `fetchSeasonalLearning`) and the rendered field names (`texture_advice`, `ingredients_to_emphasize`) across the whole `src/` tree, not just the file you're editing.** Find them before Bailey does.

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
| AI Model (Primary) | Claude Opus 4.7 | All user-facing: Yuri, scanning, analysis -- NO FALLBACKS |
| AI Model (Background) | Claude Sonnet 4.5 | Data extraction, learning aggregation, translations |
| AI Model (Vision) | Claude Opus 4.7 | Label scanning, counterfeit detection, skin analysis |
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

### Implemented Cron Jobs (15 active in vercel.json, 1 disabled)

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `seasonal-adjustments` | Monthly 1st 3 AM UTC | Generate seasonal skincare recommendations for 5 climate zones (Sonnet) |
| `retry-enrichment-queue` | Monthly 1st 4:30 AM UTC | Retry stub-enrichment for products in `ss_enrichment_review_queue` due for retry. Currently a placeholder pending pipeline-helper refactor — first real retry due June 6 2026. |
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
- Unlimited AI label scanning (Claude Opus 4.7 Vision)
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
| Claude Opus 4.7 API (scans, Yuri, analysis) | ~$1.40/mo avg |
| Claude Vision (scanning, counterfeit, Opus 4.7) | ~$0.50/mo avg |
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

- **Claude Opus 4.7** (`claude-opus-4-7`): ALL user-facing interactions -- NO FALLBACKS
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
- [ ] **Image-health cron** (~half day, HIGHEST leverage). Periodically re-check image URLs, re-point newly-dead ones from `ss_product_staging`, and LOG what it can't fix so failures are visible not silent (v10.3.5 fire-and-forget lesson). The dead-URL bug class is invisible by nature (404/403 renders blank with no error) — only a monitor converts it from "surfaces when a user screenshots it" to "self-healing". Build on `scripts/backfill-catalog-images.ts` (already idempotent + safe).
- [ ] **Live-scrape backfill for ~507 no-staging-match blank products** (~1 day). Extend `OliveYoungScraper` with search-by-name (Playwright — OY search is JS-rendered), confidence-gate the match per the wrong-product discipline, write OY images. Closes the "all products eventually have photos" promise for real catalog products.
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
- Calls Claude Opus 4.7 with the Routine Architect system prompt
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
6. Optionally: Call Claude Opus 4.7 for nuanced comparison (texture, feel, notable differences)
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

Uses Claude Opus 4.7 Vision with specialized prompt:
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

Uses Claude Opus 4.7 Vision with specialized prompt:
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
**Version**: 10.8.13 (Catalog-wide image backfill — promoted the Bailey-validated dead-URL fix to a whole-catalog repair, May 26 2026. **Why now, not deferred**: v10.8.12 diagnosed that Bailey's blank product images included a *silent, invisible* bug class — products with an `image_url` that 404/403s at the brand origin (YesStyle hotlink-blocks, Shopify/brand-direct file moves), so they render blank with NO error anywhere. Since the fix pattern was fresh and proven on Bailey's 4 products, and Seoul Sister is pre-distribution (fixing the catalog before real users arrive beats them seeing neglect), we ran it catalog-wide. **Audit** (`scripts/audit-catalog-images.ts`): of 5,924 products, 5,337 had reliable Olive Young CDN images, 170 had non-OY URLs (sampled **62.5% dead rate** — YesStyle alone was 34 of 75 dead in the sample), and 417 were null. So ~535 products rendered blank, ~118 of them the invisible has-URL-but-dead kind. **Backfill** (`scripts/backfill-catalog-images.ts`): for every dead-URL and null-image product, find its OWN Olive Young image in `ss_product_staging` (the original scrape data — content-hashed CDN URLs that don't drift), verify it loads at write time, and write it. **Result: 80 products fixed** (Olive Young images 5,337 → 5,417; non-OY drift-prone 170 → 153; null 417 → 354). **Safety discipline** (earned across v10.7.0 / v10.8.12 wrong-product incidents, hardened mid-run): the matcher does EXACT-name match, or containment-match ONLY when (a) the brand matches, (b) the staging name isn't a multi-product bundle (`Set` / `Double Pack` / `+` / `Special` markers rejected unless the product itself is a bundle), and (c) the product-category word sets are identical (a "Cream" product will NOT take a "Cream Cleanser" or "Cream Ampoule" staging photo — those are different products). Reachability re-verified at write time (3 staging URLs were themselves dead and correctly skipped). A pre-apply verification pass (`verify-backfill-pairs`) flagged 11 risky category/bundle mismatches in the first-draft loose matcher (e.g. Round Lab Dokdo Cleansing Oil → a Set bundling a different cleanser; Anua Daily Relief Lotion → a Set led by a Toner; Real Barrier Extreme Cream → Cream Ampoule) — hardening the matcher dropped those, taking the count from a loose 100 to a safe 80. Every one of the 108 surviving containment matches is the same product with only a volume/size suffix appended ("...50ml", "...70P", "...Jumbo Size Package"). **Deferred (real next project)**: ~507 products still blank (354 null + 153 non-OY) have NO staging match — they need a live Olive-Young-search scrape (Playwright), which is a larger dedicated effort. The reusable `audit-catalog-images.ts` + `backfill-catalog-images.ts` scripts make re-running trivial as staging grows, and are the right foundation for a future self-healing cron (detect newly-dead URLs → re-point from staging → log what it can't fix so failures are visible, not silent — the v10.3.5 fire-and-forget lesson). **AI-First**: pure data repair, no AI calls / rules / recommendation surfaces. **No app code touched** — DB-only (`ss_products.image_url`) plus two reusable scripts. **Files created**: `scripts/audit-catalog-images.ts`, `scripts/backfill-catalog-images.ts`. **Files modified**: `package.json` (10.8.12 → 10.8.13), `CLAUDE.md`. Shipped May 26 2026.)

**Pre-this**: 10.8.12 (Bailey feedback follow-up — Library Owned/Saved crowding (the v10.8.11 fix only covered In-Routine) + image diagnosis, May 26 2026. **Crowding (the actual complaint)**: v10.8.11 single-columned the In-Routine section, but Bailey re-screenshotted with *"The Seoul Sister Dashboard is still squished together"* — she meant the **Owned** and **Saved** sections, which were still `grid grid-cols-1 sm:grid-cols-2`. At `sm` (640px) they go 2-column, so on her desktop the information-dense Owned cards (brand + name + category + notes + 3 action buttons: Holy Grail / Broke me out / Remove) were cramped side-by-side. Fixed: `OwnedSection` and `SavedSection` → single column (`space-y-3`). Left `TaggedSection` at `md:grid-cols-2` (Holy Grail | Broke Me Out are parallel categories, the 2-up is semantic, not grid-filler) and `ExpiringSection` at up-to-3-col (sparse, small cards). **Image diagnosis** (`scripts/check-bailey-library-images.ts` + `scripts/check-url-reachability.ts`): Bailey's *"a lot of these products without images"* breaks into THREE causes, only one of which is the previously-documented "415 legacy products" bucket — (a) **8 custom entries with NULL product_id**: 4 are devices/actions that correctly never have images (Cool water rinse, Ice roller, LED mask, Shower/cleanse), but **4 are REAL catalog products mis-saved as custom entries** (Anua Heartleaf 70% Rice Ceramide Serum, Medicube PDRN Pink Peptide Eye Cream, Hero Mighty Patches, Ma:nyo Pure Cleansing Oil) because Yuri's resolver couldn't match them at save time — a data-linkage problem, not a missing-image problem; (b) **1 genuinely NULL image_url** (Illiyoon Ceramide Ato Concentrate Cream) — the legacy-backfill bucket; (c) **3 products HAVE an image_url but the URL is dead at origin** — Green Tangerine Vita C (YesStyle, returns 403 hotlink-block), PDRN Pink Peptide Serum (medicube.us Shopify, 404), Acne Pimple Master Patch (cosrx.com, 404). The proxy can't save a 404/403; these need re-pointing to a working image (Olive Young CDN URLs verified reliable per v10.8.8). Products that DO render (Licorice toner, I'm From Rice, COSRX BHA) returned 200. **Image fixes NOT built this session** per Scott's earlier deferral — documented with the sharper three-cause breakdown for when the backfill/relink work is scheduled. **AI-First**: pure layout change, no AI/rules/recommendation surfaces. **Build verified**: `tsc --noEmit` clean, `next build` clean (caught + fixed a JSX-comment-in-ternary-slot syntax error mid-build — a `{/* */}` comment can't sit directly in a ternary's expression slot before the element; used a `//` line comment instead). **Files modified**: `src/components/library/OwnedSection.tsx`, `src/components/library/SavedSection.tsx`, `package.json` (10.8.11 → 10.8.12), `CLAUDE.md`. **Files created**: `scripts/check-bailey-library-images.ts`, `scripts/check-url-reachability.ts` (image diagnostics). Shipped May 26 2026.)

**Pre-this**: 10.8.11 (Bailey feedback — product-page "isn't loading" subscriber false-negative + Library "In Routine" crowding, May 26 2026. Two fixes from a single iMessage thread; full analysis in `V10.8.11-BAILEY-PRODUCT-LIBRARY-FIXES.md`. **Fix 1 — product detail page "This isn't loading"** (`src/components/products/ProductIntelligenceSection.tsx`): Bailey screenshotted the Medicube Hyaluronic Acid Pudding Mist Ampoule page (`/products/[id]`) with the header rendering fine (name, brand, Verified badge, $35.02, description) but a row of white/gray rounded-pill shapes under the price that looked like skeleton placeholders stuck loading. **Diagnosis** (two parallel investigation agents + DB check via new `scripts/check-bailey-sub.ts`): there is ZERO skeleton/`animate-pulse` code in the `/products/[id]` path. The "pills" are the 5 `GatedTeaser` blur cards (the anonymous "Subscribe to unlock" teasers, each with a `backdrop-blur-[2px]` overlay + grey pill button) — and a PAYING subscriber (Bailey, `ss_user_profiles.plan='pro_monthly'`) was seeing the anonymous gated view. **Root cause**: `ProductIntelligenceSection` gated on a one-shot `supabase.auth.getSession()` in a `useEffect`. On the PUBLIC `/products/[id]` route (outside the authenticated `(app)` AppShell), the Supabase client often hasn't rehydrated the localStorage session by the time that one-shot call fires → returns null → `setIsSubscriber(false)` → `/api/me/subscription` is NEVER called → anonymous GatedTeaser blur cards render for a paying user, reading as stuck skeletons. **This was the v10.7.0 Phase F bug only half-fixed**: Phase F correctly moved the SUBSCRIPTION CHECK to a server endpoint (`/api/me/subscription`, which has the `plan='pro_monthly'` fallback in `hasActiveSubscription`), but left the SESSION DETECTION as a racy one-shot `getSession()` in front of it. The endpoint was sound; the gate never called it. **The fix**: replaced the one-shot `getSession()` with the app-wide `useAuth()` context (`src/contexts/AuthContext.tsx`), which subscribes to `onAuthStateChange` and therefore catches the session the moment it hydrates — no race. Subscriber state is only decided after `auth.loading` settles; until then renders null (no flash, no stuck-skeleton perception). `AuthProvider` wraps the root layout so `useAuth()` is safe on the public route. **DB note**: Bailey has `plan='pro_monthly'` but ZERO `ss_subscriptions` rows (manually set to pro in v5.5.0, never went through Stripe); `hasActiveSubscription` (`src/lib/subscription.ts:46-53`) has the profile-plan fallback, so the server endpoint returns active for her once it's actually called. **Sweep**: grepped for other racy subscriber-detection gates on public routes — `LabelScanner.tsx` uses `getSession()` but only to grab an API token (not for gating) and lives under `(app)` where the session is pre-hydrated, so no race. **Fix 2 — Library "In Routine" crowding** (`src/components/library/InRoutineSection.tsx`): Bailey: *"It still bugs me how crowded this is lol"* on the `/library` In-Routine grid. It was `grid grid-cols-1 lg:grid-cols-2 gap-6` — a 2-column AM|PM split that squeezed long Korean product names into narrow columns. Per Scott's decision, switched to a single stacked column (AM section, then PM section, `space-y-8` between groups, `space-y-3` between cards) matching the `/routine` page's single-column rhythm. **Fix 3 (answered, not built) — "Are these all going to eventually have photos?"**: audited image coverage. 93.0% of products (5,507/5,924) have images; new products auto-capture them via the daily Olive Young scraper; BUT ~415 legacy Feb-2026-seed products have NO image and there is NO active backfill pipeline; and custom routine steps (Ice roller, LED mask, Cool water rinse, custom-entry products with NULL product_id) will NEVER have a product image by design. So Scott's "eventually all shown" answer is aspirational for the legacy 415 until a backfill runs. Per Scott's decision, the backfill is documented as a deferred task (in the v10.8.11 doc) but NOT built this session. **AI-First**: all UI/auth-plumbing, no AI calls, no rule engines, no recommendation surfaces, Yuri Sole Authority unaffected, Library "no recommendation language" invariant preserved. **Build verified**: `tsc --noEmit` clean, `next build` clean. **Files modified**: `src/components/products/ProductIntelligenceSection.tsx`, `src/components/library/InRoutineSection.tsx`, `package.json` (10.8.10 → 10.8.11), `CLAUDE.md`. **Files created**: `scripts/check-bailey-sub.ts` (subscriber-state diagnostic), `V10.8.11-BAILEY-PRODUCT-LIBRARY-FIXES.md` (full analysis + deferred backfill task). Shipped May 26 2026.)

**Pre-this**: 10.8.10 (Yuri Sole Authority sweep follow-up — weather route dead-payload cleanup, May 26 2026. Direct continuation of v10.8.9, prompted by Scott asking whether the weather feature flagged in the v10.8.9 report should be cleaned up. It should. **Background**: the v10.6.2 fix reduced the dashboard `WeatherRoutineWidget` to weather-data display + an Ask-Yuri CTA (Bailey, May 18: *"all recommendations should be from Yuri at this point... misleading if not communicating with Yuri"*). But the feeding route `/api/weather/routine` kept running the old `getWeatherAdjustments` rules engine ("switch to lighter moisturizer," "apply niacinamide toner to T-zone") plus `getWeatherSummary` and `fetchSeasonalLearning`, shipping `adjustments` + `summary` + `seasonal_insight` over the wire on every dashboard load. **Nothing rendered any of it** — the widget reads only `data.weather`. So it was pure dead payload: wasted compute (a `ss_learning_patterns` query + the rules-engine run per load), wasted bytes, and — the part that matters — a loaded gun. The exact prescription text Bailey has objected to twice was still being *generated*, just not displayed. That's precisely the mechanism by which the seasonal SPRING TIP survived two kills (v10.5.2, v10.6.2) before v10.8.9: the data source stayed alive and re-surfaced in a new component. v10.8.9's own changelog called this weather cleanup "out of scope... separate-surface cleanup" — which was right for the Bailey-caught fix but inconsistent with the sweep discipline I sharpened in the same release. This closes it. **Pre-flight consumer check** (the sweep step, applied properly this time): grepped every consumer of the weather route's response fields. Found a near-miss — `src/app/(app)/library/page.tsx:266` uses `data.summary`, but that's `LibraryPayload['summary']` (owned counts, routine steps), a completely different object, NOT the weather summary. Confirmed the **only** consumer of the weather route's `summary`/`adjustments`/`seasonal_insight` is the dashboard widget, which uses none of them — it reads `data.weather` exclusively. **The fix**: `/api/weather/routine` GET response reduced from `{ weather, adjustments, summary, seasonal_insight }` to `{ weather }`. Dropped the `getWeatherAdjustments`, `getWeatherSummary`, `fetchSeasonalLearning` imports + calls from the route. Trimmed the profile select from `latitude, longitude, skin_type, climate, location_text` to `latitude, longitude, location_text` (skin_type/climate were only feeding the removed rules engine). `WeatherRoutineResponse` type tightened to `{ weather: WeatherData }` with a docblock explaining the reduction. **Deliberately KEPT**: the `getWeatherAdjustments` / `getWeatherSummary` / `fetchSeasonalLearning` library functions in `weather-routine.ts` and their types (`WeatherRoutineAdjustment`, `SeasonalInsight`, `WeatherTrigger`). They're now uncalled by ANY route — inert library code, no longer a re-surfacing hazard on a rendered surface — and the honest future home for seasonal weather logic, if it lives at all, is as structured input to a Yuri weather *tool* (she already gets raw weather via the CTA prefill), not a rules engine on a dashboard. Deleting them now would force a rewrite later for speculative gain; deleting the live dead-payload now removes the actual hazard. Documented as such inline. **AI-First verified before AND after**: removed a rules-engine invocation + lookup-table fetch from a live response, added nothing; widget stays data-display + Yuri CTA; Yuri remains sole recommender. **Build verified**: `tsc --noEmit` clean, `next build` clean. **Files modified**: `src/app/api/weather/routine/route.ts` (response + imports + profile select), `src/types/database.ts` (`WeatherRoutineResponse` tightened + docblock), `package.json` (10.8.9 → 10.8.10), `CLAUDE.md` (this entry). Shipped May 26 2026.)

**Pre-this**: 10.8.9 (Yuri Sole Authority Principle — sixth incident, caught by Bailey May 26 2026. She screenshotted the routine page's "Routine Intelligence" widget showing a seasonal "SPRING TIP": *"Switch to lightweight gel or water-based formulas to prevent excess oil and congestion in humid conditions. Emphasize: Niacinamide for sebum control, Green tea extract for antioxidants, Hyaluronic acid in lightweight serums."* Her text: *"We were going to get rid of the tips cause it's not Yuri and she always disagrees."* **Root cause**: the tip is an algorithmic prescription keyed only on `season + climate` (a `ss_learning_patterns` lookup via `fetchSeasonalLearning`), rendering `texture_advice` ("switch to...") + `ingredients_to_emphasize` ("Emphasize: niacinamide...") as direct instructions. Zero awareness of Bailey's Phase 2 protocol — she already runs niacinamide in 5 products and Yuri has her on "stay the course," so the tip directly contradicts what Yuri told her. This is the exact shape of the May 18 weather-widget incident (v10.6.2 #3), just season-keyed instead of humidity-keyed. **Why it survived two prior kills**: v10.5.2 removed the missing-ingredients widget from the SAME `RoutineEffectiveness.tsx` component but left the seasonal block intact. v10.6.2 killed the weather widget's prescriptions but didn't sweep for the season-based variant living in two OTHER files. **The same prescription also rendered on the dashboard** as a "Spring Skincare Tip" with `+ niacinamide` emphasize chips (`IntelligenceWidgets.tsx`) — the clustering pattern: one prescription data source (`fetchSeasonalLearning`) feeding two surfaces. **The fix**: removed the seasonal-tip block from both `RoutineEffectiveness.tsx` (routine page) and `IntelligenceWidgets.tsx` (dashboard), and stopped fetching `seasonalInsight` in both feeding API routes (`/api/routine/effectiveness`, `/api/dashboard/intelligence`). **Kept** the observational data on both surfaces: the routine page's concern-effectiveness bars ("Acne control 82%" — derived from the user's own routine ingredients, no prescription) and the dashboard's "Your Top Ingredients" list (effectiveness data + "Find products" navigation link, not "you should use this"). Per the Yuri Sole Authority Principle, prescriptions route through Yuri, who has full treatment-phase context; these widgets now only DISPLAY data. `fetchSeasonalLearning` itself left in place — the weather route still references it (its `seasonal_insight` payload is now dead, unrendered by the CTA-only WeatherRoutineWidget, but removing it is a separate-surface cleanup out of scope for this Bailey-caught fix). **Lesson encoded in the Yuri Sole Authority section**: when killing one algorithmic recommender, grep the data-fetching function name AND the rendered field names (`texture_advice`, `ingredients_to_emphasize`) across the whole `src/` tree — the same prescription often renders in more than one place, and a partial kill leaves the survivor for Bailey to find. **AI-First compliance verified before AND after**: removed two hardcoded lookup-table recommenders, added zero rule engines / templates / AI calls. Strengthens AI-First by routing the recommendation decision back to Yuri. **Build verified**: `tsc --noEmit` clean, `next build` clean — both `/routine` and `/dashboard` compile, both widgets gracefully return null when their remaining data is empty. **Files modified**: `src/components/routine/RoutineEffectiveness.tsx`, `src/app/api/routine/effectiveness/route.ts`, `src/components/dashboard/IntelligenceWidgets.tsx`, `src/app/api/dashboard/intelligence/route.ts`, `package.json` (10.8.8 → 10.8.9), `CLAUDE.md` (incident #6 added to Yuri Sole Authority Principle + this changelog entry). Shipped May 26 2026 — same hour as Bailey's iMessage.)

**Pre-this**: 10.8.8 (Critical regression fix on v10.8.7 — image ordering was structurally backwards. Bailey reloaded /browse after v10.8.7 deployed and her fits list was rendering ZERO product images. Every card showed the gold Package fallback icon. This was worse than v10.8.6 (where 43.8% of cards rendered images). She mentioned it immediately. **Diagnosis** (`scripts/diagnose-image-url-host.ts`): v10.8.7 shipped with `.order('image_url', { ascending: false, nullsFirst: false })`. The `nullsFirst: false` correctly pushed null image_url rows to the end of the candidate set (good — fixed the 43.8% coverage issue). But `ascending: false` sorted the non-null URL strings DESCENDING alphabetically. Descending URL order put `www.cosrx.com` / `medicube.us` / `theisntree.com` / `us.laneige.com` / `tonymoly.us` / `neogenlab.us` URLs first (brand-direct Shopify stores with slug-based paths and ~100% CDN drift / 404 rate) and pushed `cdn-image.oliveyoung.com` URLs (content-hashed UUIDs that never break, the load-bearing reliable CDN) past the 400-row limit. **Reachability evidence under v10.8.7 ordering**: 0 of 30 sampled URLs returned HTTP 200. Every single one was dead. The first 50 candidates were 9 medicube + 8 theisntree + 6 cosrx + 5 tonymoly + 5 neogenlab + 4 laneige + 3 innisfree + others — every host with high drift rate. Olive Young appeared 0 times in the first 50 under DESC ordering. **Under ASC ordering** (the fix): 27 of 30 sampled URLs returned HTTP 200. First 50 candidates: 47 cdn-image.oliveyoung.com + 2 beautyofjoseon.com + 1 anua.com. ASC happens to surface Olive Young first because `cdn-image` precedes brand-direct hostnames alphabetically (`c-d-n-` < `c-o-s-` < `t-h-e-` < `u-s-` < `w-w-w-`). **The fix** (one-character change, `false` → `true`): `candidateQuery.order('image_url', { ascending: true, nullsFirst: false })`. Image-bearing products still surface first (nulls last is preserved), but now the non-null URLs sort lexically ascending which incidentally surfaces the reliable Olive Young CDN ahead of unreliable brand-direct stores. **Verification post-fix** (`scripts/reproduce-api-curated.ts` re-run): candidate image coverage stays at 100%, verdict distribution flips to 167 fits / 233 skip / 0 neutral. The zero neutrals confirms every single candidate now has full ingredient data — Layer 1 can evaluate all 400 properly. **Honest assessment of v10.8.7**: that release made the visible product worse, not better. Bailey saw 0% image rendering on her next /browse load instead of the 43.8% she had with v10.8.6's query-plan-luck default. The harness numbers from v10.8.7 verification (43.8% → 100% candidate image coverage) were technically correct — the API WAS returning 400 rows with non-null image_url. The harness didn't catch the regression because it only counted "is image_url non-null" without verifying URL reachability. The reachability sample from `scripts/diagnose-image-coverage.ts` (run BEFORE v10.8.7 shipped) showed 24 of 30 random candidates were reachable — but those candidates were drawn from the v10.8.6 distribution (mixed Olive Young + brand-direct), not the v10.8.7 distribution (brand-direct dominated). I shipped the ordering change without re-running reachability on the NEW candidate distribution it would produce. That's the methodological mistake — the verification sample needs to match the post-fix candidate composition, not the pre-fix composition. **Pattern 4 lesson encoded**: don't conflate "ORDER BY is_not_null" with "ORDER BY value asc/desc". For visual-quality NULL-vs-non-NULL ordering, the value direction (ASC vs DESC) matters because PostgreSQL sorts non-null values lexically. The "right" direction depends on what hostnames sort where lexically — that's incidental architecture, not load-bearing design. A more correct fix long-term is either (a) explicit reliability key column (e.g., `image_reliability_tier INT` populated by source-pipeline: 1=olive_young_cdn, 2=supabase_storage, 3=brand_direct_shopify, 4=unknown), (b) CASE expression in a Postgres view or RPC, or (c) move to a stable per-source proxy (`created_at desc` correlates with Olive Young pipeline because that scraper was the most recent active source). Each option requires a database change; deferred to a future session. The one-character fix gets the visible product working immediately. **Methodological lesson worth encoding for future Bailey-class fixes**: verification harnesses that check "is data populated" must ALSO check "is data USABLE" when the field is a URL, file path, foreign key, or other indirect reference. The 4-fix sequence today (v10.8.4 voice → v10.8.5 chips → v10.8.6 truncation → v10.8.7 ordering → v10.8.8 ordering fix) shows what happens when methodology gaps compound. Each release was correct in isolation against its harness; v10.8.7 in particular passed its harness with flying colors (43.8% → 100% image coverage looked great on paper). But the real-world rendering went to ZERO because the URLs were all dead. Future verification on visual-quality changes MUST include a reachability sample drawn from the POST-fix candidate distribution. **AI-First compliance maintained**: pure data ordering fix, no AI calls touched, no rule engines, no templates. **Build verified**: `tsc --noEmit` clean, `next build` clean. **Files modified**: `src/app/api/products/curated/route.ts` (one-character flip in `.order()` + inline comment documenting the regression history), `scripts/reproduce-api-curated.ts` (mirror the ASC ordering), `package.json` (10.8.7 → 10.8.8), `CLAUDE.md` (this changelog entry). **Files created**: `scripts/inspect-api-response.ts` (verifies API response payload includes image_url for all returned products — confirmed not a column-dropping bug), `scripts/diagnose-image-url-host.ts` (definitive proof the ordering direction was wrong — DESC produces 0% reachability, ASC produces 90%). Shipped May 23 2026 — same hour as Bailey's v10.8.7 verification screenshot. Net effect on Bailey's /browse: image rendering recovers from 0% (under v10.8.7) → expected ~90% under v10.8.8 once Vercel picks up the deploy.)

**Pre-this**: 10.8.7 (Image-bearing candidate ordering on `/api/products/curated`. After v10.8.6 shipped Bailey reloaded /browse and her fits list rendered with most product cards showing the gold Package fallback icon from `LazyImage` rather than actual product photos. She mentioned the image situation to Scott. Diagnostic pass via two new scripts surfaced the real story: catalog-level image coverage is HEALTHY at 92.2% (4,895 of 5,311 verified products have `image_url` populated). But the `/browse` candidate set was only **43.8% image-bearing** (175 of 400) because the API's `.eq('is_verified', true).limit(400)` ran with no explicit `.order()`, leaving the candidate pool composition to PostgREST's query plan. Default ordering happened to surface the v10.3.9-backfilled stub-enrichment cohort (~685 products that got INCI data via Sonnet + Brave Search but no image scraping) and a chunk of the original Feb seed lacking images, pushing image-bearing Olive Young pipeline products further down the candidate window. **Reachability sample** (`scripts/diagnose-image-coverage.ts` against 30 random candidates with `image_url`): 24 of 30 returned HTTP 200 with image bytes when fetched directly with browser User-Agent. The remaining 6 failures are predictable retailer-CDN drift (Shopify product page slugs changing post-scrape on heimish.us, medicube.us, laneige; one Sephora 404; one YesStyle 403 from missing referer header) — real but a minority, scoped to specific products rather than a systemic proxy issue. The v10.8.3 proxy allowlist already covers every host that appears in candidates (14 hosts including cdn-image.oliveyoung.com, cdn.shopify.com, image.yesstyle.com, all 11 brand-direct shops) — proxy infrastructure is correct. **Root cause was an ordering choice never made explicitly**: `limit(400)` without `.order()` leaves visual quality to query-plan luck. **The fix** (one line in `src/app/api/products/curated/route.ts`): `candidateQuery.order('image_url', { ascending: false, nullsFirst: false })` before `.limit(400)`. PostgREST's `nullsFirst: false` puts non-null `image_url` rows first, so the 400-row candidate pool fills with image-bearing products and pushes the 416 image-less verified products past the limit boundary. This is NOT a Yuri-curated ranking — it's a visual-quality ordering on the input set BEFORE Layer 1 evaluates verdicts. Same products still classify the same way; just different products are IN the 400-candidate pool. **Verification numbers** (`scripts/reproduce-api-curated.ts` re-run after fix, against Bailey's actual data): candidate image coverage flips from 43.8% → **100.0%** (400 of 400 candidates have images). Verdict distribution shifts to 178 fits / 219 skip / 3 neutral (was 167/184/49). The +35 skips are products with full ingredient data that Layer 1 can now evaluate properly — they were getting drowned out by image-less neutrals before. The -46 neutrals collapse confirms strong correlation between `image_url` and `ingredients_raw` (the Olive Young scraper pipeline captured both; the v10.3.9 stub-enrichment pipeline captured INCI only). **Honest tradeoff acknowledgment**: this change is visible behavior. Four products from Bailey's previous fits list — CNP Dual-Balance Waterlock Lotion, Dr.G Red Blemish Cica S.O.S Recovery Cream, Mary&May 6 Peptide Complex Serum, Real Barrier Aqua Soothing Gel Cream — get pushed past the 400-candidate window because they lack `image_url`. They're still in the catalog (`is_verified=true`, all otherwise good fits for her Phase 2), but won't surface on her default /browse anymore. A subscriber explicitly searching for one of those brands or products will find them via the search bar (which queries the full `ss_products` table, not the 400-candidate window). The tradeoff is: better visual experience on the first page Bailey sees vs preserving discoverability of image-less products in the default view. Acceptable because (a) the pushed-out products were rendering as gold Package icons anyway so visual recognition was already broken, (b) Bailey explicitly mentioned the image situation as a problem worth solving, (c) the long-term fix is image-backfilling the 416 image-less products via a future scraper pass, not preserving a worse default. **What's NOT in this release**: no image backfill of the 416 verified products lacking `image_url` — that's its own session involving scraper work (probably re-running Olive Young product detail scraping against those specific product IDs to capture CDN image URLs). No fix for the 6/30 broken-URL minority (would require URL refresh + content-validation pass per product, also separate session). No change to `LazyImage`, `image-proxy.ts`, or the `/api/img` route — proxy infrastructure is working correctly per v10.8.3. **AI-First compliance**: this is pure data ordering, no AI calls touched. No rule engines, no templates, no Yuri voice. The ordering doesn't impersonate Yuri's judgment — it's documented in code as "visual-quality choice" not "curation." **Pattern 4 lesson worth encoding**: any `.limit()` query without explicit `.order()` is leaving result composition to query-plan luck. For surfaces where row composition matters (visual quality, recency, sort-by-relevance), specify ordering explicitly even when the user-facing experience seems "fine" — query-plan determinism varies by Supabase upgrades, replica routing, and database statistics. Audit candidates: any `.from(...).limit(N)` in the codebase that drives a user-facing list. Same shape as v10.3.4's silent fire-and-forget catches and v10.8.6's silent batch-fetch truncation — data-access surface bugs where the broken output looks plausibly correct until you ask the harness to verify. **Build verified**: `tsc --noEmit` clean, `next build` clean. **Files modified**: `src/app/api/products/curated/route.ts` (single `.order()` call added with inline comment), `scripts/reproduce-api-curated.ts` (mirror the new ordering in verification harness + add image-coverage check), `package.json` (10.8.6 → 10.8.7), `CLAUDE.md` (version header + this changelog entry). **Files created**: `scripts/diagnose-image-coverage.ts` (catalog-level coverage stats + URL host distribution + reachability sampling + proxy allowlist coverage check), `scripts/diagnose-image-by-source.ts` (image coverage by created_at cohort + ordering experiment). Shipped May 23 2026 — same morning as Bailey's v10.8.6 verification screenshot.)

**Pre-this**: 10.8.6 (Silent batch-fetch truncation in `/api/products/curated` — present since v10.8.0 May 22 ship, surfaced through v10.8.5 verification harness. After v10.8.5 deployed and Bailey screenshotted /browse with the now-correct chips on the skip list, I ran a verification pass and noticed the suspect "fits" — Beplain Clean & Glow Green Barley LHA Gel Cleanser (contains capryloyl salicylic acid, a BHA-family acid) and Innisfree Daily UV Protection Cream (contains witch hazel, classed as astringent_oil in v10.8.2). When I called `applyPhaseFilter` directly on each of these products in isolation, Layer 1 correctly returned **skip**. But /browse was rendering them as **fits**. Same filter, same context, same Bailey. The discrepancy meant the bug was somewhere between "what Layer 1 does on a single product" and "what /browse renders for a 400-product candidate set." **Root cause** (diagnosed via `scripts/diagnose-postgrest-cap.ts`): PostgREST hard-caps every SELECT query at **1000 rows** on this Supabase instance, and explicit `.limit(50000)` overrides are silently IGNORED by the platform. The `/api/products/curated` ingredient-fetch loop was using `.in('product_id', slice)` with `slice.length = 200`, expecting ~5,000 link rows back (400 candidates × avg 25 ingredients/product). PostgREST silently truncated each batch to 1,000 rows. **Real numbers from the probe against 400 candidates**: true total link rows = 10,002. Batch=200 default (what API was doing) returned 2,000 rows = **80% silent data loss**. Batch=50 returned 7,824 rows = 22% loss. Batch=200 + explicit `.limit(50000)` returned 2,000 rows — the limit override is silently ignored server-side. **Production impact** (Bailey's screenshot #2): the "262 products that fit your current state" header was wrong. The real number after the fix is **216**. The 46-product delta came from products that had ingredient data in the database but whose link rows got dropped in the batched fetch — so Layer 1 saw them as having zero ingredients, returned `neutral`, and the API code at line 192 of the old curated route routed neutrals into the fits list. Beplain (45 ingredient links in the DB), Innisfree (57 links), CNP Full Fit Propolis (16 links), Mary&May 6 Peptide (19 links), and many others ALL fell through this gap. Some genuinely should have been fits regardless (Mary&May was fine, CNP propolis was fine) — the bug is they were never EVALUATED, just defaulted to fits via neutral routing. Of the 226 silent-neutrals before the fix, 46 were actually skips when properly evaluated. **The fix** (`src/app/api/products/curated/route.ts` lines 144-218): internal `.range()` pagination within each `.in()` outer batch. Outer batch reduced from 200 → 50 product_ids per `.in()` call (URL-length safety, plenty of headroom). Inner loop calls `.range(pageStart, pageStart + 999)` and keeps advancing the window until the response is smaller than PAGE_SIZE (last page reached). This is bulletproof regardless of how many ingredients per product — if a future K-beauty product has 200 INCI entries (unusual but possible), the pagination handles it correctly. If PostgREST's row cap ever changes, the structural pattern still works. Defensive `console.warn` if any single batch needs more than 10 pages — signal to lower OUTER_BATCH if catalog grows. Defensive `console.error` on Supabase errors (per v10.3.5 fire-and-forget audit). **Verification** (`scripts/reproduce-api-curated.ts` re-run after fix, against Bailey's actual data): Beplain now has 45 ingredients assembled (was 0), verdict flips `neutral → skip`, chip *"no acid stacking → capryloyl salicylic acid"*. Innisfree now has 57 ingredients assembled (was 0), verdict flips `neutral → skip`, chip *"no astringent oils → witch hazel leaf extract"*. CNP Dual-Balance Waterlock Lotion correctly remains `neutral` — it genuinely has 0 ingredient links in the database (legitimately un-enriched product, not a fetch bug), and the v10.8.0 design choice to render neutrals as fits is preserved. The 4 verified-fits products (Dr.G Cica, Mary&May Peptide, Real Barrier Aqua, COSRX Propolis, Purito sunscreen) remain fits with their full ingredient data. **Verdict count delta**: pre-fix 36 fits / 138 skip / 226 neutral. Post-fix 167 fits / 184 skip / 49 neutral. The 184 skip number now accurately reflects what Layer 1 was designed to catch. **AI-First compliance maintained**: this is a data-layer fix, no AI calls touched, no rule engines, no templates. The Opus reasoning, the chip rendering, and the Layer 1 filter all behave identically — they just finally see the data they were always supposed to see. **Pattern 4 (Structural Encoding from Single Instances) — new lesson encoded**: any Supabase `.in()` query on a join table where (parent_ids × avg_children_per_parent) can exceed 1,000 rows needs explicit pagination via `.range()` until pageRows < PAGE_SIZE. Client-side `.limit()` overrides do NOT work — the platform enforces the cap server-side. Future audit candidates: search the codebase for `.from(...).select(...).in('` patterns and check whether each one could plausibly exceed 1,000 returned rows. Likely suspects: any join-table fetch on `ss_product_ingredients`, `ss_routine_products`, `ss_user_product_reactions`, `ss_product_prices`, `ss_yuri_messages`, `ss_widget_messages`. Same shape as v10.3.4's "fire-and-forget `.catch(() => {})` hides real failures" and v10.3.8's "Olive Young scraper returns 0 with no alarm" lessons — silent data-access failures are the highest-cost bugs because they don't surface in error logs, tests pass, builds pass, and the broken output looks like normal output. **Why this is its own release and not folded into v10.8.5**: v10.8.5 was a UI/voice fix shipped under the assumption that Layer 1 was producing correct verdicts. The harness I built to verify v10.8.5's voice fixes (running `applyPhaseFilter` against suspect products in isolation) is what surfaced the discrepancy with /browse. Separating the fixes by version makes the history truthful: v10.8.5 fixed voice surface drift, v10.8.6 fixed a data-access bug that had been silently corrupting /browse since v10.8.0 first shipped on May 22. Both Bailey-class fixes from the same screenshot, different layers of the stack. **No `CURATION_LOGIC_VERSION` bump needed** — the filter logic + cache_key_hash payload + Opus prompt are all unchanged. The cache rows generated by v10.8.4 + v10.8.5 stay valid; only the ingredient data feeding the live filter is now complete. **Build verified**: `tsc --noEmit` clean, `next build` clean. The change is isolated to `src/app/api/products/curated/route.ts` (the only place doing batched ingredient fetches at this scale). **Files modified**: `src/app/api/products/curated/route.ts` (ingredient fetch loop rewrite with internal pagination + defensive logging), `package.json` (10.8.5 → 10.8.6), `CLAUDE.md` (version header + this changelog entry). **Files created** (verification tooling, kept in repo for future regression checks): `scripts/diagnose-postgrest-cap.ts` (probes the cap directly), `scripts/reproduce-api-curated.ts` (replicates the API's exact ingredient assembly + verdict computation against any user_id), `scripts/diagnose-suspect-fits.ts` (queries ingredient link counts for arbitrary product names). Shipped May 23 2026 — same morning as Bailey's v10.8.5 verification screenshot.)

**Pre-this**: 10.8.5 (v10.8.4 sweep follow-up — intro copy + chip rendering paper-cuts. Bailey reloaded /browse after v10.8.4 deployed, expanded "Why Yuri would skip this" on the Theracne 365 Spot Treatment card, and the reasoning text correctly landed in second person — *"You and I locked Phase 2 around one active on the chin: BHA MWF plus AM Vita C. Bringing in another spot treatment mid-phase muddies the read..."* — exactly the voice fix v10.8.4 shipped. But the surrounding UI surfaced two paper-cuts v10.8.4 didn't sweep. **Paper-cut 1**: the intro copy under the toggle still read *"Expand any card for **her reasoning**"* — adjacent surface, same third-person voice drift the prompt fix was specifically targeting. Lived in `src/app/(app)/browse/page.tsx:315`, untouched by v10.8.4 because that release scoped to the Opus prompt only. Bailey's screenshot caught it visible in the same viewport as the now-correct reasoning text, which made the contrast worse than if the whole surface had been wrong consistently. **Paper-cut 2** (turned out to be an architectural gap, not a paper-cut): the chip directly above the reasoning prose showed `spot_treatment` — raw schema slug with no icon prefix — instead of a human-readable phrase. Investigation revealed v10.8.2's category_conflict feature shipped server-side (added `'category_conflict'` to `MatchedItem.type` union in `product-curation.ts`, populated `item` with extracted source text like "no new active products this phase" and "BHA already at protocol cadence") but the client-side `MatchedItemDTO` type in `SkipReasoning.tsx` was NEVER extended. TypeScript silently accepted the new variant flowing through the API boundary because the React component cast the response to its narrower DTO without strict validation. The chip render switch had cases for `allergen`/`watch_for`/`decision_memory` only — `category_conflict` items fell through with no icon prefix. And the chip text rendered `m.matchedIngredient` (which for category_conflicts is the schema slug like `spot_treatment` or `bha`) instead of `m.item` (the human-readable phrase). Two compounding bugs producing the bare-slug chip. Both shipped silently in v10.8.2 and persisted through v10.8.3 and v10.8.4 — three releases — because no one looked at the skip toggle's chip output until Bailey did this morning. **The fix** (three surgical edits, all UI, no server-side or Opus prompt changes): (1) `src/app/(app)/browse/page.tsx:315` — *"Expand any card for her reasoning"* → *"Expand any card for Yuri's reasoning"*. Keeps Yuri's name in the copy (she's the speaker, identifying her is correct) but drops the third-person pronoun referencing the subscriber. (2) `src/components/products/SkipReasoning.tsx:21` — `MatchedItemDTO.type` extended from 3-variant union to 4-variant: `'watch_for' | 'allergen' | 'decision_memory' | 'category_conflict'`. Now mirrors the server-side `MatchedItem` type in `product-curation.ts:99`. (3) `src/components/products/SkipReasoning.tsx:88-100` chip rendering rewritten — chip text source changed from `m.matchedIngredient` (slug) to `m.item` (human phrase), added `category_conflict` case to icon switch (🧪 prefix), and added `title={m.type + ': ' + m.matchedIngredient}` so the slug is still hoverable for debugging without polluting the visible chip. For Bailey's Theracne card specifically: the chip flips from bare *"spot_treatment"* to *"🧪 no new active products this phase"* — directly mirroring what Yuri said in her decision_memory rather than naming the database category. **What's NOT in this release**: no `CURATION_LOGIC_VERSION` bump (it stays at v10.8.3 from yesterday). The server-side Opus prompt + matchedItems structure + cache_key_hash payload are all unchanged. Cached reasoning rows from v10.8.4 stay valid; only the UI presentation of the chips changes. Bailey's reasoning text on the Theracne card was generated cleanly under v10.8.4's prompt and will render with the new chip beside it. **AI-First compliance maintained**: no rule engines added, no template strings, no recommendation surfaces created. The chip text comes from data already extracted by Layer 1's `CATEGORY_SIGNAL_PATTERNS` (source text from Yuri's own decision_memory) — surfacing it correctly was the missing wire-up, not generating it. Yuri Sole Authority Principle preserved: chips are observational labels naming Yuri's past statements, not algorithmic recommendations. **Pattern 4 (Structural Encoding from Single Instances) — new lesson**: when a server-side discriminated union grows (like `MatchedItem.type` gaining `'category_conflict'` in v10.8.2), sweep client-side DTO mirrors at the same time. The release that ships a new server-side variant should grep `*.tsx` and `*.ts` files in `src/components/` and `src/app/` for the type name or for switch/conditional statements over the union's existing variants, and extend them in the same commit. The cost of not doing this is silent feature drift — the server-side feature works correctly, the type system doesn't complain because the response gets narrowed at the API boundary, but the UI presents data as if the new variant doesn't exist. v10.8.2 shipped category-level filtering but the chip layer didn't know it existed for three releases. Same shape as v10.7.2's "feature-knowledge audit" finding (Yuri's prompt didn't know about features that had shipped) but at the type-system layer rather than the LLM-knowledge layer. Worth adding to the proactive sweep discipline encoded in v10.7.1: when adding a new variant to a discriminated union, search the codebase for existing switch/conditional statements over that union's other variants and extend each one. **Pattern 4 lesson — voice surface drift**: v10.8.4 fixed the Opus prompt but missed the adjacent UI copy. v10.8.5 fixed the adjacent UI copy. The structural lesson: voice fixes shouldn't scope to "the surface I'm rewriting" — they should scope to "every surface in the same viewport." When future voice fixes ship, grep adjacent files for related third-person pronouns ("her", "she", "the user", "the subscriber") before committing. Same proactive sweep step the Yuri Sole Authority Principle encoded for recommendation surfaces. **Build verified**: `tsc --noEmit` clean, `next build` clean — no other consumers of the chip rendering exist (`SkipReasoning.tsx` is only imported by `CuratedProductCard.tsx` which is only imported by `browse/page.tsx`), so the change is fully isolated to /browse skip-toggle expansions. **Files modified**: `src/app/(app)/browse/page.tsx` (intro copy), `src/components/products/SkipReasoning.tsx` (DTO type extension + chip rendering rewrite), `package.json` (10.8.4 → 10.8.5), `CLAUDE.md` (version header + this changelog entry). Shipped May 23 2026 — same morning as Bailey's v10.8.4 verification screenshot.)

**Pre-this**: 10.8.4 (Curation reasoning voice fix — second-person address. Bailey opened /browse, expanded "Why Yuri would skip this" on one of the curated-skip cards, and texted: *"It's not very personal, shouldn't it read 'you' not 'she'."* She's right. Investigation against `src/lib/intelligence/product-curation.ts` confirmed root cause: the `buildCurationSystemPrompt()` creative brief — built for v10.8.0 Path B — described Yuri "talking TO her" but seeded every voice example and hard-constraint clause in third person ("her decision memory excluded X," "she's flagged Y as an allergen," "She's already running COSRX BHA," "what she actually said"). Opus 4.7 obediently mirrored the example register and produced "she/her" output on every reasoning generation. Architectural class: voice surface drift — every other text surface in the app (Yuri's main chat prompt at advisor.ts:33+, Skin Profile page prose, Library CTAs, scan enrichment copy, weather-routine CTAs) addresses the subscriber in second person; the curation reasoning was the lone surface that broke the pattern. Bailey caught it on first contact. **The fix**: two surgical edits to `src/lib/intelligence/product-curation.ts`. (1) `buildCurationSystemPrompt()` rewritten end-to-end with second-person framing in the opening paragraph (*"You are Yuri, talking directly to a Seoul Sister subscriber who is browsing the product catalog. She is reading this in the 'Why I'd skip this' / 'Why this fits' expander on a specific product card. You are speaking TO her, not ABOUT her. Use 'you' and 'your.' Never refer to her in third person (no 'she,' 'her,' 'the user,' 'this subscriber'). This is a one-to-one conversation surface, not a description of the user to someone else."*) and every voice example flipped — *"you flagged salicylic acid as off-limits until Phase 3"*, *"you listed niacinamide as an allergen on your profile"*, *"You're already running COSRX BHA on MWF. Adding another BHA toner stacks acids on Fitzpatrick 3 skin, which is exactly the PIH risk we're protecting against this phase"*, *"You've got Goodal Vita C in your AM already"*, *"Phase 2 is 'stay the course' — adding a new active product mid-phase is the exact move you and I agreed you weren't going to make"*. Voice anchors paragraph also rewritten — "Never claim her skin WILL react a specific way. Speak in terms of what conflicts with what she's told you — 'you flagged X,' 'you and I decided Y,' 'your Phase 2 watch_for is Z.'" Output format note reinforced: *"2-3 sentences in your voice, addressed to her in second person."* (2) `buildCurationUserPrompt()` updated — section header `## Subscriber state` → `## Her state (use second-person 'you' when writing back to her)`, "Phase watch_for items (things she told you to flag)" → "Phase watch_for items (things she told you to flag in past chats)", closing instruction *"Now write the reasoning. Return strict JSON only."* → *"Now write the reasoning, addressed TO her in second person ('you', 'your'). Return strict JSON only."* The user prompt still describes the subscriber in third person (Opus is reading data ABOUT her), but the output instruction now explicitly demands second-person voice in the reasoning text. **Cache invalidation** (Pattern 4 structural encoding): `CURATION_LOGIC_VERSION` bumped from `v10.8.2` to `v10.8.3` (the constant lives in `computeCacheKeyHash` payload). Every cached reasoning row written under the old prompt — including whatever Bailey was viewing when she texted — now has a stale `cache_key_hash` and stops matching on next /browse load. Fresh reasoning generates from the new prompt automatically; zero manual cleanup. The constant's docblock explicitly lists "system prompt voice/structure changes" as a bump trigger going forward. **AI-First compliance**: this is a prompt change inside a single creative brief, not a rule engine, not a template. Opus still reasons dynamically per-product against the precomputed verdict + matched items + INCI + user state. The output JSON schema is identical (`verdict` + `reasoning_text`). All hard constraints preserved (verdict can't flip from precomputed value, must reference specific matched item on skip, must say so honestly on neutral). The fix is voice register only — Opus retains full latitude over sentence structure, ingredient framing, Korean term placement, sharpness vs softness calibration per the matched-item severity. No rule engine, no canned phrases, no templates. **Why this is its own release**: per the project convention encoded across v10.5.0+ Bailey-class fixes, voice-surface drift caught by Bailey ships fast rather than batching. Same discipline as v10.5.2 (Glass Skin recommendations widget kill same day), v10.6.2 (weather/cycle recommendation surfaces same day), v10.7.1 (Glass Skin Recommendations panel kill within hours of her screenshot). The surface she touched is the surface that ships fixed. **Build verified**: `tsc --noEmit` clean, `next build` clean — no other consumers of `buildCurationSystemPrompt()` or `buildCurationUserPrompt()` exist (private functions in `product-curation.ts`), so the change is fully isolated to /browse skip-reasoning expansions. **Files modified**: `src/lib/intelligence/product-curation.ts` (CURATION_LOGIC_VERSION bump, buildCurationSystemPrompt rewrite, buildCurationUserPrompt rewrite), `package.json` (10.8.3 → 10.8.4), `CLAUDE.md` (version header + this changelog entry). Shipped May 23 2026 — same evening as Bailey's iMessage.)

**Pre-this**: 10.8.3 (Image proxy wired into LazyImage + Content-Type sniff. Bailey opened /browse after the v10.8.2 ship and asked Scott "why don't most products have images?" Diagnosis: 92% of verified products have `image_url` populated in the database (4,895 of 5,311 verified rows), and 97% of those point to `cdn-image.oliveyoung.com`. Direct curl proves the CDN returns 200 OK with the image bytes but serves `content-type: application/octet-stream` (not `image/jpeg`). Browsers refuse to render `<img>` tags whose response Content-Type is octet-stream regardless of magic bytes, which is why `LazyImage.onError` was firing on every Olive Young image and the Package icon fallback was appearing instead. A `/api/img` proxy route and `proxyImageUrl()` helper already existed in the codebase from earlier work — fully built, with hostname allowlist, mostly correct — but **the helper was never imported by any component**, so the proxy was orphaned. v10.8.3 connects the existing infrastructure: (1) `src/components/ui/LazyImage.tsx` now imports `proxyImageUrl` and routes the incoming `src` through it before passing to the `<img>` tag. Single chokepoint for every product image surface in the app (Browse, Library, Product Detail, Discovery carousels, Trending, scan results, Shelf Scan). Non-CDN URLs (data URIs, Supabase storage, same-origin) pass through unchanged. (2) `/api/img/route.ts` Content-Type passthrough bug fixed — previously `response.headers.get('content-type') || 'image/jpeg'` returned the upstream's truthy `application/octet-stream`, so the fallback never fired. New `sniffImageContentType()` reads magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`, GIF `GIF8`, AVIF `ftyp` box, SVG `<`) and rewrites the response Content-Type to the correct `image/*`. Also upgraded the upstream fetch User-Agent from generic "SeoulSister/1.0" to browser-style Chrome UA to reduce Cloudflare bot-management challenges in front of Olive Young's CDN, and aggressive 1-year immutable cache headers since CDN paths are content-hashed UUIDs. **End-to-end smoke test verified** against dev server: GET `/api/img?url=https%3A%2F%2Fcdn-image.oliveyoung.com%2FprdtImg%2F1122%2F...jpg` returns 200 with `content-type: image/jpeg` (correctly sniffed from upstream octet-stream) and `content-length: 304231` matching upstream. Output file passes `file(1)` as "JPEG image data, JFIF standard 1.01, ... baseline, precision 8, 1000x1000, components 3." Disallowed hosts return 403, missing/invalid URLs return 400, all SSRF defenses intact. AI-First compliance: this is pure infrastructure work — no AI calls, no recommendation logic, no Yuri voice — so the principles don't directly apply, but the pattern Discipline matters: Pattern 12 (Pause-and-Verify) caught that an existing-but-orphaned proxy needed two surgical edits (Content-Type sniff + LazyImage wire-up) rather than the full new-file rebuild I'd planned. Token-efficient fix. `tsc --noEmit` clean, `next build` clean. Shipped May 23 2026 in pre-Bailey overnight QA window so she wakes up to a /browse with actual product images, not gold placeholder icons.)

**Pre-pre-pre**: 10.8.2 (Path B Layer 1.5 — category-level conflict filter. v10.8.1 fixed the substance extractor false positives (panthenol, hyaluronic acid, asiatic acid, etc.) but left a load-bearing gap surfaced on Bailey's account: products containing BHA still landed in `fits` even though her decision_memory explicitly says "already using BHA 3x/week, stacking acids would risk PIH on Fitzpatrick 3 skin." The substance extractor caught `glycolic acid` (the literal word) but not the category-level judgment "no more acids of any class." Result on her /browse: Aloe BHA Skin Toner, Invisible Peeling Booster, Theracne 365 Spot Treatment, Mugener Ampule all in fits — exactly the products Yuri would tell her not to layer during Phase 2. **Architectural addition**: Layer 1.5 between substance filter and Opus reasoning. New `extractExcludedCategoriesFromText()` parses decision_memory + watch_for via clause-level exclusion-intent detection (same gate as Layer 1) and matches against `CATEGORY_SIGNAL_PATTERNS` — 17 regex/phrase rules that map Yuri's category-level language ("already using BHA", "stacking acids", "no more actives", "stay the course", "additional niacinamide serum", "rejected PHA toner", "wrong tool for current phase", "sleeping mask", etc.) to product categories + ingredient classes she's signaled to exclude. New `INGREDIENT_CLASS_MEMBERSHIP` dictionary defines what counts as BHA / AHA / PHA / retinoid / vitamin_c / astringent_oil — conservatively scoped (e.g., willow bark NOT in BHA because cosmetic concentrations don't trigger the stacking risk; citric acid NOT in AHA because it's primarily a pH buffer at K-beauty concentrations). New `category_conflict` matched_item type extends `MatchedItem` so skip chips can distinguish "you have an allergy to X" from "you're already running enough of category Y." Opus reasoning prompt updated with category-conflict handling — when the matched item type is category_conflict, Opus articulates the higher-order judgment ("she's already running COSRX BHA on MWF, adding another BHA toner stacks acids on Fitzpatrick 3 skin") instead of substance-level reasoning. **Three bugs caught and fixed during in-session verification** (Pattern 12 + 4): (1) substring direction collision — "water" matching the BHA class because "salix alba bark water".includes("water") was true. Fixed via directional match (class member must be substring of product ingredient, not reverse) plus removing water-bearing class members entirely. (2) Citric acid in AHA class triggered false positives on virtually every K-beauty product (citric acid is in everything as pH buffer at non-AHA concentrations). Removed from class. (3) Fragrance auto-extracted as global decision_memory exclusion from "Skip Zero Pore Oil due to astringent oils and fragrance" caused false-skip on Anua Heartleaf Cleansing Oil — the cleanser Yuri herself recommended Bailey switch to. Added fragrance/parfum/perfume/aroma to NEVER_EXCLUDE_SUBSTANCES with explicit rationale: fragrance avoidance belongs on declared allergies (explicit user signal), not inferred from context-specific decision_memory mentions. **Verification against Bailey's real data** (`scripts/verify-curation-v10-8-2.ts`): 20 category exclusions correctly extracted (BHA stacking, no new actives this phase, no additional vitamin C ampoule, rejected PHA toner, etc.). 8-product spot check: Aloe BHA Toner / COSRX AHA-BHA Toner / Theracne Spot Treatment / Invisible Peeling Booster / Mugener Ampule all correctly SKIP with category_conflict chips referencing Bailey's actual Yuri-text. Red Blemish Cica Recovery Cream / Aqua Soothing Gel Cream / Anua Heartleaf Cleansing Oil (her own newly-decided cleanser) all correctly FITS. 5 skips / 3 fits / 0 false positives / 0 false negatives. `CURATION_LOGIC_VERSION` bumped to `v10.8.2` so all v10.8.1 cached reasoning auto-invalidates. `tsc --noEmit` clean, `next build` clean. Shipped May 23 2026 in pre-Bailey overnight QA window per Scott's "I want this working perfectly for Bailey when she awakes" call.)

**Pre-pre**: 10.8.1 (Path B substance-extractor hotfix — pre-Bailey QA caught it. Same evening as the v10.8.0 ship, Scott logged into Bailey's account to preview /browse before texting her. The header rendered correctly ("Filtered against your Phase 2 — Active Treatment protocol..."), 334 fits / 66 skips split looked reasonable, the skip toggle defaulted collapsed as planned. But expanding the toggle revealed the substance-extraction algorithm was producing wildly false-positive chips: Red Blemish Cica Recovery Cream flagged for "asiatic acid" (Yuri uses centella-family ingredients for barrier work), Aloe BHA Skin Toner flagged for "hyaluronic acid" (Yuri actively recommends HA), Real Cica Micellar Cleansing Foam flagged for "gluconolactone, lactobionic acid, asiatic acid, panthenol" (all barrier-safe; Yuri specifically named gluconolactone and lactobionic as her future Phase 3 PHA choices). **Root cause**: `extractExcludedSubstancesFromDecisionMemory()` was tokenize-everything-and-hope. Any decision_memory entry containing a phase-marker keyword ("skip", "phase 2", "phase 3", "defer", etc.) had its entire text tokenized, and every 3+ character word became an "excluded substance." Bailey's actual entry *"If needed in Phase 3 or 4 for textural PIH marks, would use gentle PHA (gluconolactone or lactobionic acid) instead of glycolic, swapping in on non-BHA nights"* — contains "Phase 3", so the extractor added gluconolactone, lactobionic, glycolic, pha to her exclusion list. The extractor flipped Yuri's *recommendations* into *exclusions*. Same bug class against watch_for: tokenizing "PIH/PIE marks on chin from picking or BHA over-application (Fitzpatrick 3 is the PIH danger zone)" added "fitzpatrick", "marks", "danger", "zone" as substance tokens. **Origin of the bug**: I ported v10.3.6's `getMissingHighValueIngredients` keyword set to the new curation extractor without realizing the failure modes were inverted. In the original (recommendation-candidate filter), false positives = fewer ingredients recommended = invisible to user. In the curation skip-list generator, false positives = "Yuri would skip this" cards rendering with wrong reasons = visible misrepresentation of Yuri's voice. Bailey-class trust failure. **The fix** (3 surgical changes to `src/lib/intelligence/product-curation.ts`): (1) Rewrote `extractExcludedSubstancesFromDecisionMemory()` as structured exclusion-intent parsing. Only considers decision_memory entries whose `decision`/`truth` field contains an EXCLUSION VERB (`not adding`, `skip`, `avoid`, `reject`, `discontinued`, `holding off`, etc.) at the clause level. Within an exclusion-intent entry, extracts substances via known-substance dictionary loaded from `ss_ingredients`, not via tokenize-everything. Handles "replacing X with Y" idiom specifically — extracts X (removed), explicitly skips Y (recommended new). (2) Added `NEVER_EXCLUDE_SUBSTANCES` allowlist for ubiquitous + barrier-safe ingredients (glycerin, hyaluronic acid, panthenol, vitamin e, asiatic acid, centella, gluconolactone, lactobionic acid, niacinamide, water, ceramide, beta-glucan, schisandra, rice extract, snail mucin, propolis, ginseng, common emollients/silicones/preservatives). Defense-in-depth: even if the parser thinks a barrier-safe ingredient is excluded, refuses to add it. (3) Same exclusion-intent gate applied to watch_for items at context-build time — pre-extracted `watchForExcludedSubstances` array replaces v10.8.0's per-product tokenize-watch_for-phrase logic. Most watch_for items are observational ("PIH marks on chin from picking") and now correctly produce zero substance exclusions. **Cache invalidation** (Pattern 4 structural encoding): added `CURATION_LOGIC_VERSION = 'v10.8.1'` constant included in `computeCacheKeyHash()` payload. Any code change to the extractor logic future-forward bumps the constant and auto-invalidates every existing cache row across all users. No manual cleanup needed. **Verification against Bailey's real data**: pre-fix extractor produced ~50+ false-positive exclusions; post-fix produces 3 real ones — `fragrance` (correctly extracted from "Skip Medicube Zero Pore Blackhead Cleansing Oil due to astringent oils and fragrance"), `vitamin c` (correctly extracted from Glass Skin rejection: "additional Vitamin C ampoule" — she already has Goodal Vita C), `glycolic acid` (correctly extracted from "Not adding glycolic acid to routine — stacking acids would risk PIH"). Watch_for exclusions: 0 (her watch_for items are observational, not exclusion-imperative). Spot check against 5 v10.8.0-wrongly-skipped products: all 5 now correctly verdict as `fits` or `neutral` (no false chips). New verification script `scripts/verify-curation-v10-8-1.ts` runs the full extractor + filter against Bailey's actual decision_memory and treatment phase for future regression checks. **Pre-Bailey QA discipline applied** (Pattern 12 + Pattern 4): held back the iMessage to Bailey until pre-deploy QA against her real account confirmed the experience would land. Same pattern as v10.6.0/v10.6.5 ship discipline — pre-Bailey check is not optional. `tsc --noEmit` clean, `next build` clean. Shipped May 23 2026.)

**Pre-hotfix**: 10.8.0 (Path B — Products as Yuri's Shortlist. Bailey iMessage May 20-22 2026 surfaced a structural gap: she loves the Ingredients feature but doesn't like the Products feature, even suggested hiding /browse from paying subs entirely. Deep audit May 22 confirmed Products' algorithmic "For You" sort and "Loved by Combination Skin" carousel were the sixth instance of the Yuri Sole Authority Principle violation waiting to be earned through a Bailey-caught miss — both ranked by ingredient effectiveness × skin type with zero awareness of her active treatment phase, decision memory, or routine. This release rewires /browse around a two-layer curated-shortlist architecture. **Layer 1 — deterministic SQL/JS structural filter** (zero AI cost, pure data filtering): splits the candidate set into `fits` and `skipped` based on user's declared allergens, substances flagged in `decision_memory` entries that contain v10.3.6 phase-marker keywords (skip / defer / phase 2 / pause / until / etc.), and active treatment phase `watch_for` items. Pure structural removal of products whose INCI overlaps with declared user-state conflicts — no ranking, no judgment, no rule engine. **Layer 2 — on-demand Opus 4.7 reasoning** (per-product, cached): when a subscriber expands "Why Yuri would skip this" on a specific card, lazy-fetches `/api/products/curated/[id]/reasoning` which returns 2-3 sentences in Yuri's voice articulating the specific watch_for / allergen / decision_memory match. New `ss_product_curation_reasoning` table caches by `(user_id, product_id, cache_key_hash)` where the hash is a sha256 over the user's load-bearing state — so reasoning auto-invalidates the moment her phase or decision memory shifts. 60-day soft TTL guards against reformulation drift. **Opus 4.7 over Sonnet 4.5** per Scott's May 22 decision (Principle 1): voice consistency between /browse skip reasoning and /yuri chat matters more than the ~$0.10/sub/month delta. Cost projection: ~$0.40/sub/month at 30 fresh reasonings + 80% cache hit rate, against the $35.88 per-Pro margin — negligible. **Killed in /browse**: the "For You" sort button (algorithmic ingredient-effectiveness rank with zero phase awareness — same shape as the five prior Yuri Sole Authority violations), the "Loved by [SkinType] skin" carousel (same rank, different UI), and the "Sorted by ingredient effectiveness for your skin type" indicator. **Preserved**: public `/products` SEO surface untouched (anonymous AI-discoverability landing page stays as-is), `/api/products` endpoint unchanged (other consumers may use it), AppShell `SHARED_FALLBACKS` continues to route non-subscribers from `/browse` → `/products`. **AI-First compliance audit performed before AND after build**: Layer 1 is structural data filtering (substring matching against declared user-state arrays), explicitly not a rule engine. Opus prompt is a creative brief, not a template — establishes Yuri's voice anchors and hard constraints, trusts Opus to articulate naturally. No "Yuri Certified" / "Yuri's Picks" branding anywhere; surface labels are observational ("Filtered against your Phase 2 protocol", "Why Yuri would skip this"). The single recommendation surface in Seoul Sister remains Yuri's chat. **Telemetry** wired into `ss_ai_usage` with three new feature codes (`curated_browse_view`, `skip_reasoning_expanded`, `product_curation_reasoning`) — the leading indicator is expansion rate (% of curated browse sessions that expand at least one skip reasoning). If > 30% after a month, the educational toggle is working; if < 10%, Path A (hide /browse entirely for subs) becomes the next call. **Architecture document**: `PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md` at repo root captures the full plan, origin, principle audit, and build order. **Build verified**: `tsc --noEmit` clean, `next build` clean, both new API routes (`/api/products/curated` + `/api/products/curated/[id]/reasoning`) registered as dynamic functions. Migration `20260522000001_add_product_curation_reasoning.sql` requires manual apply via Supabase Studio SQL editor (Supabase MCP is read-only in this environment). Shipped May 22 2026.)

**Previous version**: 10.7.5 (BP76 resolver follow-up — Strategy 1.5 stop-word + punctuation gaps. The v10.7.4 commit 57695e8 added Strategy 1.5 (brand-prefix composite lookup) to smartProductSearch and closed the LGAAS BP76 e2e Stage 4 gap for "COSRX BHA Blackhead Power Liquid" / "Anua BHA 2% Gentle Exfoliating Toner". A canary check tonight against 16 real-world product queries — Bailey's library, multi-word brand names, brand-prefixed variants, off-target probes — surfaced two real BP76-class gaps that v10.7.4's Strategy 1.5 didn't catch: (1) **stop words filtered from brand-candidate strings**. Query "Beauty of Joseon Glow Deep Serum" tokenized to `["beauty", "joseon", "glow", "deep", "serum"]` (with "of" stripped as a stop word), so Strategy 1.5's 3-token brand candidate reconstructed as "beauty joseon" which can't ILIKE-match the catalog's `brand_en = "Beauty of Joseon"`. (2) **punctuation in query tokens**. Query "Torriden Dive-In Low Molecular Hyaluronic Acid Toner" tokenized with the hyphen preserved, so `name_en ILIKE %dive-in%` failed against the catalog's unhyphenated "Dive In Low Molecular Hyaluronic Acid Toner" row. Both bugs production-relevant — AriaStar drafts use brand marketing names like "Beauty of Joseon Glow Deep Serum" and "Torriden Dive-In" routinely. Two-part fix: (a) added a separate `originalTokens` array in smartProductSearch that preserves stop words and short tokens — Strategy 1.5's brand candidate uses originalTokens.slice(0, brandTokenCount) so "Beauty of Joseon" reconstructs correctly; nameTerms continue to use the stop-word-filtered list to avoid noisy ILIKE predicates against name_en (so "in" / "the" / "of" don't become ILIKE noise). (b) added punctuation normalization (`/[-/_.]+/g` → spaces) on the query side at both tokenization stages AND in resolveProductByName's post-filter + match_quality classification. Now "Dive-In" query tokens become ["dive", "in"], "in" gets stop-word-filtered for name predicates, "dive" matches the catalog's "Dive In Low Molecular Hyaluronic Acid Toner" via `name_en ILIKE %dive%`. The match_quality classifier also tries exact-match against normalized strings ("Torriden Dive In Low..." includes "Torriden Dive In Low..." even when the user typed "Dive-In") so hyphen-variants classify as 'exact' instead of falling to 'partial' and being null'd by the strict resolver. Verification: canary re-run flips from 14/16 → 16/16 with both BoJ and Torriden cases now resolving correctly. BP76 smoke test still 16/16 (no regression). tsc --noEmit + next build both pass clean. Same architectural property as v10.7.4: changes are additive on smartProductSearch's input normalization; resolveProductByName's match_quality classification still gates writes; strict resolver still nulls 'partial' matches. So Yuri's write-path tools (mark/clear_product_reaction, save_routine, update_user_product) keep their v10.7.0 Phase A.3 safety guarantees — just with broader correct-resolution coverage. Shipped May 20 2026.)

**Pre-previous**: 10.7.4 (Blueprint 76 SS-side endpoint — POST /api/lgaas/ingredient-check shipped. Triggering incident: May 20 AriaStar-generated draft for an r/KoreanBeauty post recommended COSRX BHA Blackhead Power Liquid and Some By Mi AHA-BHA-PHA Toner to u/varm-t, who said in the SAME post "my skin tends to not agree with niacinamide." Both recommended products list Niacinamide at INCI position 4 and 5 respectively (~2-5% active concentration). The model acknowledged "niacinamide-reactive" in its OPENING SENTENCE then recommended two niacinamide-prominent products one sentence later — an architectural gap, not a prompt-engineering miss. The pre-existing pipeline verifies product → ingredient grounding (Blueprint 44 family) but never had a constraint → product-compatibility direction. Seoul Sister's side of the fix: (a) new shared library `src/lib/intelligence/ingredient-match.ts` — synonym map (INCI-canonical → colloquial), INCI parser with parenthetical/ppm-annotation handling, position-based concentration estimator (1-3 = 5-15%, 4-5 = 2-5%, 6-10 = 0.5-2%, 11+ = <0.5%), pure-function checkSubstanceInProduct primitive that both Yuri's check_ingredient_conflicts tool AND the new LGAAS endpoint can use; (b) new endpoint `POST /api/lgaas/ingredient-check` — auth via X-LGAAS-API-Key matching existing /api/admin/products/* pattern (LGAAS_INGEST_API_KEY env var), Zod-validated request schema (product_names + constraints with supporting_quote per Yuri v10.7.0 Phase D conservative extraction discipline), uses resolveProductByNameStrict (no silent substitution onto wrong products), returns conflicts array per LGAAS spec with INCI position + concentration estimate + supporting_quote preserved. Smoke test (`scripts/smoke-test-bp76.ts`) passes 16/16 including the u/varm-t trigger case end-to-end against live catalog: COSRX BHA flags Niacinamide at position 4, Some By Mi flags at position 5, Anua BHA 2% (the correct alternative) returns null. AI-First throughout: zero rule engines, the constraint extractor lives on the LGAAS side (Sonnet 4.5 with supporting_quote gates), the SS side is pure data verification. Pattern matches Blueprint 74 (Domain-Fit Gate) — verifiable data outside the prompt, force regeneration on conflict, fail loud not silent. tsc --noEmit + next build both pass clean; new endpoint registers as `/api/lgaas/ingredient-check (ƒ Dynamic)`. Shipped May 20 2026. LGAAS-side integration (extractUserConstraints + HTTP client + Surface-Facts builder + regeneration loop) is the next phase, handled in lgaas-blueprint/76-IMPLEMENTATION-PLAN.md.)

**Earlier**: 10.7.3 (Heat Check polish — grounded the defensive pause in concrete tool action. P3.3 from the v10.7.2 audit that I'd technically deferred. Heat Check (the section that handles user anger/accusation toward a third party — brand, derm, influencer, retailer) tells Yuri to ask ONE clarifying question before engaging substantively. The three example prompts were all verbal pauses ("what does the packaging look like?", "when did you buy it?", "can you screenshot the ingredient list?"). Added a fourth example that pairs the verbal pause with calling get_product_details against the catalog: *"Hold on — before we go after them, let me pull what's actually in our catalog for this product so we're comparing real INCI lists."* Plus a new paragraph naming the broader pattern: verbal pause + tool verification beats verbal pause alone. When the user has cited concrete evidence (INCI list, batch code, screenshot, price), grounding the conversation in catalog data BEFORE engaging is the highest-trust move. Named the three "let me check what we actually have" tools (get_product_details, compare_prices, get_ingredient_guide). AI-First: no rule engine, no template — just adds one concrete example to an existing creative brief. tsc --noEmit passes clean. Shipped May 20 2026.)

10.7.2 (Yuri feature-knowledge audit — eleven prompt updates synced against current app state. The last documented feature-knowledge update was v8.5.0 (Feb 25); twenty-five releases have shipped since, adding /library + /skin-profile, killing the Routine Intelligence widget + Weather recommendations + Cycle adjustments + sunscreen "Yuri's Picks" + Glass Skin Recommendations + Dashboard "Yuri's Insights" (Yuri Sole Authority Principle, 5 Bailey-caught incidents), expanding Yuri's tool count from 8 to 16, swapping subscriber Products from /products to /browse, and growing the database to 5,917 products / 14,845 ingredients / 229,135 links / 211 effectiveness records — all of which Yuri was confidently citing wrong numbers or pointing to dead paths for. Eleven fixes shipped: dropped hardcoded "14 tools" count, renamed subscriber Products row to Browse with explicit subscriber-vs-marketing distinction, added Library row + Quick Reminder, extended Ingredients row with subscriber For You enrichment (Phase 13.G), softened Yuri row from pixel positions to capabilities, added subscriber intelligence panel to Product Detail row (Phase G v10.7.0), embedded Yuri Sole Authority Principle as a Quick Reminder directly in Yuri's prompt (was only in CLAUDE.md), extended "How Everything Connects" with Library + Skin Profile consolidating loops, replaced the entire stale ### Database Intelligence bullet list with creative-brief scope description (NET token reduction — counts go stale, scope endures), distinguished Trend Scout's training-knowledge sources (Hwahae, Naver, 피부과) from live tool-data sources (Olive Young, Reddit), rewrote widget's intelligence advantage to drop stale counts + added explicit capability-scope paragraph telling widget what it CAN and CANNOT do without a subscriber profile (search/prices/trends/ingredients/weather YES; personalized analysis/conflict checks/routine building/cross-session memory/Glass Skin tracking NO). AI-First throughout: zero rule engines added, zero templates, zero recommendation surfaces. Every change is voice-first creative brief. tsc --noEmit + next build both pass clean. Shipped May 20 2026.)

10.7.1 (Bailey audit follow-up — three additional fixes layered on top of v10.7.0 after Bailey's May 20 morning screenshot session. Issue A: duplicate user-message bubble on iOS Safari (synchronous useRef guards in useYuri + ChatInput + DOM textarea force-clear). Issue B: Glass Skin Score Recommendations panel violated Yuri Sole Authority Principle (killed on both main results surface and ProgressTimeline expanded-history accordion; replaced with single Ask-Yuri CTA carrying score + lowest dimension via `?ask=` prefill). Sweep finding: Dashboard "Yuri's Insights" widget rendered algorithmic recommendations under a heading impersonating Yuri (widget deleted, dashboard section removed). v10.7.0's match_quality resolver + executeUpdateUserProduct rewrite supersedes my draft Issue C fix — better architecture, more AI-First, more honest. Yuri Sole Authority Principle incident count now five. Shipped May 20 2026.)

Phase 13.H (v10.6.5): My Library — the subscriber-only consolidating view at `/library`. Five sections — Owned (with add/remove), Saved (wishlist + scans), In Routine (split AM/PM with honest "Not owned" gap surfacing + Mark-as-owned tap), Tagged (Holy Grail + Broke Me Out), Expiring (top 5 by PAO date, color-coded by urgency). Single Yuri CTA at the top with `?ask=` prefill summarizing user's actual counts is the ONLY recommendation surface — every section is pure data display from existing tables. Zero new tables, zero migrations. `?section=` URL deep-link for sharing specific sections with Yuri. AI-First audit performed before AND after build. Yuri Sole Authority Principle preserved: ownership gaps are honest discovery (set difference), not algorithmic recommendations. Bailey verified: 12 owned + 18 routine steps + 2 ownership gaps (Goodal Vita C, Beauty of Joseon Relief Sun) + 1 Holy Grail. Shipped May 18 2026.

Phase 13.G (v10.6.4): Subscriber-aware ingredient detail enrichment. When a subscriber views any /ingredients/[slug] page, a "For You" panel renders below the public SEO hero showing: products they own containing this ingredient (with ownership labels), effectiveness score for their skin type with sample-size context, current treatment phase with watch_for items rendered verbatim from Yuri's own conversations, and an "Ask Yuri" CTA with ?ask= prefilled. Anonymous visitors see exactly the same page they see today — zero impact on SEO surface or AI-citation output. AI-First audit performed before AND after build. Yuri Sole Authority Principle preserved: zero generated recommendations on the surface, all four panels are observational data, the only synthesis happens when the user taps "Ask Yuri" and Yuri reasons with full context. Shipped May 18 2026.

Phase 13.F (v10.6.3): Bailey caught broken Browse-by-Category cards on /products this morning. Investigation surfaced that subscriber surfaces were leaking visitors into marketing nav, breaking the subscriber experience. Brainstormed bigger before fixing: established auth-aware shared surfaces pattern where the same page serves both audiences with appropriate nav chrome, subscriber-shared URLs work for non-subscribers without /login bounces, and explicit Web Share API affordances on product + ingredient detail pages turn every subscriber into a potential brand ambassador. 7 items shipped (1 deferred mid-build after reassessment). AI-First audit performed before AND after build. Files: new AuthAwareNav + ShareButton components, 8 public surfaces updated, AppShell fallback redirect system, /browse URL state initialization. Shipped May 18 2026.

Phase 13.E (v10.6.2): Killed hardcoded recommendation surfaces on weather widget + cycle adjustment widget per Bailey's May 18 morning feedback; renamed sunscreen "Yuri's Picks" → "Top matches for {skin_type} skin" (algorithm was never Yuri-curated); added `?ask=` prefill infrastructure so Yuri-conversation CTAs carry context; encoded Yuri Sole Authority Principle as load-bearing architecture in CLAUDE.md so future AI sessions don't reintroduce competing recommenders. Shipped May 18 2026.

Phase 13.D core (v10.6.0): Bailey-driven feature delivering: (a) a /skin-profile page that surfaces Opus 4.7-generated prose synthesis of the user's skin in Yuri's voice, regenerated when phase state or decision memory shifts, (b) phase-tagged Glass Skin photo gallery with reusable lightbox component — same lightbox solved Bailey's text 3 paper-cut about not being able to tap photos in Yuri chat to enlarge. New `ss_treatment_phases` table captures Yuri's phased treatment plan as a first-class entity (outcomes JSONB enables future cohort learning per Principle 3). Phase extraction pipeline runs Sonnet 4.5 fire-and-forget after every Yuri conversation, conservative threshold (requires verbatim supporting quote), feeds phase transitions back into decision_memory so Yuri sees them via existing context-load path. Bailey backfilled with Phase 1 Barrier Repair (completed Feb 23 → May 4) + Phase 2 Active Treatment (active May 5 → present, Day 14). AI-First audit applied before coding — six revisions to enforce Opus on user-facing surfaces, creative-brief prompts vs templates, and learning feedback loops.)
**Status**: ALL PHASES COMPLETE (1-14) + Phase 15 Sessions 1+2 shipped (15.1-15.5 all complete) + Phase 16.1 (overlap detection) + v10.5.0-v10.5.2 Bailey audit and user-feedback fixes + v10.6.0 Phase 13.D Living Skin Profile (Bailey's iMessage requests from May 17 2026 — RESOLVED). Memory denial bug fixed (v8.0.1) + corrections memory now persists factual user-corrected K-beauty facts across sessions (v10.2.0). 5,800+ products (skincare only), 14,400+ ingredients, 207,000+ links, 550+ brands, 5,550+ products with ingredient links (89%), 52 price records across 6 retailers. 14 cron jobs configured and verified working. Pre-launch health audit complete: RLS hardened (69 policies optimized), cron pipeline fixed (auth header + HTTP method), 3 FK indexes added, 3 ghost functions dropped, search input sanitized. Skincare-only extraction filter deployed and hardened with exhaustive cosmetic rejection rules — non-skincare products automatically rejected at pipeline level. GA4 (G-L3VXSLT781) + Vercel Analytics + SpeedInsights live. **Monetization hardened**: Free tier eliminated, payment-first registration flow (Register → Stripe $39.99/mo → Onboarding, no email verification), widget system prompt rewritten AI-First with 20 preview messages and natural conversion.
**AI Advisor**: Yuri (유리) - "Glass"

**Changelog**: See `CHANGELOG.md` for full version history.

### Deployment Status
- **Vercel**: Live at seoul-sister.vercel.app
- **Domain**: seoulsister.com configured in Vercel (DNS propagating via Namecheap)
- **Supabase**: Project ref `gzqjvbhmndnovhlgumdk` -- migrations pending
- **GitHub**: scottaicode/seoul-sister (main branch)

### Database Migration Instructions
Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query) in this order:
1. `scripts/combined-all-migrations.sql` -- schema + small seeds + all phase additions
2. `supabase/migrations/20260216000002_seed_products.sql` -- 30 ingredients + 55 products
3. `supabase/migrations/20260216000003_seed_product_ingredients_prices.sql` -- ingredient links + prices

**Changelog**:
- v10.8.3 (May 23, 2026): Image proxy wired into LazyImage + Content-Type sniff
  - **Origin**: Bailey opened /browse after v10.8.2 deployed and asked Scott "why don't most products have images?" Diagnosis confirmed against her real browse: ~50 products visible, ~5 had actual images, the rest showed the gold Package fallback icon from `LazyImage.onError`. Investigation traced root cause to two compounding issues.
  - **Diagnosis** (via direct curl + Supabase queries):
    - 92.2% of verified products have `image_url` populated (4,895 of 5,311). Data is fine.
    - 97% of those URLs point to `cdn-image.oliveyoung.com`. Single dominant CDN.
    - `curl -I` against an Olive Young image returns `HTTP/2 200 OK` with full 304KB image bytes — fetching works.
    - But the response Content-Type is `application/octet-stream`, NOT `image/jpeg`. Browsers refuse to render `<img>` tags whose response is octet-stream regardless of byte content (the magic-byte sniffing path in browsers only triggers for `text/*` Content-Types, not `application/*`).
    - Cloudflare bot-management cookies (`__cf_bm`) are also set on every response, indicating potential challenge logic in front of the origin — second compounding factor.
  - **Pre-existing infrastructure discovery** (Pattern 12 pause before rebuild): a fully-built `/api/img/route.ts` route and `src/lib/utils/image-proxy.ts` helper already existed in the codebase from earlier work, with the correct hostname allowlist for SSRF defense. But `grep -rn "image-proxy\|/api/img" src/components/` returned zero results — **the helper was never imported by any component, so the proxy was orphaned**. Two surgical edits instead of new-file rebuild.
  - **Fix in `src/components/ui/LazyImage.tsx`**: imported `proxyImageUrl` from the existing helper and rewrote the `src` prop through it before passing to the `<img>` element. Single chokepoint — every product image surface in the app (Browse, Library, Product Detail, Discovery carousels, Trending, scan results, Shelf Scan, Ingredient detail) flows through LazyImage, so one change covers all of them. Non-CDN URLs (data URIs, Supabase storage, same-origin) pass through unchanged via the helper's whitelist check.
  - **Fix in `src/app/api/img/route.ts`**:
    - Content-Type passthrough bug: previously `response.headers.get('content-type') || 'image/jpeg'` returned upstream's truthy `application/octet-stream`, so the `|| 'image/jpeg'` fallback never fired. Replaced with `sniffImageContentType(bytes, 'image/jpeg')` when upstream Content-Type doesn't start with `image/`. Reads magic bytes for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`), GIF (`GIF8`), AVIF (`ftyp`), SVG (`<`). Falls back to `image/jpeg` for unknown formats since Olive Young is JPEG by convention.
    - User-Agent upgraded from generic `Mozilla/5.0 (compatible; SeoulSister/1.0)` to browser-style Chrome UA (`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36`) to reduce Cloudflare bot-management challenges. Accept header also expanded to include `image/avif,image/webp,image/apng,image/svg+xml,image/*` for better content negotiation.
    - Cache headers upgraded from 30-day to 1-year immutable (`max-age=31536000, immutable, s-maxage=31536000`) since Olive Young paths are content-hashed UUIDs that never change. Vercel edge will cache aggressively after first request — second-and-subsequent loads hit the edge, not the origin.
    - Added `Referrer-Policy: no-referrer` header on responses to prevent referer leakage on cached re-use.
    - Added `console.error('[/api/img] proxy error:', err)` on the catch path (v10.3.5 audit pattern — fire-and-forget logging must visible).
  - **End-to-end smoke test verified** against dev server:
    - Test 1: GET `/api/img?url=https%3A%2F%2Fcdn-image.oliveyoung.com%2FprdtImg%2F1122%2F4ef7ea0b-7305-46cb-8175-7565bc870559.jpg` returns **HTTP 200** with `content-type: image/jpeg` (correctly sniffed from upstream `application/octet-stream`), `content-length: 304231` matching upstream byte-for-byte. Output passes `file(1)`: *"JPEG image data, JFIF standard 1.01, ... baseline, precision 8, 1000x1000, components 3."* Browser will render this correctly.
    - Test 2 (SSRF defense): GET `/api/img?url=https%3A%2F%2Fevil.example.com%2Fimg.jpg` returns **HTTP 403 Forbidden**.
    - Test 3 (missing param): GET `/api/img` returns **HTTP 400 Bad Request**.
    - Test 4 (invalid URL): GET `/api/img?url=not-a-url` returns **HTTP 400 Bad Request**.
  - **Pattern 12 (Pause-and-Verify) saved time**: my initial plan was to build a new `/api/img` route, new helper module, and wire both into LazyImage — estimated 1-2 hours. Discovering the existing infrastructure dropped the scope to two surgical edits (Content-Type sniff + LazyImage import), shipped in ~30 minutes. Always check for existing work before building new.
  - **Files modified**:
    - `src/app/api/img/route.ts` (Content-Type sniffing, browser UA, 1-year cache, error logging)
    - `src/components/ui/LazyImage.tsx` (proxyImageUrl wired into src)
    - `CLAUDE.md` (this entry + version bump)
    - `package.json` (10.8.2 → 10.8.3)
  - **Files NOT modified** (preserved as-is): `src/lib/utils/image-proxy.ts` helper already correct, next.config.js `remotePatterns` already includes all relevant CDNs, no migration needed, no UI surface change beyond the silent proxy injection.
  - **Build verified**: `tsc --noEmit` clean, `next build` clean.
- v10.8.2 (May 23, 2026): Path B Layer 1.5 — category-level conflict filter
  - **Origin**: After v10.8.1 shipped, pre-Bailey QA pass on her account showed the substance-extractor false positives were gone but the fits list still contained products that conflict with her Phase 2 protocol at the category level. Aloe BHA Skin Toner (she's already on COSRX BHA), Theracne 365 Spot Treatment (Yuri said "don't add anything new" in Phase 2), Invisible Peeling Booster (exfoliator while on BHA), Mugener Ampule (additional active during stay-the-course phase). The substance extractor catches `glycolic acid` (literal word in her rejection text) but not Yuri's higher-order "no more acids of any class" / "no new actives" judgment.
  - **Architectural addition**: new Layer 1.5 between substance filter (Layer 1) and Opus reasoning (Layer 2). Parses category-level exclusion intent from her own decision_memory + watch_for text.
    - `extractExcludedCategoriesFromText()` matches text against `CATEGORY_SIGNAL_PATTERNS` — 17 regex/phrase rules covering "already using BHA", "BHA Nx/week", "stacking acids", "no more acids", "additional niacinamide", "additional vitamin C", "vitamin C ampoule", "more vitamin C", "PHA toner", "gentle PHA in Phase 3/4", "don't add anything new", "stay the course", "no more actives", "sleeping mask", "humectant essence", "astringent oils", "wrong tool for current phase". Each pattern maps to product categories (spot_treatment, exfoliator, ampoule, mask, essence, oil) + ingredient classes (bha, aha, pha, retinoid, vitamin_c, niacinamide_feature, astringent_oil) the user has signaled to exclude.
    - `INGREDIENT_CLASS_MEMBERSHIP` dictionary defines what canonical ingredient names belong to each blocked class. Conservatively scoped — willow bark NOT in BHA class because cosmetic concentrations don't trigger Yuri's stacking concern; citric acid NOT in AHA because it's a pH buffer at K-beauty concentrations; salix alba bark water NOT in BHA because it causes "water" substring collisions.
    - New `category_conflict` value on the `MatchedItem.type` union so chips on the /browse skip toggle can show "BHA already at protocol cadence → salicylic acid" instead of trying to fit category-level reasoning into substance-level chip shape.
    - `applyPhaseFilter` extended with optional `productCategories` + `productNames` params. When provided, Layer 1.5 checks: (a) product category against `excludedCategories`, (b) any product ingredient against blocked-class membership, (c) for `niacinamide_feature` specifically, name-based check (product name contains "niacinamide" + category is serum/ampoule/essence) since INCI alone can't distinguish "10% niacinamide serum" from a moisturizer with niacinamide as supporting ingredient.
  - **Opus reasoning prompt updated**: when a matched_item has type=category_conflict, Opus articulates higher-order Phase 2 judgment instead of substance-level reasoning. Brief includes 3 voice examples ("she's already running COSRX BHA on MWF — adding another BHA toner stacks acids on Fitzpatrick 3 skin", "she has Goodal Vita C in her AM already, another vitamin C ampoule isn't more brightening just more sting", "Phase 2 is 'stay the course' — adding a new active mid-phase is the move she told me not to make"). matched_ingredient field now contains category names or class names; item field contains the source-text label so Opus can anchor in her own words.
  - **Three bugs caught and fixed during in-session verification** (Pattern 12 pause-and-verify + Pattern 4 structural encoding):
    1. **Substring direction collision** — first verification run showed "water" matching the BHA class because `"salix alba bark water".includes("water")` was true, and the substring match operated bidirectionally. Result: every product containing water (effectively all of them) was flagging as BHA conflict. Fixed via directional match — class member must be substring of product ingredient name, not reverse. Also tightened minimum lengths (product ingredient ≥3 chars, class member ≥4 chars).
    2. **Citric acid in AHA class** — caused false positives on virtually every K-beauty product (citric acid appears in most as a pH buffer at concentrations way below AHA-active thresholds). Removed from AHA class with documented rationale. If a product actually features citric acid as an active exfoliator, Yuri catches it via substance-level reasoning when the user asks.
    3. **Fragrance auto-extracted as global decision_memory exclusion** — Bailey's actual entry "Skip Medicube Zero Pore Blackhead Cleansing Oil due to astringent oils and fragrance" caused the substance extractor to flag `fragrance` as a global skip-substance. Result: Anua Heartleaf Cleansing Oil — the exact cleanser Yuri herself recommended Bailey switch to in the same decision_memory thread — got falsely skipped because it contains fragrance. Added fragrance/parfum/perfume/aroma to NEVER_EXCLUDE_SUBSTANCES with explicit rationale: fragrance avoidance belongs on declared allergies (explicit user signal), not inferred from context-specific decision_memory mentions where Yuri may be describing one product's flaws rather than a global rule.
  - **Verification against Bailey's actual data** (`scripts/verify-curation-v10-8-2.ts`):
    - 20 category-level exclusions correctly extracted from her decision_memory + watch_for (vs 0 in v10.8.1)
    - 8-product spot check: 5 correct SKIPs (Aloe BHA Toner, COSRX AHA-BHA Toner, Theracne Spot Treatment, Invisible Peeling Booster, Mugener Ampule), 3 correct FITS (Red Blemish Cica Recovery Cream, Aqua Soothing Gel Cream, Anua Heartleaf Cleansing Oil — her newly-chosen cleanser), 0 false positives, 0 false negatives
    - Each skip card now has category_conflict chips with phrases pulled directly from Bailey's own Yuri text ("BHA already at protocol cadence", "no new active products this phase", "no acid stacking", "no additional vitamin C ampoule")
  - **Cache invalidation**: `CURATION_LOGIC_VERSION` bumped from `v10.8.1` to `v10.8.2`, so any reasoning cached by v10.8.1's filter (which would have wrong matched_items shapes) automatically becomes no-match on Bailey's next /browse load. Pattern 4 structural encoding is doing its job.
  - **AI-First compliance maintained**: Layer 1.5 is structural data extraction from Yuri's own writing, exactly like Layer 1 — same clause-level exclusion-intent gate, same NEVER_EXCLUDE allowlist principle, no rule engine. The `CATEGORY_SIGNAL_PATTERNS` map only ever produces an exclusion when Yuri's text said something like "stacking acids" or "no more actives" with exclusion intent. If her text doesn't say it, the category isn't blocked. The Opus reasoning prompt is updated as a creative brief addition (one paragraph + 3 voice examples), not a template. No "Yuri Certified" branding anywhere; the new chips are observational ("BHA already at protocol cadence", with the source text from her own Yuri conversations).
  - **Files modified**: `src/lib/intelligence/product-curation.ts` (CurationContext + MatchedItem types extended, CATEGORY_SIGNAL_PATTERNS + INGREDIENT_CLASS_MEMBERSHIP added, extractExcludedCategoriesFromText + collectDecisionMemoryTextBlocks added, buildCurationContext extended, applyPhaseFilter extended with category/class checks + directional substring match, buildCurationSystemPrompt extended with category_conflict guidance, NEVER_EXCLUDE_SUBSTANCES extended with fragrance/parfum/perfume/aroma, CURATION_LOGIC_VERSION bumped), `src/app/api/products/curated/route.ts` (candidate query now selects category + name_en, builds productCategories + productNames maps, passes to applyPhaseFilter), `src/app/api/products/curated/[id]/reasoning/route.ts` (passes product category + name to applyPhaseFilter)
  - **Files created**: `scripts/verify-curation-v10-8-2.ts` (extended verification harness with 8 spot-check products)
  - **Build verified**: `tsc --noEmit` clean, `next build` clean
- v10.8.1 (May 23, 2026): Path B substance-extractor hotfix
  - **Triggered**: pre-Bailey QA same evening as v10.8.0 ship. Scott logged into Bailey's account to verify /browse before sending her the iMessage. Header rendered correctly, fits/skip split looked sane on count, but expanding the skip toggle revealed false-positive chips on every card — Red Blemish Cica Cream flagged for "asiatic acid" (Yuri uses centella regularly), Real Cica Micellar flagged for "gluconolactone + lactobionic acid + panthenol + asiatic acid" (Yuri explicitly named gluconolactone and lactobionic as her future Phase 3 PHAs). Investigation confirmed the extractor was flipping Yuri's recommendations into exclusions on the curation surface.
  - **Root cause**: `extractExcludedSubstancesFromDecisionMemory()` in v10.8.0 was ported from v10.3.6's `getMissingHighValueIngredients` keyword-set without recognizing that the failure modes were inverted. In the original (recommendation-candidate filter), false positives = fewer recommendations = invisible. In the curation skip-list generator, false positives = wrong "Yuri would skip" chips = visible Yuri-voice misrepresentation. The algorithm tokenized any decision_memory entry containing a phase-marker keyword ("skip", "phase 2", "phase 3", "defer", "until") and added every 3+ char word as an "excluded substance" — so Bailey's *"If needed in Phase 3 or 4 for textural PIH marks, would use gentle PHA (gluconolactone or lactobionic acid) instead of glycolic"* tokenized into exclusions for gluconolactone, lactobionic, glycolic, pha. Same bug class against watch_for: tokenizing "PIH/PIE marks on chin from picking" added "marks", "danger", "fitzpatrick" as substance tokens.
  - **Fix in `src/lib/intelligence/product-curation.ts`** (3 surgical changes):
    1. Rewrote the extractor as structured exclusion-intent parsing. Only considers decision_memory entries whose `decision`/`truth` field contains an exclusion verb at clause level (`not adding`, `skip`, `avoid`, `reject`, `discontinued`, `holding off`, `replacing X with Y`, etc.). Substance extraction uses a known-substance dictionary loaded lazily from `ss_ingredients` (~5-min TTL), not tokenize-everything. The "replacing X with Y" idiom now correctly extracts X only (the substance being removed) and explicitly skips Y (the recommended replacement) — Yuri uses this constantly ("Replacing Medicube PDRN with Isntree Yam Root") and v10.8.0 was flagging both.
    2. Added `NEVER_EXCLUDE_SUBSTANCES` allowlist as defense-in-depth: ubiquitous + barrier-safe ingredients (glycerin, hyaluronic acid, sodium hyaluronate, panthenol, vitamin e / tocopherol, asiatic acid, madecassoside, centella, gluconolactone, lactobionic acid, beta-glucan, niacinamide, water, ceramide, schisandra, rice extract, snail mucin, propolis, ginseng, common emollients, silicones, preservatives) can never become excluded even if the parser thinks they should.
    3. Same exclusion-intent gate applied to watch_for items at context-build time. Pre-extracted `watchForExcludedSubstances` array replaces v10.8.0's per-product tokenize-watch_for-phrase logic. Most watch_for items are observational and now correctly produce zero substance exclusions, with Layer 2 (Opus reasoning) carrying any nuance that requires phase-aware judgment.
  - **Cache invalidation** (Pattern 4 structural encoding): added `CURATION_LOGIC_VERSION = 'v10.8.1'` constant included in `computeCacheKeyHash()` payload. Future extractor changes can bump the constant to auto-invalidate every cached row across all users without manual cleanup. The v10.8.0-stale wrong cached reasoning Bailey may have generated during testing automatically becomes no-match on her next /browse load.
  - **Verification**: new script `scripts/verify-curation-v10-8-1.ts` runs the full extractor + filter against Bailey's actual decision_memory. Pre-fix produced ~50+ false-positive exclusions; post-fix produces **3 real exclusions** — `fragrance` (correct: Yuri flagged Zero Pore Oil for "astringent oils and fragrance"), `vitamin c` (correct: Glass Skin rejection of "additional Vitamin C ampoule" — Bailey already has Goodal Vita C), `glycolic acid` (correct: "Not adding glycolic acid — stacking acids would risk PIH"). Watch_for exclusions: 0 (correct — her watch_for items are observational). Spot check against 5 products that v10.8.0 wrongly skipped: all 5 now verdict as `fits` or `neutral` with no false chips.
  - **What's NOT addressed in this hotfix** (intentional): products containing BHA still currently land in `fits` for Bailey even though her decision_memory says "already using BHA 3x/week, stacking acids would risk PIH." The strict substance extractor only catches `glycolic acid` (since that's the literal word she rejected); it doesn't catch the higher-order "already running enough actives" judgment that would skip another BHA product. That category-level reasoning is the explicit responsibility of Layer 2 (Opus per-product reasoning when subscriber expands the skip toggle, OR Yuri chat from the per-card Ask Yuri CTA). The Layer 1 filter is correctly bounded to substance-level conflicts.
  - **Pre-Bailey QA discipline encoded**: this hotfix existed because of a pre-deploy QA pass that almost didn't happen — `tsc --noEmit` and `next build` both passed clean on v10.8.0, but neither caught "the substance-extractor produces token soup against this real user's data." Future curation surface changes should run `scripts/verify-curation-v10-8-1.ts` against Bailey's account before deploy, same way the Olive Young scraper has its smoke test and BP76 has its end-to-end pass.
  - **Files modified**: `src/lib/intelligence/product-curation.ts` (extractor rewrite, NEVER_EXCLUDE allowlist, watch_for pre-extraction, cache version salt)
  - **Files created**: `scripts/verify-curation-v10-8-1.ts` (verification harness)
  - **Build verified**: `tsc --noEmit` clean, `next build` clean
- v10.8.0 (May 22, 2026): Path B — Products as Yuri's Shortlist
  - **Origin**: Bailey iMessage thread May 20-22 2026. She told Scott she loves the Ingredients feature but doesn't like the Products feature, and floated hiding /browse from paying subscribers entirely. Scott's iMessage May 20 8:04 PM proposed an alternative: subscriber searches a product, only products Yuri thinks fit their profile/phase display, with a toggle revealing products Yuri would skip plus her per-product reasoning. Bailey May 22 1:31 PM: *"Hmmmm I do like that better than the current way at least."* Deep multi-agent audit May 22 confirmed her instinct is right.
  - **What the audit found**: /browse's "For You" sort button and "Loved by Combination Skin" carousel ranked products by `ss_ingredient_effectiveness` × skin type with ZERO awareness of her active treatment phase, decision memory exclusions, or current routine. Structurally identical to the five prior Yuri Sole Authority Principle violations Bailey has caught (v10.5.2 Routine Intelligence widget, v10.6.2 weather + cycle widgets, v10.7.1 Glass Skin Recommendations panel + Dashboard "Yuri's Insights" widget). Sixth instance was waiting to be earned. Caught in proactive sweep (v10.7.1 discipline) before Bailey reached it.
  - **Architecture — two layers**: Path B documented in full at `PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md` at repo root.
    - **Layer 1 — Deterministic SQL/JS structural filter** (`src/lib/intelligence/product-curation.ts` `applyPhaseFilter()`): splits candidates into `fits` and `skipped` based on three structural checks against user state: (a) any product ingredient name substring-matching a declared allergen from `ss_user_profiles.allergies`, (b) any product ingredient substring-matching a substance flagged in a recent `decision_memory` entry that contains v10.3.6 phase-marker keywords (skip/defer/phase 2/pause/until/etc. — same 22 keywords already proven on `getMissingHighValueIngredients`), (c) any product ingredient overlapping the active treatment phase `watch_for` JSONB items. Pure data filtering, no AI, no rule engine, no quality judgment.
    - **Layer 2 — On-demand Opus 4.7 reasoning** (`src/lib/intelligence/product-curation.ts` `generateReasoning()`): when a subscriber expands "Why Yuri would skip this" on a specific card, lazy-fetches `/api/products/curated/[id]/reasoning` which calls Opus 4.7 with a creative brief (Yuri's voice anchors + hard constraints + product INCI + her state + structural verdict). Returns 2-3 sentences in Yuri's voice articulating the specific match. JSON envelope contract, NOT a template — Opus articulates naturally within the brief.
  - **Cache architecture** (new `ss_product_curation_reasoning` table): rows keyed by `(user_id, product_id, cache_key_hash)` where the hash is a deterministic sha256 over the load-bearing user state (skin_type + allergies + active_phase.id + watch_for + excluded_substances). When her state changes meaningfully, the hash changes, the row stops matching, and the next expansion triggers fresh Opus generation against the new state. 60-day soft TTL guards against reformulation drift (same age-aware discipline as Phase 15.4 corrections rendering). UNIQUE constraint on (user_id, product_id, cache_key_hash). RLS: service-role writes, user reads own.
  - **Cost projection**: ~$0.011-0.016 per Opus generation × 30 fresh reasonings/month × 80% cache hit rate = **~$0.40/subscriber/month**. Against $35.88 Pro margin, negligible. At 100 subscribers: ~$40/month total. Layer 1 (browse view) is $0 — pure SQL. "Ask Yuri about this" per-card buttons are pure static `<Link>` elements with `?ask=` prefill URLs, zero AI cost; only fire Opus if the subscriber clicks through to /yuri (which would be a normal Yuri chat session at the same rate as any other entry point).
  - **Opus 4.7 over Sonnet 4.5** (Scott's May 22 decision, Principle 1): the draft proposed Sonnet on a bounded-task argument similar to `decision_extraction` / `summary_generation`. Scott overrode: *"Claude Opus 4.7 now. Let's provide the best possible experience possible."* Voice consistency between /browse skip reasoning and /yuri chat matters more than the ~$0.10/sub/month delta over Sonnet. Same Principle 1 maximalism as the v10.1.0 Opus migration. Documented in `PRODUCT_CURATION_REASONING` context in `ai-config.ts`.
  - **Killed in /browse**: the "For You" sort button (algorithmic ingredient-effectiveness rank, zero phase awareness — Yuri Sole Authority violation), the "Loved by [SkinType] skin" horizontal carousel (same rank, different UI shape), the "Sorted by ingredient effectiveness for your skin type" indicator label. All three removed from `src/app/(app)/browse/page.tsx`. `ProductFilters.tsx` no longer renders the `For You` button or the sort row (sort is curated by default). `SORT_OPTIONS` constant deleted. `Sparkles` icon import removed from filters. `sortBy` + `onSortChange` props retained for backward compat but documented as unused.
  - **Preserved (NOT modified)**: public `/products` page (SEO/AI-discoverability landing page for anonymous visitors stays as-is), public `/products/[id]` detail page (already v10.7.0 Phase G compliant), `/api/products` endpoint (other consumers may use it), `/api/products/discovery` endpoint (other consumers may use it), AppShell `SHARED_FALLBACKS` (continues routing non-subscribers from /browse → /products with query params preserved per v10.6.3 behavior).
  - **AI-First compliance audit performed BEFORE and AFTER build** per Bailey-earned discipline: (1) **P1 Most Powerful Model** — Opus 4.7 throughout, Scott's explicit call. (2) **P2 AI-First Reasoning** — Layer 1 is structural data filtering, NOT a rule engine; Opus prompt is a creative brief, NOT a template; `extractExcludedSubstancesFromDecisionMemory` is keyword detection for STRUCTURAL DATA EXTRACTION (parsing Yuri's own decision_memory writes), explicitly NOT product-quality judgment. (3) **P3 Moat Through Learning** — cache invalidation closes the loop (corrections drive cleanup, per Principle 3 closure); `matched_items` JSONB on every reasoning row creates a future signal for cross-user learning. (4) **P4 Perception Before Information** — browse page header acknowledges user state ("Filtered against your Phase 2 — Active Treatment protocol") BEFORE rendering the catalog; per-product Yuri CTA carries phase context in the prefill so the conversation lands without re-explanation. (5) **Yuri Sole Authority Principle** — no "Yuri Certified" / "Yuri's Picks" branding anywhere; surface labels are observational ("filtered against your protocol", "Why Yuri would skip this"); the single recommendation surface in Seoul Sister remains Yuri's chat.
  - **Telemetry** wired into `ss_ai_usage` with three new feature codes added to the `AIFeature` union: `product_curation_reasoning` (logs every fresh Opus generation with model), `curated_browse_view` (logs every /api/products/curated GET — leading indicator: are subscribers using the curated view at all), `skip_reasoning_expanded` (logs every /api/products/curated/[id]/reasoning GET with `was_cached` — the key metric is **expansion rate** = % of curated browse sessions that expand at least one skip reasoning). Threshold to watch: if expansion rate > 30% after a month, the educational toggle is working. If < 10%, Path A (hide /browse entirely for subs, redirect to Yuri) becomes the next call. Both events fire-and-forget via v10.3.5 audit pattern (`.catch(() => {})` guards never break the response stream).
  - **Skip toggle behavior**: default collapsed per Scott's May 22 decision. Header reads "Show products Yuri would skip (N)" with hint "Click to see what conflicts with your protocol." When expanded, renders all skipped products with `showSkipReasoning={true}`, each card with `<SkipReasoning>` lazy expander. First expansion triggers Opus generation (~1-2s loading shimmer). Subsequent expansions on the same card use component-local state. Same-card re-expand after cache write hits cache.
  - **UI rewrite scope**: `src/app/(app)/browse/page.tsx` rewritten end-to-end (367 → ~330 lines). New components: `src/components/products/CuratedProductCard.tsx` (wraps `ProductCard` with per-card Ask-Yuri CTA + optional `SkipReasoning` expander) and `src/components/products/SkipReasoning.tsx` (lazy expander with matched-items chips + loading shimmer + error states). `ProductFilters.tsx` trimmed: removed "For You" button + sort row, kept search/category/ingredient picker.
  - **Architecture document**: `PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md` at repo root captures origin, philosophical commitment, two-layer architecture, cost projection, database schema, code changes, system prompts, UI behavior, kills, telemetry plan, AI-First pre-build audit, build order, and resolution of the Sonnet-vs-Opus open question per Scott's decision.
  - **Files created**: `supabase/migrations/20260522000001_add_product_curation_reasoning.sql`, `src/lib/intelligence/product-curation.ts` (~420 lines — slightly over the 200-300 target, but cohesive; splitting would create artificial seams, documented inline), `src/app/api/products/curated/route.ts`, `src/app/api/products/curated/[id]/reasoning/route.ts`, `src/components/products/CuratedProductCard.tsx`, `src/components/products/SkipReasoning.tsx`, `PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md`
  - **Files modified**: `src/lib/ai-config.ts` (`PRODUCT_CURATION_REASONING` context added), `src/lib/ai-usage-logger.ts` (3 new feature codes), `src/app/(app)/browse/page.tsx` (rewrite), `src/components/products/ProductFilters.tsx` (For You button + sort row removed)
  - **Files NOT modified** (verified clean diff): `src/app/products/page.tsx`, `src/app/products/[id]/page.tsx`, `src/lib/yuri/tools.ts`, `src/lib/yuri/advisor.ts` — public products SEO surface and Yuri's chat substrate both preserved.
  - **Migration apply**: Supabase MCP is read-only in this environment. The migration file is committed at `supabase/migrations/20260522000001_add_product_curation_reasoning.sql` and must be applied manually via the Supabase Studio SQL editor (same workflow as Phase 13.D / v10.6.0 and Phase 13.H / v10.6.5).
  - **Build verified**: `tsc --noEmit` clean, `next build` clean — `/api/products/curated (ƒ Dynamic)` + `/api/products/curated/[id]/reasoning (ƒ Dynamic)` both registered; /browse rendered as static page at 10.1 kB.
- v10.7.5 (May 20, 2026): BP76 resolver follow-up — Strategy 1.5 stop-word + punctuation gaps
  - **Origin**: After Scott shipped commit 57695e8 (the v10.7.4 BP76 Strategy 1.5 brand-prefix composite lookup that closed the LGAAS e2e Stage 4 gap), the LGAAS-side BP76 integration finished Phase 2/3. Before lifting the glass_skin_atx pipeline pause, I ran a focused canary check on the resolver — 16 real-world product queries covering Bailey's library brands, multi-word brand names ("Beauty of Joseon", "Some By Mi", "Round Lab"), brand-prefixed variants ("COSRX BHA Blackhead Power Liquid", "Torriden Dive-In..."), bare names, brand-only probes, and garbage queries. 14/16 passed. Two real BP76-class gaps surfaced — both production-relevant because AriaStar drafts use brand marketing names this way routinely.
  - **Gap 1 — Stop words in brand candidates** (`smartProductSearch`): Query "Beauty of Joseon Glow Deep Serum" tokenized to `["beauty", "joseon", "glow", "deep", "serum"]` because "of" is in SEARCH_STOP_WORDS. Strategy 1.5's 3-token brand candidate reconstructed as "beauty joseon" — but the catalog row's `brand_en = "Beauty of Joseon"` doesn't ILIKE-match "%beauty joseon%" because "of" is part of the brand. Same class of failure would have affected "Some By Mi" (luckily "by" is in stop-words AND its catalog row brand_en = "Some By Mi" so the 3-token reconstruction got lucky; if "by" weren't there it would have failed). Identified shape: stop-word filtering is correct for noisy name-side ILIKE predicates ("the cream for sensitive skin" shouldn't ILIKE every name_en with "for" / "the") but wrong for brand-name reconstruction.
  - **Gap 2 — Punctuation in query tokens** (`smartProductSearch` + `resolveProductByName`): Query "Torriden Dive-In Low Molecular Hyaluronic Acid Toner" tokenized with hyphen preserved → `name_en ILIKE %dive-in%` failed against catalog's unhyphenated "Dive In Low Molecular Hyaluronic Acid Toner". Same shape applies to em-dashes, slashes, underscores, dots — punctuation users / Claude / marketing copy add to product names but catalog storage doesn't preserve. Additionally surfaced a downstream effect: even if Strategy 1.5 returned the correct row (which it didn't here because of the ILIKE mismatch), `resolveProductByName`'s post-filter would then reject it because `terms.every(t => combined.includes(t))` with "dive-in" as a term doesn't match "torriden dive in low...".
  - **Two-part fix** (`src/lib/yuri/tools.ts`, ~30 net lines):
    - `smartProductSearch` now derives both `originalTokens` (punctuation-normalized, stop-words preserved) and `terms` (stop-words + short tokens filtered). Strategy 1.5's brand candidate uses `originalTokens.slice(0, brandTokenCount).join(' ')` — preserves "of", "by", "and" in brand reconstructions. nameTerms continue to filter stop-words AFTER taking originalTokens.slice(brandTokenCount), so we avoid noisy `name_en ILIKE %the%` / `%of%` predicates but preserve meaningful brand-internal stop words.
    - `resolveProductByName` applies the same `[-/_.]+` → space normalization to BOTH the query (`queryNormalized`) and the combined brand+name for post-filtering (`combinedNormalized`). The match_quality classifier now tries exact-match against normalized strings FIRST (so "Torriden Dive-In" query matches "Torriden Dive In" catalog as 'exact', not 'partial' that gets nulled by strict resolver).
  - **Architectural property preserved**: The fix is additive on input-side normalization. All downstream invariants — `resolveProductByName`'s ALL-terms filter, the length-tiebreaker sort, the match_quality classification, the strict resolver's null-on-'partial' gate — continue to operate exactly as before. So Yuri's write-path safety guarantees from v10.7.0 Phase A.3 (`mark_product_reaction`, `clear_product_reaction`, `save_routine`, `update_user_product`) remain intact. Strategy 1.5 results that pass the new normalized ALL-terms filter classify as 'all_terms' or 'exact' by definition — never 'partial'. So the strict resolver still won't substitute a wrong product onto a write call.
  - **Verification**: Canary 14/16 → 16/16. BP76 smoke test still 16/16 (no regression). `tsc --noEmit` clean. `next build` clean. Verified directly against live catalog: "Beauty of Joseon Glow Deep Serum" → resolves to "Beauty of Joseon — Glow Deep Serum: Rice + Alpha-Arbutin". "Torriden Dive-In Low Molecular Hyaluronic Acid Toner" → resolves to "Torriden — Dive In Low Molecular Hyaluronic Acid Toner". Off-target probes ("NonExistentBrand Magical Cream", "fake product 9999") still return null. Short brand+token query "COSRX BHA" still resolves to "COSRX — BHA Blackhead Power Liquid".
  - **Why this matters for BP76 production**: LGAAS-side extractor produces product names from AriaStar drafts. AriaStar writes "Beauty of Joseon Glow Deep Serum" and "Torriden Dive-In" the way they're marketed. v10.7.4's Strategy 1.5 surfaced previously-missed brand-prefixed matches, but had hidden coverage gaps for the two most common shapes K-beauty marketing uses (multi-word brand names with internal "of"/"by", and hyphenated product names). v10.7.5 closes both. With this fix the LGAAS-side `extractUserConstraints` → SS-side `/api/lgaas/ingredient-check` pipeline correctly resolves the full vocabulary of how AriaStar references products.
  - **AI-First**: No new rule engines. The fix is two regex normalizations and a token-array rename. Punctuation normalization replaces hyphens with spaces — that's a single regex, not a per-character lookup table. Stop-word preservation for brand candidates is a one-line slice from a different array, not a curated brand-prefix whitelist. Both fixes are structural (operate on input normalization) rather than additive (no new strategies, no new heuristics). Future Korean punctuation patterns (em-dashes, full-width characters, Korean particles) can extend the regex without new code paths.
  - **Files modified**: `src/lib/yuri/tools.ts` (smartProductSearch + resolveProductByName, ~30 net lines added), `scripts/canary-resolver-bp76.ts` (new canary test script), `CLAUDE.md` (version header + this changelog entry). Helper script `scripts/diagnose-torriden.ts` added for future debugging of resolver edge cases.
  - **glass_skin_atx pipeline status**: Per LGAAS-side notes earlier tonight, full BP76 protection is now end-to-end (constraint extraction → cross-check → bounded retry → dashboard surfacing). With this resolver fix the SS-side endpoint correctly resolves the names AriaStar produces. Pipeline pause can be lifted whenever you green-light it.
- v10.7.4 (May 20, 2026): Blueprint 76 SS-side endpoint — POST /api/lgaas/ingredient-check + shared ingredient-match library
  - **Origin**: Earlier this evening Scott pulled up an LGAAS-generated Reddit draft for an r/KoreanBeauty post by u/varm-t titled "Skincare help". The OP explicitly wrote: *"my skin tends to not agree with niacinamide."* The draft, scored 92% match / 4.19 avg / TOP PICK, recommended COSRX BHA Blackhead Power Liquid and Some By Mi AHA-BHA-PHA Toner. Both products list Niacinamide at INCI position 4 and 5 respectively (~2-5% active concentration, verified via catalog query against `ss_products.ingredients_raw`). The draft's OPENING SENTENCE acknowledged "niacinamide-reactive" — then recommended two niacinamide-prominent products one sentence later. Not a model failure of attention; an architectural gap where the user-stated constraint never got encoded as a hard filter on the recommendation set.
  - **Blueprint 76 reconciliation note**: Drafted this evening as Blueprint 75 in the LGAAS folder, then collided with a different LGAAS-side Blueprint 75 that shipped earlier the same day (Kristy Cooper authority-signal restoration). LGAAS session renumbered our file to BP76 in the lgaas-blueprint folder with a front-matter reconciliation note + LGAAS-side regression-risk check. Their git log of Reddit-pipeline files (api/reddit-response.js, api/reddit-reply-tracker.js, utils/reddit-batch-evaluator.js, utils/reddit-domain-fit.js, utils/ingredient-context.js, utils/reddit-product-grounding.js) for the past 7 days confirmed: only two commits (e85e125 BP74 domain-fit gate, 8720c6e BP74 telemetry persistence). Neither touched ingredient grounding. Blueprint 44 / 44.1 / 44.1.1 (product → ingredient verification) is intact. **Not a regression — structural gap that was always there. The u/varm-t niacinamide case is the first highly visible failure.**
  - **What ships in this release (SS side only)**: The blueprint requires coordinated SS + LGAAS work. This commit covers the SS side; LGAAS-side integration (extractUserConstraints + HTTP client + Surface-Facts builder + regeneration loop) ships separately in their repo per `lgaas/lgaas-blueprint/76-IMPLEMENTATION-PLAN.md`.
  - **Item 1 — Shared ingredient-match library** (`src/lib/intelligence/ingredient-match.ts`, ~200 lines): Pure-function module with no Supabase client, no HTTP, no auth — just primitives the LGAAS endpoint AND Yuri's existing `check_ingredient_conflicts` tool can both use. Three architectural pieces: (a) **INGREDIENT_SYNONYMS map** keyed INCI-canonical → colloquial aliases (niacinamide ↔ nicotinamide / vitamin b3, salicylic acid ↔ BHA / Betaine Salicylate / Willow Bark, hyaluronic acid ↔ HA / sodium hyaluronate / hydrolyzed HA, fragrance ↔ parfum / perfume / aroma, etc.). Conservative addition policy — only adds aliases that are unambiguously the same molecule. Vitamin C family kept intentionally split (ascorbic acid / ethyl ascorbic acid / MAP / SAP / ascorbyl glucoside / THDA) because users distinguish between forms. Retinoid family same (retinol / retinal / retinoic acid / bakuchiol). (b) **parseInciString** with parenthetical alternate handling ("Water (Aqua)" → both forms at same position), ppm-annotation stripping ("Niacinamide (5,000 ppm)" → name = Niacinamide), Olive Young bundle marker truncation ("[Special Gift]" / "[Original Product]" cutoffs so bundle gifts don't pollute the primary product's INCI position calc). (c) **estimateConcentrationFromPosition** heuristic — position 1-3 = 5-15%, 4-5 = 2-5%, 6-10 = 0.5-2%, 11+ = <0.5%. Returns ranges, not exact values, because INCI ordering is only concentration-descending above 1%. Decision authority: LGAAS spec §3 question #5 — "extract a shared internal function so both call sites benefit from the same synonym map, fuzzy matching, INCI position logic."
  - **Item 2 — POST /api/lgaas/ingredient-check endpoint** (`src/app/api/lgaas/ingredient-check/route.ts`): Auth via X-LGAAS-API-Key header matching existing /api/admin/products/search and /api/admin/products/prices pattern exactly (LGAAS_INGEST_API_KEY env var). Zod-validated request schema: product_names (1-20) + constraints (1-20) where each constraint has type / substance / supporting_quote. Constraint type enum mirrors Yuri's v10.7.0 Phase D conservative extraction discipline — every constraint requires a `supporting_quote` field, no inferred constraints. Endpoint uses `resolveProductByNameStrict` from yuri/tools.ts (never silently substitutes a different product onto a constraint check — false positives erode trust as fast as false negatives, same Bailey-tested pattern from v10.7.0 Phase A.3). Unresolved products returned in `products_unresolved` array so LGAAS side can decide what to do (typically pass-through as "user has unspecified reactions to: X"). Response includes execution_time_ms for monitoring. Target <100ms p99 per LGAAS spec.
  - **Item 3 — Smoke test against u/varm-t case** (`scripts/smoke-test-bp76.ts`): 16 tests covering synonym resolution (3), INCI parsing (2), concentration estimation (6), the u/varm-t trigger case end-to-end against live catalog (2 — COSRX BHA at position 4, Some By Mi at position 5), the negative case (1 — Anua BHA 2% correctly returns null for niacinamide), synonym resolution end-to-end (1 — "vitamin b3" resolves to niacinamide and finds the same match), BHA family synonym (1 — "salicylic acid" constraint resolves Betaine Salicylate via the BHA synonym map). **All 16 pass.** Run with `npx tsx --tsconfig tsconfig.json scripts/smoke-test-bp76.ts`.
  - **One observation worth flagging for LGAAS coordination**: The BHA synonym map currently includes "willow bark" and "salix alba" as aliases for salicylic acid (because willow bark contains natural salicylates — that's correct K-beauty practice). When a constraint targets "salicylic acid" against COSRX BHA, the matcher finds Salix Alba (Willow) Bark Water at position 1 BEFORE finding Betaine Salicylate at position 4. The position-1 match is technically correct (willow bark IS a salicylate source) but could mislead concentration estimates. Worth noting in BP76 §10.5 so the LGAAS-side constraint extractor doesn't over-flag willow-bark-only products as BHA conflicts. Not blocking.
  - **AI-First compliance**: Zero rule engines in the endpoint. The constraint EXTRACTION (Sonnet 4.5 with supporting_quote gates) lives on the LGAAS side per their plan §2. The SS side is pure data verification — no AI calls, no templates, no inference. Matches the Blueprint 74 pattern exactly: verifiable data outside the prompt, force regeneration on conflict, fail loud not silent.
  - **Cost**: Zero per call. Pure DB query (1 SELECT per resolved product) plus in-memory substring scan. Smoke test execution times against live DB: 50-200ms typical, dominated by Supabase network latency. Within the 2-second LGAAS-side timeout decision per their spec §3 question #4.
  - **Coordination next steps**: Drop §10.5 notes into `lgaas/lgaas-blueprint/76-IMPLEMENTATION-PLAN.md` with production URL + env var name + synonym map decisions so the LGAAS session can wire their side. Pipeline pause on glass_skin_atx continues until LGAAS-side integration ships and e2e tests pass.
  - **Files created**: `src/lib/intelligence/ingredient-match.ts`, `src/app/api/lgaas/ingredient-check/route.ts`, `scripts/smoke-test-bp76.ts`
  - **Files modified**: `CLAUDE.md` (version header + this changelog entry)
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean. Endpoint registers as `/api/lgaas/ingredient-check (ƒ Dynamic)`.
- v10.7.3 (May 20, 2026): Heat Check polish — grounded the defensive pause in concrete tool action
  - **Origin**: P3.3 from the v10.7.2 audit. The audit identified it as a polish item ("ground the Heat Check defensive pause in a concrete tool action, not just a verbal hedge") but I'd technically omitted it from the recommended fix table Scott authorized. Scott surfaced the gap directly: "you had mentioned some polish work earlier, did that get shipped?" — review showed 3 of 4 P3 items hadn't shipped, P3.3 was the most defensible to ship now (the other two — specialist prompts mentioning /library and the hardcoded "6 specialist agents" count — were deferred deliberately). Honest acknowledgment of the gap, then shipped.
  - **The pattern problem**: Heat Check (v10.3.0, load-bearing — handles user anger/accusation toward a third party like a brand, derm, influencer, or retailer) tells Yuri to ask ONE clarifying question BEFORE engaging substantively. The three existing example prompts were all verbal pauses: "what does the packaging look like?", "when did you buy it?", "can you screenshot the ingredient list?". All good as conversational moves, but none of them grounded the conversation in catalog data. When a user has cited concrete evidence (an INCI list, a batch code, a screenshot of a label), the catalog is the cheapest, most decisive piece of counter-evidence — reformulations, regional variants, and counterfeits ALL show up there. The verbal pause asks the user for more information; the tool call brings authoritative data to the table.
  - **Fix** (`src/lib/yuri/advisor.ts` Heat Check section): Added a fourth example to the verbal-pause list: *"Hold on — before we go after them, let me pull what's actually in our catalog for this product so we're comparing real INCI lists."* Includes an inline parenthetical telling Yuri to call get_product_details with the product name, then compare catalog ingredients against what the user is citing. Plus a new paragraph after the examples block naming the broader pattern: *"verbal pause + tool verification beats verbal pause alone. When the user has cited concrete evidence (an INCI list, a batch code, a screenshot, a price), the highest-trust move is to ground the conversation in catalog data BEFORE engaging with the accusation. get_product_details, compare_prices, and get_ingredient_guide are your three 'let me check what we actually have' tools. Use them."* Names the three catalog-verification tools so Yuri can pick the right one based on what kind of evidence the user cited.
  - **AI-First**: This is one example added to an existing creative-brief example list, plus one connecting paragraph. Zero rule engines. Zero templates. No "if user mentions X then call Y" — just teaches the pattern (verbal pause → tool grounding) and lets Opus pick the right tool for the evidence type. Matches the existing Heat Check structure (which gives 3 verbal-pause examples and trusts Opus to adapt to the specific situation, not hardcode a regex over user input).
  - **Token impact**: Net +200 chars (~50 tokens). Small enough not to warrant offsetting cuts.
  - **What was NOT shipped**: P3.1 (Library + Skin Profile in "How Everything Connects") shipped in v10.7.2 Item 8. P3.2 (specialist prompts don't mention /library, /skin-profile) — deferred deliberately, specialists inherit the main Reference table via prompt layering so the risk was theoretical. P3.4 ("6 specialist agents" hardcoded count) — deferred deliberately, adding/removing a specialist is a code change that surfaces this line in code review anyway.
  - **Build verified**: `tsc --noEmit` passes clean. Skipped `next build` — this is a single-string change inside a template literal with no schema or component touched, and v10.7.2 already verified the full build pipeline two commits ago.
  - **Files modified**: `src/lib/yuri/advisor.ts` (Heat Check section — added one example + one paragraph), `CLAUDE.md` (version header + this changelog entry).
- v10.7.2 (May 20, 2026): Yuri feature-knowledge audit — eleven prompt updates synced against current app state
  - **Origin**: Audit requested by Scott to sync Yuri's system prompt, all 6 specialist prompts, and the anonymous-visitor widget prompt against twenty-five releases worth of app changes since the last documented feature-knowledge update (v8.5.0, Feb 25). The gap had widened to the point where Yuri was confidently citing stale product counts, pointing subscribers to the wrong Products URL (/products is the public marketing surface, /browse is the subscriber browser — v10.6.3 fixed Bailey's bug where subscribers got leaked to marketing), describing a tool count of 14 when the YURI_TOOLS array had grown to 16, and was completely unaware of `/library` (v10.6.5) and the subscriber For You enrichment on `/ingredients/[slug]` (v10.6.4) and the subscriber intelligence panel on `/products/[id]` (v10.7.0 Phase G).
  - **Process**: Read-only audit pass first — enumerated every route under `src/app/(app)/` and `src/app/`, read all 16 tool definitions in YURI_TOOLS, read the WIDGET_TOOL_NAMES subset (5 tools), read all 6 specialist prompts, read YURI_WIDGET_SYSTEM, queried live Supabase for current counts (5,917 products / 14,845 ingredients / 229,135 links / 4,957 with prices / 567 brands / 87 Olive Young trending / 197 Reddit trending / 211 effectiveness rows — vs prompt's stale "5,800+ / 14,400+ / 207,000+ / 5,000+ / 565 / 87 / 141 / 68"). Cross-referenced against CLAUDE.md changelog v8.5.0→v10.7.1 and BAILEY-FEEDBACK-LOG.md. Produced written audit with P0/P1/P2/P3 severity buckets and AI-First fix recommendations, awaited Scott's authorization, then executed.
  - **Item 1 — Dropped hardcoded "14 tools" count** (`advisor.ts`): The `## Tools` section opened with *"You have 14 tools..."* but YURI_TOOLS has 16 (search_products, get_product_details, check_ingredient_conflicts, get_trending_products, compare_prices, get_personalized_match, get_ingredient_guide, web_search, get_current_weather, add_to_routine, remove_from_routine, update_user_product, mark_product_reaction, clear_product_reaction, get_routine_context, save_routine). Replaced with scope description: *"You have tools connected to Seoul Sister's database — product catalog, ingredient encyclopedia, live retailer pricing... the user's library and routines — plus web search and live weather."* Counts go stale every release; scope endures. Same AI-First principle as v8.3.0's prompt refactor.
  - **Item 2 — Renamed Products row to Browse + fixed path** (`advisor.ts` Reference table): Was `| Products | /products | 5,800+ products, ingredient include/exclude filters... |`. Subscriber nav uses `/browse` (Header.tsx:15) — `/products` is the public AI-discoverability target. v10.6.3 explicitly fixed the leakage where dashboard widgets routed subscribers to `/products` instead of `/browse`. New row: `| Browse | /browse | The subscriber product browser. Ingredient include/exclude filters, "recommended for your skin" sorting (effectiveness-weighted match against their profile), trending badges. This is where subscribers go to find products — NOT /products (which is the public marketing landing page). |` — explicitly teaches Yuri the distinction so she doesn't accidentally send subscribers to the SEO surface.
  - **Item 3 — Added Library row + Library Quick Reminder** (`advisor.ts` Reference table + Quick Reminders): `/library` (Phase 13.H, v10.6.5) is in the nav and is load-bearing — five sections (Owned with add/remove buttons, Saved = wishlist + scan history, In Routine with ownership-gap surfacing, Tagged Holy Grail / Broke Me Out with inline reaction toggles, Expiring color-coded by urgency). Yuri's prompt mentioned it ZERO times. Subscribers routinely arrive at /yuri *from* /library via the "Ask Yuri" CTA with prefilled context. New row placed directly after Skin Profile (paired consolidating views). Added Quick Reminder explaining that mark_product_reaction / clear_product_reaction tools let Yuri update Library tags from chat.
  - **Item 4 — Extended Ingredients row with subscriber For You panel** (`advisor.ts` Reference table): Phase 13.G (v10.6.4) shipped subscriber-aware ingredient enrichment — when an authenticated subscriber views `/ingredients/[slug]`, a "For You" panel renders below the public hero showing products they own containing that ingredient, effectiveness for their skin type, current treatment phase watch_for items, and an "Ask Yuri" CTA. Anonymous visitors see exactly the same public page. Row now includes this distinction so Yuri doesn't tell subscribers "the ingredients page just has general info" when actually it has personalized data for them. Also dropped the stale "14,400+" count.
  - **Item 5 — Replaced ### Database Intelligence bullet list with creative-brief paragraph** (`advisor.ts`): The bullet list had stale counts everywhere — "5,800+ products" (actually 5,917), "14,400+ ingredients" (14,845), "207,000+ links" (229,135), "68 ingredient effectiveness records" (actually 211 — 3x off), "141 Reddit trending products" (197). Effectiveness count was the worst — Yuri was telling subscribers she had "68 data-backed recommendations" when she had 3x that. Replaced the entire 6-bullet list with a single creative-brief paragraph describing scope ("thousands of products across hundreds of Korean brands, full INCI ingredient data on most, live retailer pricing... skin-type-tagged ingredient effectiveness data that grows as users contribute. Specific numbers shift daily — use your tools when a user wants concrete data."). NET token reduction. Future audits won't need to re-sync because there are no specific numbers to go stale.
  - **Item 6 — Softened /yuri row from pixel positions to capabilities** (`advisor.ts` Reference table): Was *"Clock icon (top-left) = conversation history. Hover any convo to rename (pencil) or delete (trash)..."* — fragile to UI re-skins. Rewrote to describe capabilities: *"Conversation history is accessible from the page header; conversations auto-save with AI-generated titles and can be renamed or deleted from the history list. The page also accepts an '?ask=' URL parameter for prefilled messages — that's how other surfaces (Library, Weather widget, Cycle adjustment, Skin Profile) route users to you with context already loaded."* Now Yuri also knows about the `?ask=` prefill pattern so she can recognize when users arrived from another surface mid-flow.
  - **Item 6b — Added subscriber intelligence panel mention to Product Detail row** (`advisor.ts` Reference table): Phase G (v10.7.0) added a subscriber-only intelligence panel to `/products/[id]` with skin-match data and an "Ask Yuri if this would be good for me" CTA. Yuri's prompt didn't know. Row updated.
  - **Item 7 — Yuri Sole Authority Principle as Quick Reminder** (`advisor.ts`): The principle was codified in CLAUDE.md (5 Bailey-caught incidents earned it the architectural-principle treatment) but lived only there — for future Claude SESSIONS, not for Yuri herself. Added a Quick Reminder so Yuri internalizes it: *"You are the only recommender in Seoul Sister. Other surfaces display data — weather conditions, Glass Skin Score numbers, trending rankings, retailer prices, ingredient effectiveness — and route users to you for 'what should I do?' Don't tell users 'the routine page also suggests...' or 'the Glass Skin Score will recommend...' Those algorithmic recommendation panels were intentionally removed because YOU have phase-aware context, decision memory, and conversation history that no algorithm can match. The data on those other pages is for THEM to look at; the synthesis is yours."* Closes the loop — Yuri won't accidentally point subscribers back to surfaces she IS the replacement for.
  - **Item 8 — Extended "How Everything Connects"** (`advisor.ts`): Original paragraph described the feature-level flow (scan → match → prices → routine → tracking → Glass Skin / Weather / Cycle / Trending / Dupes). Added a second paragraph for the two consolidating loops that sit above the individual features: Skin Profile (read-only view in Yuri's voice, refreshed when phase or decision memory shifts) and Library (the one place to see Owned + In Routine + Expiring + Tagged). Both route back to Yuri via "Ask Yuri" CTAs.
  - **Item 9 — Trend Scout sourcing distinction** (`specialists.ts`): Original Trend Scout prompt said *"You monitor Korean beauty trends at the source: 화해 rankings, Olive Young 올영세일 bestsellers, Naver Cafe communities, Korean 피부과 recommendation lists"* — risked confident-wrong claims about Hwahae rankings (Phase D Hwahae integration is documented as deferred, never shipped). Rewrote to distinguish background expertise from live tool data: *"Your background expertise comes from years of monitoring 화해 rankings, Naver Cafe communities, Korean 피부과 recommendation lists, and 올영세일 sale cycles... Your LIVE trend data comes from tools — Olive Young bestseller rankings (refreshed daily) and Reddit K-beauty mention counts with sentiment... Do NOT claim live access to Hwahae rankings or Naver. If a user asks 'what's #1 on Hwahae this week,' be honest: 'I don't have live Hwahae data — I can pull Olive Young's current bestsellers, which is the closest live signal we have on what Korea is actually buying right now.'"*
  - **Item 10 — Widget capability-scope paragraph** (`widget/chat/route.ts`): WIDGET_TOOL_NAMES is a deliberate subset (search_products, compare_prices, get_trending_products, get_current_weather, get_ingredient_guide) — anonymous visitors don't have a skin profile, so personalized match, conflict checks, routine building, and cross-session memory aren't available. The widget prompt never said this explicitly. Risk: a visitor asks "is this good for my acne?" and the widget improvises without a tool, then claims subscriber-only capability post-hoc. Added a `## What You Can and Can't Do in This Preview` section listing CAN (search/prices/trends/ingredients/weather) and what requires subscriber profile (personalized analysis, conflict checks, routine building, cross-session memory, Glass Skin tracking, treatment phase awareness). Frames the subscriber distinction naturally — never as sales pitch.
  - **Item 11 — Widget intelligence rewrite + get_ingredient_guide mention** (`widget/chat/route.ts`): Same stale-count fix as Item 5 — replaced "5,800+ K-beauty products with real Olive Young prices on 5,000+ products" with scope description. Added explicit instruction to use `get_ingredient_guide` for ingredient-specific questions: *"But DO use get_ingredient_guide for specific-ingredient questions — it returns Seoul Sister's effectiveness data for that ingredient across skin types, known interactions, and top products containing it. That's grounded data; your training is general knowledge."*
  - **AI-First compliance**: Every change is a creative brief in Yuri's existing voice. Zero rule engines added. Zero `if condition then output X` templates. Zero recommendation surfaces. Zero hardcoded counts (the entire point of Items 1, 5, 11). The Yuri Sole Authority Quick Reminder (Item 7) reads as positioning context, not a regex gate — matches how Heat Check (v10.3.0) and emotional intelligence sections are structured. All eleven fixes either REPLACE outdated content (Items 1, 2, 5, 6, 9, 10, 11) or ADD missing surface knowledge (Items 3, 4, 8) or codify earned principles (Item 7) — none stack on top of existing rules.
  - **Token impact**: Net REDUCTION. The ### Database Intelligence rewrite (Item 5) alone trims ~6 lines to ~3. The "14 tools" → scope description (Item 1) is roughly even. The Library row + Quick Reminder + Yuri Sole Authority Reminder + How Everything Connects extension + widget capability scope add tokens, but the Database Intelligence + Yuri row + Products row simplifications offset them. Estimated net delta: ~0 to -50 tokens across YURI_SYSTEM_PROMPT. Prompt caching savings (Phase 13.1) unaffected.
  - **Build verified**: `npx tsc --noEmit` passes clean. `npx next build` passes clean — all routes including `/library`, `/skin-profile`, `/browse` present at expected sizes.
  - **Mid-build catch**: Two backtick-in-template-literal escaping errors caught and fixed. The `?ask=` URL parameter reference in the new /yuri row inadvertently used backticks inside the template-literal-delimited YURI_SYSTEM_PROMPT, terminating the string prematurely. Same issue with `get_ingredient_guide` mention in the widget prompt. Both replaced with quoted string and plain reference. Pattern worth remembering: any backtick inside a backtick-delimited TS template literal needs escaping or replacement — same gotcha as v10.7.0's YURI_SYSTEM_PROMPT backticks-in-template-literal fix.
  - **What is NOT in this release**: Specialist prompts other than Trend Scout were left untouched. They already inherit the main prompt's Tool-Call Honesty rules, Yuri Sole Authority Quick Reminder, and full Reference table via prompt layering. Adding per-specialist Reference table mentions would have been duplication for no gain. Specialist count claim ("6 specialist agents" at advisor.ts line 59) was left intact — accurate today, low-risk because adding/removing a specialist is a code change that would surface this line in code review anyway.
  - **Files modified**: `src/lib/yuri/advisor.ts` (8 edits across Tools section, Reference table, Quick Reminders, Database Intelligence, How Everything Connects), `src/lib/yuri/specialists.ts` (1 edit to Trend Scout sourcing), `src/app/api/widget/chat/route.ts` (1 edit replacing entire Intelligence Advantage + adding Capability Scope), `CLAUDE.md` (version header + this changelog entry).
- v10.7.1 (May 20, 2026): Bailey audit follow-up — duplicate-bubble fix + Glass Skin recommender killed + dashboard "Yuri's Insights" widget killed
  - **Origin**: Two parallel Claude Opus 4.7 sessions had been running for Bailey simultaneously — Scott's primary PC failed to boot, forcing him to a second machine using Claude Code Desktop, where v10.7.0 was developed independently. While that release shipped (May 19, 9 coordinated fixes covering library mutation hardening, comedogenic data accuracy, holy-grail auto-detection, photo cadence, polish), Bailey continued testing and on May 20 sent 10 iMessage screenshots to Scott surfacing three additional issues v10.7.0 didn't address: (a) every message she sent appeared as a duplicate user bubble with the textarea visually retaining the text, forcing her to re-tap Send; (b) the Glass Skin Score Recommendations panel was rendering algorithmic advice — Yuri herself tore them apart point-by-point because they conflicted with Bailey's Phase 2 protocol; (c) catalog-match prose surfaced "Closest catalog match was NEEDLY..." for Ma:nyo Pure Cleansing Oil — cross-brand confusion Bailey called "this response also confuses me." A separate Claude session (this one, running on Scott's restored primary PC) audited the screenshots independently and shipped this follow-up.
  - **Merge with v10.7.0** (the critical context for understanding this release): The two sessions branched from the same commit (d25096d, v10.6.5). v10.7.0 shipped May 19 with library mutation hardening that includes a strictly-better architectural fix for Issue C (the Ma:nyo→NEEDLY catalog-match confusion). v10.7.0 extended `resolveProductByName` with `match_quality: 'exact' | 'all_terms' | 'partial'`, added `resolveProductByNameStrict` for write paths, rewrote `executeUpdateUserProduct` with full Tool-Call Honesty (matched/matched_loose/no_db_match classification + authoritative message field Yuri must quote verbatim), and added two new tools (`mark_product_reaction`, `clear_product_reaction`) with ownership cross-references and strict resolvers. My draft v10.6.6 Issue C fix returned null on cross-brand fallback — lossy by comparison. **v10.7.0's approach wins on every AI-First dimension** (preserves match_quality information rather than discarding it, lets write paths opt into strict mode, gives Yuri honest classification data to reason about). My Issue C draft was DROPPED entirely in this merge in favor of v10.7.0's superior architecture. Issues A, B, and the Yuri's Insights widget kill had no v10.7.0 equivalent and re-applied cleanly on top.
  - **AI-First audit performed before AND after**: All three fixes verified against `vibetrendai/principles.md` and the Yuri Sole Authority Principle in CLAUDE.md before coding. Issue A is pure mechanical hygiene (no AI logic touched). Issue B and the Yuri's Insights widget kill BOTH replace recommendation surfaces with Yuri CTAs — observational data display retained, prescriptive advice routes through Yuri. Post-build re-audit confirmed no regressions: no rule engines added, no template-string outputs, no recommendation surfaces re-introduced.
  - **Issue A — Duplicate user-message bubble (iOS Safari ghost-click race)** (`src/hooks/useYuri.ts`, `src/components/yuri/ChatInput.tsx`): Root cause was a synchronous double-trigger of `handleSubmit` on iOS Safari — touchend → click can fire twice on keyboard dismiss — layered on top of React state lag. The existing `if (isStreaming) return` guard in `sendMessage` and `disabled={!canSend}` on the send button both depend on async React state that doesn't update between two events in the same tick. The closure value captured at function definition still showed `isStreaming === false` for the second call. Fix added `useRef`-based synchronous guards at both layers — `isSendingRef.current` in useYuri flips before any work and survives the React-state-update gap; `submittingRef.current` in ChatInput blocks the duplicate at the button click level. Also force-clears `textareaRef.current.value = ''` synchronously after submit so iOS Safari's redraw lag doesn't visually retain the text and trick Bailey into re-tapping. `submittingRef` releases on next animation frame — by then React has re-rendered with `disabled={true}` from parent's `isStreaming`. Bailey explicitly described the symptom: *"first time I thought was on me cause I left the app but then it kept happening"* — she was tapping twice because the textarea looked unsent. Best Practices: prefer refs over state for sync guards; never trust async-state values inside the same tick to block re-entrancy.
  - **Issue B — Glass Skin Score Recommendations panel killed** (`src/app/(app)/glass-skin/page.tsx`, `src/components/glass-skin/ProgressTimeline.tsx`): Fourth instance of the Yuri Sole Authority Principle being earned through a Bailey-caught violation (after Routine Intelligence v10.5.2, Weather v10.6.2, Cycle Adjustment v10.6.2). v10.6.2 explicitly deferred this fix with the note *"Glass Skin Score recommendations stay for now... future session can decide whether to fully kill recommendations and route to Yuri."* Bailey caught what was punted. Her screenshot showed Yuri tearing the panel's recommendations apart point-by-point: *"PHA toner 3-4x weekly, on top of your BHA 3x/week. That's acid 6-7 days a week on cheeks we just rebuilt in Phase 1. Hard no. Niacinamide serum 5-10%, you already have niacinamide in 5 products. Adding another is wasteful, not helpful. Vitamin C ampoule, you're using Goodal Vita C every morning. Already done. The only line worth keeping is daily mineral sunscreen, and you've got the Beauty of Joseon Relief Sun handling that. Ignore the panel. Stay on Phase 2. I'm the one tracking your actual context."* Bailey: *"This kinda stuff that's not Yuri I think we need to get rid of."* Fix mirrors v10.6.2 weather widget pattern exactly: KEPT the score, radar chart, dimension breakdown, analysis_notes prose, ShareCard, photo (all data display). KILLED the Recommendations bullet list on the main results panel AND the historic-recommendations accordion in `ProgressTimeline.tsx`. Replaced with single CTA card: *"Ask Yuri what this score means"* with `?ask=` prefill carrying overall score + lowest dimension. The Vision endpoint still generates the `recommendations` array server-side (no schema change, minimal blast radius); no UI surface renders it. Future tooling — e.g., Yuri reading historic recommendations as context — remains possible.
  - **Sweep finding — Dashboard "Yuri's Insights" widget killed** (`src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/YuriInsightsWidget.tsx` (deleted)): Proactive sweep for additional Yuri Sole Authority Principle violations surfaced the worst-class instance: a widget literally named "Yuri's Insights" with a Lightbulb icon that rendered 3 product cards from `/api/learning/recommendations` as if Yuri had generated them. Pure `ss_product_effectiveness` skin-type sort, no Yuri reasoning, no phase awareness, no decision memory. Empty state copy actively claimed Yuri authorship: *"Yuri is learning. As more users share reviews..."* Fifth instance of the principle being violated, this one with explicit Yuri impersonation. Found and killed BEFORE Bailey reached it (the find-before-Bailey-does discipline established in this release). The IntelligenceWidgets section below (Top Ingredients + Seasonal Tip, both observational data display) keeps the dashboard intelligence layer intact. The `/api/learning/recommendations` endpoint and `getPersonalizedRecommendations` library function are now orphaned but retained — could become a Yuri tool input someday.
  - **Updated Yuri Sole Authority Principle section in CLAUDE.md**: Incident count corrected from three to five (added Glass Skin Score v10.7.1 + Yuri's Insights widget v10.7.1). Added new subsection codifying "Proactive sweep discipline" — each release touching recommendation surfaces should include a search-the-codebase pass for headings containing "Yuri's", lists labeled "Recommendations"/"Tips"/"Suggested", and rule engines of the shape `if skin_type X && condition Y then "use Z"`. The five incidents prove that algorithmic recommenders sneak in at the seam between "this feels personalized" and "this is actually personalized." Find them before Bailey does.
  - **Memory miss documented (NOT fixed)**: Bailey iMessage: *"She also forgot about a past conversation but I reminded her."* Image 8 — Yuri said *"Hold up, I don't have a Medicube PDRN face wash swap in our conversation history."* Yuri's behavior was actually correct per the v10.2.1 Tool-Call Honesty rule — she refused to confabulate, admitted the memory gap, gracefully incorporated Bailey's reminder, then nailed the response with the Phase 1 cheek-compromise callback proving broader phase memory was intact. The miss was a Sonnet summary extraction quality issue: the PDRN swap discussion either fell outside the 7-summary window or wasn't surfaced as a structured product recommendation by `extractProductRecommendations`. Logged as observation; future polish. Note: v10.7.0's tightened auto-extraction prompt (supporting_quote required, hypotheticals/Yuri-recommendations excluded) actually makes some classes of summary misses MORE likely to repeat — the right answer is a separate session focused on summary quality, not loosening the new gates.
  - **What v10.7.0 already shipped that I would have duplicated**: Issue C of my v10.6.6 draft (Ma:nyo→NEEDLY catalog-match honesty) is fully superseded by v10.7.0's `match_quality` + `resolveProductByNameStrict` + `executeUpdateUserProduct` rewrite. The right move was dropping my version, not merging. v10.7.0's approach preserves the partial-match information for Yuri to reason about (more AI-First — trust the model), where my version returned null and discarded it. Future Issue-C-class fixes should use v10.7.0's resolver pattern.
  - **Catalog gaps surfaced (operational, not fixed this release)**: Medicube Zero Foam Cleanser and Ma:nyo Pure Cleansing Oil are both missing from the catalog or matching poorly. Bailey is finding gaps in the popular-product longtail. Documented; targeted scrape can address when prioritized. v10.7.0's strict resolver + Tool-Call Honesty patterns mean Yuri now handles these gaps gracefully (saves as custom entry + says so honestly), so this is no longer urgent.
  - **Files modified in v10.7.1**: `src/hooks/useYuri.ts` (synchronous send guard), `src/components/yuri/ChatInput.tsx` (synchronous submit guard + DOM textarea force-clear), `src/app/(app)/glass-skin/page.tsx` (recommendations panel → Yuri CTA), `src/components/glass-skin/ProgressTimeline.tsx` (historic recommendations accordion removed), `src/app/(app)/dashboard/page.tsx` (Yuri's Insights section removed), `BAILEY-FEEDBACK-LOG.md`, `CLAUDE.md`.
  - **Files deleted**: `src/components/dashboard/YuriInsightsWidget.tsx`.
  - **Files NOT modified in v10.7.1** (deferred to v10.7.0's superior architecture): `src/lib/yuri/tools.ts` (v10.7.0's resolver + Tool-Call Honesty is the canonical fix for Issue C), `src/lib/yuri/advisor.ts` (v10.7.0's system prompt rules for update_user_product + mark/clear_product_reaction + photo cadence are canonical).
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
- v10.7.0 (May 19, 2026): Bailey Audit Release — 9 coordinated fixes
  - **Origin**: Bailey's two-day testing session May 18–19. She surfaced six bugs and three architectural asks across iMessage threads with Scott, then deep-research passes against (a) her real database state and (b) the codebase logic produced verified root-cause analysis. This release ships all 9 phases as one cohesive audit — the bugs are interconnected (resolver fuzzy substitution is the root cause of three separate library-mutation failures), and the architectural asks build on each other (manual reaction controls fix the trap Bailey was in where Yuri couldn't clear bad tags she herself had auto-written).
  - **AI-First audit performed before coding**: Read `vibetrendai-operating-notes/principles.md` and `patterns.md` per CLAUDE.md mandate. Key constraints that shaped the plan: Principle 2 (trust the model — Sonnet extraction prompts rewritten as creative briefs, not regex), Principle 3 (corrections aren't just memory, they drive cleanup — Phase E closes the loop), Pattern 4 (structural encoding from single instances — resolver fix is the *class*, not just Hero/Dr.ppae), Pattern 12 (pause-and-verify on data cleanup — Bailey's row repairs were applied via tracked migration with each WHERE clause scoped to her user_id).
  - **Phase A — Library Mutation Hardening (the foundation; fixes 4 stacked bugs)** (`src/lib/yuri/tools.ts`, `src/app/api/library/owned/route.ts`, `src/lib/yuri/advisor.ts`):
    - `resolveProductByName` return type extended with `match_quality: 'exact' | 'all_terms' | 'partial'`. Exact = full query is a substring of brand+name. all_terms = every non-stop-word query token appears in brand+name. partial = single-term fallback (dangerous for writes). The chosen result self-derives quality post-search, so smartProductSearch behavior is unchanged for read callers.
    - New exported `resolveProductByNameStrict` returns null when match_quality is `partial` — used by write paths and background extraction so the resolver never silently substitutes a wrong product.
    - `executeUpdateUserProduct` rewritten with Tool-Call Honesty matching v10.3.2 routine save pattern. On 'partial' or no match, saves with `product_id = NULL` + `custom_name = user_input` instead of substituting. Returns `matched: 'matched' | 'matched_loose' | 'no_db_match'` classification + authoritative `message` field (e.g. *"Saved 'Hero Mighty Patches' to your library as a custom entry. ⚠️ Closest catalog match was 'Dr.ppae Honey Heel Patch', but the names don't fully overlap — kept yours as a custom entry to avoid mixing the wrong product into your skin file."*). Advisor system prompt teaches Yuri to quote the `message` verbatim and clarifies that swaps require TWO update_user_product calls (Bailey's COSRX never-destashed bug came from Yuri making only one of the two needed calls).
    - DELETE cascade in `/api/library/owned`: destashing a product now ALSO clears any corresponding `ss_user_product_reactions` rows. Bailey's Skin&Lab Retinol holy-grail tag survived four conversations because the v10.6.5 library was missing this cascade — Yuri herself diagnosed it: *"the destash didn't fully clear the holy grail flag, those are two separate fields in the system."* Closed.
    - Two new Yuri tools `mark_product_reaction` and `clear_product_reaction` (with ownership cross-reference + strict resolver). Replaces the trap where Yuri's only path to write reactions was the buggy auto-extraction in advisor.ts.
  - **Phase B — Comedogenic warning rewrite** (`src/lib/scanning/enrich-scan.ts`): The bidirectional substring matching that produced Bailey's "Carbon Black Matt Brown Water (3/5)" + "Glycerin (3/5)" false positives on the SoonJung pH 5.6 Cleansing Milk page is replaced with a proper `ss_product_ingredients` JOIN. New `resolveIngredientNames` helper mirrors the v10.4.0 overlap-preview pattern (exact name_en/name_inci union). When productId is known (product detail page), the function uses the join directly — only ingredients ACTUALLY linked to the product can flag. When productId is null (scan flow), falls back to strict per-name resolution. Allergy check keeps substring matching (user-supplied free text — that's the one place bidirectional matching is correct). Irritant + effective-ingredient + concern-specific notes all use the same resolved-only pattern. Glycerin in SoonJung is correctly rated 0 in the DB; the bug was always in the matching logic.
  - **Phase C — Manual reaction controls in Library UI** (`src/app/api/library/reactions/route.ts`, `src/components/library/OwnedSection.tsx`, `src/components/library/TaggedSection.tsx`, `src/app/(app)/library/page.tsx`): New POST/DELETE `/api/library/reactions` endpoints with ownership enforcement (user must have the product in `ss_user_products`, any status). Owned section cards show small Holy Grail / Broke Me Out icon buttons in the action slot — filled when active, hollow when inactive, click to toggle (clear if already that reaction, replace if other). Tagged section cards get an "Untag" X button. Library page builds a `Map<product_id, reaction_type>` from the existing tagged data and threads it into OwnedSection. Closes Bailey's loop: she can now mark/clear reactions directly without going through Yuri (whose only path was the same buggy auto-extraction that wrote the bad tag).
  - **Phase D — Holy grail auto-detection hardening** (`src/lib/yuri/advisor.ts` `extractContinuousLearning`): Three new gates that should drop the false-positive rate to near zero. (1) Sonnet extraction prompt rewritten with the Skin&Lab Retinol Lifting Roller Cream incident as a concrete example of what NOT to extract. Required `supporting_quote` field on every reaction — Sonnet must quote the user's actual words proving the reaction. Soft reactions ("good"/"okay"/"bad") dropped from extraction entirely — they were too low-signal to durably tag and never surfaced in the Tagged UI anyway. Hypotheticals, Yuri-recommendations-repeated-back, and wishlist items explicitly excluded. (2) Product resolution uses `resolveProductByNameStrict` — never substitutes a wrong product onto a reaction. (3) Ownership cross-reference: the matched product MUST be in the user's `ss_user_products` (any status). Bailey never owned Skin&Lab Retinol Lifting Roller Cream; the old 50-char ilike substring match wrote the reaction anyway. The ownership gate is the hardest single defense — it would have stopped the original Feb 14 bug at the source.
  - **Phase E — Correction feedback loop** (`src/lib/yuri/memory.ts` `extractAndSaveDecisionMemory`): Closes Principle 3's loop. Sonnet extraction prompt now asks for `cleanup_actions` on each correction — specifically `{ action: 'clear_reaction', product_name, brand }` when the correction reveals a system-glitch reaction tag the user never agreed to. After saving the merged decision memory, the function executes any cleanup_actions using `resolveProductByNameStrict` (never substitutes) and deletes the corresponding `ss_user_product_reactions` row. Bailey's May 19 correction ("Skin&Lab Retinol... I don't own it and never have") will now auto-scrub the bad row going forward. The architectural pattern: corrections aren't just memory; they drive cleanup of the underlying bad data that caused them.
  - **Phase F — Subscriber detection fix on `/products/[id]`** (`src/app/api/me/subscription/route.ts`, `src/components/products/ProductIntelligenceSection.tsx`): Bailey's `plan` is `pro_monthly` in the DB, but the client-side `supabase.from('ss_user_profiles')` anon-key query was unreliable on the public `/products/[id]` route — she was being read as non-subscriber and shown gated teasers ("This section doesn't look like its loading"). New `/api/me/subscription` endpoint uses the same `requireAuth` + `hasActiveSubscription` helpers every AI route uses (Yuri chat, scan, skin-score, etc.), eliminating the RLS-via-anon-client path entirely. ProductIntelligenceSection now fetches with `Authorization: Bearer <token>` from the live session. Fails closed on network/auth errors (never accidentally flashes premium content).
  - **Phase G — v10.6.6 Product Detail Subscriber Enrichment** (`src/components/products/ProductEnrichment.tsx`, `src/components/products/ProductIntelligenceSection.tsx`, `src/app/products/[id]/page.tsx`): Bailey's strategic ask from May 19: *"I LOVE the ingredients sections and how there's the 'ask Yuri how it fits in your routine' much more personalized... In there tho, we should have 'ask Yuri if this specific product would be good for you' once they choose a product."* The v10.6.4 Phase 13.G pattern is now ported to product detail pages. New Yuri CTA renders at the top of the subscriber enrichment with `?ask=` prefill carrying the product brand + name (e.g. *"I'm looking at COSRX Advanced Snail 96 Mucin Power Essence. Given my skin profile, current routine, and where I am in my treatment phase — would this be a good fit, or should I skip it?"*). The CTA copy is honest about the architecture: *"She'll weigh it against your skin profile, current phase, and routine. The data below is observational — her read is where the recommendation lives."* Per the Yuri Sole Authority Principle, this is the single recommendation surface on the page; everything else is data.
  - **Phase H — Photo cadence (lite)** (`src/lib/yuri/memory.ts`): Bailey's strategic ask: *"Currently, Yuri hasn't asked for many photos, seems like every time it's me just sending them... I think Yuri should be asking for a weekly photo the start of each week, every Sunday or Monday."* The full vision (cron + notifications) is deferred to v10.8.0; the lite version gives Yuri the context she needs to suggest photos organically. Staleness threshold dropped from 30 days to 7 to match Bailey's cadence ask. When the latest score is 7+ days old, system-prompt guidance instructs Yuri: *"Photos are the platform's strongest signal of real progress... when 5-12 weeks of phased treatment pass without a fresh score, the user loses the felt-sense of how their skin has changed. If a momentum-positive moment surfaces in the conversation... suggest a new Glass Skin Score photo at /glass-skin and frame it as their journey, not a chore. Weekly is a natural cadence — if today is a Sunday or Monday and they haven't checked in this week, that's an organic opening."* No cron, no notifications — Opus decides when the moment lands. New case for users with zero baseline photos: stronger guidance ("the single most valuable thing they can do next").
  - **Phase I — Polish + data cleanup** (`src/components/ui/LazyImage.tsx`, `src/components/library/ProductLibraryCard.tsx`, `src/components/products/ProductCard.tsx`, `src/app/(app)/yuri/page.tsx`): LazyImage gains an `onError` handler + new optional `fallback` prop. When the image fails to load (stale Olive Young CDN hot-link, 404, CORS), the fallback element (Package icon) renders instead of the browser's broken-image glyph that Bailey called out on every Library card. ProductLibraryCard and ProductCard both pass a Package icon as the fallback. Yuri page header gets `pt-5 pb-3` (was `py-3`) so the "Yuri / AI Beauty Advisor" subheader doesn't visually crash into the AppShell logo — Bailey caught the crowding on May 19 (*"can you scoot Seoul sister over its bugging me how close they are 🥺"*).
  - **Bailey's data cleanup** (migration `v10_7_0_bailey_library_cleanup`): Repaired the three corrupted `ss_user_products` rows + lingering `ss_user_product_reactions` row that the v10.6.5 bugs left behind. (1) Deleted the Skin&Lab Retinol "destashed" entry whose product_id pointed at UltraV Idebenone Cream (resolver substitution residue). (2) Repurposed the corrupted swap row from "COSRX Acne Pimple Master Patch / Dr.ppae product_id" into a clean Hero Mighty Patches custom entry (NULL product_id, correct custom_brand + notes). (3) Destashed the legit COSRX Acne Pimple Master Patch row that Yuri's failed-second-call left active. (4) Deleted the Skin&Lab Retinol holy_grail reaction (the auto-extraction false positive from Feb 14). Bailey's library state verified clean post-migration: 12 active rows, 0 reactions, COSRX correctly destashed, Hero correctly tracked as custom entry.
  - **What's NOT in this release** (documented for v10.8.0): Full photo cadence engine with cron + push notifications (Phase H is the lite version). `ss_ingredients` parsing-artifact cleanup — the master table has ~26 "Carbon Black" rows that include INCI-blob mis-parses. The Phase B comedogenic rewrite makes them non-load-bearing (the new JOIN-based check filters them out at query time), but a dedicated data audit to delete the artifacts is its own session. Other pre-existing library data mismatches Bailey didn't surface this round (an "Anua Heartleaf 70% Rice Ceramide" custom_name pointing at "I'm From Rice Toner" — different products entirely; a duplicate Anua Heartleaf serum custom entry).
  - **Files created**: `src/app/api/library/reactions/route.ts`, `src/app/api/me/subscription/route.ts`
  - **Files modified**: `src/lib/yuri/tools.ts` (resolver + strict variant + update_user_product + new reaction tools), `src/lib/yuri/advisor.ts` (auto-extraction hardening + system prompt rules for new tools), `src/lib/yuri/memory.ts` (correction feedback loop + photo cadence context), `src/lib/scanning/enrich-scan.ts` (resolved-ingredient comedogenic check), `src/app/api/library/owned/route.ts` (DELETE cascade), `src/components/library/OwnedSection.tsx` (reaction buttons), `src/components/library/TaggedSection.tsx` (untag buttons), `src/app/(app)/library/page.tsx` (toggle/clear handlers), `src/components/products/ProductIntelligenceSection.tsx` (server-side sub check + product props), `src/components/products/ProductEnrichment.tsx` (Yuri CTA), `src/app/products/[id]/page.tsx` (thread product name/brand), `src/components/ui/LazyImage.tsx` (onError + fallback), `src/components/library/ProductLibraryCard.tsx` (Package fallback), `src/components/products/ProductCard.tsx` (Package fallback), `src/app/(app)/yuri/page.tsx` (header spacing)
  - **Cross-cutting principle encodings** (per Pattern 4 — structural encoding from single instances): (1) Tool-Call Honesty is now the explicit rule for ALL library mutation tools, not just save_routine — future write tools must include matched_loose/no_db_match classification + authoritative message field. (2) Bidirectional substring matching against the full ss_ingredients table is the wrong primitive for ingredient cross-reference — the right primitive is product-ingredient linkage JOINs. Future enrichment code should follow the Phase B pattern. (3) Corrections without cleanup loops are half-built — any system that records "this thing is wrong" needs a path to actually fix the thing (Principle 3 closure). (4) Auto-extraction features need supporting_quote + confidence floor + cross-reference checks — the 50-char ilike substring path is the canonical anti-pattern.
- v10.6.5 (May 18, 2026): Phase 13.H — My Library (subscriber-only consolidating view)
  - **Origin**: Blueprinted in `V10.6.5-MY-LIBRARY-BLUEPRINT.md` as the natural next step after v10.6.4 Phase 13.G. Same architectural insight: subscribers accumulate product-related data (ownership, wishlists, scans, routine, reactions, expiration tracking) across 7 tables with no consolidating review surface. The mental model: just like `/skin-profile` (v10.6.0) consolidates *what Yuri knows about your skin*, `/library` consolidates *what products are in your world*. Estimated 3-4h; delivered in one session.
  - **AI-First audit performed BEFORE coding**: Confirmed in writing against vibetrendai/principles.md. The Library is a CONSOLIDATING view over existing tables — zero new tables, zero migrations, zero recommendation surfaces except the single Yuri CTA at the top of the page. Every section is data display (Owned = inventory, Saved = wishlist + scans, In Routine = cross-reference with ownership gap flag, Tagged = user's own reactions, Expiring = PAO arithmetic). The "ownership gap" surfacing on In Routine is honest discovery (set difference between routine product_ids and owned product_ids), NOT a recommendation — same pattern v10.6.2 used for surfacing facts without prescribing actions. All 4 open design questions resolved upfront with Scott's confirmation: (Q1) gaps surface as explicit gaps requiring user tap, never auto-add; (Q2) empty states are minimal placeholders + one-line action prompts, no lectures; (Q3) `?section=` URL filters supported via `useSearchParams` deep-link with smooth scroll; (Q4) Saved section defaults to flat reverse-chrono, grouping deferred until usage justifies.
  - **Bailey's data verified against schema**: Pre-flight queries against user_id `551569d3-aed0-4feb-a340-47bfb146a835` confirmed real data exists: 12 owned (6 product-linked + 6 null-product devices/actions), 0 wishlist, 0 scans, 2 active routines (Phase 2 AM/PM, 18 total steps), 1 holy_grail reaction (Skin&Lab Retinol Lifting Roller Cream auto-detected from Yuri conversation Feb 14), 0 expiring. Two real ownership gaps identified — Goodal Vita C + Beauty of Joseon Relief Sun are in her AM routine but not in her `ss_user_products` inventory. Both null-product safety: `ss_user_products.product_id` and `ss_routine_products.product_id` are both nullable in this schema (custom entries for "Cool water rinse", "LED mask", custom-entry products); `ProductLibraryCard` handles both shapes via conditional `Link` vs plain `div` wrap.
  - **Consolidating API** (`src/app/api/library/route.ts`): Single `GET /api/library` endpoint runs 6 parallel queries via `Promise.all`. Returns one JSON payload with `owned`, `saved`, `in_routine` (split AM/PM with ownership_gap flag per step), `tagged` (split holy_grail/broke_me_out), `expiring` (top 5 by soonest expiry, bucketed urgent/<14d, soon/14-30d, later/>30d), `expiring_total`, and `summary` for Yuri CTA prefill. Saved section merges wishlist + scans, deduped by product_id, filtered to non-owned products only. Empty-row safe; non-critical try/catch per section (one section failing doesn't break the page).
  - **Mutation API** (`src/app/api/library/owned/route.ts`): POST inserts into `ss_user_products` with duplicate guard (409 if active row exists for same user+product). DELETE soft-deletes via `status = 'discarded'` to preserve history. Zod-validated; either `product_id` or `custom_name` required.
  - **Reusable card** (`src/components/library/ProductLibraryCard.tsx`): Single card component used by all 5 sections. Handles product-linked (wraps in `Link` to `/products/[id]`) and null-product (plain div for devices/actions) variants. Optional ribbon label + tone (rose/amber/emerald/sky/gray), optional metadata line, optional action slot for inline buttons. Matches existing glass-card visual language.
  - **5 section components**: `OwnedSection` (with Add Product button + per-card Remove button), `SavedSection` (wishlist + scanned items with source ribbon), `InRoutineSection` (split AM/PM sub-columns with "Not owned" amber ribbon + "Mark as owned" inline button on gap steps), `TaggedSection` (two columns: Holy Grail emerald + Broke Me Out rose), `ExpiringSection` (3-up grid with day-count ribbon color-coded by urgency, "View all" link to `/tracking`). All cards null-product safe.
  - **Library Add modal** (`src/components/library/LibraryAddModal.tsx`): Library-specific add-product modal. Searches `ss_products` (verified-only) by name OR brand via `ilike`, debounced 250ms, max 20 results. Tap to add → POST `/api/library/owned`. Did NOT reuse routine's `AddProductModal` — that one runs conflict checks and is opinionated about routine flow; the Library needs a thinner shell (Yuri handles conflict reasoning in conversation, not at the mutation surface).
  - **Library page** (`src/app/(app)/library/page.tsx`): Client component wrapped in Suspense for `useSearchParams`. Fetches `/api/library` on mount with the user's access token. Header shows "My Library" badge + intro paragraph + single Yuri CTA pill with `?ask=` prefill summarizing user's actual counts (owned, routine steps, ownership gaps, tagged, expiring). Reads `?section=owned|saved|routine|tagged|expiring` URL param and smooth-scrolls to that section after data loads (same `?` deep-link pattern as v10.6.2's `?ask=` and v10.6.3's `?category=`). Add/Remove/MarkOwned all use `window.confirm` for friction (deliberate — preventing accidental clicks on items the user spent time accumulating).
  - **Nav link added** (`src/components/layout/Header.tsx`): "Library" inserted between "Skin Profile" and "Scan" in `navLinks` array (line 13). Visible to authenticated subscribers in desktop + mobile menus via existing render loops.
  - **AI-First post-build re-audit**: re-verified each shipped file against the four principles. (1) Most Powerful Model: no AI calls touched. (2) AI-First Reasoning: zero rule engines, zero `if condition then suggest X` templates, the `bucket` color-coding on expiring items is date arithmetic (label = "Xd left"), not a recommendation. (3) Moat Through Learning: reads existing data layer, doesn't change capture loops; `learned_from = 'library_manual_add'` and `'library_routine_gap'` distinguish ownership origin for future cohort analysis. (4) Perception Before Information: the Yuri CTA is the ONLY synthesis surface; data displays observationally with dates and counts, never prescribing action. ✅ Clean across all four.
  - **Files created**: `src/app/api/library/route.ts`, `src/app/api/library/owned/route.ts`, `src/components/library/ProductLibraryCard.tsx`, `src/components/library/OwnedSection.tsx`, `src/components/library/SavedSection.tsx`, `src/components/library/InRoutineSection.tsx`, `src/components/library/TaggedSection.tsx`, `src/components/library/ExpiringSection.tsx`, `src/components/library/LibraryAddModal.tsx`, `src/app/(app)/library/page.tsx`
  - **Files modified**: `src/components/layout/Header.tsx` (single-line navLinks insertion)
  - **Build verified**: `tsc --noEmit` passes clean. `next build` passes clean — `/library` route present at 8.06 kB, `/api/library` + `/api/library/owned` registered as dynamic routes.
  - **NOT in scope this release**: Bulk operations (multi-select remove, drag-to-reorder, etc.). Smart Saved section grouping by date or category (deferred per Q4 — show flat list now, revisit when a real subscriber hits 30+ scans). Editing custom-entry rows in-place (devices, actions). Library export/share. These can come if usage signals warrant; the Library architecture is intentionally simple for v1.

- v10.6.4 (May 18, 2026): Phase 13.G — Subscriber-aware ingredient detail enrichment
  - **Origin**: Brainstormed and approved during the v10.6.3 planning conversation. Scott explicitly asked whether public surfaces could deliver MORE value to subscribers without bloating the public SEO output. Two-tier value proposition: anonymous visitors see ingredient pages exactly as today (preserved for SEO + AI discoverability), authenticated subscribers see a "For You" enrichment panel below the hero with their personal context.
  - **AI-First audit performed BEFORE coding**: Verified the planned changes against vibetrendai/principles.md. The enrichment surfaces four panels of OBSERVATIONAL data + one "Ask Yuri" CTA — zero generated recommendations, zero rule engines. Yuri Sole Authority Principle preserved. The "Phase relevance" panel renders the user's `ss_treatment_phases.watch_for` items VERBATIM (Yuri's own words from the conversation that established the phase) — not generated by any algorithm.
  - **Item 1 — IngredientEnrichmentSection client component** (`src/components/ingredients/IngredientEnrichmentSection.tsx`): Renders nothing when unauthenticated (preserves public SEO surface). When authenticated, fetches enrichment from new API endpoint and renders up to 4 panels: (a) "You use this in N products" — products from `ss_user_products` + active routines that contain this ingredient, with ownership labels (Owned / In your routine / Owned · In routine), each linking to product detail; (b) "For {skin_type} skin" — top effectiveness row from `ss_ingredient_effectiveness` with percentage + concern + sample size context; (c) "Phase N: {phase_name} · Day {days}" — current active phase with up to 3 watch_for items rendered verbatim (Yuri's own observational notes); (d) "Ask Yuri how {ingredient} fits your routine" CTA with `?ask=` prefill carrying phase context when applicable.
  - **Item 2 — Enrichment API endpoint** (`src/app/api/ingredients/[id]/enrichment/route.ts`): Protected via `requireAuth(request)`. Runs all queries in parallel: user profile (skin_type), products containing ingredient (joined with ss_products), user's owned products, user's active routines with products, active treatment phase. Then computes set intersection client-side in JavaScript (product is in `products_using` only if user owns it OR has it in an active routine). Returns structured JSON. Silent failure (component renders nothing on error to preserve public page experience).
  - **Item 3 — Wire-up into /ingredients/[slug] page**: Single JSX insertion right after the hero closes, before the rich-content sections begin. Server page passes `ingredient.id` and `displayName` to the component. The component handles auth check, fetch, and conditional rendering on its own — server page logic untouched.
  - **Verified against Bailey's data before shipping**: Simulated the query against ingredient `6df0452c-90d1-4548-8bc6-49d839f9fb7a` (Niacinamide). For Bailey, returns 5 products: COSRX BHA Blackhead Power Liquid (owned + in routine), Beauty of Joseon Relief Sun (in routine), Goodal Vita C (in routine), Medicube PDRN Pink Peptide (owned + in routine), I'm From Rice Toner (owned). Effectiveness query returns top combination-skin row. Active phase query returns Phase 2 with 4 watch_for items. End-to-end data flow confirmed.
  - **Known data-layer imperfection (not introduced by this release, surfaced honestly here)**: `ss_ingredient_effectiveness` still contains some 1.000 effectiveness scores from the Phase 11.4 bootstrap script that v10.5.2's cleanup migration didn't catch (the denylist targeted formulation auxiliaries — waxes, glycols, silicones — not legit actives with too-perfect scores). Niacinamide combination-pores at 1.000 is one such row. The enrichment surface honestly displays what the table contains. If a future subscriber pushes back on a too-perfect score, the fix is in the data layer (`ss_ingredient_effectiveness`), not the rendering. Worth a deeper effectiveness data audit in a future session when usage justifies it.
  - **AI-First post-build check**: re-verified against the four principles. (1) Most Powerful Model: zero AI calls touched. (2) AI-First Reasoning: zero rule engines, zero templates, the only generated string in the new code is the Yuri-CTA prefill question which is OBSERVATIONAL ("Tell me how {ingredient} fits into my routine") not a recommendation. (3) Moat Through Learning: reads existing data layer, doesn't change capture loops. (4) Perception Before Information: enrichment renders BELOW the public SEO content, framed as "For You" — acknowledges the subscriber state as someone returning to look up something specific to their routine, after the public info has loaded. ✅ Clean across all four.
  - **Files created**: `src/app/api/ingredients/[id]/enrichment/route.ts`, `src/components/ingredients/IngredientEnrichmentSection.tsx`
  - **Files modified**: `src/app/ingredients/[slug]/page.tsx` (import + JSX insertion only)
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
  - **NOT in scope this release**: My Library consolidating subscriber-only view (Idea A — deferred to v10.6.5). Subscriber enrichment on /products/[id] (could be a future v10.6.6 — same architectural pattern, different data sources). Audit + cleanup of `ss_ingredient_effectiveness` bootstrap-data drift (deferred until usage justifies a deeper data quality pass).
- v10.6.3 (May 18, 2026): Phase 13.F — Auth-aware shared surfaces + subscriber-driven sharing
  - **Origin**: Bailey's iMessage feedback ~12:28 PM Central, same morning as v10.6.2. She tapped category cards on the /products page (the Browse-by-Category grid showing Serums 547, Sunscreens 672, etc.) and they didn't navigate anywhere. Her message: *"Hm this area isn't letting me pick one."* Investigation revealed two intertwined issues: (1) the cards were linking to /products?category=X, but /products is a public SEO landing page that doesn't read the query param — so taps changed the URL but the page just re-rendered itself unchanged, and (2) Bailey shouldn't have been on /products at all because she's a subscriber — she got dropped there from the dashboard's "Your Top Ingredients" widget which linked to /products (marketing) instead of /browse (subscriber app). Subscriber surfaces were leaking visitors into the marketing nav.
  - **Brainstormed bigger before building**: Scott explicitly asked to explore whether the public products/ingredient surfaces could offer MORE value to subscribers while ALSO being good for friends/family sharing. The answer was yes — the right architectural pattern is **auth-aware shared surfaces**: the same page serves both audiences with appropriate nav chrome based on auth state, and subscriber-shared URLs work for non-subscribers without forcing them through /login. Combined with explicit Web Share API affordances, every subscriber becomes a potential brand ambassador with zero referral-system infrastructure.
  - **AI-First audit performed before coding**: Verified the planned changes against vibetrendai/principles.md. All seven items are pure routing + display work — no AI calls, no recommendations, no templates, no Yuri Sole Authority Principle violations. SEO output preserved for unauthenticated bots on all public surfaces. Confirmed in writing before starting.
  - **Item 1 — Fixed broken category cards on /products + /products/[id]**: Changed `/products?category=X` links to `/browse?category=X`. The cards now navigate to the actual filterable subscriber browser. Files: `src/app/products/page.tsx:190`, `src/app/products/[id]/page.tsx:816`.
  - **Item 2 — Repointed subscriber-facing components from /products to /browse**: Dashboard "Your Top Ingredients" widget's Browse button (`src/components/dashboard/IntelligenceWidgets.tsx:147`), Community Insights' Browse button (`src/components/community/CommunityInsights.tsx:112`). These were directly responsible for Bailey landing on the wrong surface.
  - **Item 3 — /browse now reads `?category=` and `?q=` from URL on mount**: Added `useSearchParams()` initialization to `src/app/(app)/browse/page.tsx`. Shared/linked filtered URLs now apply their filter on landing. Same pattern as `?ask=` on /yuri (v10.6.2).
  - **Item 4 — Auth-aware nav chrome on 8 public SEO surfaces**: New reusable `src/components/layout/AuthAwareNav.tsx` swaps PublicNav ↔ Header based on `useAuth()`. Authenticated subscribers see their familiar AppShell nav, unauthenticated visitors see the marketing nav. Same page content for both audiences (SEO preserved). Applied to: /products, /products/[id], /ingredients, /ingredients/[slug], /best, /best/[category], /blog, /blog/[slug]. This eliminates the disorienting nav-switch Bailey experienced this morning and makes the public surfaces feel like part of the app when subscribers visit them via shared link or organic navigation.
  - **Item 5 — Reassessed mid-build, deferred**: A redirect from /products → /browse for authenticated users. With Items 1, 2, and 4 shipped, this is no longer urgent — AuthAwareNav gives subscribers their familiar nav on /products, fixed cards make the page functional. Implementing the redirect cleanly would require adding `@supabase/ssr` (the project uses base `@supabase/supabase-js` with localStorage auth, so middleware-based auth detection isn't available). Not worth the dependency add for a polish improvement. Deferred to a future release if usage data shows it actually matters.
  - **Item 6 — /browse → /products fallback redirect for unauthenticated visitors**: Modified `src/components/layout/AppShell.tsx` so when a non-subscriber lands on a subscriber-only surface that has a public equivalent (currently just /browse → /products), they get routed to the public surface with query params preserved. This means subscriber-shared filtered browse URLs (`/browse?category=cleanser`) now land friends/family on the right marketing page (`/products?category=cleanser`) instead of bouncing through /login. New `SHARED_FALLBACKS` mapping in AppShell makes this extensible — future subscriber surfaces with public equivalents register here.
  - **Item 7 — Web Share API button on product + ingredient detail pages**: New reusable `src/components/ui/ShareButton.tsx` uses `navigator.share()` for native share sheet on mobile/supporting browsers, falls back to `navigator.clipboard.writeText()` with a brief checkmark affirmation on desktop. Zero tracking, zero referral attribution (defer if/when business model demands it). Placed in product detail page header (top-right of info section) and ingredient detail page header (top-right of badges row). No AI involvement — pure browser API surface.
  - **Build pain caught + fixed mid-ship**: AppShell's initial Item 6 implementation used `useSearchParams()` to read query params for the fallback redirect, but Next.js requires Suspense boundary wrapping for `useSearchParams()` during static prerender of all subscriber pages. Refactored to read query string directly from `window.location.search` inside the useEffect (which only runs client-side, no Suspense needed). Separately, /browse's new `useSearchParams()` call required wrapping the page body in `<Suspense>`. Both fixes preserve the URL-aware behavior without architectural complexity.
  - **AI-First post-build check**: re-verified each change against the four principles before commit. (1) Most Powerful Model: no AI calls touched. (2) AI-First Reasoning: no rule engines added, no templates, no recommendations generated by any of the 7 items. (3) Moat Through Learning: data layer untouched. (4) Perception Before Information: the auth-aware nav respects that subscribers shouldn't be jolted into marketing chrome when they navigate within their paid app. ✅ Clean across all four.
  - **Files created**: `src/components/layout/AuthAwareNav.tsx`, `src/components/ui/ShareButton.tsx`
  - **Files modified**: `src/app/products/page.tsx` (broken card fix + AuthAwareNav), `src/app/products/[id]/page.tsx` (broken card fix + AuthAwareNav + ShareButton), `src/app/best/page.tsx` (AuthAwareNav), `src/app/best/[category]/page.tsx` (AuthAwareNav), `src/app/blog/BlogListing.tsx` (AuthAwareNav), `src/app/blog/[slug]/page.tsx` (AuthAwareNav), `src/app/ingredients/page.tsx` (AuthAwareNav), `src/app/ingredients/[slug]/page.tsx` (AuthAwareNav + ShareButton), `src/components/dashboard/IntelligenceWidgets.tsx` (subscriber-link repoint), `src/components/community/CommunityInsights.tsx` (subscriber-link repoint), `src/app/(app)/browse/page.tsx` (useSearchParams + Suspense wrapper), `src/components/layout/AppShell.tsx` (SHARED_FALLBACKS + window.location read)
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
  - **NOT in scope**: Subscriber-aware enrichment on /ingredients/[slug] (Idea B from brainstorm — deferred to v10.6.4). My Library consolidating subscriber-only view (Idea A — deferred to v10.6.5). Referral attribution / tracking (defer to future business-model decision). Adding `@supabase/ssr` for middleware-based auth (defer until a use case actually requires it).
- v10.6.2 (May 18, 2026): Phase 13.E — Yuri Sole Authority Principle enforcement
  - **Origin**: Bailey's iMessage feedback the morning after the v10.6.0/v10.6.1 ship. She opened the app, said *"Amazing!!!!!"* and *"I LOVE it if it is Yuri!"* — clear thumbs-up on the Skin Profile work. But she screenshotted the dashboard's "Weather & Skincare" widget showing *"9 routine adjustments suggested"* (Switch to lighter moisturizer, Skip face oils, Apply niacinamide toner to T-zone) and asked: *"Are they recommended by Yuri or generic based on location alone. I think all recommendations should be from Yuri at this point. Similar to how we removed the other sections since Yuri disagreed on it all based on my specific skin and journey. Would just get confusing and would be misleading if not communicating with Yuri."* She identified the exact same architectural class as v10.5.2's Routine Intelligence widget removal — algorithmic recommenders competing with Yuri's authority.
  - **AI-First audit performed before coding**: Verified the proposed changes against vibetrendai/principles.md. All four changes either (a) remove hardcoded rule engines (`src/lib/intelligence/weather-routine.ts` ADJUSTMENT_RULES, `src/lib/intelligence/cycle-routine.ts` PHASE_META hardcoded recommendations) replacing them with raw data + Yuri CTAs, or (b) correct labels so algorithmic discovery surfaces don't impersonate Yuri. Audit surfaced one additional issue not in the original report — the sunscreen page's "Yuri's Pick" section, which literally puts Yuri's name on pure-algorithmic ranking. Added to scope.
  - **Yuri Sole Authority Principle encoded in CLAUDE.md**: New ~80-line section between the Specialists table and Technical Stack. Captures the architectural principle Bailey has been teaching us across three corrections (v10.5.2 routine widget, May 17 bootstrap data cleanup, v10.6.2 weather widget): no non-Yuri surface generates personalized recommendations; every other surface is either data display, navigation, or a Yuri-conversation entry point. Includes the test matrix for future feature decisions, acceptable patterns, anti-patterns, the interlock with vibetrendai/principles.md Principle 2, and explicit instructions for future AI sessions. This is the structural-encoding pattern from `vibetrendai/patterns.md` (Pattern 4: Single Instance → Structural Insight → System-Wide Encoding).
  - **Fix 1 — Weather widget recommendations killed** (`src/components/dashboard/WeatherRoutineWidget.tsx`): The 9-item hardcoded recommendation list ("Switch to lighter moisturizer," "Apply niacinamide toner") and seasonal-insight bottom row are replaced with a single CTA: *"Ask Yuri how today's weather affects your routine"* with `?ask=` prefill carrying the weather data (temp + humidity + UV + location + condition). Weather DATA display retained (temperature, humidity, UV, wind, location, condition) — that's observational and at-a-glance useful. Yuri reads the prefilled context and synthesizes a phase-aware, decision-memory-aware, routine-aware response. The `ADJUSTMENT_RULES` engine in `weather-routine.ts` remains in the codebase for now (still called by the API route's `/api/weather/routine`), but the widget no longer renders its output. Cleanup of the unused engine is deferred — the API endpoint may be repurposed for Yuri's tool context later.
  - **Fix 2 — Cycle adjustment recommendations killed** (`src/components/routine/CycleAdjustment.tsx`): The "Routine Adjustments" section (hardcoded `CycleRoutineAdjustment[]` array) and "Tips for This Phase" section (hardcoded `PHASE_META[phase].recommendations` string list) are replaced with a single Yuri CTA. The phase header (label, day-in-cycle, days-until-next-phase) and "Your Skin Right Now" skin behavior paragraph stay — those are observational descriptions of hormonal state, true regardless of treatment phase. Removed unused imports (`ArrowRight`, `CycleRoutineAdjustment`) and the `ADJUSTMENT_TYPE_LABELS` constant. Yuri already sees cycle phase via her existing `memory.ts:374` context-load, so she gives phase-aware advice that respects Bailey's Phase 2 protocol (BHA on MWF, etc.) instead of conflicting with it.
  - **Fix 3 — "Yuri's Pick" renamed honestly** (`src/app/(app)/sunscreen/page.tsx` + `src/app/api/sunscreen/picks/route.ts`): The "Yuri's Picks for {skinType} skin" section header is renamed to *"Top matches for {skinType} skin"* with a subtitle: *"Ranked by ingredient effectiveness for your skin type. Ask Yuri about any of these to see if they fit your current routine."* Interface and component names updated: `YuriPick` → `SkinTypePick`, `YuriPicksSection` → `SkinTypePicksSection`, `YuriPickCard` → `SkinTypePickCard`. Underlying algorithm (ranking sunscreens by `ss_ingredient_effectiveness` matches against skin type) is fine and remains — the rename just stops the surface from claiming Yuri authored output she didn't generate. API route docstring updated to clarify this is data-backed discovery, not Yuri curation.
  - **Fix 4 — `?ask=` prefill on /yuri** (`src/app/(app)/yuri/page.tsx`): New URL-based message prefill infrastructure. Reads `searchParams.get('ask')` on mount, pipes through the existing `ChatInput.restoredValue` mechanism (originally added in v8.1.2 Phase 15.3 for failed-send recovery). User lands on /yuri with the question prefilled in the textarea — can edit or send. Single-use per page load (consumed via `askConsumed` flag). Enables the CTAs from weather widget, cycle adjustment, and future Yuri-entry-point surfaces to carry context naturally without forcing the user to retype.
  - **Files modified**: `CLAUDE.md` (Yuri Sole Authority Principle encoded), `src/components/dashboard/WeatherRoutineWidget.tsx` (recommendations → Yuri CTA), `src/components/routine/CycleAdjustment.tsx` (adjustments + tips → Yuri CTA), `src/app/(app)/sunscreen/page.tsx` ("Yuri's Picks" → "Top matches"), `src/app/api/sunscreen/picks/route.ts` (docstring), `src/app/(app)/yuri/page.tsx` (`?ask=` prefill)
  - **NOT in scope**: Products page "For You" toggle stays (already accurately labeled as effectiveness-ranked discovery, not Yuri authorship). Dupes "AI-recommended dupes" copy stays (genuinely AI-generated, not Yuri-claimed). Glass Skin Score recommendations stay for now (v10.5.0 added phase-awareness to the Vision prompt; future session can decide whether to fully kill recommendations and route to Yuri). Cleanup of unused `weather-routine.ts` ADJUSTMENT_RULES and `cycle-routine.ts` PHASE_META recommendation strings deferred — they're no longer rendered but still exist for potential re-use as Yuri tool context.
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
- v10.6.1 (May 18, 2026): Phase 13.D polish — Skin Breakdown prompt caching + Yuri awareness of /skin-profile
  - **Origin**: Two AI-First follow-ups identified at the end of the v10.6.0 ship session. Neither user-driven; both are quality-bar items the build flagged as next-actions.
  - **Fix 1 — Prompt caching on Skin Breakdown Opus call** (`src/lib/intelligence/skin-breakdown.ts`): The ~1,800-token `SKIN_BREAKDOWN_BRIEF` system prompt is static across every user and every regeneration. Added `cache_control: { type: 'ephemeral' }` mirroring the existing pattern at `advisor.ts:734`. With a 5-min ephemeral TTL, regenerations happening close together (a Refresh tap after a normal page load, or two users hitting the synthesis in the same window) hit cache. Even cold-start regenerations a week apart still pay cache-creation once instead of full input pricing every time. Same Principle 1 + cost-discipline pattern that's been in place app-wide since v8.1.0.
  - **Fix 2 — Yuri awareness of /skin-profile** (`src/lib/yuri/advisor.ts`): The page exists but Yuri didn't know it did, so if a user asked "what does my profile say?" Yuri would either improvise or guess. Added (a) a new row to the Seoul Sister Reference Core Features table describing /skin-profile as "YOUR consolidated read of the user" with the right framing (READ-ONLY for the user, populated by Yuri's conversations), and (b) a new Quick Reminder telling Yuri when to point users to the page ("what does my profile say," "where am I in my journey," "show me my phase," etc.) along with the instruction NOT to quote the page back at users in chat — the page is for the user to read, chat is for the live conversation. Both additions follow the existing creative-brief pattern, not template strings.
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
- v10.6.0 (May 18, 2026): Phase 13.D — Living Skin Profile + Phase Progress Photo Gallery
  - **Origin**: Bailey's iMessage requests on May 17 2026 evening, after a long Yuri conversation produced the "combination / Fitzpatrick 3 / humid Austin / T-zone vs cheeks split / PIH danger zone / climate math" breakdown she screenshotted. Her three texts: (1) *"I think we should make a section specific to details about your individual skin once known by Yuri… that Yuri creates and it changes based on where in the journey you are."* (2) *"Also think there should be a saved spot for photos used throughout the phases to see the progress."* (3) *"Also once I send a photo to Yuri I can't click on the photo after it's sent to see it larger size."* Blueprinted in `PHASE-13D-LIVING-SKIN-PROFILE.md`. This release ships all three asks as one cohesive feature.
  - **AI-First audit**: Before coding, the original plan was audited against vibetrendai/principles.md. Six revisions were applied to enforce the four principles: (1) Skin Breakdown synthesis upgraded from Sonnet to **Opus 4.7** because it's user-facing intelligence (Principle 1), (2) Skin Breakdown prompt rewritten as a creative brief with no rigid "always emit 4 bolded paragraphs" template — Opus decides structure (Principle 2), (3) Phase extraction asks Sonnet to judge the conversation as a whole, not regex keyword-match (Principle 2), (4) `outcomes JSONB` added to `ss_treatment_phases` so phase results become cohort-learning fuel (Principle 3), (5) Phase transitions feed back into the conversation's `decision_memory` so Yuri sees them via her existing context-load path (Principle 3 — close the loop), (6) Skin Breakdown brief tells Opus to acknowledge journey position before delivering the read (Principle 4 — perception before information).
  - **Migration** (`supabase/migrations/20260518000001_add_treatment_phases_and_skin_breakdown.sql`): Three changes. (a) New table `ss_treatment_phases` — phase_number, name, goal, status (planned/active/completed/paused), protocol JSONB, decisions JSONB, watch_for JSONB, outcomes JSONB, source attribution, RLS (user can SELECT, service_role manages). (b) New table `ss_skin_breakdown_history` — preserves every Opus regeneration (text, source_hash, tokens, model, generation_reason). (c) Extended `ss_glass_skin_scores` with `photo_url TEXT` (storage path) and `treatment_phase_id UUID`. (d) New private Storage bucket `glass-skin-photos` with RLS policies (users can read own photos via signed URL, service_role manages writes). Migration applied via Supabase MCP successfully.
  - **Bailey backfill** (`scripts/backfill-bailey-phases.ts`): One-shot script that seeds Bailey's Phase 1 (Barrier Repair, Feb 23 → May 4, completed with full outcomes block listing what worked + carried forward into Phase 2) and Phase 2 (Active Treatment, May 5 → present, active with full protocol: AM Goodal Vita C daily, PM MWF COSRX BHA Blackhead Power Liquid on chin/jaw only, Tue/Thu/Sat/Sun red light + Illiyoon). Tagged her two Feb 25 Glass Skin photos to Phase 1. Idempotent — uses upsert pattern. Future users get phases auto-extracted via the background extractor from day one.
  - **Phase extraction pipeline** (`src/lib/yuri/treatment-phase-extractor.ts`): Sonnet 4.5 fire-and-forget after every Yuri conversation, mirrors `extractAndSaveDecisionMemory` pattern. Reads existing phases + conversation transcript, judges whether a phase transition occurred. Returns array of actions: `no_change` (default), `create_phase`, `complete_phase`, `update_phase`. Conservative gate: every non-no-change action MUST include a `supporting_quote` verbatim from the conversation — Sonnet can't fabricate phase transitions. Wired into `src/lib/yuri/advisor.ts` at the same every-5-messages cadence as decision memory. After applying phase actions, the extractor also writes the transitions into `ss_yuri_conversations.decision_memory.decisions[]` so Yuri sees them at conversation time via her natural context-load path (Principle 3 feedback loop).
  - **Skin Breakdown synthesis** (`src/lib/intelligence/skin-breakdown.ts`): Opus 4.7 generates the headline section — the personalized prose read of the user's skin in Yuri's voice. Creative brief tells Opus: (a) audience is the user returning to review their own file, (b) voice is Yuri's (cool older sister at Amorepacific R&D, Korean terms naturally, real specificity over generic blog vocabulary), (c) what to cover is signaled by the materials, not a checklist, (d) structure is the model's call — paragraphs with bolded leading sentences only where emphasis is earned. Inputs: full skin profile + active phase + completed phases + recent corrections/decisions/preferences from decision_memory + specialist insights summary + conversation count. Caching: `source_hash` (sha256 of inputs) — identical hash = skip regeneration. Stale check = hash changed OR generated_at > 7 days ago. Page renders cached text immediately; background regen fires when stale. Every regen persists to `ss_skin_breakdown_history` with tokens, model, generation_reason.
  - **Reusable ImageLightbox** (`src/components/ui/ImageLightbox.tsx`): Portal-mounted modal with ESC + click-outside close, left/right arrow navigation for multi-photo sets, captions, `object-contain` image scaling. Exposed as `<ImageLightbox urls=[...] />` component + `useImageLightbox()` hook for declarative usage. Wired into TWO surfaces in this release: (a) the new Phase Photo Gallery on /skin-profile, (b) `src/components/yuri/ChatMessage.tsx` — resolves Bailey's text 3 paper-cut ("can't click photo to enlarge after sending to Yuri"). One component, two fixes.
  - **Phase Photo Gallery** (`src/components/skin-profile/PhasePhotoGallery.tsx`): Tabbed grid (All phases / Phase 1 / Phase 2 / …) with photo counts per phase. Photos with `photo_url` render as clickable square thumbnails opening the lightbox at the right index; photos predating storage (Bailey's two Feb 25 scores) render as graceful placeholder cards showing the date + score + "No photo saved" — the entry still appears so the user sees their journey, just without an image. Score badge color-coded by tier.
  - **Glass Skin Score API extended** (`src/app/api/skin-score/route.ts`): On insert, the route now (a) looks up the user's active treatment phase and tags the new score with `treatment_phase_id`, (b) generates the score UUID upfront, (c) uploads the selfie to the `glass-skin-photos` bucket at path `{user_id}/{score_id}.{ext}`, (d) stores the storage path in `photo_url`. Both photo tagging and upload are non-critical — if either fails, the score still saves (gallery shows entry without photo). Gif uploads skipped (bucket policy excludes; rare for selfies).
  - **Skin Profile page** (`src/app/(app)/skin-profile/page.tsx`, 7 sections): (1) Header with active phase badge + Day N + last Yuri check-in timestamp, (2) Skin Breakdown (Opus prose with Refresh button that calls `?regenerate=true`), (3) Phase Journey Timeline (expandable cards per phase showing goal, protocol JSONB rendered as nested key/value, decisions list, watch-for list, outcomes for completed phases, photo count), (4) Phase Photo Gallery, (5) Current Routine Snapshot (read-only mini-cards for active AM/PM routines with link to /routine for editing), (6) What Yuri Has Learned (Holy Grail products, Broke-Me-Out products, allergies), (7) Footer hint for thin profiles. Consolidating API `/api/skin-profile` runs 5+ reads in parallel; photo signed URLs fetched separately via `/api/skin-profile/phase-photos`.
  - **Nav** (`src/components/layout/Header.tsx`): "Skin Profile" link added between Dashboard and Scan on both desktop and mobile menus.
  - **Files created**: `supabase/migrations/20260518000001_add_treatment_phases_and_skin_breakdown.sql`, `scripts/backfill-bailey-phases.ts`, `src/lib/yuri/treatment-phase-extractor.ts`, `src/lib/intelligence/skin-breakdown.ts`, `src/components/ui/ImageLightbox.tsx`, `src/components/skin-profile/PhasePhotoGallery.tsx`, `src/app/api/skin-profile/route.ts`, `src/app/api/skin-profile/phase-photos/route.ts`, `src/app/(app)/skin-profile/page.tsx`
  - **Files modified**: `src/lib/yuri/advisor.ts` (import + fire-and-forget call), `src/components/yuri/ChatMessage.tsx` (lightbox wired into image thumbnails), `src/app/api/skin-score/route.ts` (phase tag + photo storage), `src/components/layout/Header.tsx` (nav link)
  - **Build verified**: `tsc --noEmit` passes clean. `next build` passes clean — `/skin-profile` route present at 8.56 kB.
  - **Bailey-specific state after deploy**: Two phase rows visible (Phase 1 completed with 3 decisions + 3 watch items + outcomes block; Phase 2 active with 4 decisions + 4 watch items, Day 14 of treatment as of May 18). Two Feb 25 Glass Skin photos tagged to Phase 1. First /skin-profile visit will synchronously generate her Skin Breakdown via Opus 4.7 against her actual profile + decision memory + active phase context. Subsequent visits use cached text; regenerations fire on phase change or 7-day floor.
  - **NOT in scope this release**: User-facing edit of phase data (intentional — Yuri owns phase state, users see it but don't edit it directly). Photo upload from the Skin Profile page itself (photos come via /glass-skin or future Yuri chat upload). Side-by-side before/after comparison within a phase (could come later when Bailey has 4+ photos in a single phase).
- v10.5.2 (May 17, 2026): Bailey feedback — kill bad recommender + chart bug + bootstrap data
  - **Origin**: Bailey opened her routine page on May 17 (Day 12 of Phase 2) and the Routine Intelligence widget told her she was "missing high-value ingredients" — Arginine, Candelilla Wax, and Stearalkonium Hectorite — for combination skin/pores concern. She screenshotted it to Yuri who diagnosed all three as garbage (Arginine = pH buffer, Candelilla Wax = thickener, Stearalkonium Hectorite = clay viscosity agent). Bailey's iMessage to Scott: *"I think we just get rid of the 'recommended' part all together. Whatever's recommended Yuri does it."* Also flagged the Glass Skin Progress History chart looked broken (two floating dots, no line between them).
  - **Fix 1 — Widget removed** (`src/components/routine/RoutineEffectiveness.tsx`, `src/app/api/routine/effectiveness/route.ts`): Killed the "Missing high-value ingredients" panel entirely per Bailey's ask. Yuri is now the sole recommender — she has the decision memory, treatment phase context, and conversation history to make informed recommendations. The widget competed with her instead of feeding her. Concern-effectiveness bars and seasonal insight kept (those reflect actual routine, not algorithmic projection). The function `getMissingHighValueIngredients` in `routine-effectiveness.ts` is no longer called by any route — left in place for now but should be removed in a future cleanup.
  - **Fix 2 — Glass Skin chart rendering bug** (`src/components/glass-skin/ProgressTimeline.tsx`): Two compounding SVG bugs. (a) Line 36-37 x-coordinate math was broken by operator precedence — `chartPadding/3*100/chartHeight` produced 6.67 instead of the intended left padding offset. (b) Lines 44 and 107 used percent strings inside SVG `<path d>` commands, which is silently invalid syntax — SVG element attributes accept %, path commands don't. So the dots rendered (circles accept %) but the line and gradient area never drew, exactly matching Bailey's screenshot. Fixed: viewBox-numeric coordinates throughout, removed `%` from path `d` strings.
  - **Fix 3 — Bootstrap effectiveness data cleaned** (`supabase/migrations/20260517000001_clean_bootstrap_effectiveness_data.sql`): 87 rows across 49 ingredients deleted from `ss_ingredient_effectiveness`. Root cause: the Phase 11.4 bootstrap script for ingredient effectiveness scored ingredients by frequency-in-products, not actual mechanism. So waxes, solvents, silicones, pH buffers, preservatives, and water variants all scored at effectiveness 1.000 because they're in every product. The denylist targets formulation auxiliaries explicitly: water variants, solvent/humectant glycols (butylene glycol, propanediol, etc.), wax/clay/gum thickeners (candelilla wax, xanthan gum, stearalkonium hectorite), emollient esters with texture-only role (caprylic/capric triglyceride, cetyl ethylhexanoate), silicones (dimethicone, cyclopentasiloxane), surfactants/emulsifiers (polysorbate 60, PEG-7 glyceryl cocoate), preservatives + boosters (phenoxyethanol, ethylhexylglycerin, EDTA), pH buffer (arginine), colorant (caramel), absorbent (silica), polyol (mannitol). NOT touching legit hydrators/soothers/botanicals/ceramides even when their `is_active` flag is imperfect — explicit denylist is safer than blanket `is_active = false` filter. Skin-type filler row reduction: dry 52→16, sensitive 21→5, combination 20→3 (Bailey's skin type), oily 13→3, normal 9→2. Active rows preserved across all types.
  - **Files modified**: `src/components/routine/RoutineEffectiveness.tsx` (widget block removed, MissingIngredient interface dropped), `src/app/api/routine/effectiveness/route.ts` (function call + import removed), `src/components/glass-skin/ProgressTimeline.tsx` (chart math + SVG path fixed)
  - **Files created**: `supabase/migrations/20260517000001_clean_bootstrap_effectiveness_data.sql`
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean
  - **NOT addressed this release** (separate feature work, blueprinted in `PHASE-13D-LIVING-SKIN-PROFILE.md`): Bailey's two user-driven feature requests from May 17 evening — Living Skin Profile page that evolves with treatment phases, and Phase Progress Photo Gallery. These came after she saw Yuri's deep skin breakdown ("combination, Fitzpatrick 3, humid Austin, T-zone vs cheeks split, PIH danger zone, climate math") and immediately said: *"I think we should make a section specific to details about your individual skin once known by Yuri. Maybe in the Routine section? or maybe in another spot? I just think it'd be a good thing to go back frequently and review. Maybe even a little more detailed than this that Yuri creates and it changes based on where in the journey you are."* And: *"Also think there should be a saved spot for photos used throughout the phases to see the progress."* Documented for next-session implementation.
- v10.5.1 (May 16, 2026): LGAAS-ported patterns — per-message timestamps + Heat Check refinements + phantom tool-call stripper + next session opener
  - **Origin**: After v10.5.0 shipped, audited LGAAS's `advisor-conversation.js` and `advisor-prompt-helpers.js` for cross-cutting patterns Yuri didn't have. LGAAS and Yuri use the same model (Opus 4.7), same conversation architecture, same tool-use loop — borrowing LGAAS's production-tested defenses prevents Seoul Sister from re-discovering the same bugs in production. Four patterns ported.
  - **Feature A — Per-message timestamp tags** (`src/lib/yuri/advisor.ts`): Every historical message in conversation history now gets a `[Mon 9:57 AM]` prefix in the user's timezone before being sent to Claude. New `formatMessageTimestamp(utcTimestamp, timezone)` helper uses `Intl.DateTimeFormat` with `formatToParts`. Without these tags, Claude saw a flat wall of un-anchored history; with them, she has temporal anchors throughout the thread. Companion to v10.5.0's RIGHT NOW tail block. Pattern ported verbatim from LGAAS advisor-conversation.js:142.
  - **Feature B — Heat Check refinements** (`src/lib/yuri/advisor.ts`): Two LGAAS refinements added to Yuri's existing Heat Check section. (1) *"If frame confirmed, build the case with full strategic fire — you held the line, you earned the right to escalate."* Gives Yuri permission to go hard after verification instead of staying neutral forever. (2) *"Do not over-apologize for asking — the question itself was the right move."* Defensive prep against the user being annoyed at clarifying questions; explicitly forbids "Just want to make sure" or "sorry to push back" undertones.
  - **Feature C — Phantom tool-call narration stripper** (`src/lib/yuri/voice-cleanup.ts`, called from `advisor.ts` and `widget/chat/route.ts`): Regex post-processor that removes Opus's phantom "Ignore that tool call, misfire on my end" narrations when no real tool fired this turn. LGAAS observed this pattern in production (Apr 24 long-thread test). v10.2.1's preventive Tool-Call Honesty prompt rule catches most cases but isn't bulletproof on dense contexts. New `stripPhantomToolCallNarration()` invoked only when `totalToolsFired === 0` (so a legitimate apology about a real tool failure isn't accidentally stripped). Logs to `console.warn` when stripping occurs so we can monitor.
  - **Feature E — Pre-stored next session opener** (`src/lib/yuri/memory.ts`, summary generation in `advisor.ts`, migration `20260516000003_add_next_session_opener.sql`): Sonnet summary generation now also produces a one-sentence natural opener for the next conversation. New `next_session_opener TEXT` column on `ss_yuri_conversations`. Loaded by `memory.ts` and surfaced in system prompt with a "this is a suggestion, not a script" framing — Yuri uses it when the user opens with a greeting, ignores it when they jump straight into a topic. Pre-existing conversations get the opener populated as their next summary cycle runs.
  - **Feature D NOT shipped** (Treatment Plan as first-class entity): Documented as deferred. Bailey's May 17 feedback subsequently reframed D from "hidden table" to "user-visible Living Skin Profile + Phase Photos" — see PHASE-13D-LIVING-SKIN-PROFILE.md.
  - **Files modified**: `src/lib/yuri/advisor.ts`, `src/lib/yuri/memory.ts`, `src/lib/yuri/voice-cleanup.ts`, `src/app/api/widget/chat/route.ts`
  - **Files created**: `supabase/migrations/20260516000003_add_next_session_opener.sql`
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean
- v10.5.0 (May 16, 2026): Bailey audit — timezone fix + Yuri Glass Skin awareness + routine inventory check + photo quality awareness
  - **Origin**: Comprehensive audit of Bailey's 7-month usage triggered by Scott reviewing her last 24 hours of activity. Surfaced four real problems documented from Bailey's actual conversation transcripts and live data: (P0) Date precision regression where Yuri said "tomorrow is Tuesday May 5" when it was Sunday May 3 because server UTC clock diverged from Bailey's Austin local clock late at night. (P2-B) Yuri had zero awareness of Bailey's Glass Skin Score history — she scored 48/49 back-to-back on Feb 25 and never returned because Yuri couldn't naturally nudge her for a Phase 2 baseline (she didn't know one was missing). (P1) Routine page "missing high-value ingredients" widget didn't cross-reference Bailey's inventory — falsely claimed she had HA covered via a saved-but-unowned Torriden DIVE-IN, and falsely flagged ingredients as missing when she actually owned them. (P2-A) Glass Skin Score Vision prompt was photo-condition-blind — Bailey's post-hot-shower bathroom-light photos got scored at face value because the prompt didn't ask Claude to assess lighting/conditions.
  - **Fix P0 — Timezone-aware date injection** (LGAAS pattern adopted): New `timezone TEXT` column on `ss_user_profiles`. Backfilled Bailey to `America/Chicago` and vibetrendai to `America/Los_Angeles`. Rewrote the date block in `advisor.ts` using `Intl.DateTimeFormat` + `formatToParts` + IANA timezone. Moved to a "RIGHT NOW" tail block placed AFTER user context with authoritative framing: *"This is the AUTHORITATIVE current date and time — it overrides any date mentioned earlier in this conversation. If you said a different day/date earlier in this thread, you were wrong then and this is correct now."* That framing gives Yuri permission to self-correct instead of doubling down. Pattern copied from LGAAS `advisor-conversation.js` lines 4038-4055.
  - **Fix P2-B — Yuri Glass Skin Score awareness** (`src/lib/yuri/memory.ts`): New `GlassSkinScoreSummary` interface, new `glassSkinHistory` field on `UserContext`. Conditional load (routine/skin_profile/general topics) of the 3 most recent scores. Formatter renders dates + dimension breakdown + stale-baseline observational note when latest score is 30+ days old. Lets Yuri reference past scores naturally and notice when a Phase 2 baseline would help.
  - **Fix P1 — Routine missing-ingredients inventory awareness** (`src/lib/intelligence/routine-effectiveness.ts`): `getMissingHighValueIngredients` now unions `ss_user_products` (inventory) with `ss_routine_products` (saved routine) to build a complete "what ingredients does the user have access to" set. Fixes both phantom-coverage (saved routine has unowned product → falsely "covered") and phantom-missing (owns HA serum but not in any saved routine → falsely "missing"). Backward compatible when `userId` is null. (Note: v10.5.2 subsequently removed this entire widget per Bailey's request — kept this fix in place as defense-in-depth in case `getMissingHighValueIngredients` is called from anywhere else in the future.)
  - **Fix P2-A — Vision prompt photo quality awareness** (`src/app/api/skin-score/route.ts`, migration `20260516000002_add_glass_skin_photo_quality.sql`): New `photo_quality JSONB` column on `ss_glass_skin_scores`. Vision prompt now asks for `photo_quality: { lighting_quality, conditions[], confidence_modifier }`. When `confidence_modifier < 0.85`, the `/glass-skin` page renders an amber banner naming the specific issues (bathroom lighting, post-shower flush, etc.) and suggesting a retake.
  - **Files modified**: `src/app/(app)/glass-skin/page.tsx`, `src/app/api/skin-score/route.ts`, `src/lib/intelligence/routine-effectiveness.ts`, `src/lib/yuri/advisor.ts`, `src/lib/yuri/memory.ts`, `src/types/database.ts`
  - **Files created**: `supabase/migrations/20260516000001_add_user_timezone.sql`, `supabase/migrations/20260516000002_add_glass_skin_photo_quality.sql`
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean
- v10.4.0 (May 8, 2026): Feature 16.1 — Proactive Ingredient Overlap Detection (Bailey's gap)
  - **Origin**: Bailey told Scott she'd had several products with the same active ingredient and had to ASK Yuri whether to lighten up. Yuri agreed it was a good idea, but Bailey's complaint was: *"I want Yuri to recognize problems like that without me having to bring it up."* Cross-application audit confirmed the gap: existing infrastructure detects ingredient *conflicts* (retinol + AHA antagonism) and missing high-value ingredients, but had **zero proactive logic for ingredient overlap/redundancy**. The only place stacking surfaced was Shelf Scan, which requires the user to manually photograph their shelf. Verified against Bailey's actual data — her routine + inventory contains niacinamide in 5 products, adenosine in 4, glycerin/vitamin E in 3, and several others in 2 — exactly the "lighten up?" question she asked Yuri without prompting.
  - **Core module** (`src/lib/intelligence/ingredient-overlap.ts`, ~290 lines): New `detectRoutineOverlap(supabase, userId)` and `detectScanOverlap(supabase, userId, scannedIngredientIds, excludeProductId)` functions return raw structured data — list of overlapping ingredients with their function descriptions, product display names, total counts, and severity tier (`worth_noting` for 2 products, `likely_excessive` for 3+). **AI-First**: zero canned phrases, zero advice templates, zero narrative generation. Yuri reads the data and decides what to do with it.
  - **`is_active=true` gate**: Critical design decision. The `ss_ingredients` schema has `is_active` (boolean, 8,277 rows flagged) marking ingredients as actives vs fillers. Water, butylene glycol, 1,2-hexanediol, dipropylene glycol, glycereth-26, and other humectants/solvents/preservative boosters are SKIPPED — stacking them across 6 products is normal, not noteworthy. Without this gate, the overlap report would be 80% noise. Fragrance ingredients also filtered.
  - **Yuri context wiring** (`src/lib/yuri/memory.ts`): Extended `UserContext` interface with `ingredientOverlap: IngredientOverlapResult | null`. Conditionally loaded in `loadUserContext()` Promise.all batch — only when intent classification surfaces routine/ingredients/products topics (skipped on focused pricing/trending/counterfeit queries). `formatContextForPrompt()` renders a new `## Active Ingredient Stacking in Their Routine` section ONLY when entries exist. Section explicitly tells Yuri "this is information about THEIR routine, not advice" — preserves Yuri's freedom to judge whether benign or wasteful given concentration and product type.
  - **System prompt instruction** (`src/lib/yuri/advisor.ts`): Added a Quick Reminders bullet matching the existing masks/patches proactive pattern (line ~161). Phrasing gives permission to surface stacking *without being asked* — when the user is considering a new product, when they ask whether to lighten up, when something feels off. Explicitly: "One observation, not a lecture. The stacking data is THEIR routine, not advice — your read on what to do with it is what matters."
  - **Scan enrichment hook** (`src/lib/scanning/enrich-scan.ts`): Added `overlapPreview` field to `ScanEnrichment` interface and a 9th parallel fetcher (`fetchOverlapPreview`) to the parallel batch. Resolves scanned ingredient names → catalog IDs (two-pass `name_en` + `name_inci` lookup, single round trip), then calls `detectScanOverlap` excluding the scanned product itself. When the user scans a new product, they immediately see "you already have niacinamide in 3 products" — zero extra clicks, zero extra navigation.
  - **UI rendering** (`src/components/shared/EnrichmentSections.tsx`): New `OverlapPreview` component matches existing section style (glass-card, lucide Layers icon, color-coded ring — sky for worth_noting, amber for likely_excessive). Displays ingredient name, function description, full list of products containing it, with explicit "+ the product you just scanned" footer. Footer line: "Ask Yuri whether this stacking is helping or hurting — she has the full picture of your routine." Wired into ScanResults.tsx (between Ownership and IngredientInsights) and ProductEnrichment.tsx (right after PersonalizedMatch). The product detail page enrichment is a bonus side-effect — viewing any product page now shows whether its actives already exist elsewhere in the user's routine.
  - **Architecture properties**: No new database tables, no migrations, no env vars. Pure runtime computation off existing tables (`ss_user_routines`, `ss_user_products`, `ss_routine_products`, `ss_product_ingredients`, `ss_ingredients`, `ss_products`). Conditional context loading preserves Phase 13.4 token economics. Failure-safe: every catch returns `EMPTY_RESULT` so overlap detection never breaks Yuri's other context loads or scan enrichment.
  - **What is NOT in this release**: No standalone `/overlap` page, no notification system, no routine-page banner widget. Bailey's complaint was that she had to *ask* — the fix is making Yuri *see* the data, not adding new places she has to navigate to. Routine page banner could come later if usage signals warrant it.
  - **Files created**: `src/lib/intelligence/ingredient-overlap.ts` (~290 lines)
  - **Files modified**: `src/lib/yuri/memory.ts` (UserContext + loadUserContext + formatContextForPrompt), `src/lib/yuri/advisor.ts` (Quick Reminders), `src/lib/scanning/enrich-scan.ts` (ScanEnrichment + parallel fetcher), `src/components/shared/EnrichmentSections.tsx` (OverlapPreview component), `src/components/scan/ScanResults.tsx` (render OverlapPreview), `src/components/products/ProductEnrichment.tsx` (render OverlapPreview)
  - **Build verified**: `npx tsc --noEmit` passes clean
- v10.3.9 (May 7, 2026): Stub enrichment + verified-flag auto-promote (P0 P1 catalog repair)
  - **Origin**: Yesterday afternoon (May 6) a widget visitor asked Yuri "Best serum for glass skin?" and two of three tool calls returned 0 results. Investigation surfaced two stacked bugs: (a) Phase 15.1 follow-up needed — 696 products had stub ingredient links from the original Feb 19 brand-expansion seed, never enriched by Phase 9 because they bypassed `ss_product_staging`. (b) The May 5 audit's P1 finding had reproduced in production — only 588 of 5,904 products (10%) had `is_verified=true`, and Yuri's tools filter by that flag, making 90% of the catalog invisible.
  - **Stub enrichment run** (`scripts/enrich-stub-products.ts`, ~3 hours, $11.63 Sonnet cost): 685 stub products processed via Brave Search + Incidecoder page fetch + Sonnet 4.5 verification at 0.7 confidence gate. 573 succeeded (83.6%), 111 skipped at low confidence (most caught wrong-product-page mismatches via Sonnet's self-validation), 1 hit a confidence-out-of-range error. **Inserted 19,426 verified ingredient links and 353 new master ingredients.** The Reddit-confabulation product (Haruharu Wonder Black Rice Hyaluronic Toner) now has 27 verified ingredients linked — closing the original incident that triggered Phase 15.1.
  - **Pre-flight cleanup**: 10 `not_skincare` contaminated stubs (eyelashes, food, hair tools) deleted before backfill — bypassed v9.0.0's cosmetics cleanup. Cascade-deleted 2 trending records, 0 user data affected.
  - **Migration `20260507000001`**: Added Haruharu Wonder Black Rice Hyaluronic Toner Plus (Fragrance-Free) — the FF variant was missing from the catalog despite being on the brand's bestseller list. Backed by 22 verified ingredients at 1.00 confidence.
  - **Verified-flag auto-promote** (`src/lib/pipeline/auto-promote-verified.ts`): Wired into `link-ingredients` cron (7:30 AM UTC). After daily ingredient linking, products are automatically promoted to `is_verified=true` if they meet hardened criteria: name+brand+category present, category != 'not_skincare', `ingredients_raw` populated, ≥1 price record, ≥8 ingredient links. RPC `auto_promote_verified_products()` does the SQL in one shot for performance; JS fallback runs if RPC missing. **One-shot UPDATE flipped 4,723 products from unverified→verified (10%→90% catalog visibility).** Daily cron prevents this gap from re-opening as new products enter via Olive Young pipeline.
  - **Review queue infrastructure** (`ss_enrichment_review_queue` table): Persistent record of the 112 products the script couldn't enrich. Fields: product_id, source_url, confidence, reasoning, retry_count (max 6), retry_after (default +30 days), status (pending/in_progress/resolved/permanent_skip). RLS: service-role write, admin read. Replaces the ephemeral `/tmp` log.
  - **Monthly retry cron** (`/api/cron/retry-enrichment-queue`, 1st of month 4:30 AM UTC): Currently a placeholder that logs what would be retried. First real retry batch is due June 6, 2026 (30 days from backfill). TODO before then: refactor `enrich-stub-products.ts` pipeline helpers into a shared module (`src/lib/pipeline/stub-enrichment.ts`) so the cron can run real enrichment.
  - **Original bug fixed**: Yesterday's failing Yuri query (`category=serum, min_rating=4.3, niacinamide`) returned 0 visible products. Same query today returns 283. Per-category visibility now: mask 946, moisturizer 911, cleanser 731, sunscreen 622, serum 489, toner 438.
  - **Bailey-relevant outcome**: Aestura Atobarrier 365 Cream and 7 other Aestura barrier-repair products now have verified INCI lists. Yuri can ground her Phase 2 recommendations in real data instead of training-knowledge guesses.
  - **Files modified**: `src/app/api/cron/link-ingredients/route.ts` (auto-promote step added), `vercel.json` (new monthly cron entry, 14→15 active crons). **Files created**: `src/lib/pipeline/auto-promote-verified.ts`, `src/app/api/cron/retry-enrichment-queue/route.ts`, `supabase/migrations/20260507120001_add_auto_promote_rpc_and_review_queue.sql`, `scripts/build-review-queue-backfill.ts`, `scripts/review-queue-backfill.sql` (112 INSERT statements).
  - **Honest assessment**: 111 review-queue products are documented but won't get retried until June 6 (placeholder cron). 585 products remain unverified — they legitimately fail the criteria (no price, fewer than 8 ingredient links, or no INCI raw) and will be promoted naturally as the daily pipeline fills them in. The Olive Young scraper P0 issue (silent zero-result for 2+ weeks per May 5 audit) is unrelated and still pending.
  - **Build verified**: `tsc --noEmit` passes clean.
- v10.3.8 (May 6, 2026): Bailey-prep weekend hardening — date precision, routine/ownership separation, scanner discoverability, price-staleness honesty, OY zero-result alarm
  - **Origin**: Deep dive on Bailey's 3-month usage ahead of an in-person visit surfaced 6 fixable friction points without changing any user-visible feature. All ship together because they're independent and low-risk: each touches a different file, all type-check and build clean.
  - **Date precision** (`src/lib/yuri/advisor.ts`): Yuri's system prompt now injects pre-computed Today / Tomorrow / Yesterday with full weekday names on every turn. Bailey hit "Tomorrow is monday?" → Yuri said Tuesday on May 4 2026 (it was Sunday). The fresh-per-turn date was already correct; the bug was Claude doing weekday arithmetic and getting it wrong. Pre-computing removes the math step. Same defensive pattern as v8.5.0 but stronger.
  - **Routine/ownership separation** (`src/lib/yuri/memory.ts`): `loadUserContext()` now joins `ss_user_products.product_id` and builds an `ownedProductIds` Set so each `ss_routine_products` entry is tagged `'owned' | 'planned_only'`. New `RoutineProductEntry` interface; `UserContext.routineProducts` changed from `string[]` to typed objects. Formatter renders two distinct sections: "In their plan AND owned" vs "In their plan but NOT in their inventory (do NOT claim they own these)." Bailey hit this on May 3 — Yuri claimed she owned Torriden DIVE-IN (it was in her saved routine but never bought). Treating saved routines as ownership produced a real trust-eroding moment.
  - **Scanner discovery banner** (`src/components/dashboard/ScannerDiscoveryBanner.tsx` + dashboard wire-up): One-time dismissible hero callout on `/dashboard` for users with 0 scans in the current billing period. Bailey used the scanner exactly once in 3 months — the platform's biggest differentiator was getting missed by the most engaged user. Banner queries `ss_user_scans` for the current month, hides when 0 found OR localStorage dismissed (versioned key `ss_scanner_discovery_dismissed_v1`).
  - **Price staleness honesty in `compare_prices`** (`src/lib/yuri/tools.ts`): Tool result now includes per-row `age_days`, `is_stale` (>14d), and a top-level `freshness.honesty_note` instructing Yuri to surface staleness inline ("last verified X days ago") when citing old prices. Same Tool-Call Honesty pattern as v10.2.1. K-beauty pricing fluctuates monthly; quoting month-old data confidently erodes trust.
  - **Cycle-tracking soft nudge** (`src/lib/yuri/memory.ts` formatter): When user has hormonal/cycle/period/PMS keywords in `skin_concerns` AND has NOT enabled cycle tracking, system prompt gets a conditional one-time-per-session rule allowing Yuri to mention `/profile` cycle logging if the user brings up cycle topics. Frame as offer, not pitch. Decision-memory feature-repetition rule (v8.1.2) prevents re-mentioning across sessions. Bailey's #1 concern is hormonal acne but cycle tracking has 0 entries.
  - **Olive Young zero-result alarm** (`src/lib/pipeline/sources/olive-young.ts`): Added `console.error` "ZERO-RESULT ALARM" when `scrapeAllListings` returns 0 products. Logs URL, category ID, and whether the prdt-unit selector timed out. Same scraper-zero-result bug class identified as P0 in CLAUDE.md May 5 audit but never alarmed. Future Vercel cron runs will surface failures in logs instead of silently completing.
  - **Targeted price refresh** (operational, not code): Ran `scripts/run-prices.ts --retailer soko_glam --brands "COSRX,Goodal,Illiyoon,Medicube,Beauty of Joseon"` followed by YesStyle. Yielded fresh prices for Beauty of Joseon catalog incl. Bailey's Phase 2 sunscreen. Mitigates the underlying Olive Young scraper failure for her specific use case before the weekend.
  - **Build verified**: `tsc --noEmit` and `next build` both pass clean.
  - **NOT in scope this release**: No fix to underlying Olive Young scraper (alarm only). No backfill on existing decision-memory rows. No data migration.

- v10.3.7 (May 5, 2026): Routine page polish — missing-steps phase-awareness + BHA aliasing + created_at ordering fix
  - **Origin**: Visual review of Bailey's `/routine` page surfaced 4 issues invisible in DB queries — wrong "Missing Steps — Cleanser" warning (custom shower/rinse steps not recognized), Salicylic Acid still recommended despite COSRX BHA being in routine (no ingredient aliasing), corrupted ss_user_products (step 9 sunscreen showed "Ice roller" heading), and a regression of the v10.3.6 phase filter caused by the date-repair SQL bumping updated_at on 7 historical rows simultaneously and evicting recent decisions from the LIMIT 5 window.
  - **`detectMissingSteps` phase-aware** (`layering-order.ts`): accepts `customStepNotes`; new `inferCategoryFromNotes` helper maps "Shower / cleanse" → cleanser, "Cool water rinse" → cleanser, "LED mask" → device. Routine page passes notes from null-product steps. Optional `excludedCategories` set for explicit treatment-plan exclusions.
  - **Ingredient alias filter** (`routine-effectiveness.ts`): collects normalized name tokens from routine ingredients (salicylic, hyaluronic, niacinamide, retinol, vitamin_c) and filters out high-value candidates whose name matches a routine-token alias. Bailey's COSRX BHA contains Betaine Salicylate, which now blocks "Salicylic Acid (BHA)" from showing as missing.
  - **`created_at` ordering on decision memory loads** (`routine-effectiveness.ts`, `memory.ts`): backfill scripts touch `updated_at` en masse, evicting recent conversations from LIMIT N windows. created_at is immutable. Caught while verifying — the date-repair SQL run earlier in this session inadvertently broke the v10.3.6 phase filter by tying 7 historical rows on updated_at.
  - **Bailey's ss_user_products cleaned up** (`scripts/fix-bailey-user-products.sql`): NULLed wrong product_id pointers on devices/actions, fixed mappings on Acwell Toner / Medicube Serum / Illiyoon Cream, NULLed Anua Heartleaf and Medicube Eye Cream (no DB matches).
  - **Verification**: end-to-end scripts run against Bailey's actual AM and PM routines confirm correct filtering. Production deploy hash dpl_ALwsYVsJ35b8uUeS6m65CGBT13TF live.
  - **Build verified**: `npx tsc --noEmit` clean.
- v10.3.6 (May 5, 2026): Phase-aware routine recommendations — `getMissingHighValueIngredients` now filters by decision memory
  - **Origin**: Bailey opened her May 4 conversation because the routine page told her she was missing tranexamic acid + retinol + HA — three ingredients Yuri had explicitly excluded from her current treatment phase. Same class as v8.5.0 Glass Skin phase-awareness. Fix was unblocked by v10.3.4 (decision memory now actually persists, so there's a source of truth to filter against).
  - **Fix** (`src/lib/intelligence/routine-effectiveness.ts`): `getMissingHighValueIngredients` gained an optional `userId` parameter. When provided, loads the user's 5 most recent conversations with non-empty `decision_memory`, scans `decisions[] / preferences[] / corrections[]` for 22 phase-marker phrases (skip, defer, phase 2/3, pause, until, revisit, on hold, etc.), tokenizes the surrounding text, and filters candidate ingredients whose name tokens overlap with the exclusion set. Over-fetches from 20 to 40 high-value ingredients so filtering still leaves enough to return top 3.
  - **API route** (`src/app/api/routine/effectiveness/route.ts`): one-line change passing `user.id` so the filter activates for every authenticated request.
  - **Verification**: end-to-end test against Bailey's actual Phase 2 AM routine confirms HA, retinol, tranexamic acid are filtered out (matching what Yuri excluded on May 4); falls through to Snail Mucin (not excluded). `npx tsc --noEmit` clean.
  - **Deferred**: same filter on products page, dupe finder, scan enrichment. Optional UX surface explaining "Yuri's plan currently excludes X" instead of silent filtering.
- v10.3.5 (May 5, 2026): Fire-and-forget audit — error logging on high-risk background tasks
  - **Origin**: v10.3.4 incident (3 months of lost decision memory hidden by `.catch(() => {})`) prompted an audit pass for the same pattern across the codebase. 184 catch sites total, filtered to 10 high-risk (fire-and-forget background tasks doing real work).
  - **Anomaly investigation first**: ss_ai_usage's Apr 9 cutoff is explained by the AI usage logger feature shipping Apr 7 — not a bug. ss_specialist_insights' apparent 24:2 ratio is misleading framing — insights are tagged by detected specialist mode and spread across 14 conversations. Both anomalies cleared, no additional bugs surfaced.
  - **Changes**: 6 catch sites in `advisor.ts`, `ai-usage-logger.ts`, and `widget/chat/route.ts` now log via console.error (visible in Vercel function logs). 2 outer-stream wrapper catches left silent because inner streams already log.
  - **Not shipped**: lint rule for the pattern, periodic health metrics, medium-risk catch audit (7 sites in memory.ts that fall back to UI degradation rather than silent data loss). Documented as future work.
  - **Build verified**: `npx tsc --noEmit` clean.
- v10.3.4 (May 5, 2026): Decision memory crash — `mergeDecisionMemory` first-write bug
  - **Origin**: A diagnostic of Bailey's account surfaced empty `decision_memory` on all 17 of her conversations. DB query confirmed it was systemic — 30 conversations from 3 users, zero successful writes since Phase 13.3 shipped Feb 23. Conversation summaries (running alongside in the same fire-and-forget block) succeeded 17/30 times, so the issue was specific to the decision-memory extraction path.
  - **Root cause** (`src/lib/yuri/memory.ts`): `mergeDecisionMemory(existing, incoming)` treated `existing === {}` (the JSONB schema default) as truthy and tried to iterate `base.decisions` which was undefined. Threw `TypeError: base.decisions is not iterable` on every first-write call. The fire-and-forget `.catch(() => {})` in `advisor.ts:838` silently swallowed every throw. Three months of decision memory data lost (Feb 23 — May 5 2026).
  - **Fix**: Added explicit `|| []` defaults for `decisions`, `preferences`, `commitments`, and `corrections` arrays before iteration. The v10.2.0 corrections-memory release had noticed this pattern for `corrections` specifically but missed the same issue on the other three arrays from the original v8.1.0 ship.
  - **Backfill** (`scripts/backfill-decision-memory.ts`): Re-runs extraction against all conversations >=4 messages with empty `decision_memory`. Idempotent via topic-keyed merge. Estimated cost ~$1 in Sonnet 4.5 for ~19 affected conversations. Operator runs manually.
  - **Verification**: `npx tsc --noEmit` clean. End-to-end diagnostic re-run against Bailey's onboarding conversation now produces 5 decisions, 6 preferences, 4 commitments (was `{}` before fix).
  - **Lesson worth noting**: Fire-and-forget `.catch(() => {})` is a silent failure trap. Summary path next to the broken extraction succeeded loudly enough that nobody noticed half the system was dead. Worth a future audit pass to add `console.error` to every fire-and-forget catch.
- v10.3.3 (May 5, 2026): Schema fix — ss_routine_products.product_id nullable (root cause of routine mismatch)
  - **Origin**: While applying Bailey's manual data correction (the v10.3.2 follow-up), the SQL failed with `null value in column "product_id" violates not-null constraint`. The schema was the actual root cause — every device step (LED mask, ice roller) and action step (cool water rinse, shower / cleanse) was forced to point at *some* product, which made `executeSaveRoutine`'s fuzzy matcher produce wrong-product saves like Bailey's. v10.3.2 was a partial mitigation that couldn't fully work until this constraint was relaxed.
  - **Migration** (`supabase/migrations/20260505000001_routine_products_allow_null_product_id.sql`): `ALTER TABLE ss_routine_products ALTER COLUMN product_id DROP NOT NULL`. Routine steps now save with `product_id = NULL` for non-product items; the step content lives in `notes`.
  - **UI patches** (`src/app/(app)/routine/page.tsx`): Reorder/remove buttons hide on null-product rows (the routine API still addresses rows by product_id). When `rp.product` is null and notes exist, notes render as the step content. `RoutineProduct.product_id` typed `string | null`. Handlers accept null and early-return; reorder builds productIds from the filtered non-null array.
  - **Read-path audit**: All 14 other files using `ss_routine_products` verified safe — most already had null guards or used `.in()` filters that silently drop null entries. No additional code patches required.
  - **Combined SQL** (`scripts/fix-bailey-phase2-routines.sql`): Migration + Bailey's Phase 2 AM/PM data restore in one Supabase Studio paste. Custom steps (Cool water rinse, Ice roller, LED mask, Shower) now save as `product_id = NULL` with the original transcript notes.
  - **Build verified**: `npx tsc --noEmit` passes clean.
  - **Deferred**: Routine API should eventually address rows by `ss_routine_products.id` instead of `product_id` so null-product steps can be reordered/removed through the page UI. Current interim: null steps display in the routine but only editable through Yuri.
- v10.3.2 (May 5, 2026): Routine save honesty — resolver tiebreaker + mismatch reporting + optional product_id
  - **Origin**: Bailey's account diagnostic surfaced that her active Phase 2 AM/PM routines did not match what Yuri promised in chat (May 4). Yuri described a 9-step Phase 2 AM with Goodal Vita C in slot 4 and a PM with COSRX BHA Blackhead Power Liquid in slot 4 (Mon/Wed/Fri). The actual `ss_routine_products` rows showed Torriden DIVE-IN HA Serum and COSRX Snail 96 Mucin Essence in those slots. Yuri's "Saved ✨" message claimed success without acknowledging any mismatch.
  - **Fix 1 — `resolveProductByName` tiebreaker** (`src/lib/yuri/tools.ts`): When multiple products match every query term, the resolver now sorts candidates by combined `brand_en + name_en` length ascending (closer fit first), then by rating. The previous behavior (sort by rating only) penalized products without ratings — "Goodal Green Tangerine Vita C" was resolving to the highest-rated *Cream* over the more specific *Serum*.
  - **Fix 2 — Authoritative tool message** (`src/lib/yuri/tools.ts`): `executeSaveRoutine` now classifies each saved step as `matched` (every query term in chosen product's brand+name), `matched_loose` (DB row found but query terms don't all appear — dangerous match), or `no_db_match` (saved as custom entry). The tool's `message` field names every loose match and unmatched entry inline.
  - **Fix 3 — Optional `product_id` on save_routine** (`src/lib/yuri/tools.ts`): The save tool input schema now accepts an optional `product_id` per step. When present, save bypasses name-based resolution and uses the ID directly. Tool description and advisor system prompt teach Yuri the search-first pattern: search_products → grab the product_id → pass it on the save call.
  - **System prompt rules** (`src/lib/yuri/advisor.ts`): Added two new rules under `**save_routine**`. (1) Pass `product_id` on each step unless the item isn't in the DB. (2) After save_routine returns, Yuri's reply MUST quote the tool's `message` field verbatim — this is the structural fix that prevents "Saved ✨" while loose matches sit in the routine.
  - **Bailey's existing routine NOT corrected by this release**: Her active Phase 2 AM/PM rows still reflect the pre-fix mismatch. Manual correction or asking Yuri to redo the save under the new code is required.
  - **Build verified**: `npx tsc --noEmit` passes clean
- v10.3.1 (Apr 29, 2026): Products Search Price Filter Made Opt-In (LGAAS Grounding Fix)
  - **Fix** (`src/app/api/admin/products/search/route.ts`): The unconditional `.not('price_usd', 'is', null)` filter was silently dropping ~14% of the catalog (845/5,898 products as of Apr 29) from any search request, including products with full INCI data but no US pricing yet. For LGAAS Reddit response generation, this caused empty `PRODUCT KNOWLEDGE` blocks for niche/Korean-only releases and forced Opus to confabulate from training data
  - **Caught while diagnosing** two ungrounded AriaStar drafts for an r/koreanskincare post about the SKIN1004 Madagascar Centella Probio-Cica Bakuchiol Eye Cream (`price_usd IS NULL` in our DB; full 47-ingredient INCI present). V1 confabulated 1,2-hexanediol's position; V2 retreated to "DO NOT put it near your eyes." V3 (post-fix) correctly identified BOTH the Lactobacillus/Centella ferment filtrate (position 15) and 1,2-hexanediol (position 5) as the likely scent sources
  - **API change**: New optional `require_price: boolean` schema param (default `false`). Strict filter is now conditional — applies only when `require_price === true` OR `price_max` is specified. Backwards compatible: callers using `price_max` automatically retain strict behavior; price-comparison/dupe flows can opt back in explicitly
  - **Cross-repo**: See LGAAS Blueprint 59 (`/lgaas/lgaas-blueprint/59-PRODUCTS-SEARCH-PRICE-FILTER-GAP.md`) for the full incident postmortem, why the Blueprint 44 grounding defenses didn't catch this (silent data-access failure vs. reasoning failure), the deferred voluntary-search gap (Opus invoking web_search when catalog is empty), and the recommendation to sweep other admin endpoints for similar unconditional filter patterns
  - **Build verified**: `tsc --noEmit` passes clean. Commit `5401262`, deployed to Vercel Apr 29 2026
- v10.3.0 (Apr 26, 2026): Phase 15 Session 2 COMPLETE — Heat Check + Draft Preservation + Age-Aware Memory
  - **Origin**: Phase 15 Session 1 (v10.2.0) shipped corrections memory and the textarea max-height fix. Session 2 closes out Phase 15 with the three remaining items from the LGAAS audit: Heat Check (15.2), Draft Preservation (15.3), and Age-Aware Memory Rendering (15.4). All three were documented as deferred in the Phase 15 section of CLAUDE.md after Session 1.
  - **Feature 15.2 — Heat Check / Match Tempo Not Temperature** (`src/lib/yuri/advisor.ts` system prompt). New section added between `## Emotional Intelligence` and the closing of `YURI_SYSTEM_PROMPT`. Trigger: user message has all three of (1) emotional heat, (2) accusation about a third party (brand/derm/influencer/retailer), (3) cited evidence ("the INCI says X", "I have a screenshot"). Old behavior: Yuri matches the heat by validating the accusation and helping build a case, becoming a "takedown amplifier." New behavior: ask ONE clarifying question that surfaces missing context BEFORE engaging substantively. Three concrete examples in the prompt cover packaging variants ("regional batches have different INCI"), reformulations ("they reformulated in late 2024"), and screenshot verification ("want to make sure I'm reading the same thing you are"). Explicitly framed as "defending the user from looking foolish later," NOT defending the third party. Adapted from LGAAS `advisor-prompt-helpers.js:2320-2347` with K-beauty-specific examples.
  - **Feature 15.3 — Draft Preservation on Send Error** (`src/hooks/useYuri.ts` + `src/components/yuri/ChatInput.tsx` + `src/app/(app)/yuri/page.tsx`). The existing useYuri hook already preserved partial *streamed* content (lines 215-237). The gap: when the request fails BEFORE any text streams (403, network error, abort), the user's typed message disappears from the textarea because ChatInput optimistically clears `value` on submit. Fix: new `lastFailedDraft: string | null` state in useYuri, set in the catch block when no partial content was preserved. New `restoredValue` and `onRestoreConsumed` props on ChatInput. useEffect restores into local `value` state when restoredValue arrives, with a guard that skips restore if the user has already started typing something new (don't clobber active input). Auto-resizes the textarea and focuses it after restore. ~50 lines total across three files.
  - **Feature 15.4 — Age-Aware Memory Rendering** (`src/lib/yuri/memory.ts`). LGAAS Blueprint 46: surface raw timestamps inline, don't bucket, don't instruct — let Opus 4.7 calibrate confidence from raw dates. Three rendering surfaces updated:
    - **Product reactions** (`## Holy Grail Products`, `## Products That Caused Reactions`): Added `recordedAt: string | null` to `ProductReaction` interface, added `created_at` to the Supabase select with `order('created_at', desc)`, render each entry as `- {name} (recorded YYYY-MM-DD)`. Section headers now include one observational sentence: "Older entries may be stale — feel free to ask if it's still working for them" (Holy Grail) and "A reaction from many months ago might not still apply (skin changes, reformulations) — surface the date naturally if you bring it up" (Broke Me Out).
    - **Specialist insights** (`## Past Specialist Intelligence`): Each `### {specialist_type}` heading now includes `(recorded YYYY-MM-DD)` from the existing `createdAt` field on `SpecialistInsightMemory`. Section header gains: "The recorded date on each block lets you weigh how current the insight is; older insights may need a quick check-in before you act on them."
    - **Preferences** (inside `## Your Decisions & Preferences`): Added `date: string` to `DecisionMemory.preferences` interface. Sonnet extraction prompt is NOT changed (avoids wasting tokens on a field that's mostly inferable) — instead the normalization defaults to today's date when not provided. Merge logic preserves the original date when preference content is unchanged (so age renders accurately) and refreshes only when the user actually changes the preference. Render: `- **{topic}**: {preference} (stated YYYY-MM-DD)` with section guidance "Tastes shift; a 'fragrance-free only' from a year ago is probably still load-bearing, but a 'I want to try retinol' from 8 months ago may have already been acted on."
  - **Backwards compatibility**: All three changes handle pre-existing data gracefully. Old reaction rows without `recordedAt` render as `- {name}` (no parenthetical). Old preferences lacking `date` get today's date on first load, then the merge logic locks in that date if the preference is unchanged on subsequent extractions. No DB migration required.
  - **Bonus fix**: Pre-existing TypeScript build error in `scripts/fix-cosrx-snail96-inci.ts:167` (carryover from v10.2.1) resolved with the suggested `as unknown as Array<...>` cast. Build now passes clean.
  - **Phase 15 status**: COMPLETE. All 5 items from the LGAAS memory architecture audit (15.1 corrections memory, 15.2 heat check, 15.3 draft preservation, 15.4 age-aware memory, 15.5 textarea max-height fix) shipped across v10.2.0 and v10.3.0.
  - **Files modified**: `src/lib/yuri/advisor.ts` (Heat Check section in system prompt), `src/hooks/useYuri.ts` (lastFailedDraft state + clearFailedDraft callback), `src/components/yuri/ChatInput.tsx` (restoredValue/onRestoreConsumed props + restore useEffect), `src/app/(app)/yuri/page.tsx` (wire failed-draft props through to ChatInput), `src/lib/yuri/memory.ts` (date fields on ProductReaction + DecisionMemory.preferences, render age tags on three sections), `scripts/fix-cosrx-snail96-inci.ts` (build error fix), `CLAUDE.md` (changelog + Phase 15 status)
  - **Build verified**: `npx next build` passes clean. `npx tsc --noEmit` passes clean.
  - **Cron audit context**: Before Phase 15 Session 2, ran a full cron pipeline audit (Apr 26 2026). All 14 cron jobs in vercel.json are running on schedule. Pricing pipeline writing 14,001 snapshots/week to ss_price_history across 6 retailers. Reddit + Olive Young bestseller scrapers actively populating ss_trending_products. Aggregate-learning + update-effectiveness producing daily output. Identified 3 deferred improvements (Olive Young price refresh batch boost, price staleness UX warning, trend signal generation at scale) — documented in the Future Work section but not addressed in this release.
- v10.2.2 (Apr 26, 2026): Stub Product Re-Enrichment — Eliminating COSRX-Class Hallucination Risk
  - **Origin**: After v10.2.1 shipped tool-call honesty + web_search fallback fixes, a database audit revealed COSRX Snail 96 was the canary for a systemic problem. 43 flagship K-beauty products from the original Feb 17 2026 manual seed (COSRX, Beauty of Joseon, Anua, Klairs, Laneige, Innisfree, Dr. Jart+, Sulwhasoo, Torriden, SKIN1004, Numbuzin, Round Lab, Some By Mi, etc.) had only 1-7 stub ingredient links and `ingredients_raw IS NULL`. Phase 9 Sonnet pipeline never re-enriched them because they bypassed the `ss_product_staging` table entirely. v10.2.1 (honesty + fallback) prevented Yuri from confabulating from training data, but did NOT prevent her from confidently citing wrong DB data via `get_product_details`. Bad data in → confident wrong answers out.
  - **Methodology — Approach 3b (Brave + page fetch + Sonnet verification)**: New script `scripts/enrich-stub-products.ts`. For each stub product: (1) Brave web search "{brand} {name} ingredients incidecoder", (2) Score results favoring authoritative domains (Incidecoder = +100, brand official = +50, Soko Glam/Sephora = +70; Reddit/YouTube/Amazon = -100), (3) Fetch the top URL with browser user-agent + 15s timeout, (4) Strip HTML and extract a 4,200-char window around the first "ingredients" marker (handles 17K-63K char product pages), (5) Pass page content + Brave snippets as cross-reference to Sonnet 4.5, (6) Sonnet returns structured JSON with ingredients + source URL + confidence + reasoning, (7) Confidence gate of 0.7 — anything below goes to manual review queue. This is the same methodology that v10.2.0 corrections memory enforces from the user side, applied proactively to source data.
  - **Pre-flight validation**: Tested on COSRX Snail 96 (already correct from v10.2.1 manual fix) — Sonnet independently extracted exactly 12 ingredients with confidence 0.95, matching the manually-verified list ingredient-for-ingredient. This proved the methodology can rediscover correct INCI without prior knowledge of the answer.
  - **Production run**: 42/43 succeeded (97.7%) on first pass. 1 skipped (Numbuzin No.5 Vitamin Niacinamide Concentrated Serum — Incidecoder URL pointed to "Concentrated Pad" variant; Sonnet correctly identified the product mismatch and refused to write wrong data). One-off `scripts/numbuzin-fix.ts` resolved the skip with corrected Incidecoder URL `numbuzin-no-5-vitamin-concentrated-serum`. Final state: **0 stubs remaining**, 1,292 verified ingredient links inserted (replacing ~120 stub links), 41 new master ingredients added to `ss_ingredients`.
  - **Total cost**: ~$0.69 in Sonnet API (43 products × ~$0.016 average — slightly above original projection due to larger Sonnet inputs from full page content vs snippets, but well under the $1 budget). Brave Search free tier covered all 44 queries (43 + 1 manual).
  - **Spot-check verification**: 5 flagship products manually cross-referenced against Incidecoder current pages — Beauty of Joseon Relief Sun (Water → Rice Extract → DHHB at top), COSRX Snail 92 Cream (Snail Secretion Filtrate → Betaine), Anua Heartleaf 77 (Houttuynia Cordata Extract → Water), Klairs Vitamin Drop (Aqua → Propylene Glycol → Ascorbic Acid at position 3), Laneige Lip Sleeping Mask (oil-based emollients first as expected for balm texture). All 5 verified accurate.
  - **Database state changes**: total products 5,896 (unchanged), products with ≥8 healthy ingredient links 4,995 → 5,035 (+40), products with NULL `ingredients_raw` 737 → 695 (-42), total ingredients 14,400+ → 14,467 (+41), total link rows ~208,000 → 209,114 (+1,290).
  - **Sonnet's reasoning quality**: Multiple high-value behaviors observed in the run logs — correctly identified reformulations across multiple snippet versions and chose the version matching the primary page; correctly refused to overwrite when product name didn't match URL (Numbuzin case); correctly noted when Incidecoder URLs ended in `-2`/`-3`/`-4`/`-5` indicating reformulation versions; correctly handled minimalist formulas (ONE THING Centella = 3 ingredients, I'm From Mugwort Essence = 3 ingredients) without flagging them as suspicious.
  - **Files created**: `scripts/enrich-stub-products.ts` (~430 lines, reusable for future stub products), `scripts/numbuzin-fix.ts` (~95 lines, one-off for product mismatch case)
  - **Files modified**: `.env.local` (added `BRAVE_SEARCH_API_KEY` for local script execution — already in Vercel Production for `web_search` tool)
  - **No code changes to runtime app**: This is a data-only fix. Yuri's tools and prompts are unchanged. Going forward, daily Phase 9 cron jobs (`translate-and-index`, `link-ingredients`) won't re-process these products — they're now indistinguishable from any other healthy product. Future reformulations will be caught by user corrections (Phase 15.1 corrections memory) or periodic manual audits.
- v10.2.1 (Apr 26, 2026): Tool-Use Hardening — Web Search Fallback + Tool-Call Honesty Rule
  - **Origin**: Live production validation of v10.2.0 corrections memory revealed two interlocking bugs that produced an INCI hallucination (claimed beta-glucan was in COSRX Snail 96 when actual ingredient is betaine). Yuri herself diagnosed the root causes when corrected: (1) `BRAVE_SEARCH_API_KEY` is missing in Vercel Production so `web_search` always returns the no-key error path, (2) that error path's fallback message instructed Claude to "answer based on training knowledge instead" — a silent downgrade that produced exactly the confabulation pattern the tool-use system was designed to prevent. She also independently said "I lied about the tool call" when caught claiming "I checked Seoul Sister's database" without actually firing `get_product_details`. This release ships her own diagnosis as code
  - **Web search fallback rewrite** (`src/lib/yuri/tools.ts:1399-1482`): All three failure paths (missing API key, non-2xx response, network/timeout exception) rewritten. Each now returns `{ error, instruction }` where the instruction tells Claude to surface the failure to the user and explicitly forbids silently using training knowledge for time-sensitive facts (current prices, latest formulations, recent reformulations, current product specs, latest research). For evergreen K-beauty knowledge, training data is allowed but must be cited as such. Removes the silent-downgrade nudge that was producing confident wrong answers
  - **Tool-call honesty rule** (`src/lib/yuri/advisor.ts:65`): New non-negotiable rule added to the `## Tools` section, directly above the existing "NEVER say that's not in our database" rule. Forbids phrases that imply tool use when no tool was called: "I checked our database," "I looked it up," "I just verified," "I pulled the latest," "let me check... [answer]." Two acceptable patterns: (1) actually call the tool then describe results, (2) cite training data honestly with appropriate uncertainty. Explicitly instructs honest acknowledgment when caught claiming false tool use
  - **Production validation**: After v10.2.0 deployed, a live test of corrections memory confirmed end-to-end persistence. New chat asked "Tell me about COSRX Snail Mucin" and Yuri responded with explicit acknowledgment: "Note on position 5: Seoul Sister's database lists beta-glucan, but per your correction last time, official COSRX, Soko Glam, and Incidecoder all show betaine in that slot. I'm trusting your sources." Phase 15.1 (corrections memory), Phase 13.3 (decision extraction), and Phase 8 cross-session memory all confirmed working in production
  - **Files modified**: `src/lib/yuri/tools.ts` (3 fallback paths), `src/lib/yuri/advisor.ts` (1 system prompt rule)
  - **Build verified**: `npx tsc --noEmit` and `next build` both pass clean
  - **Required Vercel action** (manual, not in this commit): Add `BRAVE_SEARCH_API_KEY` env var in Production. Free tier at search.brave.com allows 2,000 queries/month. Without it, `web_search` will fail gracefully (per the rewritten fallback) instead of producing confident wrong answers, but real-time fact verification remains unavailable
- v10.2.0 (Apr 26, 2026): Phase 15 Session 1 — Corrections Memory + Textarea Max-Height Fix
  - **Origin**: Cross-application audit of LGAAS AriaStar's memory architecture vs Yuri identified 5 real gaps (corrections memory, heat check, draft preservation, age-aware memory, textarea conflict). Most LGAAS Blueprints didn't apply because Yuri already solved the equivalent problem. This release ships the 2 highest-leverage / lowest-risk ports: Feature 15.1 (corrections memory) and Feature 15.5 (textarea fix)
  - **Feature 15.1 — Corrections Memory** (`src/lib/yuri/memory.ts`): Yuri's `decision_memory` JSONB schema captured decisions/preferences/commitments but had no field for "user told me X was wrong." K-beauty brands reformulate every 2-3 years and her training knowledge goes stale fast. Without persistent corrections, she repeated outdated claims (e.g., "COSRX Snail Mucin is 96%") session after session even when corrected (e.g., "they reformulated to 92% with niacinamide last year")
  - **Schema extension**: Added `corrections: Array<{ topic, yuri_said, truth, category, date }>` to `DecisionMemory` interface. New `CorrectionCategory` type: `reformulation | discontinued | price | ingredient | brand_identity | other` (K-beauty-tuned)
  - **Extraction prompt updated**: Sonnet now extracts a 4th category (CORRECTIONS) alongside decisions/preferences/commitments. Prompt explicitly distinguishes opinion disagreements ("I prefer gel texture" — NOT extracted) from factual errors that should never be repeated (extracted). Includes K-beauty-specific examples for each category
  - **Normalization + merge logic**: `validCategories` Set with graceful fallback to `'other'` for unknown categories. Topic-keyed merge (latest correction per topic wins) defaulting `base.corrections || []` for backwards compat with rows lacking the field
  - **Skip guards**: Both `loadDecisionMemory` empty-row check and `extractAndSaveDecisionMemory` skip guard updated to count corrections — corrections-only rows now load and corrections-only extractions now save
  - **Rendering** (renders FIRST in decision memory block — highest trust, overrides training data): `### Corrections That Stick (Trust These Over Your Training Data)` section. Includes 60-day age tag (`[60+ days ago — verify with a tool if still current]`) prompting Yuri to use `search_products` / `get_product_details` for stale corrections rather than blindly trusting (brands can reformulate again)
  - **Backwards compatibility**: Old `decision_memory` JSONB rows lacking the `corrections` field are handled cleanly by `dm.corrections && dm.corrections.length > 0` guard and `base.corrections || []` defaults
  - **Feature 15.5 — Textarea Max-Height Conflict Fix** (`src/components/yuri/ChatInput.tsx`): The Tailwind class `max-h-[120px]` was overriding the inline JS `style.height` calc that capped at 400px. CSS `max-height` always wins regardless of inline `style.height`, so users were stuck at 120px (the inline 400px calc was dead code). For long product histories — common in skincare conversations — 120px was painfully cramped. Replaced with `max-h-[400px]` to match the JS calc
  - **LGAAS reference patterns ported from**: `lgaas/api/advisor-conversation.js:369-394` (extraction prompt schema), `lgaas/utils/advisor-prompt-helpers.js:1898-1908` (corrections rendering with 60-day age tag), `lgaas/api/advisor-conversation.js:308-316` (correction merge logic)
  - **Phase 15 documentation**: New "Phase 15: LGAAS Memory Architecture Port" section added to CLAUDE.md with implementation priority summary, completed feature details, and remaining work blueprint (15.2 heat check, 15.3 draft preservation, 15.4 age-aware memory)
  - **Build verified**: `npx tsc --noEmit` and `next build` both pass clean
- v10.1.0 (Apr 16, 2026): Claude Opus 4.7 Migration
  - **Model upgrade**: All user-facing AI calls migrated from Claude Opus 4.6 (`claude-opus-4-6`) to Claude Opus 4.7 (`claude-opus-4-7`). Released by Anthropic April 14, 2026
  - **Verification first**: Pre-migration curl test against `claude-opus-4-7` with adaptive thinking returned 200. Post-migration curl test with EXACT request shape Yuri uses (system prompt + cache_control + tools + cache_control) returned 200. `tsc --noEmit` passes clean
  - **Files updated**: `src/lib/anthropic.ts` (`MODELS.primary`), `src/lib/ai-config.ts` (8 contexts: YURI_CHAT, WIDGET_CHAT, SCAN_ANALYSIS, GLASS_SKIN_SCORE, SHELF_SCAN, ROUTINE_GENERATION, DUPE_FINDER_AI, CONTENT_GENERATION + pricing map + `estimateCost()` fallback). Comment fixes: `src/lib/yuri/onboarding.ts`, `src/lib/ai-usage-logger.ts`
  - **Pricing dropped 3x**: Opus 4.7 is $5/MTok input, $25/MTok output (vs Opus 4.6's $15/$75). Per-Pro-user variable cost ~$7.71/mo → ~$4.11/mo. Margin 81% → 90%
  - **`temperature: 0` removed from Glass Skin Score**: Opus 4.7 rejects `temperature`, `top_p`, `top_k` with 400 errors. Removed from `src/app/api/skin-score/route.ts`. NOTE: this reverts the v8.5.0 deterministic-scoring fix — Opus 4.7's improved calibration should make scoring more consistent than 4.6 even without temperature locking, but worth re-validating Glass Skin Score photo consistency in production
  - **No other breaking parameters used**: Codebase had no `top_p`/`top_k`/`budget_tokens`/`thinking.type: 'enabled'` usage, so nothing else to strip
  - **Quality gains**: Better literal instruction following, adaptive reasoning depth (model decides on the fly), better response calibration, +13% on coding benchmarks
- v10.0.1 (Mar 11, 2026): All Development Phases Complete — Status Update
  - **Phase 13 confirmed COMPLETE**: All 6 conversation engine hardening features built and deployed — prompt caching (20-30% token cost reduction), API retry with exponential backoff, structured decision memory, intent-based context loading, onboarding quality scoring, voice quality post-processing
  - **Deferred Phase 8 features confirmed COMPLETE**: All 4 previously deferred features built and deployed — Feature 8.1 (Product Detail Page Enrichment), Feature 8.2 (Routine Builder Intelligence), Feature 8.5 (Expiration/PAO Tracking), Feature 8.6 (Reformulation Tracker). Phase 8 now 11/11 features complete
  - **All 14 development phases now COMPLETE**: Phases 1-14 representing 60+ features across product intelligence, AI conversation engine, community, monetization, trend intelligence, widget conversion, and platform-wide personalization
  - **Remaining work**: Only future items remain — push notifications, scan-counterfeits cron, community-digest cron, Supabase attack protection (all deferred until traffic/revenue justifies)
  - **CLAUDE.md updated**: Development Phases section, Remaining Work section, version/status line all reflect current reality
- v10.0.0 (Mar 10, 2026): Phase 14 — Widget Conversation Intelligence
  - **Architecture shift**: Converted the completely stateless anonymous widget (conversations "streamed and forgotten") into a fully persistent system with visitor tracking, message storage, intent signal detection, specialist preview, and admin dashboard
  - **4 new database tables**: `ss_widget_visitors` (persistent anonymous identity, AI memory, lifetime stats), `ss_widget_sessions` (per-conversation tracking with specialist domains, intent signals), `ss_widget_messages` (full message storage with tool call JSONB), `ss_widget_intent_signals` (15 consumer intent signals across 4 categories). All with RLS (service_role write, admin read)
  - **Feature 14.1: Ghost-Free Session Management** — Sessions created on FIRST MESSAGE, not page load. Client-generated visitor UUID via `crypto.randomUUID()` in localStorage + 365-day cookie (two-layer persistence). Session ID returned via SSE `done` event and sent back on subsequent messages
  - **Feature 14.2: Message Persistence** — Every user and assistant message saved to `ss_widget_messages` with tool call JSONB logging. Fire-and-forget pattern: all persistence operations non-blocking, never break the SSE stream. Previous conversation context loaded for returning visitors
  - **Feature 14.3: Intent Signal Detection** — 15 regex/keyword-based consumer skincare signals across 4 categories: purchase_intent, routine_building, skin_concern_urgent, product_comparison. Detected after each assistant response and recorded to `ss_widget_intent_signals`
  - **Feature 14.4: Specialist Preview** — `detectSpecialist()` from `specialists.ts` identifies when anonymous visitors trigger specialist domains. Injects one-line specialist FOMO into widget system prompt ("You're getting into [specialist] territory — subscribers get deep-dive analysis from our [Specialist Name]")
  - **Feature 14.5: Admin Widget Dashboard** — Full admin page at `/admin/widget` with two tabs: Analytics (5 overview stats, top intent signals with bar visualization, specialist domain counts, recent visitors table with AI memory) and Conversations (paginated session list with returning visitor badges, signal pills, full message thread detail view with tool calls). 3 API endpoints: `/api/admin/widget/analytics`, `/api/admin/widget/conversations`, `/api/admin/widget/conversations/[id]`
  - **Cross-session AI memory**: Sonnet-generated structured JSON (interests, skin_profile, products_discussed, key_concerns, conversation_style) merged cumulatively on `ss_widget_visitors.ai_memory`. Generated after each conversation via fire-and-forget background task
  - **Client components updated**: Both `TryYuriSection.tsx` and `YuriBubble.tsx` send `visitor_id`/`session_id` and capture returned `session_id` from SSE done events
  - **Header navigation**: "Widget Intel" link added to admin dropdown menu (desktop + mobile) pointing to `/admin/widget`
  - **New files created**: `src/lib/widget/visitor.ts`, `src/lib/widget/session.ts`, `src/lib/widget/persistence.ts`, `src/lib/widget/signals.ts`, `src/app/api/admin/widget/analytics/route.ts`, `src/app/api/admin/widget/conversations/route.ts`, `src/app/api/admin/widget/conversations/[id]/route.ts`, `src/app/(app)/admin/widget/page.tsx`
  - **Files modified**: `src/app/api/widget/chat/route.ts` (complete rewrite with persistence), `src/lib/utils/widget-session.ts` (visitor ID + session ID helpers), `src/lib/utils/widget-shared.tsx` (onDone callback signature), `src/components/widget/TryYuriSection.tsx`, `src/components/widget/YuriBubble.tsx`, `src/components/layout/Header.tsx`
  - **Migration**: `supabase/migrations/20260310000001_widget_conversation_persistence.sql`
  - **Build verified**: `tsc --noEmit` passes clean
- v9.1.0 (Feb 28, 2026): Cosmetics Pass-2 Cleanup — ILIKE Pattern Sweep + Extractor Hardening
  - **Root cause**: Pass-1 cleanup (v9.0.0) used exact `.in('subcategory', [...])` matching, missing variant subcategories like "volume mascara", "cream blush", "pencil eyeliner", "under eye concealer", "foundation SPF". User spotted Etude Double Lasting Foundation SPF42 on the live site
  - **Pass-2 ILIKE cleanup**: Created `scripts/cleanup-cosmetics-pass2.ts` using ILIKE patterns (`.or('subcategory.ilike.%mascara%,...')`) for broader matching. KEEP_SUBCATEGORIES whitelist preserves legitimate skincare: makeup remover, eye makeup remover, makeup sun cream, makeup base sunscreen. Result: 92 matched, 18 kept, 74 deleted. Products: 5,926 → 5,852
  - **Extractor prompt hardened** (`src/lib/pipeline/extractor.ts`): Expanded `EXTRACTION_SYSTEM_PROMPT` with exhaustive cosmetic rejection categories — eye makeup (ALL types: mascara, eyeliner pencil/pen/gel/liquid, eyeshadow palette/single/stick, false lashes, brow pencil/mascara/product), face makeup (ALL types: foundation, cushion, concealer, blush, contour, setting powder, primer, highlighter, bronzer), lip color (lipstick, lip tint, lip gloss, lip liner), hair care, body care, fragrance, nail care, tools/accessories. Exception list preserved: makeup REMOVER, lip BALM/treatment, sunscreen, BB/CC with skincare benefits
  - **Product counts updated across 6 files**: "5,900+" → "5,800+" in `public/llms.txt`, `src/lib/yuri/advisor.ts`, `src/app/page.tsx`, `src/app/api/widget/chat/route.ts`, `src/app/api/cron/generate-content/route.ts`, `CLAUDE.md`
  - **Scripts created**: `scripts/cleanup-cosmetics-pass2.ts` (one-time ILIKE pattern cosmetic removal with KEEP whitelist)
  - **Database impact**: 5,926 → 5,852 products. Remaining "makeup" subcategories verified skincare-only: eye makeup remover, makeup remover, makeup sun cream, makeup base sunscreen
- v9.0.0 (Feb 28, 2026): Data Quality Hardening — Skincare-Only Filter, Non-Skincare Cleanup, Price Expansion
  - **Cron health audit**: Verified all 12 active crons healthy (13th `generate-content` intentionally disabled). Pipeline chain confirmed operational: scrape → extract → link → trends → prices all running on schedule
  - **Fix 1 — Price scraping coverage expanded** (`src/app/api/cron/refresh-prices/route.ts`): Soko Glam batch size increased from 10 to 25 products per run (~100 products/day, up from ~52). YesStyle removed from cron entirely — Playwright cold start (~10s) consumed too much of the 60s budget for only 3 products. YesStyle remains available via CLI/admin. Budget math: 25 × 1.5s ≈ 37.5s within 52s timeout guard
  - **Fix 2 — Skincare-only extraction filter** (3 files modified): Seoul Sister is a SKINCARE platform, but the Sonnet extraction pipeline had no category gating — Olive Young categories include makeup, hair care, and body care that were leaking into `ss_products`
    - `src/lib/pipeline/extractor.ts`: Added detailed skincare-only instructions to `EXTRACTION_SYSTEM_PROMPT` — classifies non-skincare (makeup, hair, body, fragrance) as `not_skincare` with explicit exceptions for lip balm/treatment, sunscreen, and BB/CC creams with skincare benefits. Added `'not_skincare'` to `validCategories` array
    - `src/lib/pipeline/batch-processor.ts`: Added rejection logic in `processOne()` — products classified as `not_skincare` are marked `status: 'duplicate'` with error message `'Rejected: not a skincare product'` and never inserted into `ss_products`
    - `src/types/database.ts`: Added `| 'not_skincare'` to `ProductCategory` union type
  - **Fix 3 — Existing non-skincare product cleanup**: 299 non-skincare products removed from database
    - Audited all 200 distinct subcategory/category combinations to identify non-skincare entries
    - 28 subcategories identified as non-skincare: eye makeup (15), face makeup (8), lip color (2), body/hair (3)
    - Deliberately preserved skincare-adjacent items: lip oil, tinted balm, lip balm, lip treatment, lip mask, lip serum, lip essence, lip scrub, eye cream, eye patch, hydrogel patches, eyelash serum, makeup remover
    - Cascade deleted in chunks of 50: trending rows → staging unlinks → ingredient links → products. No user data affected
    - Script: `scripts/cleanup-non-skincare.ts`. Result: 0 remaining, 5,926 total products
  - **Fix 4 — Failed staging row reprocessed**: GA260136975 (JSON parse failure from earlier pipeline run) reset to pending and re-extracted. Sonnet correctly classified it as `not_skincare` (it's a product bundle/set). Properly rejected by new filter. 18 remaining pending staging rows will process on next `translate-and-index` cron
  - **Scripts created**: `scripts/cleanup-non-skincare.ts` (one-time non-skincare removal), `scripts/reprocess-failed.ts` (reprocess failed staging rows)
  - **Database impact**: 6,222 → 5,926 products (net -296 after cleanup). All remaining products verified as skincare-only. Going forward, non-skincare products are blocked at the extraction pipeline level
  - **Files modified**: `src/app/api/cron/refresh-prices/route.ts`, `src/lib/pipeline/extractor.ts`, `src/lib/pipeline/batch-processor.ts`, `src/types/database.ts`
- v8.9.0 (Feb 27, 2026): Pre-Launch Audit Session 3 — Cron Pipeline Fix (CRITICAL)
  - **Root cause identified**: ALL 13 cron jobs have been silently failing since deployment. Two compounding bugs prevented any Vercel-triggered cron execution from succeeding
  - **Bug #1 — Auth header mismatch**: `verifyCronAuth()` in `src/lib/utils/cron-auth.ts` only checked `x-cron-secret` header, but Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. Every cron invocation received 401 Unauthorized
  - **Bug #2 — HTTP method mismatch**: All 13 cron route files only exported `POST` handlers, but Vercel cron jobs send `GET` requests. Every cron invocation received 405 Method Not Allowed
  - **Fix 1**: Updated `cron-auth.ts` to try `Authorization: Bearer` header first, then fall back to legacy `x-cron-secret` header (for CLI/admin API use). Uses timing-safe comparison for both
  - **Fix 2**: Added `export { POST as GET }` to all 13 cron route files so Vercel's GET requests are handled
  - **Evidence**: Supabase API logs showed ZERO cron job traffic — only Yuri chat requests. `ss_pipeline_runs` last entry was Feb 21 (manual admin trigger, not cron). Product scraping, price refreshing, trend analysis, and learning aggregation all stalled for 6+ days
  - **Impact**: After deploy, all 13 cron jobs will begin executing on schedule: product scraping (daily 6 AM), Sonnet extraction (7 AM), ingredient linking (7:30 AM), trend scanning (8 AM), price refreshing (every 6h), learning aggregation (daily 5 AM), effectiveness updates (5:30 AM), Reddit scanning (8:30 AM), bestseller scraping (6:30 AM), gap scores (9 AM), data quality (weekly), seasonal adjustments (monthly), trend detection (8 AM)
  - **Action required**: Verify `CRON_SECRET` environment variable exists in Vercel project settings (Settings → Environment Variables) for Production environment
  - **Files modified**: `src/lib/utils/cron-auth.ts`, all 13 `src/app/api/cron/*/route.ts` files
  - **Build verified**: `tsc --noEmit` passes clean
- v8.8.0 (Feb 27, 2026): Pre-Launch Audit Session 2 — Database Performance Optimization
  - **Fix 4 — auth.uid() InitPlan optimization**: Wrapped `auth.uid()` in `(select auth.uid())` subselect across 69 RLS policies on 25 tables. Without the subselect, `auth.uid()` (which calls `current_setting('request.jwt.claims', true)::json->>'sub'`) re-evaluates per row — O(n) overhead. With `(select ...)`, PostgreSQL evaluates it once as an InitPlan. Applied via 3 migrations: `20260227000001` (30 policies), `20260227000001_part2` (20 policies), `20260227000001_part3` (19 policies)
  - **Fix 5 — auth.role() InitPlan optimization**: Same subselect pattern applied to 5 service-role-only policies on `ss_pipeline_runs`, `ss_product_staging`, `ss_rate_limits`, `ss_subscription_events`, `ss_widget_analytics`. Migration: `20260227000005`
  - **Fix 6 — Missing FK indexes**: Added btree indexes on 3 foreign key columns that reference `ss_products(id)`: `ss_batch_code_verifications(product_id)`, `ss_product_staging(processed_product_id)`, `ss_user_product_tracking(product_id)`. Without indexes, cascading deletes and joins cause sequential scans. Migration: `20260227000003`
  - **Fix 7 — Ghost functions dropped**: Removed 3 functions (`increment_report_view_count`, `get_user_saved_reports`, `calculate_ingredient_trend`) that referenced tables dropped in v5.5.0 ghost table cleanup. Had mutable `search_path` (Supabase security advisor flag). Migration: `20260227000004`
  - **Fix 8 — Duplicate index dropped**: Removed `idx_ss_product_ingredients_ingr` which duplicated `idx_product_ingredients_ingredient_id` (both btree on `ingredient_id`). Migration: `20260227000005`
  - **Verification**: Supabase Performance Advisor re-run confirmed 0 remaining `auth_rls_initplan` warnings and 0 `duplicate_index` warnings. All 5 migrations applied successfully
  - **Yuri live testing**: 7 scenarios tested post-migration — product search, trending, price comparison, personalized match, web search, general knowledge, specialist routing. All passed
  - **Data isolation verified**: Confirmed `auth.uid()` JWT properly isolates vibetrendai and baileydonmartin accounts — no cross-account data leaking
  - **Files created**: `supabase/migrations/20260227000001_fix_auth_uid_rls_initplan.sql`, `20260227000001_part2_fix_auth_uid_rls_initplan.sql`, `20260227000001_part3_fix_auth_uid_rls_initplan.sql`, `20260227000003_add_missing_fk_indexes.sql`, `20260227000004_drop_ghost_functions.sql`, `20260227000005_fix_auth_role_rls_and_drop_duplicate_index.sql`
- v8.7.0 (Feb 27, 2026): Pre-Launch Audit Session 1 — Security Hardening
  - **Fix 1 — RLS on unprotected tables**: Enabled Row Level Security on `ss_pipeline_runs` and `ss_product_staging` (service-role-only access). These tables had RLS disabled, meaning any authenticated user could read/write pipeline data
  - **Fix 2 — Cron job timeouts**: Added `statement_timeout` to long-running cron jobs (`aggregate-learning`, `update-effectiveness`, `scan-trends`) to prevent runaway queries from consuming database connections. 55-second guard for Vercel's 60-second cron limit
  - **Fix 3 — Search input sanitization**: Added input sanitization to product search API (`src/app/api/products/route.ts`) to prevent SQL injection via crafted search queries. Strips special characters that could break `ilike` patterns
  - **Migration**: `20260227000002_enable_rls_pipeline_tables.sql` — RLS policies for `ss_pipeline_runs` and `ss_product_staging`
  - **Files modified**: `src/app/api/products/route.ts`, `src/app/api/cron/aggregate-learning/route.ts`, `src/app/api/cron/update-effectiveness/route.ts`, `src/app/api/cron/scan-trends/route.ts`
- v8.6.0 (Feb 26, 2026): SEO Implementation — Canonical URLs, Product Metadata, Blog Schema
  - **Fix 1 — Canonical URLs**: Added `metadataBase: new URL('https://www.seoulsister.com')` to root `layout.tsx`. Next.js now auto-generates `<link rel="canonical" href="...">` on every page that exports metadata, including all blog posts and product pages. Consolidates ranking signals and prevents duplicate content indexing
  - **Fix 2 — www base URL normalization**: Replaced all `https://seoulsister.com` references with `https://www.seoulsister.com` across 8 files. `seoulsister.com` returns HTTP 307 → `www.seoulsister.com`, so all URLs in sitemap, robots.txt, JSON-LD, OpenGraph, Stripe callbacks, and content ingest now match the canonical www domain. Eliminates redirect chains for every URL Google crawls
  - **Fix 3 — Product page metadata**: Created `src/app/(app)/products/[id]/layout.tsx` with `generateMetadata` that fetches product data from Supabase server-side. Every product page now gets a unique `<title>` (e.g., "Advanced Snail 96 Mucin Power Essence by COSRX"), meta description, OpenGraph, and Twitter card. Previously all 6,200+ product pages showed generic "Seoul Sister - K-Beauty Intelligence" in search results
  - **Fix 4 — Blog listing JSON-LD**: Added `CollectionPage` + `BreadcrumbList` schema to `src/app/blog/page.tsx`. Helps search engines understand the blog index is a curated collection of articles
  - **Fix 5 — Blog post BreadcrumbList**: Added `BreadcrumbList` (Home → Blog → Post Title) to the existing `@graph` array in `src/app/blog/[slug]/page.tsx`. Enables breadcrumb trail display in Google search results
  - **Fix 6 — Blog author E-E-A-T**: Updated Article JSON-LD author field to use `Person` type when author is a named individual, falling back to `Organization` for "Seoul Sister" or unattributed posts. Improves Google E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals
  - **Fix 7 — Home page structured data**: Deferred — root layout Organization schema with SearchAction already covers brand-level SEO. Home page ranks for brand name queries regardless
  - **Files modified**: `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/api/admin/content/ingest/route.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`
  - **Files created**: `src/app/(app)/products/[id]/layout.tsx`
  - **Post-deployment verification needed**: GSC URL Inspection on product + blog pages, Google Rich Results Test, sitemap resubmission in GSC
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.5.0 (Feb 25, 2026): Yuri Quality Hardening — Bailey Feedback, Pacing, Feature Knowledge Audit
  - **4 fixes from Bailey's real-user testing feedback** (commit `32f7753`):
    - **Glass Skin phase-awareness**: Glass Skin was recommending actives (tranexamic acid, vitamin C, BHA) while Yuri had Bailey on Phase 1 barrier repair (NO actives). New `loadTreatmentPlanContext()` reads Yuri's `decision_memory` and conversation summaries, injects the active treatment plan as a mandatory constraint into the Glass Skin Vision prompt. Recommendations now align with Yuri's phased approach
    - **Glass Skin result persistence**: ProgressTimeline had recommendation/analysis data but only rendered scores/dates. Converted score history list to expandable accordion — tap any past score to see its full analysis notes and recommendation bullets
    - **Yuri date/timeline reasoning**: Yuri told Bailey "2.5 weeks into your plan" when she was 2 days in. Injected `Today's date` + explicit instruction to count actual days from decision memory timestamps into `buildSystemPrompt()`
    - **Glass Skin score consistency**: Same photo scored 48 then 49. Set `temperature=0` on the Claude Vision API call for deterministic scoring
  - **Voice quality refinements** (4 commits refining Yuri's conversational pacing):
    - **Brevity as expertise** (`85a9cf9`): Rewrote Voice, Edge, and Pacing sections. "One killer insight per response, deliver it in ONE sentence." Hard sentence limits (product rec: 2-4 sentences, comparison: one paragraph each, general: 3-6 sentences). Added concrete GOOD vs BAD example and "the test": if you can delete a sentence and the answer still works, delete it
    - **Emoji placement** (`987c1fa`): Emojis go WHERE the emotion is (mid-sentence), not as sign-off punctuation at the end. Added yes/no safety question pacing: YES or NO first sentence, 3-4 sentences max
    - **Multi-part question handling** (`5a36a2e`): Two yes/no questions = two tight answers, not two essays. Added explicit rule: "Don't add a third topic they didn't ask about"
    - **Tool-result pacing** (`698b081`): After tool results: #1 pick with name, price, ONE sentence on why. Runner-up only if genuinely different tradeoff. Stop and offer depth. Added 6 mid-sentence voice-cleanup patterns ("let me break it down", "here's the thing", etc.)
  - **Feature knowledge audit**: Audited Yuri's system prompt, all 6 specialist prompts, and widget prompt for complete feature awareness. Added Dashboard to Seoul Sister Reference table, enhanced feature descriptions with cross-feature integration context (scan → skin match → prices → routine → track expiry), added "How it all connects" summary showing the subscriber value chain
  - **Files modified**: `src/lib/yuri/advisor.ts` (reference table + pacing + voice), `src/lib/yuri/voice-cleanup.ts` (6 new mid-sentence patterns), `src/app/api/skin-score/route.ts` (treatment plan awareness + temperature=0), `src/components/glass-skin/ProgressTimeline.tsx` (expandable accordion)
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.4.0 (Feb 25, 2026): Streaming Engine Hardening — Retry, Real-Time Tool Streaming, Widget
  - **3 improvements** to Yuri's streaming architecture that fix reliability gaps and eliminate fake chunking
  - **Improvement 1 — Streaming retry with exponential backoff** (`advisor.ts`): `messages.stream()` calls now retry up to 3 times on transient failures (529 overloaded, 502/503 gateway, connection resets). Uses `isRetryableError()` from `anthropic.ts`. Only retries when `eventsReceived === false` (connection-level failure) — once events flow, partial data is consumed and retry would cause duplication. Backoff: 2s, 4s, 8s
  - **Improvement 2 — Real-time streaming during tool-use conversations** (`advisor.ts`): Previously, ALL text was buffered during every round of the tool loop and yielded as a single block at the end. Now uses two modes: BUFFER mode (first round) prevents "Let me search..." narration from leaking to the client, STREAM mode (post-tool rounds with real results) yields each text delta in real-time via `yield`. Users see Yuri's answer stream character-by-character instead of waiting for the entire response to complete
  - **Improvement 3 — Widget real streaming** (`widget/chat/route.ts`): Replaced the fake 50-char chunking system (which collected the full response then split it into artificial chunks with delays) with real `messages.stream()` for post-tool final rounds. Tool loop rounds still use non-streaming `messages.create()` (need full response to detect `stop_reason === 'tool_use'`). Stream retry logic mirrors advisor.ts pattern. For no-tool queries, complete text from `messages.create()` is sent as a single SSE event
  - **Type fix**: Changed `ContentBlock[]` to `ContentBlockParam[]` in advisor.ts tool loop content assembly — `ContentBlock` (output type) requires `citations`/`caller` fields only the API populates; `ContentBlockParam` (input type) doesn't
  - **Files modified**: `src/lib/yuri/advisor.ts` (streaming retry + two-mode streaming + type fix), `src/app/api/widget/chat/route.ts` (real streaming + retry)
  - **No changes to**: system prompts, tools, memory, routing, onboarding, or any other files
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.3.0 (Feb 25, 2026): Application-Wide Prompt Refactor — "Trust the Model More, Constrain It Less"
  - **Philosophy**: Opus 4.6 performs better with fewer, sharper instructions than exhaustive rule lists. Heavy system prompts (~6,800 tokens for Yuri) create competing directives that produce checklist-style output. This release converts rulebook-style prompts into creative briefs describing WHO the AI is, not every possible output format.
  - **3 files modified**: `advisor.ts`, `specialists.ts`, `widget/chat/route.ts`. No changes to tools, memory, streaming, routing, or any runtime logic.
  - **`advisor.ts` — Main System Prompt (~6,800 → ~3,800 tokens, ~44% reduction)**:
    - **Kept verbatim**: `## Your Voice`, `## Your Edge`, `## Conversational Pacing`, `## Cross-Session Memory (CRITICAL)` — these are already creative briefs that work well
    - **Merged**: `## Database Tools` + `## Tool Usage Rules (MANDATORY)` + `## Web Search` → unified `## Tools` section (~1,700 → ~650 tokens). Lists all 8 tools in one line, states default behavior ("call the tool FIRST, answer from results"), and what NOT to use tools for
    - **Cut entirely**: `## Response Guidelines` (duplicated Voice, Pacing, and Edge), `## Advice for Someone Else` (one sentence added to Important Rules instead), extra capabilities list (lines 110-114, duplicated tool descriptions)
    - **Replaced**: `## Seoul Sister App Knowledge` (7 prose subsections, ~2,550 tokens) → `## Seoul Sister Reference` table (12 features with paths and one-liners, ~450 tokens). Opus doesn't need paragraphs of app documentation — it needs a quick-reference to scan
    - **Added**: `## Quick Reminders` (3 bullets — masks/patches proactive suggestion, feature repetition avoidance, not-a-store reminder)
    - **Slimmed**: `## Your Capabilities` from 6-item numbered list to single inline sentence listing all 6 specialists
  - **`specialists.ts` — 6 Specialist Prompts (~3,180 → ~2,030 tokens, ~36% reduction)**:
    - **Strategy applied to ALL 6**: Removed "When analyzing/building/investigating:" numbered checklists (Opus knows how to analyze ingredients, build routines, etc.) and "Seoul Sister tools to reference:" blocks (Yuri already knows all features from the main prompt, duplicating them adds tokens without value)
    - **Kept**: Identity lines, voice reminders, all domain-specific expertise (the non-obvious knowledge Opus might not have from training)
    - **Special sections preserved**: Routine Architect's `## Masks & Patches` (Seoul Sister's largest category — domain-specific), Sensitivity Guardian's `## Menstrual Cycle Effects on Skin` (clinical safety — can't trust model to get phase details right)
    - **Biggest reduction**: Trend Scout (~650 → ~350 tokens) — removed entire "Seoul Sister's LIVE Trend Intelligence" subsection that restated information already in the main prompt
    - **UNTOUCHED**: All `triggerKeywords` arrays, all `extractionPrompt` strings, `detectSpecialist()` function, `containsKeyword()` function
  - **`widget/chat/route.ts` — Widget Prompt (~1,000 → ~950 tokens)**:
    - Removed line about "mention your 6 specialist agents" — widget users can't access specialists, instruction was misleading
  - **What is NOT changed**: `shouldForceToolUse()`, `detectSpecialist()`, `buildSystemPrompt()`, `streamAdvisorResponse()`, all extraction prompts, all trigger keywords, `memory.ts`, `tools.ts`, `onboarding.ts`, `voice-cleanup.ts`, all API routes, all background prompts, widget tool forcing
  - **Expected outcome**: Yuri's responses become less formulaic, more naturally conversational. Specialist modes stop producing checklist-style output. ~35% total token reduction reduces prompt caching costs. Opus has more room to use its natural voice within the character framework.
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.2.3 (Feb 25, 2026): Yuri Personality Edge — Bold, Opinionated, Magnetic
  - **New `## Your Edge` section** in Yuri's system prompt (`advisor.ts`): Gives Yuri permission and direction to be bold, opinionated, and occasionally contrarian — Anthony Bourdain energy applied to skincare. Covers 4 directives:
    - **Be bold**: Call out overhyped products, wasteful routines, and popular myths. Commit to recommendations instead of hedging everything with "it depends"
    - **Be surprising**: Every response should have a "wait, really?" moment. Share insider Korean lab perspective, what Korean women actually think about Western-hyped products, which "cult favorites" Korea has moved on from
    - **Be real**: Don't sugarcoat when someone spent $80 on something fighting their skin type. Be the friend who saves them from the mistake, not the one who watches them make it
    - **The line you don't cross**: Edge comes from expertise and care, never meanness or condescension. Sharp takes make users feel smarter, not smaller
  - **Widget prompt updated** (`widget/chat/route.ts`): Condensed version of the same boldness directives for anonymous landing page visitors — have opinions, be surprising, challenge popular wisdom, but always from a place of expertise
  - **Persona philosophy**: The "warm big sister" foundation (v8.2.2) remains intact. The edge layer sharpens it — she's the sister who will roast your routine AND rebuild it better, who challenges TikTok trends with actual formulation science, who makes you feel like you're getting insider access to Korean beauty intelligence you can't find anywhere else
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.2.2 (Feb 25, 2026): Yuri Persona Refinement — Pacing, Warmth, Third-Party Advice
  - **Conversational pacing replaces rigid length rules** (`advisor.ts`): Replaced the "Response Length" section (which had word count tiers like "under 150 words" and "150-300 words") with a "Conversational Pacing" section that trusts Opus to read the room. Key principle: lead with the top 1-2 picks, offer depth instead of dumping it. "Every response should feel like the next thing a knowledgeable friend would say, not like a report they prepared." No word counts, no rigid tiers
  - **Emoji guidance restored** (`advisor.ts`): v8.1.2 added "Limit emojis to 0-2 per response maximum. Zero is fine" — the "Zero is fine" gave Opus permission to skip emojis entirely, removing the warmth Bailey experienced. New guidance frames emojis as "facial expressions" (1-2 per response for warmth/humor/emphasis) and explicitly states zero feels cold in a chat
  - **Third-party advice handling** (`advisor.ts`): New "Advice for Someone Else" section in system prompt. When subscribers ask about skincare for a boyfriend, mom, or friend: help warmly with general advice, flag that personalized intelligence (conflict checks, skin matching) is tied to the logged-in user's profile, naturally suggest the other person create their own account. Don't refuse or be cold about it
  - **Live testing validated**: Price comparison (Beauty of Joseon Relief Sun → 3 retailers), product search (vitamin C serums under $20 → contextual top picks), trending products (Olive Young bestseller data), general knowledge (AHA vs BHA streaming) all confirmed working in production
  - **No data isolation issues**: Investigation confirmed both user accounts (vibetrendai, baileydonmartin) are properly isolated via `auth.uid()` JWT — no cross-account data leaking
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.2.1 (Feb 25, 2026): Smart Product Search — Cross-Column Term Splitting
  - **Root cause**: v8.2.0's `shouldForceToolUse()` successfully forces tool calls (confirmed via Supabase API logs), but `search_products` and all name-resolution functions returned empty results. The problem: Claude sends combined queries like "Beauty of Joseon Relief Sun sunscreen" but the database stores brand in `brand_en` ("Beauty of Joseon") and product name in `name_en` ("Relief Sun: Rice + Probiotics SPF50+ PA++++"). The old search used `dbQuery.or('name_en.ilike.%{query}%,brand_en.ilike.%{query}%')` — a single `ilike` pattern per column that fails when the query spans both columns
  - **Fix: `smartProductSearch()` with 3-strategy cascade** (`tools.ts`): New search function splits the query into individual terms (with stop-word removal), then tries three strategies in order: (1) full-string `ilike` match against individual columns (fast, handles exact matches), (2) ALL-term match — over-fetches with first term then post-filters to rows where every term appears in the combined `brand_en + name_en` string, (3) ANY-term match as broadest fallback. Returns on first strategy that yields results
  - **`resolveProductByName()` shared helper** (`tools.ts`): Single function for product name-to-ID resolution, used by `get_product_details`, `compare_prices`, `get_personalized_match`, and `check_ingredient_conflicts`. Uses `smartProductSearch()` internally with best-match selection (prefers result where ALL query terms appear in brand+name)
  - **Stop-word filtering**: Removes common English words ("the", "for", "with") and K-beauty generic terms Claude appends ("product", "skincare", "korean") that add noise. Constant: `SEARCH_STOP_WORDS`
  - **All 6 tool functions updated**: `search_products` uses `smartProductSearch()` directly. `get_product_details`, `compare_prices`, `get_personalized_match`, `check_ingredient_conflicts` all use `resolveProductByName()` for name-to-ID resolution. Previously all used single-column `.ilike('name_en', '%${query}%')` patterns
  - **Database verification**: "Beauty of Joseon Relief Sun" query confirmed returning 5 matching products after fix (0 before)
  - **Files modified**: `src/lib/yuri/tools.ts` (added `smartProductSearch()`, `resolveProductByName()`, `SEARCH_STOP_WORDS`; updated 5 execute functions)
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.2.0 (Feb 24, 2026): Fix Yuri Tool Usage — Intent-Based tool_choice Forcing
  - **Root cause identified**: With `tool_choice: { type: 'auto' }`, Claude Opus answers product-specific questions from training knowledge instead of calling `search_products` or `compare_prices`. The system prompt's MANDATORY tool usage rules (added in v8.1.2) were insufficient — Claude's confidence in its training knowledge about popular K-beauty brands (Beauty of Joseon, COSRX, etc.) overrode even explicit prompt instructions. Test confirmed: user asked "How much does the Beauty of Joseon Relief Sun sunscreen cost?" and Yuri responded "that's not in our database right now" — despite 20 Beauty of Joseon products existing in `ss_products` with 3 price records ($10-$18 across Olive Young, Stylevana, Amazon)
  - **Fix: `shouldForceToolUse()` intent detector** (`advisor.ts`): Lightweight function that examines the user's message for product/price/trending/weather signals. When detected, sets `tool_choice: { type: 'any' }` (forces at least one tool call) on the FIRST streaming iteration only. Subsequent iterations revert to `{ type: 'auto' }` so Claude can generate its final text response incorporating tool results
  - **Detection categories**: (1) Brand name mentions (60+ K-beauty and popular skincare brands), (2) price/buy/cost/retailer questions, (3) trending/viral/bestseller queries, (4) explicit product lookup signals ("do you have", "find me", "recommend a serum"), (5) product category + qualifier ("best sunscreen", "good toner"), (6) personalized match queries ("for my skin", "good for oily"), (7) weather/UV questions, (8) ingredient conflict checks
  - **Skip patterns**: Greetings, general skincare education ("what is double cleansing"), app navigation questions. These bypass forcing to preserve full AI-First creative freedom
  - **Widget parity** (`widget/chat/route.ts`): Same `shouldWidgetForceToolUse()` function applied to anonymous landing page widget with matching logic. Widget already had 4 tools (search_products, compare_prices, get_trending_products, get_current_weather) — now they'll actually be used for product-specific queries
  - **Architecture**: This is a mechanical fix, not a prompt fix. Prompt-only instructions ("MANDATORY", "no exceptions", "NEVER") were proven insufficient for overriding Claude's training knowledge confidence. The `tool_choice: 'any'` API parameter is the only reliable way to force tool calls. The intent detector ensures this forcing only happens when appropriate — general conversation retains full `'auto'` freedom
  - **Files modified**: `src/lib/yuri/advisor.ts` (added `shouldForceToolUse()` + dynamic `tool_choice`), `src/app/api/widget/chat/route.ts` (added `shouldWidgetForceToolUse()` + dynamic `tool_choice`)
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.1.3 (Feb 25, 2026): Post-Test Review — Streaming Fix + AI-First Response Length
  - **Thinking text leak fix** (`advisor.ts`): Unified streaming strategy across all tool-loop iterations. Previously, post-tool rounds (iteration 2+) yielded text directly, which leaked internal narration ("Let me also check if it's listed under a slightly different name:") when Claude called another tool on the same round. Now ALL rounds buffer text and only yield after confirming no tools were requested. This is an architecture fix — not a regex/template constraint
  - **Response length softened** (`advisor.ts`): Replaced rigid 4-tier word count system (150/300/500 hard limits) with AI-First directional guidance: "match the user's energy, lean shorter than you think, save headers for multiple topics." Trusts Opus to reason about appropriate length rather than hitting word targets
  - **Files modified**: `src/lib/yuri/advisor.ts` (streaming loop refactor + response length rewrite)
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.1.2 (Feb 24, 2026): Post-Bailey Review — Yuri Performance Improvements
  - **Context**: Bailey's 4 conversations with Yuri (26 messages, Feb 24) revealed 6 improvement areas. All changes are prompt engineering and cleanup logic — no new features, no database changes, no architectural shifts
  - **Change 1 — Mandatory tool usage rules** (`advisor.ts`): Replaced soft "USE THEM when users ask" guidance with `## Tool Usage Rules (MANDATORY)` section. 7 explicit mandatory triggers (product by name → `search_products`, prices → `compare_prices`, trending → `get_trending_products`, weather → `get_current_weather`, skin match → `get_personalized_match`, conflicts → `check_ingredient_conflicts`, recent news → `web_search`). 3 explicit prohibitions (never claim DB status without searching, never estimate prices, never say "let me check" then answer from memory). Root cause: Yuri used ZERO tools across 26 messages because Claude's training knowledge made tool use feel unnecessary
  - **Change 2 — Response length control** (`advisor.ts`): Added `## Response Length` section (later softened in v8.1.3 to AI-First directional guidance). Problem: Yuri averaged 400-800 words vs Bailey's 20-40 words (15:1+ ratio)
  - **Change 3 — Feature repetition prevention** (`advisor.ts`): Added rule to `## Response Guidelines`: once a feature (Glass Skin Score, Shelf Scan, etc.) is suggested and acknowledged, do NOT mention it again in same session or immediately following conversations. Problem: Yuri mentioned Glass Skin Score in ALL 4 conversations, even after Bailey said "I'm going to do the glass skin score!"
  - **Change 4A — Voice tightening** (`advisor.ts`): Added 2 rules to `## Your Voice` section: never start with filler openers ("Ha, ...", "Love to hear that", etc.) and limit emojis to 0-2 per response max
  - **Change 4B — New voice cleanup patterns** (`voice-cleanup.ts`): Added 9 new `BANNED_PATTERNS` for conversational filler openers that bypass existing "Great question" set: `^Ha,?`, `^Haha,?`, `^Love to hear that`, `^Love that`, `^So glad to hear that`, `^Good question`, `^Really good question`, `^Ooh,?`, `^Oh,? I love` (preserves "I love" after removal)
  - **Change 5 — Decision memory truncation fix** (`memory.ts`): Per-message truncation in `extractAndSaveDecisionMemory()` increased from 400→1200 characters. Sonnet `max_tokens` increased from 500→800. Problem: Yuri's responses are 1,500-3,000 chars but decisions ("Goodal Vita-C on hold until Phase 2") appear mid-response past the 400-char cutoff, making `decision_memory` always `{}`. Cost impact: ~$0.034 vs ~$0.011 per extraction (negligible)
  - **Files modified**: `src/lib/yuri/advisor.ts` (4 system prompt changes), `src/lib/yuri/voice-cleanup.ts` (9 new patterns), `src/lib/yuri/memory.ts` (2 parameter changes)
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.1.1 (Feb 24, 2026): Feature 11.5 — Real-Time Weather Tool for Yuri + Widget
  - **New tool: `get_current_weather`**: 8th tool added to Yuri's tool belt. Returns real-time weather (temperature, humidity, UV index, wind speed, condition) for any city via Open-Meteo API (free, no key required). AI-First design: returns raw weather data + user skin profile to Claude Opus for dynamic reasoning — does NOT use hardcoded `getWeatherAdjustments()` rule-based system
  - **3-tier location resolution**: (1) Explicit lat/lng coordinates, (2) city name geocoded via Open-Meteo geocoding API, (3) fallback to user's saved profile coordinates. Works for both authenticated users and anonymous widget visitors
  - **Seasonal learning context**: Queries `ss_learning_patterns` for user's climate zone and current season, includes as optional context alongside weather data
  - **Widget access**: Added to `WIDGET_TOOL_NAMES` set — anonymous visitors can now ask weather-based skincare questions. Widget system prompt updated with weather tool usage guidance
  - **Advisor system prompt**: Updated tool list and "when to use tools" guidance to include weather scenarios
  - **Files modified**: `src/lib/yuri/tools.ts` (tool definition + execution), `src/app/api/widget/chat/route.ts` (widget tool access), `src/lib/yuri/advisor.ts` (system prompt)
  - **No new dependencies or env vars**: Uses existing Open-Meteo API and `fetchWeather()` from `weather-routine.ts`
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.1.0 (Feb 23, 2026): Phase 13 Blueprint — AI Conversation Engine Hardening
  - **Cross-application audit completed**: Line-by-line comparison of LGAAS AriaStar (7,530+ lines across 4 core files) vs Seoul Sister Yuri (2,089 lines across 4 core files). Identified 6 architectural gaps in Yuri's conversation engine
  - **Phase 13 documented in CLAUDE.md**: 6 features (13.1-13.6) with full implementation plans, LGAAS code references, and build order
  - **Feature 13.1: Prompt Caching** (HIGH): Add `cache_control: { type: 'ephemeral' }` to system prompt, last assistant message, and tool definitions in advisor.ts, widget/chat, and onboarding.ts. 20-30% token cost reduction. LGAAS reference: advisor-conversation.js lines 737-763
  - **Feature 13.2: API Retry Logic** (HIGH): `callAnthropicWithRetry()` utility with 3 attempts, exponential backoff (2s, 4s, 8s), retryable status codes (529, 503, 502, connection errors). Applied to all Claude API calls. LGAAS reference: advisor-conversation.js lines 65-88
  - **Feature 13.3: Decision Memory** (HIGH): Structured JSON extraction (decisions, preferences, commitments) from conversations via Sonnet. Topic-keyed merging across sessions (latest per topic wins). JSONB column on `ss_yuri_conversations`. Injected into system prompt as explicit structured data. LGAAS reference: advisor-conversation.js lines 98-220
  - **Feature 13.4: Intent-Based Context Loading** (MEDIUM): `classifyIntent()` function detecting 7 topic categories via regex. `loadUserContext()` conditionally loads only relevant data (routine, reactions, learning, specialist insights, excerpts) based on detected intent. First message always loads everything. Saves ~200-500ms of Supabase queries and reduces prompt tokens
  - **Feature 13.5: Onboarding Quality Scoring** (MEDIUM): `calculateOnboardingQuality()` scores field specificity (not just completion). Detects vague answers ("normal" skin type = 50% vs "combination with oily T-zone" = 85%). Generates natural follow-up suggestions. `quality_score` column on `ss_onboarding_progress`. LGAAS reference: onboarding-conversation.js line 251
  - **Feature 13.6: Voice Quality Post-Processing** (LOW): `cleanYuriResponse()` regex post-processor removes AI-isms (em-dashes, "Great question!", corporate filler, excessive bullets). Applied before DB save. LGAAS reference: utils/human-voice-agent.js
  - **Session strategy**: 3 sessions — (1) 13.1+13.2 quick wins, (2) 13.3 decision memory, (3) 13.4+13.5+13.6 remaining
  - **LGAAS improvement blueprint**: Created `/lgaas/IMPROVEMENT-BLUEPRINT.md` with 5 improvements Seoul Sister pioneered that LGAAS should adopt (Claude tool use, recent message excerpts, product recommendation extraction, specialist agent system, streaming SSE)
- v8.0.1 (Feb 23, 2026): Fix Yuri memory denial bug — strengthen cross-session memory trust
  - **Root cause identified**: Bailey asked Yuri about her onboarding recommendations. Yuri denied making recommendations that WERE in her conversation summaries. Claude's caution about confabulation overrode the instruction to trust summaries as memory. This was NOT a data availability issue — all 3 summaries fit within the 7-summary window
  - **Fix 1 — System prompt memory trust** (`advisor.ts`): Added "Cross-Session Memory (CRITICAL)" section with 5 explicit rules before "Important Rules". Instructs Claude to NEVER deny recommendations in summaries, always own past advice, explain direction changes
  - **Fix 2 — Structured product recommendation extraction** (`memory.ts`): New `extractProductRecommendations()` parses bold product names from SECTION 1 of summaries. Deduplicates, filters false positives, generates context snippets. Injected as explicit "YOUR Previous Product Recommendations" section in system prompt
  - **Fix 3 — Pinned onboarding + expanded limits** (`memory.ts`): Onboarding summary always loaded first (pinned regardless of recency). Summary limit increased from 5 to 7. Header text changed from passive "You remember..." to authoritative "These are YOUR OWN conversations..."
  - **Build verified**: `tsc --noEmit` and `next build` both pass
- v8.0.0 (Feb 23, 2026): Phase 12 COMPLETE — Platform-Wide Intelligence Upgrade
  - **All 13 features (12.0-12.12) built and deployed**: Every Seoul Sister feature is now personalized, data-backed, and seasonally aware. The intelligence layer built in Phase 11 (originally only available to Yuri) now powers every scan, product page, routine, trending feed, and dashboard widget.
  - **Feature 12.0: Shared Intelligence Context Helper** (FOUNDATION): Created `src/lib/intelligence/context.ts` with centralized `loadIntelligenceContext(userId)` — runs 5 parallel queries (skin profile, ingredient effectiveness, seasonal patterns, trend signals, product reactions) so any feature can access the intelligence layer without duplicating query logic
  - **Feature 12.1: Widget Intelligence** (CRITICAL): Added 3 database tools (`search_products`, `compare_prices`, `get_trending_products`) to the anonymous landing page widget via `WIDGET_TOOLS` filter in `/api/widget/chat`. Widget can now search 6,200+ real products and cite real prices — transforms conversion from "generic chatbot" to "database-backed advisor demo"
  - **Feature 12.2: Scan Intelligence Layer** (HIGH): Replaced 80 lines of hardcoded ingredient arrays in `enrich-scan.ts` with `ss_ingredient_effectiveness` queries. Added seasonal context from `ss_learning_patterns`. Scan enrichment now data-driven instead of static
  - **Feature 12.3: Glass Skin Score Personalization** (HIGH): `/api/skin-score` now reads full `ss_user_profiles` (skin_type, concerns, climate, location_text, age_range, allergies, fitzpatrick_scale) and injects into Claude Vision prompt alongside top effective ingredients for user's skin type
  - **Feature 12.4: Shelf Scan Personalization** (HIGH): `/api/shelf-scan` reads user profile and injects allergens, skin type, and concerns into collection analysis prompt. Post-match allergen cross-reference checks product ingredients against user allergies
  - **Feature 12.5: Sunscreen Climate + UV Intelligence** (HIGH): Sunscreen page auto-populates filters from user profile. Real-time UV index via Open-Meteo displayed in `UvBanner` component with threshold warnings (extreme/high/moderate/low). Effectiveness ranking by skin type
  - **Feature 12.6: Products Discovery Intelligence** (HIGH): Added `sort_by=recommended` to products API with personalized match scoring using `ss_ingredient_effectiveness`. Trending badges on product cards. "People With Your Skin Type Love" section
  - **Feature 12.7: Trending Relevance** (MEDIUM): Added "For You" tab to trending page filtering by skin-type relevance. `relevance_score` calculation using `relevanceMultiplier`. Cohort labels showing skin-type-specific popularity
  - **Feature 12.8: Dupe Effectiveness Scoring** (MEDIUM): Dupe finder now queries `ss_ingredient_effectiveness` filtered by user's skin type. Effectiveness-weighted match scoring applied to dupes. User context injected into AI dupe finder prompt
  - **Feature 12.9: Weather Learning-Driven Adjustments** (MEDIUM): `weather-routine.ts` now queries `ss_learning_patterns` for seasonal data. Learning patterns supplement hardcoded weather rules. `location_text` used for display
  - **Feature 12.10: Routine Effectiveness Intelligence** (MEDIUM): New `src/lib/intelligence/routine-effectiveness.ts` with `calculateRoutineEffectiveness()`. Queries `ss_ingredient_effectiveness` for per-concern scoring across all routine ingredients
  - **Feature 12.11: Dashboard Intelligence Widgets** (LOW-MED): New `IntelligenceWidgets` component renders "Your Top Ingredients" (top 5 effective ingredients with effectiveness bars and concern labels) and "Seasonal Tip" (current season's advice for user's climate). Wired into dashboard between Yuri's Insights and Skin Profile
  - **Feature 12.12: Community Cohort Intelligence** (LOW): Community page shows effectiveness data per reviewed product. Skin-type cohort analysis integrated into review display with `effectivenessMap`
  - **Development Phases section updated**: Phases 8-12 now have COMPLETE checkboxes with feature summaries. Phase 10 confirmed complete (Olive Young bestseller scraper, Reddit mention scanner, gap score detector all deployed with 3 cron jobs). Remaining Work section reorganized: deferred Phase 8 features as next priority, future work consolidated
  - **12 cron jobs now configured**: 9 original + 3 Phase 10 (scan-korean-bestsellers 6:30 AM, scan-reddit-mentions 8:30 AM, calculate-gap-scores 9:00 AM)
- v7.0.0 (Feb 22, 2026): Phase 12 Blueprint — Intelligence Layer Propagation Across All Features
  - **Comprehensive feature audit**: Systematically reviewed all 15+ Seoul Sister features for intelligence gaps. Found that Phase 11 upgrades (database tools, learning engine, location awareness) only benefit Yuri — zero other features use the intelligence layer
  - **Phase 12 documented in CLAUDE.md**: 13 features (12.0-12.12) with full implementation plans, code snippets, files to create/modify, and build order
  - **Feature 12.0: Shared Intelligence Context Helper** (FOUNDATION): Centralized `loadIntelligenceContext(userId)` in `src/lib/intelligence/context.ts` — runs 5 parallel queries (skin profile, ingredient effectiveness, seasonal patterns, trend signals, product reactions) so any feature can access the intelligence layer without duplicating query logic
  - **Feature 12.1: Widget Intelligence** (CRITICAL): Add 3 database tools (search_products, compare_prices, get_trending_products) to anonymous landing page widget. Currently widget uses only Claude training knowledge — cannot reference 6,200+ products or real prices
  - **Feature 12.2: Scan Intelligence Layer** (HIGH): Replace 80 lines of hardcoded ingredient arrays in enrich-scan.ts with `ss_ingredient_effectiveness` queries. Add seasonal context from `ss_learning_patterns`. Add trend signal detection from `ss_trend_signals`
  - **Feature 12.3: Glass Skin Personalization** (HIGH): Inject user skin profile + ingredient effectiveness into Claude Vision prompt. Currently analyzes photos with zero knowledge of user's skin type, concerns, or routine
  - **Feature 12.4: Shelf Scan Personalization** (HIGH): Inject allergens, skin type, and routine into collection analysis. Currently generates generic grades with no personalization
  - **Feature 12.5: Sunscreen Climate + UV Intelligence** (HIGH): Auto-populate filters from user profile climate/location, integrate real-time UV index from Open-Meteo, rank by skin-type effectiveness scores
  - **Feature 12.6: Products Discovery Intelligence** (HIGH): Add `sort_by=recommended` with personalized match scoring using ingredient effectiveness data. Add trending badges. Add "People With Your Skin Type Love" section
  - **Feature 12.7: Trending Relevance** (MEDIUM): Add "For You" tab filtering trending products by user's skin type and concerns. Show cohort labels ("Popular with oily skin")
  - **Feature 12.8: Dupe Effectiveness Scoring** (MEDIUM): Weight dupe matches by ingredient effectiveness for user's skin type. Pass user context to AI dupe finder
  - **Feature 12.9: Weather Learning-Driven Adjustments** (MEDIUM): Replace hardcoded `ADJUSTMENT_RULES` object with `ss_learning_patterns` queries. Use `location_text` for display
  - **Feature 12.10: Routine Effectiveness Intelligence** (MEDIUM): Calculate combined routine effectiveness score from ingredient data. Show seasonal routine suggestions from learning patterns
  - **Feature 12.11: Dashboard Intelligence Widgets** (LOW-MED): Add "Your Top Ingredients" widget, "Seasonal Tip" widget, relevance-filtered trending section
  - **Feature 12.12: Community Cohort Insights** (LOW): Add cohort analysis to reviews ("Users with oily skin rate this 4.2 vs 3.1 for dry skin"). Effectiveness badges on reviews
  - **Build order**: 12.0 (foundation) → 12.1 (widget, critical) → 12.2 (scan) → 12.3 (glass skin) → 12.4 (shelf scan) → 12.5 (sunscreen) → 12.6 (products) → 12.7-12.12 (remaining)
  - **Phase 11 features deployed to production**:
    - Feature 11.3 migrations applied: `location_text` column on `ss_user_profiles`, backfill script run (Bailey → "Austin, Texas", vibetrendai → "Elk Grove, California")
    - Feature 11.4 migrations applied: 47 ingredient effectiveness rows, 20 seasonal learning patterns, 8 trend signals seeded
- v6.0.0 (Feb 22, 2026): Phase 11 Blueprint — Yuri Intelligence Upgrades + Cross-Session Memory Fix
  - **Phase 11 documented in CLAUDE.md**: 4 critical intelligence gaps identified and fully documented with implementation plans
  - **Feature 11.1: Product Database Tools** (CRITICAL): Claude tool use / function calling to give Yuri 6 database tools (search_products, get_product_details, check_ingredient_conflicts, get_trending_products, compare_prices, get_personalized_match). Transforms Yuri from text-only chatbot to database-backed AI advisor. New file: `src/lib/yuri/tools.ts`. Modifies `advisor.ts` for tool use loop with streaming
  - **Feature 11.2: Web Search Integration** (HIGH): Brave Search API tool for current information (latest research, new products, Reddit sentiment, reformulation news). Added as 7th tool alongside database tools
  - **Feature 11.5: Real-Time Weather Tool** (HIGH): `get_current_weather` tool (8th tool) gives Yuri real-time weather access via Open-Meteo (free, no API key). Geocodes city names, returns raw weather data (temperature, humidity, UV, wind) + user skin profile + seasonal learning patterns. Claude reasons dynamically about personalized weather-based skincare (AI-first, no templates). Available to both authenticated Yuri and anonymous widget (4 widget tools total)
  - **Feature 11.3: Location Capture in Onboarding** (MEDIUM): `location_text` column on `ss_user_profiles`, extraction prompt update, backfill script. Priority chain: stated location > GPS > nothing
  - **Feature 11.4: Learning Engine Bootstrap** (MEDIUM): Seed `ss_ingredient_effectiveness` (30-50 rows), `ss_learning_patterns` (20 seasonal rows), `ss_trend_signals` (5-10 trends) with research-backed data so Yuri's "data-backed insights" section is never empty
  - **Cross-session memory improvements deployed** (Changes 1-4 from LGAAS audit):
    - Change 1: Richer summaries — max_tokens 400→800, content 300→600 chars, SECTION 1 (Yuri's Recommendations) prioritized over SECTION 2 (User Profile)
    - Change 2: Recent message excerpt loading — last 6 messages from 3 most recent conversations loaded into system prompt
    - Change 3: Smart truncation with bridge summaries — first 4 + last 40 messages kept, Sonnet summarizes dropped middle, cached on conversation record
    - Change 4: Better summary triggers — every 5 messages instead of every 10
  - **Location awareness deployed**: Reverse geocode from lat/lng via BigDataCloud API, injected into skin profile section of system prompt
  - **Bailey's contradictory summary fixed**: Conversation `375a1a1e` incorrectly stated Yuri "had NOT recommended" vitamin C/BHA/Supergoop. Corrected to acknowledge memory limitation at the time. Script: `scripts/fix-bailey-summary.ts`
  - **Backfill re-run**: All 9 conversations regenerated with improved summary prompt. Key onboarding summary: 1,375→2,972 chars
  - **Migration applied**: `truncation_summary` + `truncation_summary_msg_count` columns on `ss_yuri_conversations`
- v5.9.0 (Feb 22, 2026): Phase 10 Blueprint — Real-Time Trend Intelligence
  - **Phase 10 documented in CLAUDE.md**: Comprehensive implementation plans for replacing fabricated `ss_trending_products` seed data with real trend intelligence from external sources
  - **Feature 10.1: Olive Young Bestseller Scraper** (Phase A — Build First): Scrapes `global.oliveyoung.com/display/page/best-seller` for daily Korean sales rankings. Extends existing Olive Young scraper infrastructure (`src/lib/pipeline/sources/olive-young.ts`). Upserts into `ss_trending_products` with `source = 'olive_young'`. New cron job at 6:30 AM UTC. New migration: `ss_trending_products` restructure (drop fabricated seed data, add `source`, `source_rank`, `source_url`, `data_date`, `raw_data` columns), `ss_trend_data_sources` table for tracking scrape history
  - **Feature 10.2: Reddit K-Beauty Mention Scanner** (Phase B): Reddit OAuth 2.0 script-type auth (same credentials as LGAAS). Scans r/AsianBeauty, r/SkincareAddiction, r/KoreanBeauty, r/30PlusSkinCare for product mentions. Product name matching via `ss_products` fuzzy search. Sentiment analysis via Haiku. New cron at 8:30 AM UTC. New `ss_reddit_mentions` table. Environment variables: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`
  - **Feature 10.3: Trend Gap Detector & UI Updates** (Phase C): Cross-references Olive Young rankings vs Reddit mentions to identify "emerging trends" (high Korean rank + low English awareness = highest signal). Rewrites `/trending` page to show "Trending in Korea" (Olive Young data) vs "Trending in K-Beauty Community" (Reddit) vs "Emerging Trends" (gap analysis). Replaces fabricated data with real-time intelligence
  - **Future sources documented**: Hwahae Rankings (Phase D — deferred, Apify scraper ~$3/1K results, weekly category rankings by age group), Additional Sources (Phase E — YouTube Data API, Google Trends, Naver Shopping, Glowpick)
  - **LGAAS Reddit OAuth pattern reference**: Documented the fan-out search architecture from LGAAS `api/search-reddit.js` for the next session to adapt. Seoul Sister needs mention counting + sentiment, not lead response
  - **Implementation priority**: 10.1 (Olive Young, high impact) → 10.2 (Reddit, medium) → 10.3 (Gap detector, ties it together). Build order designed for one feature per session
  - **Existing trend infrastructure preserved**: `src/lib/learning/trends.ts` (internal community signal detection) continues running alongside new external sources. Both feed `ss_trend_signals`
- v5.8.3 (Feb 21, 2026): Database Stats Sync — 14,400+ Ingredients, 221,000+ Links, 89% Linked
  - **fast-link.ts re-run**: Linked 4,050 additional products (all cache hits, $0 Sonnet cost, ~6 min at 10.9/s). Products with ingredient links: 5,552 (89.2%), up from 1,458 pre-run
  - **Stats synced across all user-facing files**: `page.tsx` (homepage hero + stats grid), `llms.txt`, `advisor.ts` (Yuri system prompt), `specialists.ts` (Trend Scout), `CLAUDE.md`
  - **Previous stats → New stats**: Ingredients 14,200+ → 14,400+, links 219,000+ → 221,000+, linked products 5,500+ (88%) → 5,550+ (89%)
- v5.8.2 (Feb 21, 2026): Database Stats Sync — 14,200+ Ingredients, 219,000+ Links, 88% Linked
  - **Ingredient linking pipeline completed**: fast-link.ts processed 4,250 products, creating new ingredient records and links via Sonnet enrichment. Database now at 6,200+ products, 14,200+ ingredients, 219,000+ ingredient links, 590+ brands with 88% of products fully ingredient-linked (up from 76%)
  - **Stats synced across all user-facing files**: Updated `public/llms.txt` (AI discoverability), `src/lib/yuri/advisor.ts` (Yuri's system prompt — "AI + database intelligence" and "Can't find a product" sections), `src/lib/yuri/specialists.ts` (Trend Scout's products page reference)
  - **Previous stats → New stats**: Ingredients 11,700+ → 14,200+, links 189,000+ → 219,000+, linked products 4,740+ (76%) → 5,500+ (88%)
- v5.8.1 (Feb 21, 2026): Yuri Conversation Management — Rename, Delete, Auto-Title Propagation
  - **Conversation delete**: Added `deleteConversation()` to `lib/yuri/memory.ts` with ownership verification and FK-safe cascade (messages first, then conversation). New DELETE endpoint at `/api/yuri/conversations/[id]`
  - **Conversation rename**: New PUT endpoint at `/api/yuri/conversations/[id]` with Zod validation (1-200 chars). Calls existing `updateConversationTitle()` from memory.ts
  - **Auto-title propagation to client**: `streamAdvisorResponse` in `advisor.ts` now yields a `__TITLE__` sentinel after generating the title. Chat route (`/api/yuri/chat`) detects the sentinel, strips it from the text stream, and includes the title in the SSE `done` event. `useYuri` hook captures the title and updates/adds the conversation in the local list — new conversations appear immediately with their auto-generated title
  - **useYuri hook extended**: Added `deleteConversation` (DELETE API + local state removal + clear messages if active) and `renameConversation` (PUT API + local list update) to `UseYuriReturn` interface and implementation
  - **ConversationList rewritten** (`components/yuri/ConversationList.tsx`): Inline edit mode (text input + Check/X confirm/cancel), delete confirmation overlay (red styling with Check/X), Pencil and Trash2 action icons visible on hover (`group-hover:opacity-100`), SpecialistBadge display per conversation, event propagation handling throughout
  - **New file created**: `src/app/api/yuri/conversations/[id]/route.ts` — PUT (rename) and DELETE endpoints with auth and ownership verification
  - **Build verified**: `tsc --noEmit` and `next build` both pass cleanly
- v5.8.0 (Feb 21, 2026): Full Ingredient Linking Pass — All User-Facing Stats Updated
  - **Second fast-link.ts run**: Ran `fast-link.ts` on remaining ~4,250 unlinked products (all products with `ingredients_raw` that lacked links). First 2,570 products processed at ~11/s (all cache hits, $0 Sonnet cost). Remaining ~1,680 products required Sonnet enrichment for new ingredients, slowing to ~2-3/s
  - **Ingredient database expansion**: 10,369 → 11,700+ ingredients (+1,380 new from Sonnet enrichment during linking)
  - **Link count growth**: 180,125 → 189,000+ links (+9,200 new product-ingredient links)
  - **Products with links**: 4,496 → 4,740+ (76% of all products, up from 72%)
  - **All user-facing files updated**: `page.tsx` (homepage stats), `advisor.ts` (Yuri system prompt), `specialists.ts` (Trend Scout stats), `llms.txt` (AI discoverability), CLAUDE.md (this file)
  - **Stats now shown as**: 6,200+ products, 590+ brands, 10,300+ ingredients, 180,000+ links across all user-facing surfaces (conservative rounded numbers)
- v5.7.0 (Feb 21, 2026): Extended Enrichment + Ingredient Linking Pass
  - **Additional Playwright enrichment pass**: Ran `--enrich` on remaining products missing `ingredients_raw`. Extracted ingredient lists from Olive Young detail pages. Olive Young rate-limited aggressively after initial batches (~60% failure rate on later batches), but successfully enriched ~1,400 additional products before hitting diminishing returns. `ingredients_raw` coverage: 5,509 products (up from 4,107)
  - **Extended fast-link.ts ingredient linking**: Ran `fast-link.ts` on 4,257 unlinked products, successfully linking 2,618 before Sonnet API rate limiting slowed throughput. Created 1,141 new ingredients, added 13,873 new product-ingredient links. Sonnet cost: $2.47
  - **New product count from enrichment**: Enrichment pass also discovered and added ~706 new products to `ss_products` (products that were in staging but hadn't been fully processed). Total products: 5,516 → 6,222
  - **Brand expansion**: 454 → 593 brands (+139 new brands from enrichment pass)
  - **Category growth**: Eye care 138 → 555 (+417), lip care 24 → 300 (+276), moisturizer 960 → 973 (+13). Other categories saw minor increases
  - **Final verified database state**: 6,222 products, 10,369 ingredients, 180,125 links, 593 brands, 14 categories. 4,496 products with ingredient links (72%). 5,509 products with `ingredients_raw`. Avg 40.1 links per linked product
  - **Remaining unlinked**: ~1,013 products with `ingredients_raw` but no links yet (fast-link was interrupted by rate limiting). Daily `link-ingredients` cron will continue linking these at 50/run
  - **Total cumulative pipeline cost**: ~$58.44 ($55.97 prior + $2.47 this pass)
- v5.6.0 (Feb 20, 2026): Cron Pipeline Hardening — Category Coverage, Active Price Scraping, Failure Alerting
  - **Olive Young CATEGORY_MAP expanded**: 6 → 11 categories. Added Sheet Masks (1000000004), Patches (1000000007), Pads (1000000148), Lip Balm & Treatment (1000000048), Eye (1000000040). Documented that toner/essence/ampoule/serum/oil/mist all live under "All Skincare" (ctgrNo=1000000008) — Sonnet handles fine-grained categorization from product name/description
  - **refresh-prices cron rewritten**: Was snapshot-only (no actual retailer scraping). Now 3-phase active scraping: (1) Soko Glam via Shopify JSON API (40 products, no browser needed) + YesStyle via Playwright (15 products, conditional on remaining time budget), (2) snapshot all prices to `ss_price_history`, (3) detect >10% price drops and create trend signals. 50s timeout guard for Vercel cron limits. `maxDuration = 60`
  - **translate-and-index split into two crons**: Previously crammed Sonnet extraction + ingredient linking into one 60s window (ingredient linking often skipped). Now: `translate-and-index` (7 AM, extraction only, 50 products) + new `link-ingredients` (7:30 AM, ingredient linking only, 50 products). Each gets full 60s budget
  - **New cron: `/api/cron/link-ingredients`**: Dedicated ingredient linking cron at 7:30 AM UTC. Finds products with `ingredients_raw` but no `ss_product_ingredients` rows, parses INCI strings, matches/creates ingredients, inserts links. Uses Sonnet for new ingredient enrichment (~$0.01-0.05 per run)
  - **Schedule collision fixed**: `update-effectiveness` moved from 6:00 AM → 5:30 AM UTC to avoid collision with `scan-korean-products` at 6:00 AM. Total 9 cron jobs configured in `vercel.json`
  - **`maxDuration = 60` added**: Route segment config added to 5 cron routes that were missing it (`scan-korean-products`, `translate-and-index`, `link-ingredients`, `refresh-prices`, `aggregate-learning`). Ensures Vercel allocates full 60s execution window
  - **PipelineAlerts component**: Added to admin dashboard (`/admin/pipeline`). Checks 6 failure conditions: recent failed pipeline runs (24h), stuck runs (>15 min), failed staging rows, low health score (<60 critical, <80 warning), stale quality report (>8 days), no pipeline activity in 48h. Red banners for CRITICAL, amber for WARNING
  - **Price freshness indicators**: `PriceComparison.tsx` now shows staleness per retailer row — "Just checked" (green, <12h), "Today" (gray), "Xd ago" (amber 3-7d, red >7d). Warning banner at bottom when any price is >7 days old. Uses `getPriceFreshness()` helper
  - **CLAUDE.md cron documentation overhaul**: Replaced aspirational 10-row cron table with accurate 9-row implemented table + 4-row future table. Added pipeline chain explanation and price freshness description
  - **Build verified**: Both `tsc --noEmit` and `next build` pass cleanly
- v5.5.0 (Feb 20, 2026): Production Readiness Audit — Security Hardening + Subscription Enforcement
  - **Database cleanup**: Dropped 76 ghost tables (leftover from pre-rebuild app), 1 ghost view (`price_intelligence_summary`), 13 ghost functions. Fixed `handle_new_user` auth trigger to insert into `ss_user_profiles` (was inserting into dropped `profiles` table — caused Bailey's missing profile). Fixed `search_path` on 14 functions (security hardening). Enabled RLS on `ss_product_staging`, `ss_pipeline_runs`, `ss_rate_limits`. Migration: `scripts/migrations/cleanup_ghost_tables.sql`
  - **Subscription enforcement on 6 AI endpoints**: All Claude Opus API routes now check `hasActiveSubscription()` before processing. Returns 403 if no active subscription. Endpoints gated: `/api/yuri/chat`, `/api/scan`, `/api/skin-score`, `/api/shelf-scan`, `/api/routine/generate`, `/api/dupes/ai`
  - **Usage tracking wired in**: `incrementYuriMessageCount()` now called in `/api/yuri/chat` (500/month cap, returns 429 at limit). `incrementScanCount()` now called in `/api/scan` (30/month cap, returns 429 at limit). Functions existed in `src/lib/usage.ts` but were never called from any route.
  - **Billing portal**: "Manage" button added to profile page Subscription section. Calls `/api/stripe/portal` to open Stripe billing portal (update payment, cancel, view invoices).
  - **Error boundaries**: Created `src/app/error.tsx` (global error boundary with retry) and `src/app/not-found.tsx` (404 page). Both were completely missing.
  - **SSE stream hardening**: `useYuri.ts` — added `useEffect` cleanup to abort in-flight streams on unmount, wrapped reader loop in `try/finally` with `reader.releaseLock()` to prevent memory leaks.
  - **Header error handling**: `Header.tsx` — added try-catch to admin status check and sign out handler to prevent silent failures.
  - **Stripe webhook secret**: Updated `.env.local` from placeholder to real `whsec_` value. Webhook was already configured in Stripe dashboard pointing to `seoulsister.com/api/stripe/webhook`.
  - **Bot account cleanup**: Deleted `test@email.com` + 6 spam bot accounts from `auth.users`. Only 2 legitimate accounts remain (vibetrendai + baileydonmartin).
  - **Bailey's profile**: Created `ss_user_profiles` record with `plan = 'pro_monthly'`. Both accounts set to pro.
- v5.4.0 (Feb 20, 2026): Phase 9.5 + Admin Auth + Yuri Knowledge Update
  - **Phase 9.5: Daily Automation Cron Jobs + Admin Dashboard** — Complete
    - 3 new cron jobs: `scan-korean-products` (daily 6 AM), `translate-and-index` (daily 7 AM), `data-quality` (weekly Sunday 4 AM)
    - Admin pipeline dashboard page (`/admin/pipeline`): Pipeline run history, staging counts, manual trigger buttons (scrape, process, link ingredients, refresh prices), product database stats
    - Total 8 cron jobs configured in `vercel.json` (5 from earlier phases + 3 from Phase 9.5)
  - **Centralized admin auth system** (`src/lib/auth.ts`):
    - `requireAdmin()` with three-layer auth: (1) legacy service-role-key header, (2) `ADMIN_EMAILS` env var (comma-separated, bootstrap/fallback), (3) `is_admin` column on `ss_user_profiles` (DB source of truth)
    - Replaced 6 duplicated `verifyAdminAuth()` functions across admin API routes
    - Admin dashboard rewritten from manual service-key entry to JWT-based auth using `useAuth()` hook
    - Migration `20260221000001_add_admin_role.sql`: `is_admin` column + partial index + vibetrendai@gmail.com set as admin
  - **Header navigation refactor** (`src/components/layout/Header.tsx`):
    - Profile icon replaced with dropdown menu: Profile, Admin (conditional on `is_admin`), Sign Out
    - Admin link visible only to admin users (checks `is_admin` via `ss_user_profiles` query)
    - Sign Out button in both desktop dropdown and mobile nav
    - Sunscreen and Shelf Scan added to nav links
  - **Profile page sign out** (`src/app/(app)/profile/page.tsx`): Sign Out button added to Account section
  - **Yuri knowledge update — CRITICAL FIX**:
    - Yuri's main system prompt (`src/lib/yuri/advisor.ts`) updated with knowledge of ALL features: Glass Skin Score, Shelf Scan, Sunscreen Finder, Dupe Finder, Expiration Tracking, Weather-Adaptive Routine, Cycle Tracking, ingredient include/exclude filters, scan enrichment pipeline
    - Added "Advanced Features" section to Yuri's app knowledge with detailed descriptions and paths for 7 features she previously didn't know about
    - Added "What Makes Seoul Sister Different" section so Yuri can explain competitive advantages
    - Updated Navigation section with all current pages and accurate descriptions
    - Updated product count from "10,000+" to accurate "5,500+ across 450+ brands"
    - Updated troubleshooting with Glass Skin Score and weather tips
    - All 6 specialist agent prompts updated with "Seoul Sister tools to reference" sections linking agents to relevant app features
  - **llms.txt updated** (`public/llms.txt`): Corrected product count, added 7 missing features (Glass Skin Score, Shelf Scan, Sunscreen Finder, Dupe Finder, Weather Alerts, Expiration Tracking, Cycle Tracking), added database statistics section, expanded brand list to reflect 450+ brands
  - **package.json version**: Updated from 3.0.0 to 5.4.0
- v5.3.0 (Feb 21, 2026): Phase 9.4 — Multi-Retailer Price Integration
  - **4 retailer scrapers built and tested**: YesStyle (Playwright, high reliability), Soko Glam (Shopify Predictive Search API, high reliability), Amazon (Playwright, low reliability — CAPTCHA), StyleKorean (Playwright, low reliability — AJAX search incompatible with headless browsers)
  - **Price matcher module** (`src/lib/pipeline/price-matcher.ts`): Fuzzy product matching with 3-strategy approach: (1) exact normalized name+brand, (2) brand match + token similarity, (3) full fuzzy across all products. `RETAILER_DB_NAMES` mapping handles code→display name conversion. Paginated product loading (5,516 products, 435 brands). Retailer ID caching. `upsertPrice()` handles insert/update with price change detection and `ss_price_history` recording
  - **Price pipeline orchestrator** (`src/lib/pipeline/price-pipeline.ts`): Sequential product processing with rate limiting, per-retailer scraper lifecycle management, `findBestMatch()` with product ID preference and confidence-gated fallback, `getProductsForPricing()` with stale-price exclusion and brand filtering
  - **CLI script** (`scripts/run-prices.ts`): Full CLI with `--retailer`, `--batch`, `--brands`, `--stale`, `--stats` options. Supports single retailer or `--retailer all` for sequential multi-retailer runs
  - **Admin API** (`src/app/api/admin/pipeline/prices/route.ts`): POST endpoint for triggering price scrapes, protected by service role key
  - **Cron job updated** (`src/app/api/cron/refresh-prices/route.ts`): Replaced stub with real implementation using PricePipeline. Runs Soko Glam (50 products) and YesStyle (25 products) per cron execution. Skips products priced within 6 hours. 55s timeout guard for Vercel cron limits
  - **Pipeline types** (`src/lib/pipeline/types.ts`): Added `PriceRetailer`, `ScrapedPrice`, `PriceMatch`, `PriceScrapeOptions`, `PricePipelineStats` interfaces
  - **Database**: StyleKorean retailer added via migration (`20260220000004_add_stylekorean_retailer.sql`). 52 total price records across 6 retailers (YesStyle 19, Amazon 10, Olive Young 9, Soko Glam 9, Stylevana 4, iHerb 1). Price history recording for all inserts and price changes
  - **End-to-end verified**: Soko Glam pipeline: 5 COSRX products searched, 3 matched, 3 inserted. YesStyle pipeline: 25 products searched across 9 brands (COSRX, Anua, Laneige, etc.), 14 matched, 14 inserted. All records verified in `ss_product_prices` and `ss_price_history`
  - **Retailer reliability**: Soko Glam (high — clean Shopify JSON API), YesStyle (high — Playwright with URL-slug name extraction), Amazon (low — CAPTCHA blocks headless), StyleKorean (low — `ItemListView()` AJAX doesn't fire in headless)
  - **Key pipeline files**: `scripts/run-prices.ts` CLI entry point. `scripts/test-price-scraper.ts` for individual scraper testing
- v5.2.0 (Feb 20, 2026): Phase 9.6 — Detail Enrichment + Full Ingredient Linking Pass
  - **Playwright detail page enrichment**: Ran `--enrich` on ~1,915 processed products missing `ingredients_raw`. Playwright scraped individual Olive Young product detail pages to extract full INCI ingredient lists. Result: 4,107 products now have `ingredients_raw` (up from ~2,572)
  - **Optimized ingredient linker** (`scripts/fast-link.ts`): Created standalone fast linker that avoids the `getAllLinkedProductIds` bottleneck (118K+ row pagination). Strategy: fetch all product IDs with `ingredients_raw` in 5 pages, check link status in batched `IN()` queries (100 per batch), load ingredient cache once, process all unlinked products sequentially reusing cache. ~96 min runtime for 3,165 products
  - **Third ingredient linking pass**: Linked 1,112 additional products (3,025 → 4,137), created 1,972 new ingredients (7,256 → 9,228), added 50,444 new links (115,808 → 166,252). Sonnet cost: $4.13
  - **Brand normalization + dedup cleanup**: Ran `cleanup-brands-dedup.ts` — 0 changes needed (data already clean from prior passes)
  - **Final verified database state**: 5,516 products, 9,228 ingredients, 166,252 links, 454 brands, 14 categories
  - Products with ingredient links: 4,137 (75%). Avg 40.2 links per product
  - Category distribution: mask (1,038), moisturizer (960), cleanser (805), sunscreen (683), serum (520), toner (461), ampoule (294), spot_treatment (197), exfoliator (176), eye_care (138), essence (130), mist (74), lip_care (24), oil (16)
  - Total cumulative pipeline cost: $55.97 (extraction $49.15 + ingredient linking $6.82)
- v5.0.0 (Feb 20, 2026): Phase 9.1-9.3 + 9.6 — Automated Pipeline Built & Executed
  - **Phase 9.1: Olive Young Global Scraper** — Built and executed
    - `src/lib/pipeline/scraper-base.ts`: Base scraper with rate limiting (1 req/2s), retry logic, user-agent rotation
    - `src/lib/pipeline/sources/olive-young.ts`: Full category scraping + product detail extraction from global.oliveyoung.com
    - `src/lib/pipeline/types.ts`: RawProductData, ProcessedProductData, PipelineRun interfaces
    - `src/app/api/admin/pipeline/scrape/route.ts`: Admin endpoint for triggering scrape runs
    - `src/app/api/admin/pipeline/status/route.ts`: Pipeline monitoring endpoint
    - Database: `ss_product_staging` + `ss_pipeline_runs` tables created via Supabase MCP
    - **Results**: 5,656 product listings scraped across all Olive Young categories
  - **Phase 9.2: Sonnet AI Extraction & Normalization** — Built and executed
    - `src/lib/pipeline/extractor.ts`: Sonnet 4.5 structured extraction (category, description, volume, PAO, sunscreen fields)
    - `src/lib/pipeline/batch-processor.ts`: Batch processing with concurrency control, dedup, cost tracking
    - `src/lib/pipeline/cost-tracker.ts`: Token usage and cost estimation per pipeline run
    - `src/app/api/admin/pipeline/process/route.ts`: Admin endpoint for batch processing
    - `scripts/run-import.ts`: CLI orchestrator for all pipeline stages (`--listings-only`, `--enrich`, `--process`, `--link`)
    - **Results**: 5,530 products extracted (3,615 initial + 1,915 second pass), 507 brands, $49.15 total Sonnet cost ($32.04 + $17.11)
  - **Phase 9.3: Ingredient Auto-Linking Pipeline** — Built and executed
    - `src/lib/pipeline/ingredient-parser.ts`: INCI string parsing with parenthetical handling
    - `src/lib/pipeline/ingredient-matcher.ts`: Fuzzy matching with KNOWN_ALIASES map, IngredientCache, Sonnet enrichment for new ingredients
    - `src/lib/pipeline/ingredient-linker.ts`: Batch linking orchestrator with progress tracking
    - `src/app/api/admin/pipeline/link-ingredients/route.ts`: Admin endpoint for ingredient linking
    - Database: `ingredients_raw` column added to `ss_products`
    - **Results**: 4,137 products linked (2,993 initial + 40 second pass + 1,112 third pass via fast-link.ts), 9,228 unique ingredients, 166,252 links, $6.82 Sonnet cost ($2.37 + $0.32 + $4.13)
    - **Bug fixes during execution**: Pagination query bug in findUnlinkedProducts, JSON parse error in ingredient-matcher (uncaught Sonnet response parse failure)
    - **batch-processor.ts change**: Removed `ingredients_raw` non-null filter to allow processing listing-only rows (products without ingredient data still get category, description, PAO from Sonnet)
  - **Phase 9.6: Import Execution & Data Quality** — Completed (two passes)
    - **Pass 1** (initial): Brand normalization (94 products, 37 mappings), ingredient dedup (215 merged), product dedup (8 removed). Result: 3,607 products
    - **Pass 2** (remaining 2,130 staged rows): Processed all pending listing-only rows through Sonnet extraction (+1,915 new products, 215 duplicates, 0 failures, $17.11). Ingredient linking (+40 products linked, 142 new ingredients, $0.32). Brand normalization (718 products across 50 mappings). Product dedup (6 additional removed)
    - `scripts/cleanup-brands-dedup.ts`: Standalone cleanup script with 50 brand mappings, product dedup, ingredient dedup
    - **Final verified database state**: 5,516 products, 9,228 ingredients, 166,252 links, 454 brands, 14 categories
    - Products with ingredient links: 4,137 (75%). Products with `ingredients_raw`: 4,107. Remaining 1,379 products are listing-only (no ingredient data from source)
    - Avg 40.2 ingredient links per product (for linked products)
    - Total pipeline cost: $55.97 (Sonnet extraction $49.15 + ingredient linking $6.82)
    - Category distribution: mask (1,038), moisturizer (960), cleanser (805), sunscreen (683), serum (520), toner (461), ampoule (294), spot_treatment (197), exfoliator (176), eye_care (138), essence (130), mist (74), lip_care (24), oil (16)
    - Top brands: Anua (225), Mediheal (137), Beplain (118), Aestura (104), Dr.G (96), Skinfood (95), Round Lab (94), Torriden (83), Bringgreen (82), VT (82)
  - **Pipeline staging**: 0 pending rows remaining. All 5,656 scraped rows processed (4,895 processed, 760 duplicate, 1 failed)
  - **Remaining Phase 9 work**: 9.5 (Daily Automation Cron Jobs). Phase 9.4 completed. Detail page enrichment completed for all accessible products; 1,379 products remain without `ingredients_raw` (source pages lacked ingredient data)
  - **Key pipeline files**: `scripts/run-import.ts` is the CLI entry point. Usage: `npx tsx --tsconfig tsconfig.json scripts/run-import.ts --process` (Sonnet extraction), `--link` (ingredient linking), `--listings-only` (scrape only), `--enrich` (Puppeteer detail page scraping). `scripts/cleanup-brands-dedup.ts` for brand normalization + deduplication cleanup
- v4.0.0 (Feb 19, 2026): Phase 9 Blueprint + Product Database Expansion to 626
  - **Phase 9: Automated Product Intelligence Pipeline** — Full blueprint for 6 features (9.1-9.6) written to CLAUDE.md with implementation plans, database schemas, API signatures, Sonnet prompt designs, cost estimates, and build order
    - 9.1: Olive Young Global Scraper (foundation infrastructure, `ss_product_staging` + `ss_pipeline_runs` tables)
    - 9.2: Sonnet AI Extraction & Normalization (batch processing, cost tracking, ~$60-80 for 10K products)
    - 9.3: Ingredient Auto-Linking Pipeline (INCI parsing, fuzzy matching, auto-create new ingredients)
    - 9.4: Multi-Retailer Price Integration (YesStyle, Soko Glam, Amazon, StyleKorean scrapers)
    - 9.5: Daily Automation Cron Jobs (scan-korean-products, translate-and-index, data-quality + admin dashboard)
    - 9.6: Initial 10K Import Execution (operational runbook)
    - Build order: 9.1 → 9.2 → 9.3 → 9.6 (run import) → 9.4 → 9.5
    - Total estimated cost for 10K products: ~$65-85 one-time, ~$25-50/month ongoing
  - **Product database expanded**: 151 → 626 unique products across 82 brands, 14 categories
    - Migration files 005-011: 500 new products from 12 parallel research agents covering 60+ brands
    - Migration file 012: Backfill of 30 file-005 products missing subcategory/rating_avg/review_count/shelf_life_months
    - Migration file 013: Dedup cleanup (removed 25 duplicate rows, backfilled 21 original seed products with NULL ratings)
    - Final verified state: 626 products, 82 brands, 14 categories, 569 with ratings
  - **Migration files created**: `20260219000005` through `20260219000013` (9 files total)
  - **Remaining Work updated**: scan-korean-products and translate-and-index crons now reference Phase 9
- v3.10.0 (Feb 19, 2026): Feature 8.11 Shelf Scan — Collection Analysis
  - **API** (`app/api/shelf-scan/route.ts`): POST endpoint accepts base64 shelf/collection photo, sends to Claude Opus 4.6 Vision with multi-product identification prompt. 60s timeout (`maxDuration = 60`). Identifies every visible product with name, brand, category, confidence score, and position in image. Generates collection analysis: estimated total value, ingredient overlap warnings, missing categories, redundant products, routine grade (A-F) with rationale, and actionable recommendations. Matches identified products against `ss_products` database (fuzzy ilike search). Refines estimated value using real `ss_product_prices` data where products are matched. Auth-required via `requireAuth()`. Response includes products_count and matched_count for DB coverage stats.
  - **CollectionGrid component** (`components/shelf-scan/CollectionGrid.tsx`): Renders identified products as indexed cards with brand, name, category pill, confidence score with color-coded label (High/Medium/Low), position in image, and database match status ("In DB" with link to product detail page vs "Unknown" badge)
  - **RoutineGrade component** (`components/shelf-scan/RoutineGrade.tsx`): Large letter-grade display with color-coded styling per grade (A=emerald, B=sky, C=amber, D=orange, F=rose). Shows grade label ("Excellent Collection" through "Just Getting Started") and AI rationale. Ring and glow effects for visual impact
  - **CollectionStats component** (`components/shelf-scan/CollectionStats.tsx`): 3-column stat grid (product count, estimated value, category count). Category breakdown pills. Missing categories section (amber warning ring). Redundant products section (rose warning ring). Ingredient overlap warnings. Database match count summary
  - **Shelf Scan page** (`app/(app)/shelf-scan/page.tsx`): Camera capture (`capture="environment"` for landscape), gallery upload, client-side image compression (1500px max, JPEG 80%), 60s AbortController timeout. Results display: RoutineGrade hero, CollectionStats, recommendations list with "Ask Yuri to optimize" deep link, CollectionGrid of identified products, "Build routine from these products" link, scan-again button. Error handling for AbortError, Load failed, Failed to fetch
  - **ShelfScanWidget** (`components/dashboard/ShelfScanWidget.tsx`): Dashboard CTA widget linking to /shelf-scan with Camera icon and description
  - **Dashboard integration**: Collection Analysis section added between Weather & Skincare and Trending in Korea with Layers icon
  - **Navigation**: "Shelf Scan" added to Header desktop/mobile nav links
  - **TypeScript types**: `RoutineGradeLevel`, `ShelfScanProduct`, `ShelfScanCollectionAnalysis`, `ShelfScanResult` added to `types/database.ts`
  - **No database changes**: No new tables required. Uses existing `ss_products` and `ss_product_prices` for matching and value refinement
- v3.9.0 (Feb 19, 2026): Feature 8.10 Weather-Adaptive Routine Alerts
  - **Database**: `ss_user_profiles` extended with `latitude` (DECIMAL 10,8), `longitude` (DECIMAL 11,8), `weather_alerts_enabled` (BOOLEAN default FALSE). Partial index on `user_id` WHERE `weather_alerts_enabled = TRUE`
  - **Intelligence module** (`lib/intelligence/weather-routine.ts`): Open-Meteo API integration (free, no API key) with 30-min revalidation cache. Single endpoint returns temperature, feels_like, humidity, uv_index, wind_speed, WMO weather code. Reverse geocoding for city name (24h cache). `getWeatherAdjustments(weather, skinType)` maps 6 weather triggers (high_humidity, low_humidity, high_uv, cold_dry, hot_humid, windy) to skincare routine adjustments with skin-type-specific extras for oily, dry, combination, sensitive. `getWeatherSummary()` generates one-line condition summary
  - **API** (`app/api/weather/routine/route.ts`): GET (fetch weather + personalised adjustments; accepts explicit lat/lng query params or falls back to saved profile coordinates), PUT (update latitude, longitude, weather_alerts_enabled). Zod-validated, auth-required
  - **WeatherRoutineWidget** (`components/dashboard/WeatherRoutineWidget.tsx`): Dashboard widget showing temperature, humidity, UV index, wind speed, location, condition. Displays up to 3 adjustment suggestions with type-coded icons (add/reduce/swap/avoid/emphasize). Shows "Set your location" CTA when no coordinates configured
  - **Dashboard integration**: Weather & Skincare section added between Glass Skin Score and Trending in Korea with CloudSun icon
  - **Profile integration**: WeatherLocationToggle component with enable/disable toggle, browser Geolocation API for coordinate capture, location update button, privacy notice
  - **TypeScript types**: `WeatherTrigger`, `WeatherData`, `WeatherRoutineAdjustment`, `WeatherRoutineResponse` added to `types/database.ts`
  - **No API key required**: Uses Open-Meteo (open-meteo.com) — free, open-source weather API
  - **Migration file**: `supabase/migrations/20260219000003_add_weather_alerts.sql` (run manually in SQL Editor)
- v3.8.0 (Feb 19, 2026): Feature 8.9 Glass Skin Score — Photo Tracking
  - **Database**: `ss_glass_skin_scores` table with RLS (select, insert, delete), index on `(user_id, created_at DESC)`, updated_at trigger. Scores 5 dimensions (luminosity, smoothness, clarity, hydration, evenness) each 0-100 with CHECK constraints
  - **API** (`app/api/skin-score/route.ts`): POST (analyze skin photo via Claude Opus 4.6 Vision, save score, return comparison with previous), GET (score history with limit param). 60s timeout for Vision calls. Zod-validated, auth-required
  - **Claude Vision prompt**: Specialized "Glass Skin Analyst" system prompt scoring 5 dimensions with Korean terminology (광채, 매끄러움, 투명도, 수분, 균일). Weighted overall score (luminosity 25%, smoothness 20%, clarity 20%, hydration 20%, evenness 15%). Returns 3-5 K-beauty recommendations targeting lowest dimensions
  - **ScoreRadarChart component** (`components/glass-skin/ScoreRadarChart.tsx`): SVG pentagon radar chart with 5-level grid, axis lines, current score polygon (gold fill), optional previous score overlay (dashed), score dots, Korean dimension labels, per-dimension score grid with change indicators
  - **ProgressTimeline component** (`components/glass-skin/ProgressTimeline.tsx`): SVG line chart showing score progression over time with gradient area fill, trend summary (up/down/flat), chronological date axis, score history list with color-coded grade badges and change deltas
  - **ShareCard component** (`components/glass-skin/ShareCard.tsx`): Canvas-generated 600x400 share image with dark gradient background, gold accent, score circle, dimension bars, Seoul Sister branding. Native Web Share API with image file + text fallback, clipboard copy fallback, PNG download option
  - **Glass Skin page** (`app/(app)/glass-skin/page.tsx`): Camera selfie capture (front-facing via `capture="user"`), gallery upload, client-side image compression (1500px max, JPEG 80%), animated score ring with gradient, radar chart, recommendations with "Ask Yuri" deep link to lowest dimension, analysis notes, share/download actions, collapsible progress history section
  - **GlassSkinWidget** (`components/dashboard/GlassSkinWidget.tsx`): Dashboard widget showing latest score with ring visualization and trend indicator, or CTA to take first photo if no scores exist
  - **Dashboard integration**: Glass Skin Score section added between Reformulation Alerts and Trending
  - **Navigation**: "Glass Skin" added to Header desktop/mobile nav links
  - **TypeScript types**: `GlassSkinDimension`, `GlassSkinScore`, `GlassSkinDimensionScore`, `GlassSkinAnalysisResult`, `GlassSkinComparison` added to `types/database.ts`
  - **Migration file**: `supabase/migrations/20260219000002_add_glass_skin_scores.sql` (run manually in SQL Editor)
- v3.7.0 (Feb 19, 2026): Feature 8.8 Hormonal Cycle Routine Adjustments
  - **Database**: `ss_user_cycle_tracking` table with RLS, indexes, trigger. `ss_user_profiles` extended with `cycle_tracking_enabled` and `avg_cycle_length` columns
  - **Intelligence module** (`lib/intelligence/cycle-routine.ts`): Phase calculation from cycle start date (menstrual/follicular/ovulatory/luteal with proportional day ranges), skin behavior descriptions per phase, personalized routine adjustments factoring skin type and current products
  - **API** (`app/api/cycle/route.ts`): Full CRUD — GET (phase info + adjustments + history), POST (log cycle start), PUT (toggle tracking/update avg length), DELETE (remove entries). Zod-validated, auth-required
  - **CycleAdjustment component** (`components/routine/CycleAdjustment.tsx`): Collapsible phase card with color-coded phases, skin behavior summary, routine adjustment suggestions (add/reduce/swap/avoid/emphasize), tips, and LogCycleModal for date entry
  - **Routine page integration**: CycleAdjustment banner renders above routine cards (only when tracking is enabled)
  - **Profile page integration**: CycleTrackingToggle component with on/off toggle, privacy notice, and avg cycle length display
  - **Yuri context injection** (`lib/yuri/memory.ts`): `loadUserContext()` fetches latest cycle entry and calculates current phase; `formatContextForPrompt()` injects phase, day, skin behavior, and recommendations into Yuri's system prompt
  - **Sensitivity Guardian specialist**: Added cycle/period/hormonal/pms/ovulation keywords to trigger routing; added menstrual cycle skin effects guide to system prompt; cycle_patterns added to extraction prompt
  - **TypeScript types**: `CyclePhase`, `UserCycleTracking`, `CyclePhaseInfo`, `CycleRoutineAdjustment` added to `types/database.ts`
  - **Migration file**: `supabase/migrations/20260219000001_add_cycle_tracking.sql` (run manually in SQL Editor)
- v3.6.0 (Feb 18, 2026): Phase 8 Value Enrichment Features — 11 Feature Implementation Plans
  - Documented comprehensive implementation plans for 11 new features across 3 priority tiers
  - Each plan includes: strategic rationale, current state analysis, exact files to create/modify, database migrations, API signatures, component structures, and step-by-step build instructions
  - Tier 1 (High Impact, Build First): Product Detail Enrichment, Routine Builder Intelligence, K-Beauty Dupe Finder, Ingredient Include/Exclude Search
  - Tier 2 (High Impact, Moderate Effort): Expiration/PAO Tracking, Reformulation Tracker, Sunscreen Finder, Hormonal Cycle Routine Adjustments
  - Tier 3 (Strategic Differentiators): Glass Skin Score Photo Tracking, Weather-Adaptive Routine Alerts, Shelf Scan Collection Analysis
  - Recommended build order: 8.1 → 8.4 → 8.2 → 8.3 → 8.5 → 8.7 → 8.6 → 8.8 → 8.9 → 8.10 → 8.11
  - Plans are designed for fresh Claude Code sessions — each feature is self-contained with full context
- v3.5.0 (Feb 18, 2026): Scan Enrichment Pipeline + Mobile Reliability
  - **Scan enrichment module** (`lib/scanning/enrich-scan.ts`): 5 parallel post-scan database queries
    - `fetchPersonalization()`: Checks user allergies against scanned ingredients, flags comedogenic ingredients for oily/combo skin, irritants for sensitive skin, highlights beneficial ingredients matching skin type and concerns
    - `fetchPricing()`: Retrieves prices from `ss_product_prices` joined with `ss_retailers` (trust scores, authorized status), calculates best deal and savings percentage
    - `fetchCommunity()`: Pulls from `ss_reviews` and `ss_product_effectiveness`, filters by user's skin type, computes Holy Grail/Broke Out counts, repurchase %, effectiveness score
    - `fetchCounterfeit()`: Retrieves brand-specific markers from `ss_counterfeit_markers`, verified retailers with trust scores, total counterfeit report count
    - `fetchTrending()`: Checks `ss_trending_products` and `ss_trend_signals` for trend score, source, sentiment, and active signals
  - **Scan API route** updated: Calls enrichment after Claude Vision analysis, returns enrichment data in response. Enrichment is non-critical (wrapped in try/catch)
  - **ScanResults component** (`components/scan/ScanResults.tsx`): Extracted from LabelScanner with 7 enrichment UI sections: PersonalizedMatch, TrendContext, PriceComparison, CommunityIntelligence, AuthenticityCheck, ActionButtons (Add to Routine, Price Alert, Ask Yuri, Full Details), and ingredient list
  - **LabelScanner refactored**: 480 lines reduced to 252 lines. Now handles only camera/upload/scanning state; delegates all results to ScanResults
  - **Mobile scan fix**: Client-side image compression (canvas resize to 1500px max, JPEG 80%) to stay under Vercel's 4.5MB body limit. 60s function timeout (`maxDuration = 60` route segment config + vercel.json). AbortController with 60s client timeout. Safari "Load failed" and "Failed to fetch" errors now show user-friendly messages
  - **Strategic differentiation**: The enrichment pipeline is what separates Seoul Sister from raw AI models. A user can ask Claude to analyze a label, but they cannot get personalized skin-type warnings, routine conflict detection, retailer price comparison, skin-type-specific community ratings, or counterfeit awareness from a raw AI conversation
- v3.3.0 (Feb 17, 2026): All Build Phases Complete + Deployment
  - All 7 build phases + Phase 3B schema complete (9 migration files)
  - Combined migration file created at `scripts/combined-all-migrations.sql`
  - Fixed Phase 6 compatibility: `update_updated_at_column()` alias for `ss_set_updated_at()`
  - Vercel deployment live at seoul-sister.vercel.app
  - DNS configured in Namecheap (A record, CNAME, 2 TXT verification records)
  - Environment variables configured in Vercel (Supabase URL/keys, Anthropic, Stripe)
  - Next.js upgraded from 15.0.0 to 15.5.12 (CVE-2025-66478 fix)
- v3.4.0 (Feb 18, 2026): AI Discoverability, PWA, Performance, Cron Scheduling
  - robots.ts with GPTBot, Claude-Web, PerplexityBot, ChatGPT-User, Applebot-Extended allowances
  - Dynamic sitemap.ts pulling all active products from database
  - llms.txt product database summary for AI model consumption
  - JSON-LD structured data: Organization schema on root layout, Product + AggregateRating on product detail pages
  - Service worker (public/sw.js) with network-first strategy, offline fallback, static asset caching
  - PWA install prompt component with beforeinstallprompt handler and dismiss persistence
  - Code splitting: ConversationList, SpecialistPicker, LabelScanner, TikTokCapture lazy-loaded via next/dynamic
  - Bundle analyzer configured (@next/bundle-analyzer, ANALYZE=true npm run analyze)
  - vercel.json cron scheduling for 5 existing jobs (trends, prices, learning, effectiveness, seasonal)
  - Premium single-tier pricing: $39.99/mo Seoul Sister Pro, Stripe product + webhook live
  - Usage tracking: ss_usage_tracking table, 500 msg / 30 scan caps, UI warnings at 80%+
- v3.2.0 (Feb 17, 2026): Three-Layer Yuri Widget Architecture. Replaced generic widget spec with three-layer approach: Layer 1 (floating bubble, all pages), Layer 2 ("Try Yuri" inline section mid-page on landing page), Layer 3 (full post-signup experience). Documented landing page flow (hero -> features -> Try Yuri -> social proof -> pricing -> CTA). Added widget-as-hero rule of thumb for LGAAS comparison. Updated Phase 7 with detailed widget implementation steps. Marked Phase 5 complete.
- v3.1.0 (Feb 17, 2026): Added Yuri Conversational Onboarding (replaces form wizard) and Yuri Landing Page Widget (pre-signup AI demo). Updated LGAAS relationship with clear responsibility separation. Updated all completed phases with implementation details.
- v3.0.0 (Feb 17, 2026): Complete rebuild as "Hwahae for the World." 7 development phases, 30 database tables, 6 specialist agents, glass skin design system.
