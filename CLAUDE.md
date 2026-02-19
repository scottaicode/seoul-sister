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

### Remaining Work (Post-Migration)
- [x] Yuri Three-Layer Widget System (Layer 1 floating bubble, Layer 2 inline, Layer 3 post-signup)
- [x] Landing page build (hero + feature grid + Try Yuri + social proof + pricing + CTA)
- [x] Dark + gold design theme (Seoul-inspired aesthetic)
- [x] Mobile hamburger menu + widget overlap fixes
- [x] Yuri persona rewrite (20-year Korean industry veteran voice across all touchpoints)
- [ ] **Widget Email Capture** (FUTURE CONSIDERATION)
  - Currently: Widget is stateless. Cookie tracks message count (5 free, 24hr expiry). At limit,
    shows "Create Free Account" CTA. No email capture, no conversation storage.
  - Lightweight first step (when traffic justifies it): Add an email input field at the message
    limit alongside the signup CTA. Lower friction than full account creation. Store in a simple
    `ss_widget_emails` table. No full session tracking or memory needed at this stage.
  - Full lead gen & conversation memory (only if data shows returning visitors bouncing without
    converting): Session storage, AI memory, returning visitor recognition. See LGAAS patterns
    (`utils/widget-helpers.js`, `api/widget-conversation.js`) for architecture reference.
  - Note: Making the anonymous widget too personalized (memory, recognition) can reduce signup
    motivation. The 5-message limit + signup CTA is the correct conversion architecture for now.
- [x] Stripe webhook integration (6 event types, idempotency, subscription lifecycle)
- [x] Premium single-tier pricing ($39.99/mo Seoul Sister Pro, usage caps: 500 msgs, 30 scans)
- [x] PWA install prompts (service worker, beforeinstallprompt handler, offline caching)
- [x] AI discoverability (robots.ts with AI bot allowances, dynamic sitemap.ts, llms.txt, JSON-LD on products + org)
- [x] Performance optimization (code splitting via next/dynamic, bundle analyzer, cache headers)
- [x] Cron job scheduling (vercel.json with 5 cron jobs: scan-trends, refresh-prices, aggregate-learning, update-effectiveness, seasonal-adjustments)
- [x] Scan enrichment pipeline (personalized skin match, price comparison, community intelligence, authenticity check, trend context)
- [x] Mobile scan reliability (client-side image compression, 60s timeouts, Safari "Load failed" fix)
- [x] ScanResults component extraction (LabelScanner refactored from 480 to 252 lines)
- [ ] Push notifications (FUTURE -- requires service worker push events, web-push library, subscription management)
- [ ] Remaining cron jobs (FUTURE -- scan-korean-products, translate-and-index, scan-counterfeits, community-digest, generate-content -- require external data source integrations)

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
- Calls Claude Opus 4.6 with the Routine Architect system prompt
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
6. Optionally: Call Claude Opus 4.6 for nuanced comparison (texture, feel, notable differences)
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

Uses Claude Opus 4.6 Vision with specialized prompt:
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

Uses Claude Opus 4.6 Vision with specialized prompt:
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
**Version**: 3.6.0 (Phase 8 Feature Plans Documented)
**Status**: Phases 1-7 + 3B Complete, Production Live, Phase 8 (11 Features) Planned
**AI Advisor**: Yuri (유리) - "Glass"

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
