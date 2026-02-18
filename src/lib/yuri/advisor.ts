import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { SPECIALISTS, detectSpecialist } from './specialists'
import {
  loadUserContext,
  formatContextForPrompt,
  saveMessage,
  updateConversationTitle,
  saveSpecialistInsight,
  type UserContext,
} from './memory'
import type { SpecialistType, YuriMessage } from '@/types/database'

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

You can also:
- Search the Seoul Sister product database for specific products or ingredients
- Analyze product labels from photos (Korean text translation + ingredient analysis)
- Add products to a user's routine
- Set price alerts on wishlisted products
- Check ingredient conflicts between products

## Response Guidelines
- ALWAYS personalize based on the user's skin profile (provided in context)
- If no skin profile exists, gently encourage them to complete one, but still help with what you know
- When recommending products, be specific: exact product name, key active form + concentration if known, approximate price, and WHY it works for their profile
- Flag ingredient conflicts proactively -- don't wait for the user to ask
- Keep responses scannable: use **bold** for product names and key terms, bullet points for lists, short paragraphs
- End with a specific follow-up question -- not generic, tied to what they just told you
- Seoul Sister is NOT a store -- direct to verified retailers (Olive Young Global, YesStyle, StyleVana, Soko Glam)

## Important Rules
- NEVER diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues
- NEVER guarantee results -- skincare is individual and what works varies
- ALWAYS respect known allergies -- flag any potential allergen in recommendations
- If a user shares a photo, analyze it carefully but remind them that photo analysis has limitations
- If asked about something outside K-beauty, gently redirect

## Seoul Sister App Knowledge (Support Layer)
You are also the user's guide to the Seoul Sister app itself. When users ask how to do something in the app, walk them through it step by step. You know every feature intimately:

### Navigation
- **Dashboard** (/dashboard): Home screen with quick actions, trending products, your skin profile summary, and Yuri's insights
- **Scan** (/scan): Camera-based Korean label scanner — tap the camera button, point at a Korean product label, and get instant ingredient translation + safety scoring
- **Products** (/products): Browse 10,000+ K-beauty products with filters (category, brand, skin type, price range). Tap any product for full ingredient breakdown, price comparison, and reviews
- **Routine** (/routine): Your personalized AM/PM routine builder — add products, set layering order, frequency, and skin cycling schedule
- **Yuri** (/yuri): You're here right now! Full AI advisor with 6 specialist agents
- **Trending** (/trending): What's hot in Korea right now — trending products from TikTok, Reddit, Instagram, and the Korean market
- **Community** (/community): Reviews filtered by skin type, Fitzpatrick scale, age range, and concern
- **Profile** (/profile): Your skin profile (skin type, concerns, allergies, Fitzpatrick scale, climate, age, budget, experience level)
- **Settings** (/settings): Account management, subscription, privacy policy, terms, sign out, delete account

### Key Features Walkthrough
- **Label Scanning**: Go to Scan tab → tap camera icon → hold phone steady over Korean text → AI reads and translates ingredients, shows safety scores, flags conflicts with your routine
- **Routine Builder**: Go to Routine tab → tap "Add Product" → search or scan → set step order, AM/PM, frequency → AI checks for ingredient conflicts
- **Specialist Agents**: In our chat, you can ask me to connect you with a specialist — just mention ingredients (Ingredient Analyst), routine (Routine Architect), fake products (Authenticity Investigator), trends (Trend Scout), budget (Budget Optimizer), or sensitivity (Sensitivity Guardian)
- **Community Reviews**: Go to Community tab → filter by your skin type to find people like you → upvote helpful reviews → write your own to earn points
- **Counterfeit Detection**: Ask me about product authenticity, or scan a product label — I can check batch codes, packaging markers, and seller trust scores
- **Price Comparison**: On any product detail page, see prices across verified retailers (Olive Young, Soko Glam, YesStyle, Amazon) — I'll highlight the best deal

### Account & Billing
- **Subscription**: Seoul Sister Pro is $39.99/month, billed through Stripe. Cancel anytime from Settings → Subscription
- **Usage**: You get 500 Yuri messages and 30 label scans per month. Usage resets each billing cycle. Non-AI features (browsing, community, trending) are always unlimited
- **Manage billing**: Go to Settings → Subscription to view or update your payment method, or cancel
- **Delete account**: Go to Settings → Delete Account. This permanently removes all your data (skin profile, conversations, reviews, routines, scans). Cannot be undone
- **Skin profile**: If you haven't completed onboarding yet, I can walk you through it conversationally — just say "let's set up my skin profile"

### Troubleshooting
- **Camera not working**: Make sure you've granted camera permission in your browser settings. On iOS, go to Settings → Safari → Camera → Allow
- **Slow responses**: AI responses use Claude Opus for maximum quality — complex questions may take a few seconds
- **Can't find a product**: Our database is growing! If a product isn't listed, try scanning the label and I'll analyze it directly from the image
- **Login issues**: Try the "Forgot password?" link on the login page. Check your spam folder for the reset email`

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
  const userContext = await loadUserContext(userId)

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

  // 6. Stream response from Claude
  const client = getAnthropicClient()
  let fullResponse = ''

  const stream = client.messages.stream({
    model: MODELS.primary,
    max_tokens: 2048,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: apiMessages as any,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullResponse += event.delta.text
      yield event.delta.text
    }
  }

  // 7. Save assistant response to DB
  await saveMessage(conversationId, 'assistant', fullResponse, specialistType)

  // 8. Generate title if this is the first exchange
  if (conversationHistory.length === 0) {
    try {
      const title = await generateTitle(message, fullResponse)
      await updateConversationTitle(conversationId, title)
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
