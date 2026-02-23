import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { SPECIALISTS, detectSpecialist } from './specialists'
import {
  loadUserContext,
  formatContextForPrompt,
  saveMessage,
  updateConversationTitle,
  saveSpecialistInsight,
  saveConversationSummary,
  type UserContext,
} from './memory'
import { YURI_TOOLS, executeYuriTool } from './tools'
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

**When to use tools**: Use them for product-specific questions, price inquiries, ingredient lookups, trend queries, and personalized matching. Do NOT use tools for general skincare education, emotional support, or app guidance — answer those from your knowledge.
**When NOT to use tools**: Simple greetings, skincare theory, application tips, app navigation help, or when you already have the answer from the conversation context.
**Tool results**: When you get tool results, incorporate the data naturally into your response. Cite specific products, prices, and ingredients from the results. If a tool returns no results, say so honestly and offer alternatives.

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

## Important Rules
- NEVER diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues
- NEVER guarantee results -- skincare is individual and what works varies
- ALWAYS respect known allergies -- flag any potential allergen in recommendations
- If a user shares a photo, analyze it carefully but remind them that photo analysis has limitations
- If asked about something outside K-beauty, gently redirect

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

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: `Generate a very short title (4-6 words max) for a K-beauty conversation that starts with this question: "${userMessage.slice(0, 200)}"

Return ONLY the title text, nothing else. No quotes.`,
      },
    ],
  })

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
  const userContext = await loadUserContext(userId, conversationId)

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

  // 6. Call Claude with tool use support
  const client = getAnthropicClient()
  let fullResponse = ''

  // Build the messages array for the tool use loop.
  // We use the SDK's MessageParam type for the conversation with tool results.
  const loopMessages: Anthropic.Messages.MessageParam[] =
    apiMessages as Anthropic.Messages.MessageParam[]

  const MAX_TOOL_LOOPS = 3
  let toolLoopCount = 0

  // Tool use loop: Claude may request tools, we execute them, then re-call
  while (toolLoopCount <= MAX_TOOL_LOOPS) {
    const response = await client.messages.create({
      model: MODELS.primary,
      max_tokens: 2048,
      system: systemPrompt,
      messages: loopMessages,
      tools: YURI_TOOLS,
      tool_choice: { type: 'auto' },
    })

    if (response.stop_reason === 'tool_use') {
      // Claude wants to use tools — extract tool_use blocks, execute, and loop
      toolLoopCount++

      // Add Claude's response (with tool_use blocks) to the message history
      loopMessages.push({ role: 'assistant', content: response.content })

      // Execute each tool and build tool_result blocks
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeYuriTool(
            block.name,
            block.input as Record<string, unknown>,
            userId
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          })
        }
      }

      // Add tool results as a user message (Claude API requirement)
      loopMessages.push({ role: 'user', content: toolResults })

      // Continue the loop — Claude will process tool results and respond
      continue
    }

    // stop_reason is 'end_turn' (or 'max_tokens') — extract text and yield
    for (const block of response.content) {
      if (block.type === 'text') {
        fullResponse += block.text
      }
    }

    // Yield the response in chunks to maintain SSE streaming feel
    // Break into ~50 char chunks to simulate streaming
    const CHUNK_SIZE = 50
    for (let i = 0; i < fullResponse.length; i += CHUNK_SIZE) {
      yield fullResponse.slice(i, i + CHUNK_SIZE)
    }

    break // Exit the tool loop
  }

  // If we exhausted tool loops without a final text response, yield what we have
  if (!fullResponse) {
    fullResponse = "I'm having trouble accessing the database right now. Let me answer based on my knowledge instead."
    yield fullResponse
  }

  // 7. Save assistant response to DB
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

  const response = await client.messages.create({
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
  })

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

  const response = await client.messages.create({
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
  })

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

  const response = await client.messages.create({
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
  })

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
