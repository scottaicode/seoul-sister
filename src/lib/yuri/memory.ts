import { getServiceClient } from '@/lib/supabase'
import type { SkinProfile, YuriConversation, YuriMessage, SpecialistType, CyclePhaseInfo, UserCycleTracking } from '@/types/database'
import { getCyclePhase, getPhaseLabel } from '@/lib/intelligence/cycle-routine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecialistInsightMemory {
  specialistType: string
  data: Record<string, unknown>
  createdAt: string
}

export interface RecentConversationExcerpt {
  conversationId: string
  title: string | null
  messages: Array<{ role: string; content: string }>
}

export interface UserContext {
  skinProfile: SkinProfile | null
  recentConversations: ConversationMemory[]
  recentExcerpts: RecentConversationExcerpt[]
  productReactions: ProductReaction[]
  knownAllergies: string[]
  knownPreferences: string[]
  routineProducts: string[]
  learningInsights: LearningContextData[]
  specialistInsights: SpecialistInsightMemory[]
  cyclePhase: CyclePhaseInfo | null
  locationName: string | null
}

export interface LearningContextData {
  type: 'effectiveness' | 'trend' | 'seasonal'
  summary: string
}

export interface ConversationMemory {
  conversationId: string
  title: string | null
  specialistType: SpecialistType | null
  summary: string
  keyInsights: string[]
  timestamp: string
  aiSummary: string | null
}

export interface ProductReaction {
  productName: string
  reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
}

// ---------------------------------------------------------------------------
// Load user context for Yuri conversations
// ---------------------------------------------------------------------------

export async function loadUserContext(userId: string, currentConversationId?: string): Promise<UserContext> {
  const db = getServiceClient()

  const [
    profileResult,
    conversationsResult,
    reactionsResult,
    routineResult,
    specialistInsightsResult,
  ] = await Promise.all([
    // Skin profile
    db
      .from('ss_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single(),

    // Recent conversations (last 10) for memory context
    db
      .from('ss_yuri_conversations')
      .select('id, title, specialist_type, updated_at, summary')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10),

    // Product reactions (holy grail / broke me out)
    db
      .from('ss_user_product_reactions')
      .select(`
        reaction,
        product_id,
        ss_products (name_en)
      `)
      .eq('user_id', userId)
      .limit(50),

    // Current routine products
    db
      .from('ss_user_routines')
      .select(`
        id,
        routine_type,
        ss_routine_products (
          step_order,
          product_id,
          ss_products (name_en, brand_en, category)
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true),

    // Specialist insights from past conversations (most recent per specialist)
    db
      .from('ss_specialist_insights')
      .select('specialist_type, data, created_at, conversation_id, ss_yuri_conversations!inner(user_id)')
      .eq('ss_yuri_conversations.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Load learning insights after we know the skin profile
  const skinProfile = profileResult.data as SkinProfile | null
  const learningInsights = await loadLearningContext(db, skinProfile)

  // Load cycle phase if tracking is enabled
  let cyclePhase: CyclePhaseInfo | null = null
  try {
    const profileRaw = profileResult.data as Record<string, unknown> | null
    if (profileRaw?.cycle_tracking_enabled) {
      const { data: latestCycle } = await db
        .from('ss_user_cycle_tracking')
        .select('cycle_start_date, cycle_length_days')
        .eq('user_id', userId)
        .order('cycle_start_date', { ascending: false })
        .limit(1)
        .single()

      if (latestCycle) {
        const entry = latestCycle as unknown as UserCycleTracking
        const avgLength = (profileRaw.avg_cycle_length as number) || entry.cycle_length_days || 28
        cyclePhase = getCyclePhase(entry.cycle_start_date, avgLength)
      }
    }
  } catch {
    // Cycle loading is non-critical
  }

  // Build conversation memories from recent conversations
  const recentConversations: ConversationMemory[] = (conversationsResult.data || []).map(
    (conv: { id: string; title: string | null; specialist_type: SpecialistType | null; updated_at: string; summary: string | null }) => ({
      conversationId: conv.id,
      title: conv.title,
      specialistType: conv.specialist_type,
      summary: conv.title || 'Untitled conversation',
      keyInsights: [],
      timestamp: conv.updated_at,
      aiSummary: conv.summary || null,
    })
  )

  // Extract product reactions
  const productReactions: ProductReaction[] = (reactionsResult.data || []).map(
    (r: Record<string, unknown>) => ({
      productName: (r.ss_products as Record<string, string>)?.name_en || 'Unknown',
      reaction: r.reaction as ProductReaction['reaction'],
    })
  )

  // Extract routine products
  const routineProducts: string[] = []
  for (const routine of routineResult.data || []) {
    const products = (routine as Record<string, unknown>).ss_routine_products as
      | Record<string, unknown>[]
      | null
    if (products) {
      for (const rp of products) {
        const product = rp.ss_products as Record<string, string> | null
        if (product) {
          routineProducts.push(
            `${product.name_en} (${product.brand_en}) - ${product.category}`
          )
        }
      }
    }
  }

  // Extract specialist insights — deduplicate by specialist type (keep most recent)
  const specialistInsights: SpecialistInsightMemory[] = []
  const seenSpecialists = new Set<string>()
  for (const row of specialistInsightsResult.data || []) {
    const r = row as Record<string, unknown>
    const st = r.specialist_type as string
    if (seenSpecialists.has(st)) continue
    seenSpecialists.add(st)
    const data = r.data as Record<string, unknown>
    // Only include insights that have meaningful content (non-empty arrays/values)
    const hasContent = Object.values(data).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ''
    )
    if (hasContent) {
      specialistInsights.push({
        specialistType: st,
        data,
        createdAt: r.created_at as string,
      })
    }
  }

  // Load actual message content from recent conversations (LGAAS pattern)
  // This gives Yuri access to what she actually said, even if the summary missed it
  const recentExcerpts = await loadRecentConversationExcerpts(db, userId, currentConversationId)

  // Reverse-geocode user's location from lat/lng if available
  const locationName = await reverseGeocodeUserLocation(skinProfile)

  return {
    skinProfile,
    recentConversations,
    recentExcerpts,
    productReactions,
    knownAllergies: skinProfile?.allergies || [],
    knownPreferences: [],
    routineProducts,
    learningInsights,
    specialistInsights,
    cyclePhase,
    locationName,
  }
}

// ---------------------------------------------------------------------------
// Format user context as text for system prompt injection
// ---------------------------------------------------------------------------

export function formatContextForPrompt(context: UserContext): string {
  const sections: string[] = []

  // Skin profile
  if (context.skinProfile) {
    const p = context.skinProfile
    const profileRaw = p as unknown as Record<string, unknown>
    const onboarded = profileRaw.onboarding_completed
    // Location fallback chain: stated location (from onboarding) > GPS reverse-geocode > nothing
    const locationText = profileRaw.location_text as string | null
    const locationLine = locationText
      ? `\n- Location: ${locationText}`
      : context.locationName
        ? `\n- Location: ${context.locationName} (from GPS)`
        : ''
    sections.push(`## User's Skin Profile${onboarded ? ' (built during your onboarding conversation -- you already know this user!)' : ''}
- Skin type: ${p.skin_type}
- Concerns: ${p.skin_concerns?.join(', ') || 'none specified'}
- Allergies: ${p.allergies?.join(', ') || 'none known'}
- Fitzpatrick scale: ${p.fitzpatrick_scale}
- Climate: ${p.climate}${locationLine}
- Age range: ${p.age_range}
- Budget: ${p.budget_range}
- Experience level: ${p.experience_level}`)
  } else {
    sections.push(`## User's Skin Profile\nNot yet created. Encourage them to complete their skin profile for personalized advice. You can suggest they go through the onboarding conversation with you.`)
  }

  // Current routine
  if (context.routineProducts.length > 0) {
    sections.push(`## Current Routine Products\n${context.routineProducts.map((p) => `- ${p}`).join('\n')}`)
  }

  // Product reactions
  if (context.productReactions.length > 0) {
    const holyGrails = context.productReactions
      .filter((r) => r.reaction === 'holy_grail')
      .map((r) => r.productName)
    const brokeMeOut = context.productReactions
      .filter((r) => r.reaction === 'broke_me_out')
      .map((r) => r.productName)

    if (holyGrails.length > 0) {
      sections.push(`## Holy Grail Products\n${holyGrails.map((p) => `- ${p}`).join('\n')}`)
    }
    if (brokeMeOut.length > 0) {
      sections.push(`## Products That Caused Reactions\n${brokeMeOut.map((p) => `- ${p}`).join('\n')}`)
    }
  }

  // Known allergies (emphasized)
  if (context.knownAllergies.length > 0) {
    sections.push(`## IMPORTANT: Known Allergies/Sensitivities\nALWAYS check for these before recommending any product:\n${context.knownAllergies.map((a) => `- ${a}`).join('\n')}`)
  }

  // Recent conversation summaries (cross-session memory)
  if (context.recentConversations.length > 0) {
    const withSummaries = context.recentConversations.filter(c => c.aiSummary)
    const withoutSummaries = context.recentConversations.filter(c => !c.aiSummary)

    if (withSummaries.length > 0) {
      const summaryText = withSummaries
        .slice(0, 5)
        .map((c) => `### ${c.title || 'Conversation'} (${c.specialistType || 'general'})\n${c.aiSummary}`)
        .join('\n\n')
      sections.push(`## Previous Conversations (Your Memory)\nYou remember these past conversations with this user. Use this knowledge naturally — don't repeat advice they've already received, build on what you discussed before, and reference specific products/routines/preferences they mentioned:\n\n${summaryText}`)
    }

    if (withoutSummaries.length > 0) {
      const topics = withoutSummaries
        .slice(0, 3)
        .map((c) => `- ${c.summary} (${c.specialistType || 'general'})`)
        .join('\n')
      sections.push(`## Other Recent Conversation Topics\n${topics}`)
    }
  }

  // Recent conversation excerpts (actual message content from past conversations)
  // This is the safety net — even if summaries missed specific recommendations,
  // Yuri can see what she actually said in the last few messages of recent conversations
  if (context.recentExcerpts.length > 0) {
    const excerptText = context.recentExcerpts
      .map((ex) => {
        const msgs = ex.messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content}`)
          .join('\n')
        return `### ${ex.title || 'Conversation'}\n${msgs}`
      })
      .join('\n\n')
    sections.push(`## Recent Conversation Excerpts (Your Actual Messages)\nThese are the last few messages from your recent conversations with this user. Use these to remember EXACTLY what you said — specific products you recommended, advice you gave, and commitments you made:\n\n${excerptText}`)
  }

  // Menstrual cycle phase context
  if (context.cyclePhase) {
    const cp = context.cyclePhase
    sections.push(`## Menstrual Cycle Phase (User has opted into cycle tracking)
- Current phase: ${getPhaseLabel(cp.phase)} (Day ${cp.day_in_cycle} of ${cp.cycle_length}-day cycle)
- Days until next phase: ${cp.days_until_next_phase}
- Skin behavior: ${cp.skin_behavior}
- Key recommendations for this phase: ${cp.recommendations.slice(0, 3).join('; ')}
When making skincare recommendations, factor in the user's current cycle phase. This is especially relevant for actives, exfoliation, moisturizer weight, and breakout prevention.`)
  }

  // Learning engine insights (makes Yuri smarter over time)
  if (context.learningInsights.length > 0) {
    const insightLines = context.learningInsights
      .map((i) => `- [${i.type}] ${i.summary}`)
      .join('\n')
    sections.push(`## Learning Engine Insights (From Community Data)\nUse these data-backed insights to personalize your advice. Cite the data when relevant:\n${insightLines}`)
  }

  // Specialist insights from past conversations (accumulated intelligence)
  if (context.specialistInsights.length > 0) {
    const insightLines = context.specialistInsights.map((si) => {
      const data = si.data
      const parts: string[] = [`### ${si.specialistType.replace(/_/g, ' ')}`]
      // Format known data fields from specialist extractions
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          parts.push(`- ${key.replace(/_/g, ' ')}: ${value.join(', ')}`)
        } else if (typeof value === 'string' && value) {
          parts.push(`- ${key.replace(/_/g, ' ')}: ${value}`)
        }
      }
      return parts.join('\n')
    }).join('\n')
    sections.push(`## Past Specialist Intelligence (From Previous Conversations)\nThis user has had specialist conversations before. Use these insights to build on previous advice — don't ask about things you already learned:\n${insightLines}`)
  }

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

export async function createConversation(
  userId: string,
  specialistType: SpecialistType | null = null
): Promise<string> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .insert({
      user_id: userId,
      specialist_type: specialistType,
      message_count: 0,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return data.id
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  specialistType: SpecialistType | null = null,
  imageUrls: string[] = []
): Promise<string> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('ss_yuri_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      specialist_type: specialistType,
      image_urls: imageUrls,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save message: ${error.message}`)

  // Update conversation timestamp (message_count managed via DB trigger or manual increment)
  await db
    .from('ss_yuri_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data.id
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const db = getServiceClient()
  await db
    .from('ss_yuri_conversations')
    .update({ title })
    .eq('id', conversationId)
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const db = getServiceClient()

  // Verify ownership
  const { data: conv } = await db
    .from('ss_yuri_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single()

  if (!conv || conv.user_id !== userId) {
    throw new Error('Conversation not found')
  }

  // Delete messages first (FK constraint)
  await db
    .from('ss_yuri_messages')
    .delete()
    .eq('conversation_id', conversationId)

  // Delete the conversation
  const { error } = await db
    .from('ss_yuri_conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw new Error(`Failed to delete conversation: ${error.message}`)
}

export async function saveConversationSummary(
  conversationId: string,
  summary: string
): Promise<void> {
  const db = getServiceClient()
  await db
    .from('ss_yuri_conversations')
    .update({
      summary,
      summary_generated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}

// Truncation constants (LGAAS pattern)
const TRUNCATION_THRESHOLD = 50 // Start truncating after this many messages
const HEAD_COUNT = 4 // Keep first N messages (conversation setup)
const TAIL_COUNT = 40 // Keep last N messages (recent flow)

export async function loadConversationMessages(
  conversationId: string,
  limit = 200
): Promise<YuriMessage[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to load messages: ${error.message}`)
  const messages = data as YuriMessage[]

  // If under threshold, return all messages as-is
  if (messages.length <= TRUNCATION_THRESHOLD) {
    return messages
  }

  // Smart truncation: keep head + tail, bridge-summarize the middle
  return await truncateWithBridge(db, conversationId, messages)
}

/**
 * Smart truncation with bridge summary (LGAAS pattern).
 * Keeps first HEAD_COUNT messages (topic setup) + last TAIL_COUNT messages (recent flow).
 * Generates a Sonnet summary of the dropped middle section and injects it as a
 * synthetic assistant message between head and tail.
 * Bridge summaries are cached on the conversation record to avoid regeneration.
 */
async function truncateWithBridge(
  db: ReturnType<typeof getServiceClient>,
  conversationId: string,
  messages: YuriMessage[]
): Promise<YuriMessage[]> {
  const head = messages.slice(0, HEAD_COUNT)
  const tail = messages.slice(-TAIL_COUNT)
  const droppedMessages = messages.slice(HEAD_COUNT, messages.length - TAIL_COUNT)

  if (droppedMessages.length === 0) return messages

  // Check for cached bridge summary
  const { data: conv } = await db
    .from('ss_yuri_conversations')
    .select('truncation_summary, truncation_summary_msg_count')
    .eq('id', conversationId)
    .single()

  let bridgeSummary = conv?.truncation_summary
  const cachedMsgCount = conv?.truncation_summary_msg_count

  // Regenerate if no cached summary or message count has changed significantly
  if (!bridgeSummary || !cachedMsgCount || Math.abs(cachedMsgCount - messages.length) >= 5) {
    try {
      const { getAnthropicClient, MODELS } = await import('@/lib/anthropic')
      const client = getAnthropicClient()

      const droppedTranscript = droppedMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 400)}`)
        .join('\n')

      const response = await client.messages.create({
        model: MODELS.background,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Summarize these messages from the MIDDLE of a K-beauty advisor conversation. These messages are being dropped due to conversation length, so the summary must preserve all critical information.

Focus on:
1. Specific product recommendations Yuri made (exact names, brands)
2. Advice and reasoning Yuri gave for each recommendation
3. Key decisions or preferences the user expressed
4. Any routine changes discussed or agreed upon

DROPPED MESSAGES (${droppedMessages.length} messages):
${droppedTranscript}

Write a dense, factual summary. Max 400 words. Return ONLY the summary text.`,
        }],
      })

      const block = response.content[0]
      if (block.type === 'text') {
        bridgeSummary = block.text.trim()

        // Cache the bridge summary
        await db
          .from('ss_yuri_conversations')
          .update({
            truncation_summary: bridgeSummary,
            truncation_summary_msg_count: messages.length,
          })
          .eq('id', conversationId)
      }
    } catch {
      // Bridge generation failed — fall back to simple truncation
      return [...head, ...tail]
    }
  }

  // Inject bridge summary as a synthetic assistant message between head and tail
  if (bridgeSummary) {
    const bridgeMessage: YuriMessage = {
      id: 'bridge-summary',
      conversation_id: conversationId,
      role: 'assistant',
      content: `[CONVERSATION CONTEXT — ${droppedMessages.length} earlier messages summarized]\n\n${bridgeSummary}\n\n[End of summary. The ${tail.length} most recent messages follow below.]`,
      specialist_type: null,
      image_urls: [],
      created_at: head[head.length - 1]?.created_at || new Date().toISOString(),
    }
    return [...head, bridgeMessage, ...tail]
  }

  return [...head, ...tail]
}

export async function loadUserConversations(
  userId: string,
  limit = 20
): Promise<YuriConversation[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to load conversations: ${error.message}`)
  return data as YuriConversation[]
}

// ---------------------------------------------------------------------------
// Extract specialist insights post-conversation (background task)
// ---------------------------------------------------------------------------

export async function saveSpecialistInsight(
  conversationId: string,
  specialistType: SpecialistType,
  insightData: Record<string, unknown>
): Promise<void> {
  const db = getServiceClient()
  await db.from('ss_specialist_insights').insert({
    conversation_id: conversationId,
    specialist_type: specialistType,
    insight_type: 'conversation_extraction',
    data: insightData,
  })
}

// ---------------------------------------------------------------------------
// Load actual message content from recent conversations (LGAAS pattern)
// Gives Yuri access to what she actually said, even if summaries missed it
// ---------------------------------------------------------------------------

async function loadRecentConversationExcerpts(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  currentConversationId?: string
): Promise<RecentConversationExcerpt[]> {
  try {
    // Find the 3 most recent conversations with 3+ messages (meaningful conversations)
    // Exclude the current conversation since those messages are already in the API history
    let query = db
      .from('ss_yuri_conversations')
      .select('id, title, message_count')
      .eq('user_id', userId)
      .gte('message_count', 3)
      .order('updated_at', { ascending: false })
      .limit(4) // Fetch 4 in case one is the current conversation

    if (currentConversationId) {
      query = query.neq('id', currentConversationId)
    }

    const { data: conversations } = await query
    if (!conversations || conversations.length === 0) return []

    // Load the last 6 messages from each (captures the most recent exchange context)
    const excerpts: RecentConversationExcerpt[] = []
    const targetConversations = conversations.slice(0, 3)

    for (const conv of targetConversations) {
      const { data: messages } = await db
        .from('ss_yuri_messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (messages && messages.length > 0) {
        // Reverse to get chronological order (we fetched descending)
        const chronological = messages.reverse()
        excerpts.push({
          conversationId: conv.id,
          title: conv.title,
          messages: chronological.map((m) => ({
            role: m.role,
            // Generous content per message — product names and recommendations need space
            content: m.content.slice(0, 500),
          })),
        })
      }
    }

    return excerpts
  } catch {
    // Excerpt loading is non-critical
    return []
  }
}

// ---------------------------------------------------------------------------
// Reverse-geocode user location from lat/lng (Open-Meteo, free, no key)
// ---------------------------------------------------------------------------

async function reverseGeocodeUserLocation(
  skinProfile: SkinProfile | null
): Promise<string | null> {
  try {
    const raw = skinProfile as unknown as Record<string, unknown> | null
    const lat = raw?.latitude as string | number | null
    const lng = raw?.longitude as string | number | null
    if (!lat || !lng) return null

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng
    if (isNaN(latNum) || isNaN(lngNum)) return null

    // BigDataCloud free reverse geocoding (no API key, no rate limit issues)
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lngNum}&localityLanguage=en`,
      { next: { revalidate: 86400 } } // cache 24h
    )
    if (!res.ok) return null

    const data = await res.json() as {
      city?: string
      locality?: string
      principalSubdivision?: string
      countryName?: string
    }

    const city = data.city || data.locality
    if (!city) return null

    const parts = [city]
    if (data.principalSubdivision) parts.push(data.principalSubdivision)
    if (data.countryName) parts.push(data.countryName)
    return parts.join(', ')
  } catch {
    // Location is non-critical
    return null
  }
}

// ---------------------------------------------------------------------------
// Load learning engine context for Yuri's system prompt
// ---------------------------------------------------------------------------

async function loadLearningContext(
  db: ReturnType<typeof getServiceClient>,
  skinProfile: SkinProfile | null
): Promise<LearningContextData[]> {
  const insights: LearningContextData[] = []

  try {
    if (skinProfile) {
      // Top effective ingredients for user's skin type
      const { data: topIngredients } = await db
        .from('ss_ingredient_effectiveness')
        .select(`
          effectiveness_score,
          sample_size,
          concern,
          ingredient:ss_ingredients(name_en, function)
        `)
        .or(`skin_type.eq.${skinProfile.skin_type},skin_type.eq.__all__`)
        .gte('sample_size', 5)
        .order('effectiveness_score', { ascending: false })
        .limit(5)

      for (const ti of topIngredients || []) {
        const ingredient = ti.ingredient as unknown as Record<string, string>
        if (!ingredient) continue
        const pct = Math.round((ti.effectiveness_score as number) * 100)
        insights.push({
          type: 'effectiveness',
          summary: `Users with ${skinProfile.skin_type} skin report ${pct}% satisfaction with ${ingredient.name_en} (${ingredient.function}) based on ${ti.sample_size} reports${ti.concern && ti.concern !== '__all__' ? ` for ${ti.concern}` : ''}`,
        })
      }

      // Seasonal adjustments for user's climate
      const { data: seasonal } = await db
        .from('ss_learning_patterns')
        .select('data, pattern_description')
        .eq('pattern_type', 'seasonal')
        .eq('skin_type', skinProfile.climate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (seasonal?.pattern_description) {
        const data = seasonal.data as Record<string, unknown>
        insights.push({
          type: 'seasonal',
          summary: `${seasonal.pattern_description}. ${data.texture_advice || ''} Focus on: ${(data.ingredients_to_emphasize as string[])?.join(', ') || 'hydration'}`,
        })
      }
    }

    // Current trending items (available to all users)
    const { data: trends } = await db
      .from('ss_trend_signals')
      .select('trend_name, status, signal_strength')
      .in('status', ['emerging', 'trending'])
      .order('signal_strength', { ascending: false })
      .limit(3)

    for (const trend of trends || []) {
      if (trend.trend_name) {
        insights.push({
          type: 'trend',
          summary: `${trend.trend_name} is currently ${trend.status} in the K-beauty community`,
        })
      }
    }
  } catch {
    // Learning context is non-critical; don't fail if queries error
  }

  return insights
}
