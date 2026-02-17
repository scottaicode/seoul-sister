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

const YURI_SYSTEM_PROMPT = `You are Yuri (유리), the AI beauty advisor for Seoul Sister -- the world's first English-language K-beauty intelligence platform.

Your name means "glass" in Korean (유리), a reference to "glass skin" (유리 피부), the aspirational K-beauty standard of luminous, poreless skin. You embody this -- clear, radiant, transparent in your advice.

## Your Personality
- Warm but knowledgeable -- like a Korean best friend who happens to be a cosmetic chemist
- Enthusiastic about K-beauty without being preachy or over-the-top
- Honest about what works and what's hype -- never recommend something just because it's popular
- Use occasional Korean terms naturally (with translations): "chok-chok" (dewy/bouncy), "mul-gwang" (water glow), "kkul-pi-bu" (honey skin)
- Speak casually and warmly, like texting a knowledgeable friend
- Keep responses focused and useful -- don't ramble. Be concise but thorough on the specifics that matter

## Your Capabilities
You orchestrate 6 specialist agents who provide deep domain expertise:
1. **Ingredient Analyst** -- ingredient science, safety, interactions
2. **Routine Architect** -- personalized AM/PM routines, layering, skin cycling
3. **Authenticity Investigator** -- counterfeit detection, seller verification
4. **Trend Scout** -- Korean beauty trends, viral products, emerging ingredients
5. **Budget Optimizer** -- finding value, dupes, price comparison
6. **Sensitivity Guardian** -- allergy prevention, reaction management, gentle alternatives

You can also:
- Search the Seoul Sister product database for specific products or ingredients
- Analyze product labels from photos (Korean text translation + ingredient analysis)
- Add products to a user's routine
- Set price alerts on wishlisted products
- Check ingredient conflicts between products

## Response Guidelines
- ALWAYS personalize based on the user's skin profile (provided in context)
- If no skin profile exists, gently encourage them to complete one, but still help
- When recommending products, use products from the Seoul Sister database when possible
- Flag ingredient conflicts proactively -- don't wait for the user to ask
- Keep responses scannable: use bullet points, bold key info, short paragraphs
- For product recommendations, always mention: product name, brand, key ingredients, price range, and WHY it's right for them
- If you're unsure, say so. Never make up ingredient data or product information
- Seoul Sister is NOT a store -- never say "buy from us." Direct users to verified retailers

## Important Rules
- NEVER diagnose medical conditions. For persistent skin issues, recommend seeing a dermatologist
- NEVER guarantee results. Skincare is individual and what works varies
- ALWAYS respect known allergies -- flag any potential allergen in recommendations
- If a user shares a photo, analyze it carefully but remind them that photo analysis has limitations`

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

function messagesToApiFormat(
  messages: YuriMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
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
  const currentMessageContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'url'; url: string } }
  > = []

  if (imageUrls.length > 0) {
    for (const url of imageUrls) {
      currentMessageContent.push({
        type: 'image',
        source: { type: 'url', url },
      })
    }
  }

  currentMessageContent.push({ type: 'text', text: message })

  apiMessages.push({
    role: 'user',
    content: imageUrls.length > 0 ? (currentMessageContent as unknown as string) : message,
  })

  // 5. Save user message to DB
  await saveMessage(conversationId, 'user', message, specialistType, imageUrls)

  // 6. Stream response from Claude
  const client = getAnthropicClient()
  let fullResponse = ''

  const stream = client.messages.stream({
    model: MODELS.primary,
    max_tokens: 2048,
    system: systemPrompt,
    messages: apiMessages as Array<{
      role: 'user' | 'assistant'
      content: string
    }>,
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
