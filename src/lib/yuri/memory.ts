import { getServiceClient } from '@/lib/supabase'
import type { SkinProfile, YuriConversation, YuriMessage, SpecialistType } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserContext {
  skinProfile: SkinProfile | null
  recentConversations: ConversationMemory[]
  productReactions: ProductReaction[]
  knownAllergies: string[]
  knownPreferences: string[]
  routineProducts: string[]
  learningInsights: LearningContextData[]
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
}

export interface ProductReaction {
  productName: string
  reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
}

// ---------------------------------------------------------------------------
// Load user context for Yuri conversations
// ---------------------------------------------------------------------------

export async function loadUserContext(userId: string): Promise<UserContext> {
  const db = getServiceClient()

  const [
    profileResult,
    conversationsResult,
    reactionsResult,
    routineResult,
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
      .select('id, title, specialist_type, updated_at')
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
  ])

  // Load learning insights after we know the skin profile
  const skinProfile = profileResult.data as SkinProfile | null
  const learningInsights = await loadLearningContext(db, skinProfile)

  // Build conversation memories from recent conversations
  const recentConversations: ConversationMemory[] = (conversationsResult.data || []).map(
    (conv: { id: string; title: string | null; specialist_type: SpecialistType | null; updated_at: string }) => ({
      conversationId: conv.id,
      title: conv.title,
      specialistType: conv.specialist_type,
      summary: conv.title || 'Untitled conversation',
      keyInsights: [],
      timestamp: conv.updated_at,
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

  return {
    skinProfile,
    recentConversations,
    productReactions,
    knownAllergies: skinProfile?.allergies || [],
    knownPreferences: [],
    routineProducts,
    learningInsights,
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
    const onboarded = (p as unknown as Record<string, unknown>).onboarding_completed
    sections.push(`## User's Skin Profile${onboarded ? ' (built during your onboarding conversation -- you already know this user!)' : ''}
- Skin type: ${p.skin_type}
- Concerns: ${p.skin_concerns.join(', ') || 'none specified'}
- Allergies: ${p.allergies.join(', ') || 'none known'}
- Fitzpatrick scale: ${p.fitzpatrick_scale}
- Climate: ${p.climate}
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

  // Recent conversation topics
  if (context.recentConversations.length > 0) {
    const topics = context.recentConversations
      .slice(0, 5)
      .map((c) => `- ${c.summary} (${c.specialistType || 'general'})`)
      .join('\n')
    sections.push(`## Recent Conversation Topics\n${topics}`)
  }

  // Learning engine insights (makes Yuri smarter over time)
  if (context.learningInsights.length > 0) {
    const insightLines = context.learningInsights
      .map((i) => `- [${i.type}] ${i.summary}`)
      .join('\n')
    sections.push(`## Learning Engine Insights (From Community Data)\nUse these data-backed insights to personalize your advice. Cite the data when relevant:\n${insightLines}`)
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

export async function loadConversationMessages(
  conversationId: string,
  limit = 50
): Promise<YuriMessage[]> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_yuri_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to load messages: ${error.message}`)
  return data as YuriMessage[]
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
