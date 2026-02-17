# Seoul Sister - K-Beauty Intelligence Platform

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

### Yuri Landing Page Widget -- Three-Layer Architecture

**Philosophy**: Trust-first conversion. Let Yuri sell herself through free value before asking anyone to create an account. A visitor who's had a real conversation with Yuri before signing up is 5-10x more likely to convert than someone who just read marketing copy.

**Why NOT Widget-as-Hero**: Seoul Sister has 6 major features to showcase (Product Intelligence, AI Advisor, Community, Counterfeit Detection, Price Comparison, Trend Discovery). The conversation is one of six features, not the entire product. Putting Yuri in the hero would hide everything else. Compare with LGAAS subscriber pages (e.g., myweekendceo.com) where the AI conversation IS the entire product -- hero placement is correct there.

**Rule of Thumb**: If the AI conversation IS the product -> widget in hero (50% of page). If the AI conversation is one of many features -> mid-page section + floating bubble.

#### Three-Layer Approach

**Layer 1: Floating Yuri Bubble (Always Present)**
```
- Bottom-right corner, all pages, always visible
- Collapsed state: Yuri avatar + "Ask me anything about K-beauty"
- Expands to chat window on click
- 3-5 free messages per session (cookie-tracked)
- Full-screen takeover on mobile
- Follows visitor as they browse -- available whenever curiosity strikes
- SSE streaming for real-time responses
```

**Layer 2: "Try Yuri" Interactive Section (Mid-Page)**
```
Landing Page Flow:
  Hero: Glass skin visual + value prop + "Start Free" CTA
  -> Feature Grid (6 features with glass-card design)
  -> "Try Yuri" Section (HERE -- after visitor understands what Seoul Sister is)
  -> Social Proof (community stats, testimonials)
  -> Pricing (Free / Pro Monthly / Pro Annual / Student)
  -> Final CTA
```

The "Try Yuri" section appears AFTER the feature grid, when the visitor already understands what Seoul Sister offers. This section includes:
- Pre-populated demo conversation showing Yuri's personality (visitor question + Yuri response)
- Live input field: "Ask Yuri anything about K-beauty..." (types directly into the section)
- Same 3-5 free message limit as floating bubble (shared session)
- After free messages: soft conversion prompt to sign up
- NOT a duplicate of the floating bubble -- this is an embedded inline experience
- On mobile: tapping the input area opens full-screen Yuri conversation

**Layer 3: Full Yuri Experience (Post-Signup)**
```
After account creation:
  -> Yuri onboarding conversation (skin profile, preferences, concerns)
  -> /yuri page with full specialist routing
  -> 6 specialist agents (no message limits)
  -> Cross-session memory and personalization
  -> Deep-dive conversations with product recommendations
```

#### Visitor Journey Example
```
1. Visitor lands on seoulsister.com
2. Scrolls through hero, sees feature grid
3. Reaches "Try Yuri" section:
   -> Sees demo: "Is the COSRX snail mucin I bought on Amazon real?"
   -> Yuri's demo response shows counterfeit detection knowledge
   -> Visitor types their own question in the live input
   -> Yuri gives a genuinely helpful answer
4. OR visitor clicks floating bubble at any point
5. After 3-5 free messages (either Layer 1 or 2):
   -> Yuri: "I could help you so much more with a skin profile.
      Create your free account and I'll build you a personalized
      K-beauty routine."
   -> Soft conversion prompt (not a hard paywall)
6. Visitor signs up -> enters Yuri onboarding conversation (Layer 3)
```

#### Widget Specifications
- **Free messages**: 3-5 per session (cookie-tracked, shared between Layer 1 and Layer 2)
- **No login required**: Anonymous conversations stored with session ID
- **Genuine value**: Yuri gives real, helpful answers -- not teaser responses
- **Soft conversion**: After free messages, Yuri naturally suggests signup for full experience
- **Surface-level routing**: Anonymous questions get helpful answers but not deep specialist dives
- **Data capture**: Anonymous conversation data feeds the learning engine
- **Mobile-optimized**: Full-screen takeover on mobile for both layers
- **SSE streaming**: Real-time streamed responses (not waiting for full response)

#### Conversion Tracking
- Track which questions visitors ask most (informs marketing and feature priority)
- Track conversion rate: Layer 1 (bubble) vs Layer 2 (inline) vs organic signup
- Track which Yuri responses have highest conversion (learning engine)
- A/B test Yuri's conversion prompts over time
- Track Layer 1 vs Layer 2 engagement (which gets more conversations started)

#### Rate Limiting (Cost Control)
- 3-5 messages per session (cookie-based, shared across layers)
- 10 messages per IP per day (prevents abuse)
- Shorter max_tokens for anonymous visitors (300 vs 600 for subscribers)
- Anonymous conversations not saved to database (just streamed and forgotten)
- No specialist agent deep-dives for anonymous users (surface-level answers only)

#### What This Is NOT
- NOT the LGAAS AriaStar widget (which is white-labeled for subscriber businesses)
- NOT a lead generation tool for other businesses
- This is Seoul Sister's OWN conversion tool on its OWN landing page
- Seoul Sister may subscribe to LGAAS for marketing (Reddit, blog, social, email), but the landing page widget is Yuri, not AriaStar

#### Relationship to LGAAS When Seoul Sister Is a Subscriber
When Seoul Sister subscribes to LGAAS for marketing automation:
- **LGAAS provides**: Reddit K-beauty discovery, blog generation, social content, email sequences, competitive intelligence, learning engine for marketing
- **Seoul Sister keeps**: Its own landing page with Yuri widget (NOT replaced by AriaStar)
- **AriaStar's role**: Business advisor to Seoul Sister's team (marketing strategy, content performance) -- not visitor-facing
- **Clean separation**: AriaStar drives traffic TO seoulsister.com. Yuri handles conversion ON seoulsister.com.

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

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| AI Model (Primary) | Claude Opus 4.6 | All user-facing: Yuri, scanning, analysis -- NO FALLBACKS |
| AI Model (Background) | Claude Sonnet 4.5 | Data extraction, learning aggregation, translations |
| AI Model (Vision) | Claude Opus 4.6 | Label scanning, counterfeit detection, skin analysis |
| Framework | Next.js 15 (App Router) | PWA-configured, TypeScript strict |
| Database | Supabase PostgreSQL | RLS, real-time subscriptions |
| Styling | Tailwind CSS 4 | Korean-inspired design system |
| Auth | Supabase Auth | Email + social login |
| Payments | Stripe | Subscriptions only (no product commerce) |
| Hosting | Vercel | Edge functions, automatic SSL |
| Distribution | PWA | No App Store dependency, Stripe at 2.9% vs Apple 30% |

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
ss_widget_conversations     - Anonymous pre-signup landing page widget conversations
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
│   │   ├── scan/                       # Camera scanning components
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
- Conflict warnings against user's current routine
- "People like you" effectiveness data from learning engine
- **Free tier**: 3 scans/month. **Pro tier**: Unlimited.

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

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `scan-korean-products` | Daily 6 AM UTC | Monitor Olive Young, Coupang for new products |
| `translate-and-index` | Daily 7 AM UTC | Claude translates ingredient lists, generates descriptions |
| `track-prices` | Every 6 hours | Compare Korea vs US prices across 10+ retailers |
| `scan-counterfeits` | Daily 3 AM UTC | Monitor counterfeit sources, update risk signals |
| `detect-trends` | Daily 8 AM UTC | Scan TikTok/Reddit/Instagram for trending K-beauty |
| `community-digest` | Daily 9 AM UTC | Aggregate top reviews, generate "trending today" |
| `aggregate-learning` | Daily 5 AM UTC | Aggregate scan/review/routine data into patterns |
| `ingredient-safety-updates` | Weekly Sunday 2 AM UTC | Cross-reference regulatory changes (Korea/US/EU FDA) |
| `seasonal-routine-updates` | Monthly 1st 3 AM UTC | Update routine recommendations by climate/season |
| `generate-content` | Daily 10 AM UTC | Auto-generate trend articles for AI discoverability |

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

### Subscription Tiers

| Tier | Price | Purpose |
|------|-------|---------|
| **Free** | $0 | User acquisition, database growth via scans |
| **Pro Monthly** | $14.99/mo | Full AI intelligence suite |
| **Pro Annual** | $99.99/yr ($8.33/mo) | Price-sensitive users, cash flow |
| **Student** | $6.99/mo (with .edu email) | College demographic, long-term retention |

### Free Tier (Generous -- Builds User Base)
- Browse product database
- 3 label scans per month (cached results, minimal AI cost)
- Basic ingredient lists (pre-translated, no live AI)
- Community access (read reviews)
- Trending products feed

### Pro Tier (Full AI Intelligence)
- Unlimited AI label scanning
- Full Yuri advisor conversations (all specialist agents)
- Personalized routine builder with conflict detection
- Counterfeit detection alerts
- Price drop alerts on wishlist
- Proactive intelligence notifications
- Skin cycling schedule generation
- Priority scan processing

### Unit Economics (Pro Monthly at $14.99)
| Item | Cost |
|------|------|
| Claude Opus 4.6 API (scans, Yuri, analysis) | ~$4.00/mo avg |
| Claude Vision (scanning, counterfeit) | ~$1.50/mo avg |
| Supabase (storage, queries, auth) | ~$0.50/mo |
| Vercel (hosting, functions) | ~$0.25/mo |
| Stripe processing (2.9% + $0.30) | ~$0.73/mo |
| **Total variable cost** | **~$6.98/mo** |
| **Margin per Pro user** | **~$8.01/mo (53%)** |

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

- **Claude Opus 4.6** (`claude-opus-4-6`): ALL user-facing interactions -- NO FALLBACKS
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

- JSON-LD @graph on all product pages (Product, Review, AggregateRating)
- Article schema on all trend content
- SpeakableSpecification for voice assistant citation
- Dynamic robots.txt allowing GPTBot, Claude-Web, PerplexityBot
- Dynamic sitemap.xml for all product and content pages
- llms.txt with product database summary
- Blog pipeline auto-generates K-beauty trend content from data

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
- [x] Korean Label Scanner API (Claude Opus 4.6 Vision, base64 image analysis)
- [x] Price comparison API across 6 retailers with best deal, savings %
- [x] 130 product-ingredient links, 35 retailer price records
- [x] ProductCard, ProductFilters, IngredientList, PriceComparison components
- [x] Full product browse, product detail (tabbed), and scan pages

### Phase 3: Yuri AI Advisor (COMPLETE)
- [x] Yuri conversation system (SSE streaming via Claude Opus 4.6)
- [x] 6 specialist agents with deep domain prompts (200-400 words each)
- [x] Keyword-based specialist routing
- [x] Cross-session memory (skin profile, past conversations, product reactions)
- [x] Action execution (add to routine, wishlist, log reactions, search, check conflicts)
- [x] Auto-generated conversation titles (Sonnet 4.5)
- [x] Full chat UI with specialist picker, conversation history sidebar

### Phase 3B: Yuri Conversational Onboarding (NEW)
- Replace form wizard with Yuri onboarding conversation
- Onboarding-specific system prompt guiding Yuri to collect all profile fields
- Sonnet 4.5 background extraction of structured skin profile data
- `onboarding_progress` tracking (which fields captured vs still needed)
- Natural conversation flow -- Yuri knows when she has enough data
- Profile creation from extracted data upon onboarding completion
- Redirect to full app experience after onboarding

### Phase 4: Community & Discovery (COMPLETE)
- [x] Review system with skin-type, Fitzpatrick scale, age range filtering
- [x] "Holy Grail" / "Broke Me Out" reaction badges
- [x] Upvote/downvote with community points
- [x] Trending products feed (TikTok/Reddit/Instagram/Korean market sources)
- [x] TikTok Moment Capture ("Just saw this on TikTok" instant product match)
- [x] Points system: 4-tier leveling (Newcomer -> Skin Scholar -> Glow Getter -> K-Beauty Expert)
- [x] 6 new components, 3 pages built/replaced, migration with seed data

### Phase 5: Counterfeit Detection & Safety
- Counterfeit detection via Claude Vision
- Packaging comparison database
- Retailer trust scoring
- User-submitted counterfeit reports
- Safety alert system

### Phase 6: Learning Engine & Automation
- Cross-user learning patterns
- Ingredient effectiveness by skin type
- All cron jobs (product scanning, translation, prices, trends)
- Seasonal routine adjustments
- Trend content auto-generation

### Phase 7: Monetization, Widget & Polish
- Stripe subscription (Free/Pro/Student tiers)
- Affiliate link system
- **Yuri Three-Layer Widget System**:
  - Layer 1: Floating Yuri bubble (bottom-right, all pages, always present)
  - Layer 2: "Try Yuri" inline section (mid-page on landing page, after feature grid)
  - Layer 3: Full Yuri post-signup (already built in Phase 3)
  - Shared session: 3-5 free messages across Layer 1 + Layer 2 (cookie-tracked)
  - Pre-populated demo conversation in Layer 2
  - Soft conversion prompt after free messages
  - Layer 1 vs Layer 2 conversion tracking
- Landing page build (hero + feature grid + Try Yuri + social proof + pricing + CTA)
- Push notifications
- PWA install prompts
- Performance optimization
- AI discoverability (JSON-LD, llms.txt, sitemap)

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
**Version**: 3.2.0 (Three-Layer Yuri Widget Architecture)
**Status**: Phases 1-5 Complete, Phase 3B Next
**AI Advisor**: Yuri (유리) - "Glass"

**Changelog**:
- v3.2.0 (Feb 17, 2026): Three-Layer Yuri Widget Architecture. Replaced generic widget spec with three-layer approach: Layer 1 (floating bubble, all pages), Layer 2 ("Try Yuri" inline section mid-page on landing page), Layer 3 (full post-signup experience). Documented landing page flow (hero -> features -> Try Yuri -> social proof -> pricing -> CTA). Added widget-as-hero rule of thumb for LGAAS comparison. Updated Phase 7 with detailed widget implementation steps. Marked Phase 5 complete.
- v3.1.0 (Feb 17, 2026): Added Yuri Conversational Onboarding (replaces form wizard) and Yuri Landing Page Widget (pre-signup AI demo). Updated LGAAS relationship with clear responsibility separation. Updated all completed phases with implementation details.
- v3.0.0 (Feb 17, 2026): Complete rebuild as "Hwahae for the World." 7 development phases, 30 database tables, 6 specialist agents, glass skin design system.
