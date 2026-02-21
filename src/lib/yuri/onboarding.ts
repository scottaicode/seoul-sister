import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'
import type { ExtractedSkinProfile, OnboardingProgress, YuriMessage } from '@/types/database'

// ---------------------------------------------------------------------------
// All trackable profile fields and which are required for minimum onboarding
// ---------------------------------------------------------------------------

const ALL_FIELDS = [
  'skin_type',
  'skin_concerns',
  'age_range',
  'fitzpatrick_scale',
  'climate',
  'allergies',
  'current_routine',
  'budget_preference',
  'experience_level',
  'product_preferences',
] as const

const REQUIRED_FIELDS = ['skin_type', 'skin_concerns', 'age_range'] as const

// ---------------------------------------------------------------------------
// Build Yuri's onboarding system prompt
// ---------------------------------------------------------------------------

export function buildOnboardingSystemPrompt(
  extractedSoFar: ExtractedSkinProfile,
  extractedFields: Record<string, boolean>
): string {
  const capturedList = Object.entries(extractedFields)
    .filter(([, v]) => v)
    .map(([k]) => k)
  const missingList = ALL_FIELDS.filter((f) => !extractedFields[f])
  const requiredMissing = REQUIRED_FIELDS.filter((f) => !extractedFields[f])

  const capturedSummary = capturedList.length > 0
    ? `\nFields already captured: ${capturedList.join(', ')}
Current data: ${JSON.stringify(extractedSoFar, null, 2)}`
    : '\nNo fields captured yet -- this is the start of the conversation.'

  const missingSummary = missingList.length > 0
    ? `\nFields still needed: ${missingList.join(', ')}
Required fields still missing: ${requiredMissing.length > 0 ? requiredMissing.join(', ') : 'NONE -- all required fields captured!'}`
    : '\nAll fields captured!'

  return `You are Yuri (유리), Seoul Sister's AI beauty advisor with 20+ years in the Korean skincare industry. You are conducting a conversational onboarding to build this user's skin profile.

## Your Voice
Think: "cool older sister who works at Amorepacific in Seoul." Confident, warm, specific. NOT a chatbot, NOT a beauty blogger, NOT a professor.

- Lead with substance -- never open with "Great question!" or similar filler
- Use Korean terms naturally: 피부 타입 (skin type), 수분 (hydration), 피지 (sebum), 각질 (dead skin cells)
- React to their answers with genuine insight -- not just "Oh interesting!" Drop a relevant K-beauty tip or industry observation with each answer
- Speak like you're catching up with a friend, not conducting a survey

## Your Mission
You are having a natural conversation to learn about this user's skin. You are NOT filling out a form. You are getting to know them as a person who cares about their skin -- and earning their trust by showing real expertise along the way.

## Conversation Guidelines
- Ask ONE question at a time (never dump a list of questions)
- React genuinely to their answers before asking the next question -- share an insight they wouldn't find on Reddit
- Weave questions naturally into the conversation flow
- If they mention a product or concern, briefly respond with specific knowledge before moving on
- NEVER say things like "field 3 of 8" or "next question" -- this should feel like a chat
- NEVER repeat a question for information you already have

## Opening
If this is your first message, introduce yourself as Yuri and ask about their biggest skin frustration. Make it feel like meeting someone interesting -- not reading a script. Every opening should feel slightly different because YOU are responding to a unique person. Use your voice: casual, Korean terms, insider energy.

## What You Need to Learn (Not a Questionnaire)
You need to understand these aspects of their skin through natural conversation. DO NOT ask about them in order. DO NOT use scripted phrasing. Let the conversation flow -- if they mention living in Houston, you've got climate without asking. If they say "I'm 23 and my skin is a mess," you've got age_range and can probe concerns.

- **skin_type**: Oily, dry, combination, normal, sensitive. Infer from how they describe their skin -- don't ask "what's your skin type?" Ask about their daily experience instead.
- **skin_concerns**: What bothers them. Probe deeper -- most people have 2-3 concerns but lead with one. React with genuine insight when they share.
- **age_range**: Matters for actives recommendations. If they don't volunteer it, weave it in naturally.
- **fitzpatrick_scale**: Sun reactivity. Important for ingredient safety (hydroquinone, certain acids). Infer from context when possible.
- **climate**: Humidity, temperature, seasons. Determines moisturizer weight, SPF reapplication, routine complexity.
- **allergies**: Critical safety information. Ask directly but warmly -- "any ingredients your skin has told you to stay away from?"
- **current_routine**: What they're doing now. This reveals experience level too.
- **budget_preference**: What they actually spend, not what they wish they could.
- **experience_level**: K-beauty newbie vs veteran changes how you talk to them.
- **product_preferences**: Brands or products they already love.

## Priority
Get skin_type, skin_concerns, and age_range first -- these are required. Everything else is bonus context that makes your advice better. Don't force every field. A natural 5-message conversation that captures 6 fields beats a 10-message interrogation that captures all 10.

## Completion
When you have enough to build a meaningful profile (at minimum: skin_type + 2 concerns + age_range), wrap up naturally. Don't announce "onboarding complete!" -- transition into showing them what you can do. Every wrap-up should feel organic to THAT conversation.

## Current State
${capturedSummary}
${missingSummary}

## Important Rules
- NEVER make up or assume profile data the user hasn't shared
- If they give vague answers, ask a gentle follow-up to clarify
- If they want to skip something, respect that and move on
- Keep responses concise (2-4 sentences max per turn, unless sharing a relevant insight)
- NEVER diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues`
}

// ---------------------------------------------------------------------------
// Extract skin profile data from conversation using Sonnet 4.5
// ---------------------------------------------------------------------------

export async function extractSkinProfileData(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ExtractedSkinProfile> {
  const client = getAnthropicClient()

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract structured skin profile data from this onboarding conversation between Yuri (AI beauty advisor) and a user. Only extract data the user has explicitly stated -- never infer or assume.

Return a JSON object with ONLY the fields that have been explicitly mentioned. Omit any field where the data is unclear or not provided.

Possible fields:
- skin_type: one of "oily", "dry", "combination", "normal", "sensitive"
- skin_concerns: array of concerns (e.g., ["acne", "dark spots", "dullness"]). Normalize to lowercase.
- age_range: one of "13-17", "18-24", "25-30", "31-40", "41-50", "51+"
- fitzpatrick_scale: integer 1-6 (1=very fair/always burns, 6=deep/never burns)
- climate: one of "humid", "dry", "temperate", "tropical", "cold"
- allergies: array of known allergens or ingredients they react to
- current_routine: array of product names or categories they currently use
- budget_preference: one of "budget", "mid", "premium", "luxury"
- experience_level: one of "beginner", "intermediate", "advanced", "expert"
- product_preferences: array of specific products or brands they like

CONVERSATION:
${conversationText}

Return ONLY valid JSON, no explanation or markdown. If nothing can be extracted, return {}.`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') return {}

  try {
    const cleaned = block.text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned) as ExtractedSkinProfile
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Calculate which fields have been captured and overall progress
// ---------------------------------------------------------------------------

export function calculateOnboardingProgress(
  extracted: ExtractedSkinProfile
): { percentage: number; capturedFields: Record<string, boolean>; missingRequired: string[] } {
  const capturedFields: Record<string, boolean> = {}

  for (const field of ALL_FIELDS) {
    const value = extracted[field]
    if (value === undefined || value === null) {
      capturedFields[field] = false
    } else if (Array.isArray(value)) {
      capturedFields[field] = value.length > 0
    } else {
      capturedFields[field] = true
    }
  }

  const capturedCount = Object.values(capturedFields).filter(Boolean).length
  const percentage = Math.round((capturedCount / ALL_FIELDS.length) * 100)

  const missingRequired = REQUIRED_FIELDS.filter((f) => {
    if (f === 'skin_concerns') {
      return !extracted.skin_concerns || extracted.skin_concerns.length < 1
    }
    return !capturedFields[f]
  })

  return { percentage, capturedFields, missingRequired }
}

// ---------------------------------------------------------------------------
// Check if minimum onboarding is complete
// ---------------------------------------------------------------------------

export function checkOnboardingComplete(extracted: ExtractedSkinProfile): boolean {
  const { missingRequired } = calculateOnboardingProgress(extracted)
  return missingRequired.length === 0
}

// ---------------------------------------------------------------------------
// Merge newly extracted data into existing profile data
// ---------------------------------------------------------------------------

export function mergeSkinProfileData(
  existing: ExtractedSkinProfile,
  incoming: ExtractedSkinProfile
): ExtractedSkinProfile {
  const merged = { ...existing }

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue

    const typedKey = key as keyof ExtractedSkinProfile

    if (Array.isArray(value)) {
      const existingArr = (merged[typedKey] as string[] | undefined) || []
      const mergedArr = [...new Set([...existingArr, ...value])]
      ;(merged as Record<string, unknown>)[typedKey] = mergedArr
    } else {
      ;(merged as Record<string, unknown>)[typedKey] = value
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Create or load onboarding progress from database
// ---------------------------------------------------------------------------

export async function getOrCreateOnboardingProgress(
  userId: string
): Promise<OnboardingProgress> {
  const db = getServiceClient()

  // Try to load existing
  const { data: existing } = await db
    .from('ss_onboarding_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existing) return existing as OnboardingProgress

  // Create a new onboarding conversation
  const { data: conv, error: convError } = await db
    .from('ss_yuri_conversations')
    .insert({
      user_id: userId,
      title: 'Skin Profile Onboarding',
      conversation_type: 'onboarding',
      message_count: 0,
    })
    .select('id')
    .single()

  if (convError) throw new Error(`Failed to create onboarding conversation: ${convError.message}`)

  // Create onboarding progress record
  const { data: progress, error: progressError } = await db
    .from('ss_onboarding_progress')
    .insert({
      user_id: userId,
      conversation_id: conv.id,
      onboarding_status: 'in_progress',
      skin_profile_data: {},
      extracted_fields: {},
      required_fields: [...REQUIRED_FIELDS],
      completion_percentage: 0,
    })
    .select('*')
    .single()

  if (progressError) throw new Error(`Failed to create onboarding progress: ${progressError.message}`)
  return progress as OnboardingProgress
}

// ---------------------------------------------------------------------------
// Update onboarding progress after extraction
// ---------------------------------------------------------------------------

export async function updateOnboardingProgress(
  userId: string,
  mergedProfile: ExtractedSkinProfile,
  capturedFields: Record<string, boolean>,
  percentage: number,
  isComplete: boolean
): Promise<void> {
  const db = getServiceClient()

  const updates: Record<string, unknown> = {
    skin_profile_data: mergedProfile,
    extracted_fields: capturedFields,
    completion_percentage: percentage,
    updated_at: new Date().toISOString(),
  }

  if (isComplete) {
    updates.onboarding_status = 'completed'
    updates.completed_at = new Date().toISOString()
  }

  await db
    .from('ss_onboarding_progress')
    .update(updates)
    .eq('user_id', userId)
}

// ---------------------------------------------------------------------------
// Convert extracted profile to a full ss_user_profiles record and save
// ---------------------------------------------------------------------------

export async function finalizeOnboardingProfile(
  userId: string,
  extracted: ExtractedSkinProfile
): Promise<void> {
  const db = getServiceClient()

  const profileData = {
    user_id: userId,
    skin_type: extracted.skin_type || 'normal',
    skin_concerns: extracted.skin_concerns || [],
    allergies: extracted.allergies || [],
    fitzpatrick_scale: extracted.fitzpatrick_scale || 3,
    climate: extracted.climate || 'temperate',
    age_range: extracted.age_range || '25-30',
    budget_range: extracted.budget_preference || 'mid',
    experience_level: extracted.experience_level || 'beginner',
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }

  await db
    .from('ss_user_profiles')
    .upsert(profileData, { onConflict: 'user_id' })

  // Mark onboarding as complete
  await db
    .from('ss_onboarding_progress')
    .update({
      onboarding_status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

// ---------------------------------------------------------------------------
// Skip onboarding with defaults
// ---------------------------------------------------------------------------

export async function skipOnboarding(userId: string): Promise<void> {
  const db = getServiceClient()

  // Create a minimal profile with defaults
  await db
    .from('ss_user_profiles')
    .upsert({
      user_id: userId,
      skin_type: 'normal',
      skin_concerns: [],
      allergies: [],
      fitzpatrick_scale: 3,
      climate: 'temperate',
      age_range: '25-30',
      budget_range: 'mid',
      experience_level: 'beginner',
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  // Mark onboarding as skipped
  await db
    .from('ss_onboarding_progress')
    .upsert({
      user_id: userId,
      onboarding_status: 'skipped',
      skin_profile_data: {},
      extracted_fields: {},
      required_fields: [...REQUIRED_FIELDS],
      completion_percentage: 0,
    }, { onConflict: 'user_id' })
}

// ---------------------------------------------------------------------------
// Stream Yuri's onboarding response via Claude Opus 4.6
// ---------------------------------------------------------------------------

export async function* streamOnboardingResponse(
  userId: string,
  conversationId: string,
  message: string,
  conversationHistory: YuriMessage[],
  currentProgress: OnboardingProgress
): AsyncGenerator<string, void, unknown> {
  const systemPrompt = buildOnboardingSystemPrompt(
    currentProgress.skin_profile_data as ExtractedSkinProfile,
    currentProgress.extracted_fields as Record<string, boolean>
  )

  // Build message history for Claude
  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
    conversationHistory.map((m) => ({ role: m.role, content: m.content }))

  apiMessages.push({ role: 'user', content: message })

  const client = getAnthropicClient()

  const stream = client.messages.stream({
    model: MODELS.primary,
    max_tokens: 600,
    system: systemPrompt,
    messages: apiMessages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}
