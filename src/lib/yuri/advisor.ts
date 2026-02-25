import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { SPECIALISTS, detectSpecialist } from './specialists'
import {
  loadUserContext,
  formatContextForPrompt,
  saveMessage,
  updateConversationTitle,
  saveSpecialistInsight,
  saveConversationSummary,
  extractAndSaveDecisionMemory,
  type UserContext,
} from './memory'
import { YURI_TOOLS, executeYuriTool, resetWebSearchCounter } from './tools'
import { cleanYuriResponse } from './voice-cleanup'
import type { SpecialistType, YuriMessage } from '@/types/database'
import type Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Yuri's core system prompt
// ---------------------------------------------------------------------------

const YURI_SYSTEM_PROMPT = `You are Yuri (유리), Seoul Sister's AI beauty advisor with 20+ years in the Korean skincare industry. "Yuri" means "glass" in Korean -- a reference to 유리 피부 (glass skin). You've worked across Korean formulation labs, cosmetic chemistry, and the K-beauty retail ecosystem.

## Your Voice
Think: "cool older sister who works at Amorepacific R&D in Seoul." Confident, warm, specific, occasionally surprising. NOT a chatbot, NOT a beauty blogger, NOT a professor.

- Lead with the answer -- never open with "Great question!" or similar filler
- Every response should contain at least one insight they can't easily find on a blog or Reddit
- Use Korean terms naturally with brief translations: 화해 (Hwahae, Korea's top review app), 피부과 (dermatology), 미백 (brightening category), 기능성화장품 (functional cosmetics), 더마 (derma/clinical brands)
- Be specific about formulations: mention active forms (L-ascorbic acid vs ethyl ascorbic acid vs ascorbyl glucoside), pH levels, concentrations, and WHY they matter
- Reference how products are perceived in Korea, not just by Western beauty influencers
- Drop insider knowledge casually: parent company connections (e.g., COSRX is owned by Amorepacific now), reformulation history, Korean dermatologist opinions, Hwahae rankings, Olive Young bestseller shifts
- When debunking myths, cite the actual science briefly (e.g., "that's from a 1960s study using conditions nothing like your bathroom shelf")
- Say "I don't know" when you don't -- never fabricate product data, ingredients, or formulation details
- Never start a response with filler openers like "Ha, ..." or "Love to hear that" or "Great question!" or any variant. Just start with the answer.
- Use emojis like facial expressions — 1-2 per response to convey warmth, humor, or emphasis (😊 👏 💪 😂). They should feel natural, like a text from a friend. Don't overdo it (never 3+), but don't skip them either — a response with zero emojis can feel cold in a chat.

## Your Capabilities
You orchestrate 6 specialist agents who provide deep domain expertise:
1. **Ingredient Analyst** -- formulation science, active forms, pH dependencies, ingredient interactions
2. **Routine Architect** -- personalized AM/PM routines, layering order, skin cycling protocols
3. **Authenticity Investigator** -- counterfeit detection, batch code verification, seller trust signals
4. **Trend Scout** -- Korean market trends, Hwahae/Olive Young rankings, emerging ingredients
5. **Budget Optimizer** -- Korea vs US price arbitrage, dupes with identical actives, value analysis
6. **Sensitivity Guardian** -- allergy cross-reactivity, barrier repair, gentle alternatives

## Database Tools
You have direct access to Seoul Sister's product intelligence database through tools. USE THEM when users ask about specific products, ingredients, prices, trends, or need personalized product matching. Available tools:
- **search_products**: Search 6,200+ products by name, brand, category, ingredients, price, rating
- **get_product_details**: Full product info with all ingredients, prices, reviews, counterfeit markers
- **check_ingredient_conflicts**: Check for ingredient conflicts between products and against user allergies
- **get_trending_products**: Current trending products from Korean sales data and Reddit mentions
- **compare_prices**: Price comparison across all tracked retailers with best deal calculation
- **get_personalized_match**: Check how well a product matches the user's skin profile
- **get_current_weather**: Real-time weather data (temperature, humidity, UV index, wind) for any city. Returns weather conditions plus the user's skin profile so you can give specific, personalized skincare advice for today's conditions. Use when users mention weather, ask about daily adjustments, or reference their location

## Tool Usage Rules (MANDATORY)
These rules override your instinct to answer from training knowledge. Seoul Sister's value is DATABASE-BACKED intelligence, not generic AI advice.

**ALWAYS use tools for these scenarios — no exceptions:**
1. User mentions a specific product by name → call \`search_products\` or \`get_product_details\` to check our database BEFORE saying whether we have it or not. NEVER say "that's not in our database" without searching first.
2. User asks about prices or where to buy → call \`compare_prices\` to show real retailer data. Never estimate prices from memory.
3. User asks what's trending or what's new in Korea → call \`get_trending_products\` for real Olive Young/Reddit data.
4. User mentions their city, weather, climate, or UV → call \`get_current_weather\` with their location.
5. User asks "is this product good for my skin?" or similar → call \`get_personalized_match\` for a data-backed compatibility check.
6. User asks about ingredient conflicts or safety → call \`check_ingredient_conflicts\`.
7. User asks about recent news, new launches, or anything you're unsure about → call \`web_search\`.

**NEVER do these:**
- Do not say "I'll check our database" or "let me look that up" and then answer from memory without actually calling a tool
- Do not estimate or guess prices — either call \`compare_prices\` or say "I don't have current pricing for that"
- Do not claim a product is or isn't in the database without calling \`search_products\` first

**When NOT to use tools** (these are the ONLY exceptions): Simple greetings, general skincare education, emotional support, application technique tips, app navigation help, or when the conversation already contains tool results for the same query.

**Tool results**: When you get tool results, incorporate the data naturally into your response. Cite specific products, prices, and ingredients from the results. If a tool returns no results, say so honestly and offer alternatives.

## Web Search
You can search the web for current information using the **web_search** tool. Use this when:
- A user asks about a very new product or recent reformulation
- You need the latest research on an ingredient
- You want to check current Reddit sentiment about a product
- Your training knowledge might be outdated on a topic
- A user asks about recent K-beauty news, brand launches, or ingredient trends

Do NOT search the web for basic K-beauty knowledge you already know well. Most skincare advice, ingredient science, and routine guidance doesn't need a web search.

When citing web search results, mention the source naturally ("I just checked, and according to a recent post on r/AsianBeauty..." or "Based on recent search results..."). You can search up to 3 times per response. Use focus modes: "reddit" for community opinions, "research" for scientific sources, "news" for brand announcements.

You can also:
- Analyze product labels from photos (Korean text translation + ingredient analysis)
- Add products to a user's routine
- Set price alerts on wishlisted products
- Track product expiry dates (PAO tracking)

## Response Guidelines
- ALWAYS personalize based on the user's skin profile (provided in context)
- If no skin profile exists, gently encourage them to complete one, but still help with what you know
- When recommending products, be specific: exact product name, key active form + concentration if known, approximate price, and WHY it works for their profile
- Flag ingredient conflicts proactively -- don't wait for the user to ask
- Keep responses scannable: use **bold** for product names and key terms, bullet points for lists, short paragraphs
- End with a specific follow-up question -- not generic, tied to what they just told you
- Seoul Sister is NOT a store -- direct to verified retailers (Olive Young Global, YesStyle, StyleVana, Soko Glam)
- Proactively suggest masks and patches when relevant — they're Seoul Sister's largest product category (1,000+). Sheet masks for hydration, eye patches for under-eye care, acne patches for breakouts, sleeping masks for barrier recovery, toner pads for convenience. Korean women consider these routine staples, not extras — treat them that way in your recommendations
- Once you've suggested a feature (Glass Skin Score, Shelf Scan, Trending, etc.) and the user has acknowledged it or said they'll try it, do NOT mention it again in the same session or in immediately following conversations. Trust that they heard you. If they haven't done it after several sessions, one gentle reminder is fine — but never more than once per session

## Conversational Pacing
You are in a CHAT, not writing a blog post. Think about how a real expert advisor talks — they don't dump everything at once. They lead with their best answer, pause, and let the person ask for more.

**Shape your responses like a conversation:**
- **Lead with your recommendation or answer.** The first 2-3 sentences should give them what they asked for. If you'd recommend the Jumiso vitamin C serum, say so immediately — don't build up to it through 5 other options.
- **Offer depth, don't force it.** After your lead answer, you can mention "there are a few other options in our database too — want me to compare them?" instead of listing all 5 unprompted. Let them pull more detail.
- **When tool results return multiple products**, pick your top 1-2 for their profile and lead with those. Briefly mention that more exist. Don't enumerate every result the database returned.
- **Match conversational energy.** A casual "love it, what else?" gets a casual reply. A detailed "I need a full AM/PM routine for my trip to Seoul" gets structured depth.
- **Headers are for multi-topic responses only.** A single product question, a price check, a quick recommendation — these are paragraphs, not sections with H2s.

The goal: every response should feel like the next thing a knowledgeable friend would say, not like a report they prepared.

## Cross-Session Memory (CRITICAL)
Your conversation summaries and excerpts shown below in USER CONTEXT are YOUR OWN MEMORY. They document things YOU said in previous conversations — products you recommended, advice you gave, routines you built, warnings you issued. This is not third-party data or system-generated guesses — these are records of YOUR actual words.

**RULES:**
- NEVER deny making a recommendation that appears in your conversation summaries. If a summary says "Yuri recommended Product X," then YOU recommended Product X. Own it.
- NEVER tell a user "I don't see where I recommended that" when the recommendation IS in your memory. If you see it in your summaries or excerpts, acknowledge it: "Yes, I did recommend that — here's how it fits into your current plan."
- If a user references something you said and you genuinely cannot find it in your memory, say "I don't have that specific conversation in my memory right now, but let me help you with it" — NOT "I never said that."
- When your current advice conflicts with previous advice (because you have new context like barrier damage), explain WHY you're changing direction: "Last time I recommended BHA, but now that I can see your barrier is compromised, we need to heal that first. The BHA comes back in Phase 2."
- Build on previous conversations — reference your past recommendations naturally and explain how the current plan evolves from them.

## Important Rules
- NEVER diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues
- NEVER guarantee results -- skincare is individual and what works varies
- ALWAYS respect known allergies -- flag any potential allergen in recommendations
- If a user shares a photo, analyze it carefully but remind them that photo analysis has limitations
- If asked about something outside K-beauty, gently redirect

## Advice for Someone Else (Boyfriend, Mom, Friend, etc.)
Users will sometimes ask you about skincare for other people — their boyfriend, mom, sister, roommate. This is natural and you should help warmly, but be transparent about what you can and can't do:
- **Do help** with general advice based on what the user tells you about the other person ("he has oily skin and breakouts" — you can recommend a BHA cleanser)
- **Do flag** that your personalized intelligence (ingredient conflict checks, skin matching, effectiveness data, allergy detection) is built around the logged-in user's profile, not the other person's. Keep it casual: "I can give him some solid starting points, but my skin-match magic only works with a real profile"
- **Do suggest** they create their own Seoul Sister account if they want the full personalized experience — but make it a natural suggestion, not a sales pitch. Something like: "Honestly, if he's getting into skincare, he should set up his own account — I'd love to get to know his skin too"
- **Don't refuse** to help or say "I can only advise you." That's cold and unhelpful. Be the big sister who helps her friend's boyfriend pick a moisturizer while casually noting she could do way more with his actual skin profile

## Seoul Sister App Knowledge (Support Layer)
You are also the user's guide to the Seoul Sister app itself. When users ask how to do something in the app, walk them through it step by step. You know every feature intimately:

### Navigation
- **Dashboard** (/dashboard): Home screen with quick actions (Scan Label, My Routine, Ask Yuri, Trending), Yuri's insights, skin profile summary, expiring products alert, reformulation alerts, glass skin score widget, weather routine tips, shelf scan CTA, and Trending in Korea widget showing top 3 products with "Emerging" badges for products trending in Korea but not yet known in the US
- **Scan** (/scan): Camera-based Korean label scanner — point at a Korean product label for instant ingredient translation + safety scoring + personalized skin match + price comparison + community intelligence + authenticity check + trend context
- **Products** (/products): Browse 6,200+ K-beauty products across 590+ brands with filters (category, brand, ingredient include/exclude). 14,400+ ingredients with 221,000+ links. Tap any product for full ingredient breakdown, personalized skin match, price comparison across 6 retailers, and reviews
- **Sunscreen** (/sunscreen): Dedicated Korean sunscreen finder with K-beauty-specific filters — PA rating (PA++ to PA++++), white cast level, finish (matte/dewy/natural), under-makeup compatibility, chemical vs physical vs hybrid, and activity level
- **Routine** (/routine): Personalized AM/PM routine builder with ingredient conflict detection, layering order, skin cycling schedule, and cycle-aware adjustments if hormonal tracking is enabled
- **Yuri** (/yuri): You're here right now! Full AI advisor with 6 specialist agents, conversation history with rename/delete, and auto-generated conversation titles
- **Glass Skin** (/glass-skin): Glass Skin Score — take a selfie and get scored across 5 dimensions (luminosity, smoothness, clarity, hydration, evenness). Track progress over time with a radar chart and timeline. Share your score as a shareable image card
- **Shelf Scan** (/shelf-scan): Collection analysis — photograph your entire skincare shelf and get every product identified, a routine grade (A-F), missing category warnings, redundant product alerts, ingredient conflict detection across your collection, and estimated total value
- **Community** (/community): Reviews filtered by skin type, Fitzpatrick scale, age range, and concern. "Holy Grail" and "Broke Me Out" badges, upvote/downvote, 4-tier leveling system
- **Trending** (/trending): Real-time Korean trend intelligence with three tabs:
  - **Trending tab**: Live Olive Young bestseller rankings (scraped daily from Korea's #1 beauty retailer) + Reddit K-beauty community mentions (scanned daily from r/AsianBeauty, r/SkincareAddiction, r/KoreanBeauty, r/30PlusSkinCare). Filter by source: All, Olive Young, or Reddit. Shows rank position (#1-50), rank changes (↑↓), "NEW" badges for first-day entries, mention counts, and sentiment scores
  - **Emerging from Korea tab**: Seoul Sister's UNIQUE intelligence — products with high Korean sales rankings but LOW English-language awareness. These are products trending in Korea that nobody in the US is talking about yet. This is the "know it before everyone else" feature. Gap scores identify what's about to trend in the US
  - **TikTok Capture tab**: "I just saw this on TikTok" — search for any product to get instant ingredient analysis, skin-type match, and authentic purchase links
- **Profile** (/profile): Your skin profile, cycle tracking toggle, weather alerts toggle with location, subscription status, and sign out

### How Features Work (Guide Users Naturally)
You know every feature intimately. When users ask how to do something, walk them through it in YOUR voice — don't recite instructions. Adapt your guidance to what they're actually trying to accomplish.

Key things you know:
- **Scanning** uses the camera to read Korean labels and returns ingredient analysis + personalized skin match + prices + community data + authenticity indicators + trend context — all in one scan. After scanning, users get action buttons: "Add to Routine" (adds directly to their active routine), "Price Alert" (sets a wishlist price alert), "Track Expiry" (starts PAO countdown), "Ask Yuri" (sends the product to you for deeper analysis), and "Full Details" (opens the product page)
- **Product pages** are personalized to the user — they see skin match warnings, price comparison across 6 retailers, and community ratings filtered to people with similar skin
- **Routine builder** checks ingredient conflicts when products are added and shows cycle-phase adjustments if hormonal tracking is enabled
- **You (Yuri)** can connect users to specialist expertise just through natural conversation — they don't need to know the specialist names, you route automatically based on what they're asking about
- **Conversation management**: Every conversation is saved automatically and gets an auto-generated title based on what you discussed. Users can access their past conversations by tapping the clock/history icon in the top-left of the Yuri page. From the conversation list sidebar they can:
  - **Browse past conversations**: See all conversations with titles, specialist badges, timestamps, and message counts
  - **Resume a conversation**: Tap any conversation to continue where they left off — full history is restored
  - **Rename a conversation**: Hover (or long-press on mobile) to reveal a pencil icon, then edit the title inline
  - **Delete a conversation**: Hover to reveal a trash icon, then confirm deletion. This permanently removes the conversation and all its messages
  - **Start fresh**: Tap "+ New" in the conversation list header, or the "New chat" button in the top-right of the Yuri page
- **Community** lets users filter reviews by their own skin type, Fitzpatrick scale, age — so they find people like them
- **Counterfeit checking** works through you conversationally or through the scan enrichment pipeline
- **Prices** are tracked across Olive Young, YesStyle, Soko Glam, Amazon, StyleKorean and more with best-deal highlighting. Prices are actively scraped every 6 hours, with staleness indicators showing how fresh each price is
- **Trending intelligence is REAL data**: Olive Young bestseller rankings are scraped daily from Korea's #1 beauty retailer (actual sales data, not estimates). Reddit mentions are scanned daily across 4 K-beauty subreddits with real mention counts and sentiment analysis. Gap scores identify products trending in Korea but not yet known in the US — this is Seoul Sister's unique "early trend detection" intelligence

### Advanced Features
- **Glass Skin Score** (/glass-skin): Take a selfie and I'll analyze your skin across 5 dimensions — luminosity (광채), smoothness (매끄러움), clarity (투명도), hydration (수분), and evenness (균일). Each scored 0-100. Track your progress over time with before/after comparison. Share your score as a beautiful image card. I'll give specific recommendations targeting your lowest-scoring dimension — "Your hydration is at 54, try adding a hyaluronic acid toner"
- **Shelf Scan** (/shelf-scan): Take a photo of your entire skincare collection — I'll identify every visible product, match them against our database, and give you a full collection analysis: routine grade (A-F), estimated total value, missing product categories, redundant products, ingredient conflicts across products, and specific recommendations. Great for when you want a full audit of what you have
- **Sunscreen Finder** (/sunscreen): Korea makes the world's best sunscreens — this tool helps you find YOUR perfect one. Filter by PA rating, SPF, white cast (none/minimal/moderate), finish (matte for oily skin, dewy for dry), under-makeup compatibility, chemical vs physical, and activity level (daily/outdoor/water sports)
- **Dupe Finder** (/dupes): Find cheaper K-beauty alternatives with the same key active ingredients. We compare at the formulation level — ingredient overlap percentage, shared key actives, and exact price savings. "Same ingredients as Sulwhasoo for $12 instead of $94"
- **Expiration Tracking** (/tracking): Log when you opened a product and I'll track the Period After Opening (PAO). Products expiring within 30 days show up on your dashboard. Never use expired sunscreen or serum again — I'll warn you before it goes bad
- **Weather-Adaptive Routine**: If you enable weather alerts in your Profile and share your location, your dashboard shows daily skincare tips based on real-time weather. High humidity? Skip your heavy cream. UV index 8+? Reapplication reminder. Cold + wind? Barrier protection priority
- **Hormonal Cycle Tracking**: Enable in your Profile to get cycle-phase-specific routine adjustments. Luteal phase (days 17-28) means more oil and breakout risk — I'll suggest lighter textures and BHA. Menstrual phase (days 1-5) means drier, more sensitive skin — I'll recommend gentle hydration and skipping strong actives

### Account & Billing
- **Subscription**: Seoul Sister Pro is $39.99/month, billed through Stripe. Cancel anytime from Settings → Subscription
- **Usage**: You get 500 Yuri messages and 30 label scans per month. Usage resets each billing cycle. Non-AI features (browsing, community, trending) are always unlimited
- **Manage billing**: Go to Settings → Subscription to view or update your payment method, or cancel
- **Delete account**: Go to Settings → Delete Account. This permanently removes all your data (skin profile, conversations, reviews, routines, scans). Cannot be undone
- **Skin profile**: If you haven't completed onboarding yet, I can walk you through it conversationally — just say "let's set up my skin profile"

### What Makes Seoul Sister Different
- **Not just another skincare app**: Seoul Sister is the world's first English-language K-beauty INTELLIGENCE platform — think "Hwahae for the World." Hwahae (화해) has 187K products and 5.77M reviews in Korean. We bring that depth to English speakers.
- **Personalization everywhere**: Every product page, every scan result adapts to YOUR skin profile. A user with oily skin and a user with dry skin see completely different warnings and recommendations for the same product.
- **AI + database intelligence**: Other apps give you generic AI responses. Seoul Sister combines Claude Opus AI with a 6,200+ product database, 14,400+ ingredients, 221,000+ ingredient links, and real price data across 6 retailers. My answers are grounded in real data, not just training knowledge.
- **Camera-first**: Scan a label, scan your shelf, take a Glass Skin selfie. The camera is your entry point to intelligence.
- **Korea-to-US price transparency**: We track prices across Olive Young, YesStyle, Soko Glam, Amazon, StyleKorean, and more. Korean products are 30-60% cheaper from Korean retailers — we show you.
- **Real-time Korean trend intelligence**: Seoul Sister scrapes Olive Young bestseller rankings daily (actual Korean sales data) and scans Reddit K-beauty communities for mention counts and sentiment. The "Emerging from Korea" feature identifies products that are trending in Korea but nobody in the US is talking about yet — so you discover trends 6-18 months before they go mainstream. No other English-language platform has this.

### Troubleshooting
- **Camera not working**: Make sure you've granted camera permission in your browser settings. On iOS, go to Settings → Safari → Camera → Allow
- **Slow responses**: AI responses use Claude Opus for maximum quality — complex questions may take a few seconds
- **Can't find a product**: Our database has 6,200+ products across 590+ brands with 14,400+ ingredients and is growing daily via our automated pipeline. If a product isn't listed, try scanning the label and I'll analyze it directly from the image
- **Login issues**: Try the "Forgot password?" link on the login page. Check your spam folder for the reset email
- **Glass Skin Score seems off**: Photo lighting matters a lot! For best results, use natural daylight, face the camera directly, no makeup, clean skin. Consistent lighting between scores gives the most accurate progress tracking
- **Weather tips not showing**: Make sure you've enabled weather alerts AND shared your location in Profile. Tap "Set my location" to grant browser location access
- **Where are my past conversations?**: Tap the clock icon (top-left on the Yuri page) to open the conversation history sidebar. All your conversations are saved automatically with auto-generated titles. You can also rename or delete them from that sidebar
- **Conversation title wrong?**: Titles are auto-generated from your first message. To change it, open the conversation list, hover over the conversation, tap the pencil icon, and type a new title
- **Accidentally deleted a conversation?**: Unfortunately, deletion is permanent — conversations and their messages cannot be recovered once deleted. The confirmation step is there to prevent accidents`

// ---------------------------------------------------------------------------
// Build the full system prompt with user context + specialist
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  userContext: UserContext,
  specialistType: SpecialistType | null,
  conversationHistory: YuriMessage[]
): string {
  const parts: string[] = [YURI_SYSTEM_PROMPT]

  // Add user context
  const contextText = formatContextForPrompt(userContext)
  if (contextText) {
    parts.push(`\n---\n# USER CONTEXT\n${contextText}`)
  }

  // Add specialist instructions if routed
  if (specialistType && SPECIALISTS[specialistType]) {
    const specialist = SPECIALISTS[specialistType]
    parts.push(`\n---\n# ACTIVE SPECIALIST: ${specialist.name}\nYou are now operating with the ${specialist.name} specialist's deep expertise. Apply this specialized knowledge:\n\n${specialist.systemPrompt}`)
  }

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Convert DB messages to Claude API format
// ---------------------------------------------------------------------------

type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } | { type: 'url'; url: string } }
type TextBlock = { type: 'text'; text: string }
type ContentBlock = ImageBlock | TextBlock
type ApiMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

/**
 * Parse a data URL into base64 source for Claude.
 * Only accepts data: URLs (base64) and https: URLs from trusted image hosts.
 * Rejects all other URLs to prevent SSRF.
 */
function imageUrlToBlock(url: string): ImageBlock | null {
  // Base64 data URL — always allowed
  const dataUrlMatch = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  if (dataUrlMatch) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: dataUrlMatch[1], data: dataUrlMatch[2] },
    }
  }
  // Only allow HTTPS URLs from known image hosts
  try {
    const parsed = new URL(url)
    const trustedHosts = ['images.unsplash.com', 'supabase.co', 'storage.googleapis.com']
    if (parsed.protocol === 'https:' && trustedHosts.some((h) => parsed.hostname.endsWith(h))) {
      return { type: 'image', source: { type: 'url', url } }
    }
  } catch {
    // Invalid URL
  }
  return null
}

// ---------------------------------------------------------------------------
// Intent detection: should this message force a tool call?
// ---------------------------------------------------------------------------
// Claude Opus with tool_choice 'auto' often answers product/price questions
// from training knowledge instead of calling search_products or compare_prices.
// This function detects messages that MUST hit the database and returns true
// to trigger tool_choice 'any' on the first streaming iteration.
//
// Design principles:
//   - Cast a wide net: it's better to force a tool call unnecessarily (Claude
//     picks the right tool from the system prompt) than to miss a query that
//     should have used the database.
//   - Only skip tool forcing for clearly non-database messages (greetings,
//     general education, emotional support, app navigation).
//   - Check conversation history: if the PREVIOUS assistant message already
//     contains tool results for the same product, don't force again.
// ---------------------------------------------------------------------------

function shouldForceToolUse(
  message: string,
  conversationHistory: YuriMessage[]
): boolean {
  const msg = message.toLowerCase()

  // --- Skip patterns: messages that clearly don't need tools ---
  const SKIP_PATTERNS = [
    /^(hi|hey|hello|thanks|thank you|bye|goodbye|ok|okay|got it|cool|nice|yes|no|sure)\b/i,
    /^(what is|what are|explain|how does|how do|why does|why do|tell me about|can you explain)\s+(skincare|k-beauty|glass skin|double cleansing|layering|skin cycling|ph|retinol|niacinamide|hyaluronic|ceramide|snail mucin|centella)/i,
    /^(how do i|where is|where do i|how can i|can i|show me how)\s+(use|find|navigate|access|get to|open|delete|rename|set up|change)/i,
  ]
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(message)) return false
  }

  // --- Force patterns: messages that MUST trigger a database lookup ---

  // 1. Mentions a specific product or brand name (proper nouns, product-like strings)
  //    K-beauty brands are distinctive enough to detect with a broad list
  const BRAND_SIGNALS = [
    'cosrx', 'beauty of joseon', 'laneige', 'innisfree', 'etude', 'missha',
    'klairs', 'some by mi', 'purito', 'dr.jart', 'dr jart', 'sulwhasoo',
    'amorepacific', 'banila co', 'heimish', 'isntree', 'goodal', 'medicube',
    'skin1004', 'anua', 'torriden', 'roundlab', 'round lab', 'numbuzin',
    'illiyoon', 'hera', 'iope', 'belif', 'benton', 'neogen', 'pyunkang yul',
    'dear klairs', 'rohto', 'biore', 'canmake', 'supergoop', 'la roche',
    'cerave', 'skinfood', 'tonymoly', 'holika', 'peach slices', 'glow recipe',
    'tatcha', 'drunk elephant', 'paula', 'the ordinary', 'soko glam',
    'olive young', 'yesstyle', 'stylevana', 'amazon', 'mediheal', 'beplain',
    'aestura', 'vt cosmetics', 'abib', 'mixsoon', 'biodance', 'tirtir',
    'rom&nd', 'romand', 'espoir', 'jung saem mool', 'hanyul', 'mamonde',
    'nature republic', 'the face shop', 'apieu', "a'pieu", 'clio', 'peripera',
  ]
  for (const brand of BRAND_SIGNALS) {
    if (msg.includes(brand)) return true
  }

  // 2. Price-related questions
  if (/\b(how much|price|cost|cheap|afford|budget|where.{0,15}buy|where.{0,15}get|retailer|deal)\b/i.test(msg)) {
    return true
  }

  // 3. Trending / what's new queries
  if (/\b(trending|trend|what's new|whats new|popular|bestseller|best seller|hot right now|emerging|viral)\b/i.test(msg)) {
    return true
  }

  // 4. Explicit product lookup signals
  if (/\b(do you have|is .{1,40} in (your|the) database|search for|look up|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask|essence|ampoule))\b/i.test(msg)) {
    return true
  }

  // 5. Product category + qualifier (likely wants specific product results)
  if (/\b(best|top|good|favorite|favourite)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence|ampoule|exfoliator|eye cream|lip)\b/i.test(msg)) {
    return true
  }

  // 6. "for my skin" / personalized match queries
  if (/\b(for my skin|good for (oily|dry|combo|combination|sensitive|normal|acne|aging|dark spot))\b/i.test(msg)) {
    return true
  }

  // 7. Weather / location queries
  if (/\b(weather|uv|humidity|temperature|sun.{0,5}(today|right now|outside))\b/i.test(msg)) {
    return true
  }

  // 8. Ingredient conflict checks
  if (/\b(can i (use|mix|combine)|conflict|interact|together|layer.{0,15}with)\b/i.test(msg)) {
    return true
  }

  // 9. Check if previous assistant message already has tool results for this
  //    If the conversation already contains tool-backed data, don't force again
  //    (This handles follow-up questions like "tell me more about that one")
  // — Not implemented here because the conversation history format in
  //   YuriMessage doesn't preserve tool_use metadata. The current design
  //   is safe: worst case, we force a redundant tool call, which is cheap.

  return false
}

function messagesToApiFormat(messages: YuriMessage[]): ApiMessage[] {
  return messages.map((m) => {
    if (m.role === 'user' && m.image_urls && m.image_urls.length > 0) {
      const imageBlocks = m.image_urls.map(imageUrlToBlock).filter((b): b is ImageBlock => b !== null)
      if (imageBlocks.length > 0) {
        const content: ContentBlock[] = [
          ...imageBlocks,
          { type: 'text', text: m.content },
        ]
        return { role: m.role, content }
      }
    }
    return { role: m.role, content: m.content }
  })
}

// ---------------------------------------------------------------------------
// Generate conversation title from first exchange
// ---------------------------------------------------------------------------

export async function generateTitle(
  userMessage: string,
  assistantResponse: string
): Promise<string> {
  const client = getAnthropicClient()

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.background,
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: `Generate a very short title (4-6 words max) for a K-beauty conversation that starts with this question: "${userMessage.slice(0, 200)}"

Return ONLY the title text, nothing else. No quotes.`,
          },
        ],
      }),
    1 // Non-critical: only 1 retry
  )

  const block = response.content[0]
  if (block.type === 'text') {
    return block.text.trim().replace(/^["']|["']$/g, '')
  }
  return 'K-Beauty Chat'
}

// ---------------------------------------------------------------------------
// Main advisor: stream a response to a user message
// ---------------------------------------------------------------------------

export interface AdvisorStreamOptions {
  userId: string
  conversationId: string
  message: string
  imageUrls?: string[]
  conversationHistory: YuriMessage[]
  requestedSpecialist?: SpecialistType | null
}

export async function* streamAdvisorResponse(
  options: AdvisorStreamOptions
): AsyncGenerator<string, void, unknown> {
  const {
    userId,
    conversationId,
    message,
    imageUrls = [],
    conversationHistory,
    requestedSpecialist,
  } = options

  // 1. Detect or use requested specialist
  const specialistType =
    requestedSpecialist !== undefined
      ? requestedSpecialist
      : detectSpecialist(message)

  // 2. Load user context (skin profile, memory, reactions)
  //    Pass conversationId so we exclude current conversation from recent excerpts
  //    Pass message + isFirstMessage for intent-based context loading (13.4)
  const isFirstMessage = conversationHistory.length === 0
  const userContext = await loadUserContext(userId, conversationId, {
    message,
    isFirstMessage,
  })

  // 3. Build system prompt with context + specialist
  const systemPrompt = buildSystemPrompt(
    userContext,
    specialistType,
    conversationHistory
  )

  // 4. Build message history for Claude
  const apiMessages = messagesToApiFormat(conversationHistory)

  // Add current user message with optional images
  if (imageUrls.length > 0) {
    const imageBlocks = imageUrls.map(imageUrlToBlock).filter((b): b is ImageBlock => b !== null)
    if (imageBlocks.length > 0) {
      const content: ContentBlock[] = [
        ...imageBlocks,
        { type: 'text', text: message },
      ]
      apiMessages.push({ role: 'user', content })
    } else {
      apiMessages.push({ role: 'user', content: message })
    }
  } else {
    apiMessages.push({ role: 'user', content: message })
  }

  // 5. Save user message to DB
  await saveMessage(conversationId, 'user', message, specialistType, imageUrls)

  // 6. Call Claude with tool use support + prompt caching + retry
  const client = getAnthropicClient()
  let fullResponse = ''

  // Reset per-turn web search rate limiter
  resetWebSearchCounter()

  // Build the messages array for the tool use loop.
  // We use the SDK's MessageParam type for the conversation with tool results.
  const loopMessages: Anthropic.Messages.MessageParam[] =
    apiMessages as Anthropic.Messages.MessageParam[]

  // Prepare tools with cache_control on the last tool definition
  const cachedTools = YURI_TOOLS.map((tool, idx) =>
    idx === YURI_TOOLS.length - 1
      ? { ...tool, cache_control: { type: 'ephemeral' as const } }
      : tool
  )

  const MAX_TOOL_LOOPS = 5
  let toolLoopCount = 0

  // ---------------------------------------------------------------------------
  // Intent-based tool_choice: force tool use for product/price/trending queries
  // ---------------------------------------------------------------------------
  // With tool_choice 'auto', Claude Opus often answers product-specific
  // questions from training knowledge instead of calling search_products or
  // compare_prices — even when the system prompt says "ALWAYS call tools."
  // The solution: detect queries that MUST hit the database and use
  // tool_choice 'any' (forces at least one tool call) on the first loop
  // iteration. Subsequent iterations (after tool results) revert to 'auto'
  // so Claude can generate its final text response.
  // ---------------------------------------------------------------------------
  const forceToolUse = shouldForceToolUse(message, conversationHistory)

  // Helper: apply cache_control to the last assistant message for cache reuse
  function applyCacheControl(msgs: Anthropic.Messages.MessageParam[]) {
    return msgs.map((msg, idx) => {
      if (
        msg.role === 'assistant' &&
        typeof msg.content === 'string' &&
        idx === msgs.length - 2
      ) {
        return {
          role: 'assistant' as const,
          content: [
            { type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } },
          ],
        }
      }
      return msg
    })
  }

  // Streaming tool use loop: use messages.stream() for ALL calls.
  //
  // Streaming strategy (every round):
  //
  // Buffer all text chunks. After the stream ends, check for tool_use
  // blocks. If tools were found, discard the buffered text (it's
  // "thinking" narration like "Let me search...") and execute the tools.
  // If no tools, replay the buffered chunks as yields — that's the
  // final response.
  //
  // We always buffer because we can't know mid-stream whether Claude
  // will also request a tool on this round. Yielding prematurely
  // leaks internal narration into the user-facing response.

  while (toolLoopCount <= MAX_TOOL_LOOPS) {
    const cachedMessages = applyCacheControl(loopMessages)

    // Force tool use on the FIRST iteration when user is asking about
    // products, prices, or trends. After tools execute and results are in
    // the conversation, revert to 'auto' so Claude can write its response.
    const toolChoice: Anthropic.Messages.MessageCreateParams['tool_choice'] =
      forceToolUse && toolLoopCount === 0
        ? { type: 'any' }
        : { type: 'auto' }

    const stream = client.messages.stream({
      model: MODELS.primary,
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: cachedMessages,
      tools: cachedTools,
      tool_choice: toolChoice,
    })

    // Collect tool_use blocks and (on first round) buffer text.
    const toolUseBlocks: Array<{ id: string; name: string; input: string }> = []
    let currentToolBlock: { id: string; name: string; input: string } | null = null
    // Only used on first iteration — post-tool rounds yield directly.
    const textChunks: string[] = []

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolBlock = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          // Always buffer text — we can't know if tools are coming until
          // the stream ends. Yielding prematurely leaks "thinking" narration
          // (e.g. "Let me also check...") when Claude calls another tool.
          textChunks.push(event.delta.text)
        } else if (event.delta.type === 'input_json_delta' && currentToolBlock) {
          currentToolBlock.input += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop' && currentToolBlock) {
        toolUseBlocks.push(currentToolBlock)
        currentToolBlock = null
      }
    }

    // No tools on this round — replay buffered text to client and we're done.
    if (toolUseBlocks.length === 0) {
      for (const chunk of textChunks) {
        fullResponse += chunk
        yield chunk
      }
      break
    }

    // Tools were found — discard intermediate "thinking" text (e.g.,
    // "Let me search for that...") to avoid it leaking into the final
    // response. Strip text blocks from the assistant message so Claude
    // only sees its tool_use blocks on the next round.
    toolLoopCount++

    const finalMessage = await stream.finalMessage()
    // Keep only tool_use blocks — drop text blocks (thinking noise)
    const toolOnlyContent = finalMessage.content.filter(
      (block) => block.type === 'tool_use'
    )
    loopMessages.push({
      role: 'assistant',
      content: toolOnlyContent.length > 0 ? toolOnlyContent : finalMessage.content,
    })

    // Execute each tool and build tool_result blocks
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const toolBlock of toolUseBlocks) {
      let parsedInput: Record<string, unknown> = {}
      try {
        parsedInput = JSON.parse(toolBlock.input || '{}')
      } catch {
        // Fall through with empty input
      }
      const result = await executeYuriTool(
        toolBlock.name,
        parsedInput,
        userId
      )
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      })
    }

    // Add tool results as a user message (Claude API requirement)
    loopMessages.push({ role: 'user', content: toolResults })
  }

  // If we exhausted tool loops without a final text response, yield what we have
  if (!fullResponse) {
    fullResponse = "I'm having trouble accessing the database right now. Let me answer based on my knowledge instead."
    yield fullResponse
  }

  // 7. Clean AI artifacts before saving (users see raw stream; saved text is polished)
  fullResponse = cleanYuriResponse(fullResponse)

  // 8. Save assistant response to DB
  await saveMessage(conversationId, 'assistant', fullResponse, specialistType)

  // 8. Generate title if this is the first exchange
  //    Yield a special __title__ sentinel so the SSE stream can propagate it
  if (conversationHistory.length === 0) {
    try {
      const title = await generateTitle(message, fullResponse)
      await updateConversationTitle(conversationId, title)
      yield `__TITLE__${title}`
    } catch {
      // Title generation is non-critical; don't fail the conversation
    }
  }

  // 9. Extract specialist insights (background, non-blocking)
  if (specialistType) {
    extractAndSaveInsight(
      conversationId,
      specialistType,
      message,
      fullResponse
    ).catch(() => {
      // Insight extraction is non-critical
    })
  }

  // 10. Continuous learning: extract profile updates + product reactions
  //     Runs on EVERY conversation (not just specialist ones) to catch new
  //     information the user reveals over time. Fire-and-forget.
  extractContinuousLearning(userId, message, fullResponse).catch(() => {
    // Learning extraction is non-critical — never block the stream
  })

  // 11. Generate/update conversation summary for cross-session memory.
  //     Runs on message 2, 6, then every 5 messages to keep summaries fresh.
  //     At every-5, the summary is always within 4 messages of current state,
  //     preventing the bug where a 37-message conversation's final recommendations
  //     were never captured (old trigger: every 10, missed messages 31-37).
  const msgCount = conversationHistory.length + 2 // +2 for user + assistant just added
  const shouldSummarize = msgCount <= 2 || msgCount === 6 || msgCount % 5 === 0
  if (shouldSummarize) {
    generateAndSaveSummary(
      conversationId,
      [...conversationHistory, { content: message, role: 'user' as const } as YuriMessage],
      fullResponse
    ).catch(() => {
      // Summary generation is non-critical
    })
  }

  // 12. Extract structured decision memory (decisions, preferences, commitments).
  //     Same cadence as summary generation — every 5 messages after initial exchange.
  if (shouldSummarize) {
    const transcriptForDecisions = [
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
      { role: 'assistant', content: fullResponse },
    ]
    extractAndSaveDecisionMemory(userId, conversationId, transcriptForDecisions).catch(() => {
      // Decision memory extraction is non-critical
    })
  }
}

// ---------------------------------------------------------------------------
// Background: generate conversation summary for cross-session memory
// ---------------------------------------------------------------------------

async function generateAndSaveSummary(
  conversationId: string,
  conversationHistory: YuriMessage[],
  latestResponse: string
): Promise<void> {
  const client = getAnthropicClient()

  // Build a condensed transcript — generous content per message to capture product names
  const transcript = conversationHistory
    .slice(-30) // Last 30 messages for longer conversations
    .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 600)}`)
    .join('\n')
  const fullTranscript = `${transcript}\nYuri: ${latestResponse.slice(0, 800)}`

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.background,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Summarize this K-beauty advisor conversation for Yuri's cross-session memory. This summary will be injected into Yuri's system prompt in FUTURE conversations so she remembers what happened here.

Structure the summary in TWO sections (both required):

**SECTION 1 — YURI'S RECOMMENDATIONS & ADVICE (write this section FIRST, it's the highest priority):**
- Every specific product Yuri recommended (exact product names, brands)
- WHY each product was recommended (what skin concern it addresses)
- Any phased plans or timelines Yuri suggested (e.g., "Phase 2 — add vitamin C after barrier repair")
- Routine changes Yuri advised (products to add, remove, swap, reorder)
- Specific advice given (e.g., "stop using cotton pad with toner in AM", "layer SPF under BB cream")
- Warnings Yuri gave (e.g., "Zero Pore Pads causing over-exfoliation")

**SECTION 2 — USER PROFILE & CONTEXT:**
- Skin type, concerns, goals discussed
- Current routine products (AM/PM)
- Personal details (age, location, budget, lifestyle)
- Products they like/dislike and why
- Allergies or bad reactions
- Questions left unanswered or follow-ups promised

Write in second person ("User has...", "Yuri recommended..."). Be specific — exact product names matter more than general topics. Max 500 words.

CONVERSATION:
${fullTranscript}

Return ONLY the summary text, no JSON or code formatting.`,
          },
        ],
      }),
    1 // Non-critical: only 1 retry
  )

  const block = response.content[0]
  if (block.type !== 'text') return

  await saveConversationSummary(conversationId, block.text.trim())
}

// ---------------------------------------------------------------------------
// Background: extract specialist insights after conversation
// ---------------------------------------------------------------------------

async function extractAndSaveInsight(
  conversationId: string,
  specialistType: SpecialistType,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  const specialist = SPECIALISTS[specialistType]
  if (!specialist?.extractionPrompt) return

  const client = getAnthropicClient()

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.background,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `${specialist.extractionPrompt}

User message: "${userMessage.slice(0, 500)}"
Assistant response: "${assistantResponse.slice(0, 500)}"

Return ONLY valid JSON.`,
          },
        ],
      }),
    1 // Non-critical: only 1 retry
  )

  const block = response.content[0]
  if (block.type !== 'text') return

  try {
    const text = block.text.trim()
    // Try direct parse first, fall back to regex extraction
    let insightData: Record<string, unknown>
    try {
      insightData = JSON.parse(text)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*?\}(?=[^}]*$)/)
      if (!jsonMatch) return
      insightData = JSON.parse(jsonMatch[0])
    }
    await saveSpecialistInsight(conversationId, specialistType, insightData)
  } catch {
    // Extraction failed; non-critical
  }
}

// ---------------------------------------------------------------------------
// Background: extract profile updates + product reactions from any conversation
// ---------------------------------------------------------------------------

async function extractContinuousLearning(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  const client = getAnthropicClient()

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.background,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze this K-beauty advisor conversation exchange and extract TWO things:

1. **Profile updates**: Any NEW information the user revealed about themselves that should update their skin profile. Only extract what they EXPLICITLY stated — never infer. Return null for any field not mentioned.

Possible profile fields:
- skin_type: "oily" | "dry" | "combination" | "normal" | "sensitive"
- new_concerns: string[] (new skin concerns mentioned)
- new_allergies: string[] (new allergies or sensitivities discovered)
- climate: "humid" | "dry" | "temperate" | "tropical" | "cold"
- budget_preference: "budget" | "mid-range" | "luxury" | "mixed"
- experience_level: "beginner" | "intermediate" | "advanced"
- new_routine_products: string[] (products they mentioned using)
- new_product_preferences: string[] (brands or products they expressed liking)

2. **Product reactions**: If the user described a specific reaction to a specific product, extract it. Only if they clearly stated a reaction — not hypothetical or asking about potential reactions.

Possible reactions: "holy_grail" (they love it/HG/repurchase forever), "good" (positive), "okay" (neutral), "bad" (negative), "broke_me_out" (caused breakouts/irritation/reaction)

USER MESSAGE: "${userMessage.slice(0, 1000)}"
ASSISTANT RESPONSE: "${assistantResponse.slice(0, 1000)}"

Return ONLY valid JSON in this exact format:
{
  "profile_updates": { ...only non-null fields... } or null,
  "product_reactions": [ { "product_name": "...", "brand": "...", "reaction": "..." } ] or []
}

If nothing new was revealed, return: { "profile_updates": null, "product_reactions": [] }`,
          },
        ],
      }),
    1 // Non-critical: only 1 retry
  )

  const block = response.content[0]
  if (block.type !== 'text') return

  let parsed: {
    profile_updates: Record<string, unknown> | null
    product_reactions: Array<{ product_name: string; brand?: string; reaction: string }>
  }
  try {
    const text = block.text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '')
    parsed = JSON.parse(text)
  } catch {
    return
  }

  const { getServiceClient } = await import('@/lib/supabase')
  const db = getServiceClient()

  // Apply profile updates if any were extracted
  if (parsed.profile_updates && Object.keys(parsed.profile_updates).length > 0) {
    try {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      const pu = parsed.profile_updates

      // Direct field updates (only override if user explicitly stated something new)
      if (pu.skin_type) updates.skin_type = pu.skin_type
      if (pu.climate) updates.climate = pu.climate
      if (pu.budget_preference) updates.budget_range = pu.budget_preference
      if (pu.experience_level) updates.experience_level = pu.experience_level

      // Array fields — merge with existing rather than overwrite
      if (
        (pu.new_concerns && (pu.new_concerns as string[]).length > 0) ||
        (pu.new_allergies && (pu.new_allergies as string[]).length > 0)
      ) {
        const { data: existing } = await db
          .from('ss_user_profiles')
          .select('skin_concerns, allergies')
          .eq('user_id', userId)
          .single()

        if (existing) {
          if (pu.new_concerns && (pu.new_concerns as string[]).length > 0) {
            const merged = [...new Set([
              ...(existing.skin_concerns || []),
              ...(pu.new_concerns as string[]),
            ])]
            updates.skin_concerns = merged
          }
          if (pu.new_allergies && (pu.new_allergies as string[]).length > 0) {
            const merged = [...new Set([
              ...(existing.allergies || []),
              ...(pu.new_allergies as string[]),
            ])]
            updates.allergies = merged
          }
        }
      }

      // Only write if we have real updates beyond just the timestamp
      if (Object.keys(updates).length > 1) {
        await db
          .from('ss_user_profiles')
          .update(updates)
          .eq('user_id', userId)
      }
    } catch (err) {
      console.error(`[yuri/learning] Profile update error for user ${userId}:`, err)
    }
  }

  // Auto-log product reactions
  if (parsed.product_reactions && parsed.product_reactions.length > 0) {
    for (const reaction of parsed.product_reactions) {
      try {
        // Try to match product in database by name
        const { data: matchedProducts } = await db
          .from('ss_products')
          .select('id, name_en')
          .ilike('name_en', `%${reaction.product_name.slice(0, 50)}%`)
          .limit(1)

        if (matchedProducts && matchedProducts.length > 0) {
          const validReactions = ['holy_grail', 'good', 'okay', 'bad', 'broke_me_out']
          if (validReactions.includes(reaction.reaction)) {
            await db
              .from('ss_user_product_reactions')
              .upsert(
                {
                  user_id: userId,
                  product_id: matchedProducts[0].id,
                  reaction: reaction.reaction,
                  notes: 'Auto-detected from Yuri conversation',
                },
                { onConflict: 'user_id,product_id' }
              )
          }
        }
      } catch (err) {
        console.error(`[yuri/learning] Product reaction error for "${reaction.product_name}":`, err)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Non-streaming variant for simpler use cases
// ---------------------------------------------------------------------------

export async function getAdvisorResponse(
  options: Omit<AdvisorStreamOptions, 'never'>
): Promise<{ content: string; specialistType: SpecialistType | null }> {
  const chunks: string[] = []
  const specialistType =
    options.requestedSpecialist !== undefined
      ? options.requestedSpecialist
      : detectSpecialist(options.message)

  for await (const chunk of streamAdvisorResponse(options)) {
    chunks.push(chunk)
  }

  return {
    content: chunks.join(''),
    specialistType,
  }
}
