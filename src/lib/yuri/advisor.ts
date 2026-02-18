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
- If asked about something outside K-beauty, gently redirect`

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
 * Parse a data URL into base64 source for Claude, or fall back to URL source.
 */
function imageUrlToBlock(url: string): ImageBlock {
  const dataUrlMatch = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  if (dataUrlMatch) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: dataUrlMatch[1], data: dataUrlMatch[2] },
    }
  }
  return { type: 'image', source: { type: 'url', url } }
}

function messagesToApiFormat(messages: YuriMessage[]): ApiMessage[] {
  return messages.map((m) => {
    if (m.role === 'user' && m.image_urls && m.image_urls.length > 0) {
      const content: ContentBlock[] = [
        ...m.image_urls.map(imageUrlToBlock),
        { type: 'text', text: m.content },
      ]
      return { role: m.role, content }
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
    const content: ContentBlock[] = [
      ...imageUrls.map(imageUrlToBlock),
      { type: 'text', text: message },
    ]
    apiMessages.push({ role: 'user', content })
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
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return
    const insightData = JSON.parse(jsonMatch[0])
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
