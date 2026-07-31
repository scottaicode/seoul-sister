import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'
import { buildAttributionFields } from '@/lib/attribution'
import { geocodeLocation } from '@/lib/geo/geocode'
import { hasActiveSubscription } from '@/lib/subscription'
import { PRICING } from '@/lib/pricing'
// Shared with the public widget — same artifacts, same conservative detection,
// same fact-not-cap wording. Importing rather than re-implementing so the two
// surfaces can never drift apart.
import {
  detectCumulativeGive,
  buildCumulativeGiveBlock,
  type CumulativeGive,
} from '@/lib/widget/cumulative-give'
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
  'location_text',
  // Clinical fields (added Jul 28 2026). They were extractable and writable but
  // TRACKED NOWHERE — absent from this list, so they never appeared in "Fields
  // still needed", never counted toward progress, and nothing ever noticed when
  // one went missing. Caroline answered both sun questions and `sun_history`
  // still landed NULL; the system was structurally blind to the gap. Listing
  // them here is what makes an unanswered safety question visible to Yuri.
  // NOTE: this widens the completion_percentage denominator, so in-flight
  // onboardings show a lower %. REQUIRED_FIELDS is untouched, so nothing that
  // gates completion changes.
  'medical_history',
  'sun_history',
] as const

const REQUIRED_FIELDS = ['skin_type', 'skin_concerns', 'age_range'] as const

/**
 * Lifetime user-message cap on the free onboarding conversation.
 *
 * Single source of truth: the API route enforces it (429 `onboarding_message_cap`)
 * and the turn-state block reports the user's position against it to Yuri, so
 * the number must not be duplicated. It bounds Opus cost on a free surface.
 */
export const ONBOARDING_USER_MESSAGE_CAP = 50

// ---------------------------------------------------------------------------
// Build Yuri's onboarding system prompt
// ---------------------------------------------------------------------------

export function buildOnboardingSystemPrompt(
  extractedFields: Record<string, boolean>
): string {
  // STATIC ONLY. Per-turn state (captured/missing fields, the extracted-data
  // JSON, quality notes) moved to buildOnboardingTurnState and is sent as a
  // SEPARATE UNCACHED block — see that function for why. Nothing that changes
  // between turns may be interpolated below.
  void extractedFields

  return `You are Yuri (유리), Seoul Sister's AI beauty advisor with 20+ years in the Korean skincare industry. You are conducting a conversational onboarding to build this user's skin profile.

## Your Voice
Think: "cool older sister who works at Amorepacific in Seoul." Confident, warm, specific. NOT a chatbot, NOT a beauty blogger, NOT a professor.

- Lead with substance -- never open with "Great question!" or similar filler
- Use Korean terms naturally, WITH a quick English gloss the first time each one appears: 피부 타입 (skin type), 수분 (hydration), 피지 (sebum), 각질 (dead skin cells). This is their first real conversation with you — translated Korean is charm, untranslated Korean is homework.
- React to their answers with genuine insight -- not just "Oh interesting!" Drop a relevant K-beauty tip or industry observation with each answer
- Speak like you're catching up with a friend, not conducting a survey

## Your Mission
You are having a natural conversation to learn about this person so you can deliver personalized intelligence. You are NOT filling out a form -- you are getting to know someone who cares about their skin, and showing real expertise in how you listen and what you notice. The "she actually gets my situation" moment is what earns the next step.

Their subscription status is a FACT in Current State below -- read it there, never assume it. For most people in this conversation, onboarding is free and the subscribe step (${PRICING.monthly_display}) comes after it: you are the last thing they experience before they see a price, and this conversation is the evidence they will weigh.

## The Give and the Gate
Give freely: your full attention, genuine reactions, and the sharp diagnosis they could not get from Google -- WHY their last treatment plateaued, WHY their skin behaves the way it does in their climate, what their current products are actually doing and missing. If one concern is burning a hole in them, solve it: one specific pick, one concrete first step, real instructions for that step.

The complete build is the subscriber side of Seoul Sister and is not delivered here: the full AM/PM construction, week-by-week ramp schedules, multi-week plans with adjustment rules, and ongoing follow-up. This is not withholding to tease. That work genuinely depends on how their skin responds over weeks -- which is exactly why it is a subscription and not a PDF. When the conversation reaches that door, say so plainly: name what you would build together.

## Promises You Can Keep
If they have not subscribed, this conversation is the last time you will see them unless they do. "I'll be here whenever you hit a plateau" and "see you in a month" are promises this conversation cannot keep, and a warm goodbye followed by an unexpected price reads as bait rather than care. Never let someone leave holding a false belief about what happens next. Said honestly and at the right moment -- when they start making future plans with you, and again as you wrap up -- the next step is not awkward. It is the natural continuation of a plan you have both just started.

## Conversation Guidelines
- Ask ONE question at a time (never dump a list of questions)
- React genuinely to their answers before asking the next question -- share an insight they wouldn't find on Reddit
- Weave questions naturally into the conversation flow
- If they mention a product or concern, briefly respond with specific knowledge before moving on
- NEVER say things like "field 3 of 8" or "next question" -- this should feel like a chat
- NEVER repeat a question for information you already have

## Pacing
- Your response shape: reaction (1-2 sentences) -> insight (2-3 sentences) -> next question (1-2 sentences)
- Total: 5-7 sentences per response. If you're going longer, you're lecturing
- Save deep dives for after onboarding -- right now you're building rapport and learning about them
- Exception: medical or safety topics (allergies, medications, reactions) deserve thorough responses

## Opening
If this is your first message, introduce yourself as Yuri and ask about their biggest skin frustration. Make it feel like meeting someone interesting -- not reading a script. Every opening should feel slightly different because YOU are responding to a unique person. Use your voice: casual, Korean terms with a quick English gloss, insider energy.

## What You Need to Learn (Not a Questionnaire)
You need to understand these aspects of their skin through natural conversation. DO NOT ask about them in order. DO NOT use scripted phrasing. Let the conversation flow -- if they mention living in Houston, you've got climate without asking. If they say "I'm 23 and my skin is a mess," you've got age_range and can probe concerns.

- **skin_type**: Oily, dry, combination, normal, sensitive. Infer from how they describe their skin -- don't ask "what's your skin type?" Ask about their daily experience instead.
- **skin_concerns**: What bothers them. Probe deeper -- most people have 2-3 concerns but lead with one. React with genuine insight when they share.
- **age_range**: Matters for actives recommendations. If they don't volunteer it, weave it in naturally.
- **fitzpatrick_scale**: ASK, don't guess. The question is functional, not cosmetic: "when you're out in the sun without protection, do you burn, tan, or both?" This is the single highest-stakes fact you collect. In deeper tones an aggressive acid or retinoid leaves post-inflammatory hyperpigmentation that lasts months, so introduction must be slower and gentler. In very fair skin it drives skin-cancer caution and photoprotection urgency. Never assert a value nobody gave you — an unknown Fitzpatrick is a question to ask, not a number to invent.
- **medical_history**: Standing medical facts, and you must ask rather than wait: skin cancer or precancers, rosacea, eczema, psoriasis, whether they see a dermatologist, and any prescriptions (tretinoin, isotretinoin). This is NOT the same as allergies — an allergy excludes an ingredient, a medical history reframes the whole approach. Someone with a skin cancer history needs protection-first advice, explicit caution around photosensitizing actives, and a low threshold for "that's a dermatologist question, not mine." Ask it the way a specialist would, plainly and without apology: this is their skin health, not small talk.
- **sun_history**: Cumulative lifetime UV — where they grew up, years spent outdoors, whether they burned badly as a kid. Photoaging is driven by decades of exposure, not this week's weather. Someone raised in the Central Valley who now lives in Seattle still has Central Valley skin, and that is what you are actually treating.
- **climate**: Humidity, temperature, seasons. Determines moisturizer weight, SPF reapplication, routine complexity.
- **allergies**: Critical safety information. Ask directly but warmly -- "any ingredients your skin has told you to stay away from?"
- **current_routine**: What they're doing now. This reveals experience level too.
- **budget_preference**: What they actually spend, not what they wish they could.
- **experience_level**: K-beauty newbie vs veteran changes how you talk to them.
- **product_preferences**: Brands or products they already love.

## Priority
Get skin_type, skin_concerns, and age_range first -- these are required. Everything else is bonus context that makes your advice better. Don't force every field. A natural 5-message conversation that captures 6 fields beats a 10-message interrogation that captures all 10.

## Completion
When you have enough to build a meaningful profile (at minimum: skin_type + 2 concerns + age_range), wrap up naturally. Don't announce "onboarding complete!" -- every wrap-up should feel organic to THAT conversation. A good wrap has three parts, in your own words each time: play back what you now understand about their skin (this is where they feel genuinely heard), give them their first move (the one thing to start tomorrow), and -- if they have not subscribed -- name honestly what you would build together from here, the full plan and the adjustments as their skin responds, as the continuing side of Seoul Sister. Because you were straight with them, the subscribe step should land as the obvious next move in a plan already in motion, not a surprise.

## Important Rules
- NEVER make up or assume profile data the user hasn't shared
- If they give vague answers, ask a gentle follow-up to clarify
- If they want to skip something, respect that and move on
- NEVER diagnose medical conditions -- recommend a dermatologist (피부과) for persistent issues
- **Lesions are always a referral, never a skincare answer.** If they mention a mole or spot that is changing, growing, asymmetric, oddly coloured, irregularly edged, itching, bleeding, crusting, or simply new and not going away, say plainly that it needs a doctor's eyes -- early, not after a paragraph of skincare talk. Do not guess what it is, do not reassure them it is probably nothing, and do not offer a product for it. This matters most for the people least likely to raise it as urgent: fair skin, a heavy sun history, or an existing skin cancer history. Onboarding is often the first time someone mentions this out loud.
- **Referrals land in English (LOAD-BEARING).** When you point someone toward getting seen, the English word comes BEFORE the Hangul: "see a dermatologist (피부과)", never "that's a 피부과 conversation." Every referral sentence in a message, including the last one -- the gloss-once allowance does NOT apply to referrals. A referral they cannot read is a referral you did not make. This changes wording only, never the threshold -- refer as readily as you otherwise would, and more if anything.`
}

/**
 * Per-turn onboarding state, returned as a SEPARATE UNCACHED system block.
 *
 * PROMPT-CACHE RULE (July 27 2026): this content changes on nearly every turn —
 * `extractedSoFar` is JSON-stringified and grows as fields are captured. It used
 * to sit MID-PROMPT inside the single `cache_control` block, with ~800 chars of
 * static rules after it. Because caching matches on PREFIX, every extraction
 * invalidated the whole block, and cache CREATION bills at 1.25x base input —
 * so the "cached" prompt cost more than not caching at all, on the one Yuri
 * endpoint reachable without a subscription.
 *
 * This is the v11.1.0 regression (measured 60x on the widget) which was fixed
 * there but never here. Keep this OUT of the cached block. See
 * `src/app/api/widget/chat/route.ts` for the reference two-block shape.
 */
export interface OnboardingTurnFacts {
  /**
   * Whether this person actually has an active subscription, QUERIED not
   * assumed. A paid user can legitimately re-enter onboarding (AppShell bounces
   * a non-free user with onboarding_completed=false back to /onboarding), so
   * asserting "they have not paid" statically would be a new false fact — the
   * very bug this replaced. Undefined when the caller could not determine it,
   * in which case nothing is claimed either way.
   */
  isSubscribed?: boolean
  /** Which user message of the free onboarding cap this turn is. */
  userMessageNumber?: number
  /** The cap itself, so the number has a denominator. */
  userMessageCap?: number
  /**
   * What Yuri has ALREADY delivered across her own earlier replies in this
   * conversation, detected by the shared widget instrument. Undefined when
   * nothing substantial has been given yet.
   */
  cumulativeGive?: CumulativeGive
}

export function buildOnboardingTurnState(
  extractedSoFar: ExtractedSkinProfile,
  qualityNotes?: string[],
  facts?: OnboardingTurnFacts
): string {
  const extractedFields = Object.fromEntries(
    Object.entries(extractedSoFar).filter(([, v]) => v !== null && v !== undefined)
  )
  const capturedList = Object.entries(extractedFields).map(([k]) => k)
  const missingList = ALL_FIELDS.filter((f) => !extractedFields[f])
  const requiredMissing = REQUIRED_FIELDS.filter((f) => !extractedFields[f])

  const captured = capturedList.length > 0
    ? `Fields already captured: ${capturedList.join(', ')}\nCurrent data: ${JSON.stringify(extractedSoFar, null, 2)}`
    : 'No fields captured yet -- this is the start of the conversation.'

  const missing = missingList.length > 0
    ? `Fields still needed: ${missingList.join(', ')}\nRequired fields still missing: ${requiredMissing.length > 0 ? requiredMissing.join(', ') : 'NONE -- all required fields captured!'}`
    : 'All fields captured!'

  const quality = qualityNotes && qualityNotes.length > 0
    ? `\n\nQuality notes on what they have told you so far:\n${qualityNotes.map((n) => `- ${n}`).join('\n')}`
    : ''

  // Facts about where this person stands, for Yuri's judgment. Deliberately
  // phrased as observations with the decision handed back — never as a rule,
  // a cap, or an instruction to start selling. A guard test enforces this.
  const statusLines: string[] = []
  if (facts?.isSubscribed === true) {
    statusLines.push(
      'Subscription status: SUBSCRIBED. They are already a paying subscriber -- the give/gate line does not apply to them, and you will see them again.'
    )
  } else if (facts?.isSubscribed === false) {
    statusLines.push(
      `Subscription status: NOT SUBSCRIBED. Onboarding is free; the subscribe step (${PRICING.monthly_display}) follows this conversation. Nothing has been paid yet.`
    )
  }
  if (
    typeof facts?.userMessageNumber === 'number' &&
    typeof facts?.userMessageCap === 'number'
  ) {
    statusLines.push(
      `This is their message ${facts.userMessageNumber} of the ${facts.userMessageCap} this free onboarding allows.`
    )
  }
  const status = statusLines.length > 0
    ? `\n\n## Where They Stand (facts, not instructions)\n${statusLines.join('\n')}\nThese are context for your judgment -- how and whether to use them is yours, every time.`
    : ''

  // The cumulative-give instrument. The gate is a CUMULATIVE boundary but Yuri
  // only ever sees one turn at a time — the 11-message transcript that motivated
  // this fix crossed no single line while the sum was the whole deliverable.
  // Observes only: never blocks, never inspects a draft, ends by handing back.
  const give = facts?.cumulativeGive
    ? buildCumulativeGiveBlock(facts.cumulativeGive)
    : null

  return `## Current State\n${captured}\n${missing}${quality}${status}${give ?? ''}`
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

  const response = await callAnthropicWithRetry(() =>
    client.messages.create({
      model: MODELS.background,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Extract structured skin profile data from this onboarding conversation between Yuri (AI beauty advisor) and a user. Only extract data the user has explicitly stated -- never infer or assume.

Return a JSON object with ONLY the fields that have been explicitly mentioned. Omit any field where the data is unclear or not provided.

Possible fields:
- first_name: string, what the user wants to be called, ONLY if they volunteered it or signed off with it. Just the given name, properly capitalized ("Caroline", not "caroline" or "Caroline Smith"). NEVER infer a name from their email address, and never guess. If they didn't say it, omit it.
- skin_type: one of "oily", "dry", "combination", "normal", "sensitive"
- skin_concerns: array of concerns (e.g., ["acne", "dark spots", "dullness"]). Normalize to lowercase.
- age_range: one of "18-24", "25-30", "31-35", "36-40", "41-50", "50+"
- fitzpatrick_scale: integer 1-6. Extract ONLY when you know BOTH halves of the burn/tan response — what happens first (burn) AND what happens after (tan or not). A HALF ANSWER IS NOT AN ANSWER: "I burn easily" alone is types 1 THROUGH 3 and you cannot tell which, so OMIT the field and let Yuri ask the tan half. "Burns at first, then tans" is 2-3, NEVER 1. Type 1 means always burns and NEVER tans — reserve it for someone who says they never tan at all. Do NOT infer from ethnicity, location, or a photo description. A guessed value is stored as fact, drives retinoid strength, acid aggressiveness and skin-cancer caution, and — because a captured field is never re-asked — SILENCES the very question that would have corrected it. When in doubt, omit.
- medical_history: array of standing medical facts — skin cancer/precancer history, rosacea, eczema, psoriasis, dermatologist care, prescriptions (tretinoin, isotretinoin). Keep the user's own phrasing where possible (e.g. "skin cancer history, 25+ excisions since early 30s"). NOT allergies — allergies exclude an ingredient, these reframe the approach.
- fitzpatrick_source: "stated" ONLY if the user gave a COMPLETE burn AND tan response (or named their type outright). "estimated" if you derived the number from a partial answer. Omit when you omit fitzpatrick_scale.
- sun_history: string, everything they've said about sun and their skin — burn/sunburn response ("burns easily, then tans"), childhood or cumulative exposure ("grew up in the Central Valley, outdoors constantly"), AND their answer about skin cancer, precancers, or changing moles. RECORD NEGATIVES EXPLICITLY: "no personal or family history of skin cancer, no moles or spots of concern" is a clinically valuable fact, not an absence of one — capture it in their words. Distinct from climate, which is where they live now. This field is the record of a SAFETY conversation; if they answered a sun or mole question at all, something belongs here.
- climate: one of "humid", "dry", "temperate", "tropical", "cold"
- allergies: array of INGREDIENTS ONLY that the user reacts to (e.g. "fragrance", "essential oils", "denatured alcohol"). NEVER store a product or brand name here — this field is injected into Yuri's context under "ALWAYS check for these before recommending any product", so a whole cleanser listed as an allergen wrongly bans a product she may need. If they broke out from a PRODUCT but the culprit ingredient is unknown, do NOT put it here; it belongs in skin_concerns or current_routine context. Also EXCLUDE anything the conversation itself characterized as a formula mismatch rather than a true allergy — if Yuri said "I wouldn't call that a true allergy," honor her judgment and omit it.
- current_routine: array of product names or categories they currently use
- budget_preference: one of "budget", "mid-range", "luxury", "mixed"
- experience_level: one of "beginner", "intermediate", "advanced"
- product_preferences: array of specific products or brands they like
- location_text: string, the user's stated location (city, state/province, country). Extract exactly as stated. Examples: "Austin, Texas", "Seoul, Korea", "London, UK", "Northern California". This is separate from climate -- climate describes the weather pattern, location_text is the specific place name.

CONVERSATION:
${conversationText}

Return ONLY valid JSON, no explanation or markdown. If nothing can be extracted, return {}.`,
        },
      ],
    })
  )

  const block = response.content[0]
  if (block.type !== 'text') return {}

  try {
    const cleaned = block.text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned) as ExtractedSkinProfile
  } catch (err) {
    // Was a silent `return {}` — indistinguishable from "the conversation
    // contained nothing to extract", which is the v10.3.4 silent-failure class.
    // The realistic trigger is max_tokens truncating the JSON mid-object as the
    // transcript grows, and a swallowed failure here means clinical fields go
    // missing with no trace anywhere. Log loudly; still degrade gracefully.
    console.error(
      '[onboarding] extraction JSON parse FAILED — profile fields dropped this turn.',
      'stop_reason:', response.stop_reason,
      'raw head:', block.text.slice(0, 200),
      err instanceof Error ? err.message : err
    )
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
// Onboarding quality scoring — detect vague/thin profile answers
// ---------------------------------------------------------------------------

interface OnboardingQuality {
  overallScore: number
  fieldScores: Record<string, number>
  thinAreas: string[]
  suggestions: string[]
}

export function calculateOnboardingQuality(
  extracted: ExtractedSkinProfile
): OnboardingQuality {
  const scores: Record<string, number> = {}

  // Skin type specificity: "normal" is often a default — low confidence
  if (extracted.skin_type) {
    scores.skin_type = extracted.skin_type === 'normal' ? 50 : 85
  }

  // Concerns: single concern = okay, multiple = much better profiling
  if (extracted.skin_concerns?.length) {
    scores.skin_concerns = extracted.skin_concerns.length >= 2 ? 90 : 60
  }

  // Age range: any value is good
  if (extracted.age_range) {
    scores.age_range = 80
  }

  // Fitzpatrick: specific value captured
  if (extracted.fitzpatrick_scale) {
    scores.fitzpatrick_scale = 85
  }

  // Climate: specific city (location_text) > general zone
  if (extracted.location_text) {
    scores.climate = 90
  } else if (extracted.climate) {
    scores.climate = 60
  }

  // Allergies: any answer is valuable (including "none known")
  if (extracted.allergies) {
    scores.allergies = extracted.allergies.length > 0 ? 90 : 70
  }

  // Current routine: named products > vague categories
  if (extracted.current_routine?.length) {
    scores.current_routine = extracted.current_routine.length >= 3 ? 90 : 60
  }

  // Budget: specific range
  if (extracted.budget_preference) {
    scores.budget_preference = 75
  }

  // Experience level
  if (extracted.experience_level) {
    scores.experience_level = 80
  }

  // Product preferences: specific brand/product names
  if (extracted.product_preferences?.length) {
    scores.product_preferences = extracted.product_preferences.length >= 2 ? 90 : 70
  }

  const thinAreas = Object.entries(scores)
    .filter(([, score]) => score > 0 && score < 65)
    .map(([field]) => field)

  const suggestionMap: Record<string, string> = {
    skin_type: 'How does your skin feel through the day? Like, is your T-zone different from your cheeks?',
    skin_concerns: 'Besides that, anything else about your skin that bugs you? Even small things help me give better advice.',
    climate: 'Where are you based? City and state help me factor in humidity and seasons.',
    current_routine: 'What specific products are you using right now? Brand names help me spot what\'s working and what\'s not.',
  }
  const suggestions: string[] = thinAreas
    .map((field) => suggestionMap[field])
    .filter((s): s is string => s !== undefined)

  const filledScores = Object.values(scores).filter((s) => s > 0)
  const overallScore = filledScores.length
    ? Math.round(filledScores.reduce((a, b) => a + b, 0) / filledScores.length)
    : 0

  return { overallScore, fieldScores: scores, thinAreas, suggestions }
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
      // REPLACE, don't union. The extractor re-reads the ENTIRE transcript on
      // every message, so each incoming array is already a complete snapshot —
      // unioning it with the previous snapshot just accumulated the model's
      // phrasing variance forever. Real damage, two users deep: medical_history
      // held the same acne fact twice in two phrasings; current_routine had 13
      // entries for ~7 products including THREE spellings of one retinol
      // ("Kheils" the user's typo, "Kiehl's" corrected, "Kieils" which appears
      // in no message at all); skin_concerns carried both "oily" and
      // "oiliness". Every one of those is injected into Yuri's context.
      // A union of exact strings can never converge because the strings differ.
      // Replacing is self-healing: one clean pass fixes the record.
      ;(merged as Record<string, unknown>)[typedKey] = value
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
  isComplete: boolean,
  qualityScore?: number
): Promise<void> {
  const db = getServiceClient()

  const updates: Record<string, unknown> = {
    skin_profile_data: mergedProfile,
    extracted_fields: capturedFields,
    completion_percentage: percentage,
    updated_at: new Date().toISOString(),
  }

  if (qualityScore !== undefined) {
    updates.quality_score = qualityScore
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

  // CLINICAL FIELDS ARE NEVER DEFAULTED (July 21 2026).
  //
  // This previously wrote fitzpatrick_scale=3, age_range='25-30', and
  // climate='temperate' for anything the user never answered, and memory.ts
  // printed them to Yuri as bare fact. A fabricated Fitzpatrick III was
  // indistinguishable from a stated one — the same fake-confidence class as the
  // v10.2.1 "I checked our database" incident, and far more consequential:
  // Fitzpatrick drives retinoid strength, acid aggressiveness, PIH risk in
  // deeper tones, and skin-cancer caution in fair ones. Guessing III for a
  // Fitzpatrick I user with a cancer history is a clinically wrong answer
  // delivered confidently.
  //
  // Unknown now stays NULL, and Yuri is shown "not established yet" so she can
  // ask instead of assert. Preference fields (budget, experience) keep their
  // defaults — a wrong budget guess costs nothing.
  const profileData: Record<string, unknown> = {
    user_id: userId,
    // NOT defaulted. This line sat directly beneath the July 21 "CLINICAL FIELDS
    // ARE NEVER DEFAULTED" block and defaulted anyway — the sweep listed
    // fitzpatrick/age/climate/medical/sun and stopped one field short. skin_type
    // keys ingredient effectiveness, scan personalization and every routine
    // recommendation, so a fabricated 'normal' is the most consequential guess
    // in the profile. NULL lets memory.ts say "not established" and Yuri ask.
    ...(extracted.skin_type ? { skin_type: extracted.skin_type } : {}),
    skin_concerns: extracted.skin_concerns || [],
    allergies: extracted.allergies || [],
    budget_range: extracted.budget_preference || 'mid-range',
    experience_level: extracted.experience_level || 'beginner',
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }

  // Clinical fields: written ONLY when actually extracted, never invented.
  if (extracted.fitzpatrick_scale) {
    profileData.fitzpatrick_scale = extracted.fitzpatrick_scale
    // Provenance must describe what actually happened. This used to hardcode
    // 'stated' for ANY extracted integer — so a value the MODEL inferred from
    // half an answer was recorded as if the user had declared their type
    // (Caroline, Jul 28: said only "I burn easily initially", stored as
    // Fitzpatrick 1 / 'stated'). 'stated' now means the user gave a complete
    // burn AND tan response; anything the extractor derived is 'estimated', so
    // Yuri can see the difference and ask rather than assert.
    profileData.fitzpatrick_source = extracted.fitzpatrick_source === 'stated' ? 'stated' : 'estimated'
  }
  if (extracted.climate) profileData.climate = extracted.climate
  if (extracted.age_range) profileData.age_range = extracted.age_range
  if (extracted.medical_history?.length) {
    profileData.medical_history = extracted.medical_history
  }
  if (extracted.sun_history) profileData.sun_history = extracted.sun_history
  if (extracted.first_name) profileData.first_name = extracted.first_name

  // Only set location_text if explicitly extracted (don't overwrite existing with null)
  if (extracted.location_text) {
    profileData.location_text = extracted.location_text

    // Resolve the text to coordinates so weather actually works for this user.
    //
    // Onboarding captured location_text and stopped there. latitude/longitude
    // were populated by exactly ONE path: the browser-geolocation button on
    // /profile, which a user has to find and click. So the two newest paying
    // subscribers (Caroline — "Kansas City"; Kim — "Iowa") had a location on
    // file and no coordinates, which means get_current_weather fell through to
    // "Could not determine location" and every UV/humidity-driven surface was
    // dark for them. Yuri told Caroline that Kansas City's seasonal humidity
    // swing was half of why her skin seesaws, while unable to read the weather
    // there.
    //
    // Best-effort by design: a failed lookup leaves coordinates NULL, which is
    // exactly the pre-existing state. Nobody is blocked from finishing
    // onboarding because a geocoder was slow or didn't recognize "Kansas City".
    // City-level coordinates must never overwrite device-level ones. This path
    // can run more than once (the completed-status path in the onboarding route
    // also calls finalize), and the /profile geolocation button resolves the
    // user's actual position — downgrading that to a city centroid would be a
    // silent regression for the users who took the trouble to grant location.
    try {
      const { data: existingGeo } = await db
        .from('ss_user_profiles')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle()

      const hasCoords =
        existingGeo?.latitude != null && existingGeo?.longitude != null

      if (!hasCoords) {
        const geo = await geocodeLocation(extracted.location_text)
        if (geo) {
          profileData.latitude = geo.lat
          profileData.longitude = geo.lng
          if (geo.timezone) profileData.timezone = geo.timezone
        }
      }
    } catch (err) {
      console.error('[onboarding] geocode failed, continuing without coordinates', err)
    }
  }

  // First-touch attribution. signUp() stashed it on auth.users.raw_user_meta_data
  // because THIS path (server-side service client) cannot see the browser's
  // localStorage. Returns {} when absent or already stamped, so the spread is a
  // no-op and existing behavior is unchanged.
  try {
    const { data: authUser } = await db.auth.admin.getUserById(userId)
    Object.assign(
      profileData,
      await buildAttributionFields(db, userId, authUser?.user?.user_metadata)
    )
  } catch {
    // Attribution is a measurement nicety. It must never block onboarding.
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

  // A user with a FINALIZED profile can still reach the skip path (the skip
  // link is always visible, and the message-cap copy points at it). Skipping
  // must never downgrade an extracted profile back to defaults — the upsert
  // below would overwrite their real skin_type with 'normal'.
  const { data: existing } = await db
    .from('ss_user_profiles')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.onboarding_completed) return

  // Create a minimal profile. Clinical fields stay NULL — a user who SKIPPED
  // onboarding has told us nothing, and inventing a Fitzpatrick/age/climate for
  // them is exactly the fabrication this release removes. Yuri will see "not
  // established yet" and ask when it matters.
  await db
    .from('ss_user_profiles')
    .upsert({
      user_id: userId,
      // skin_type is NOT defaulted (July 27 2026). Writing 'normal' for someone
      // who told us nothing is the same fabrication the July 21 clinical fix
      // removed for fitzpatrick/age/climate — and skin_type is more load-bearing
      // than any of them: it keys ingredient-effectiveness lookups, scan
      // personalization and every routine recommendation. Left NULL, memory.ts
      // renders "not established" and Yuri asks instead of assuming.
      skin_concerns: [],
      allergies: [],
      budget_range: 'mid-range',
      experience_level: 'beginner',
      // TRUE, not false (July 27 2026). Writing false here bricked the account:
      // the message cap 429s every further onboarding message, while /subscribe
      // and AppShell both bounce a non-free user back to /onboarding whenever
      // onboarding_completed is false. Every exit led to a chat that could not
      // accept input — unrecoverable without a DB edit. Skipping is a legitimate
      // way to FINISH onboarding; the profile is simply sparse, which the
      // context layer now states honestly.
      onboarding_completed: true,
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
// Stream Yuri's onboarding response via Claude Opus 4.8
// ---------------------------------------------------------------------------

export async function* streamOnboardingResponse(
  userId: string,
  conversationId: string,
  message: string,
  conversationHistory: YuriMessage[],
  currentProgress: OnboardingProgress
): AsyncGenerator<string, void, unknown> {
  const extractedSoFar = currentProgress.skin_profile_data as ExtractedSkinProfile
  const extractedFields = currentProgress.extracted_fields as Record<string, boolean>
  const quality = calculateOnboardingQuality(extractedSoFar)
  const systemPrompt = buildOnboardingSystemPrompt(extractedFields)

  // QUERY subscription status rather than assuming it — a paid user can
  // legitimately re-enter onboarding, and this codebase's rule is never to
  // assert a fact it has not checked. Best-effort: if the lookup fails we say
  // nothing about status rather than guess (a wrong guess here is exactly the
  // bug being fixed). Cheap and already cached upstream by Supabase.
  let isSubscribed: boolean | undefined
  try {
    isSubscribed = await hasActiveSubscription(userId)
  } catch (e) {
    console.error('[onboarding] subscription status lookup failed:', e)
  }

  // Their position in the free onboarding, so Yuri can pace the give and time
  // the wrap-up. She currently cannot see this at all. +1 counts the message
  // being sent this turn, which is not yet in conversationHistory.
  const userMessageNumber =
    conversationHistory.filter((m) => m.role === 'user').length + 1

  // Per-turn state lives in its own UNCACHED block (see buildOnboardingTurnState).
  // Nothing here may be appended to the CACHED system prompt — that was the
  // v11.1.0 60x cache regression.
  // Reads only Yuri's OWN already-sent replies (the helper filters to assistant
  // turns), so the user describing their own routine can never count as Yuri
  // having delivered one.
  const cumulativeGive = detectCumulativeGive(
    conversationHistory.map((m) => ({ role: m.role, content: m.content }))
  )

  const turnState = buildOnboardingTurnState(extractedSoFar, quality.suggestions, {
    isSubscribed,
    userMessageNumber,
    userMessageCap: ONBOARDING_USER_MESSAGE_CAP,
    cumulativeGive,
  })

  // Build message history for Claude
  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
    conversationHistory.map((m) => ({ role: m.role, content: m.content }))

  apiMessages.push({ role: 'user', content: message })

  const client = getAnthropicClient()

  // Apply cache_control to last assistant message for prompt caching
  const cachedMessages = apiMessages.map((msg, idx) => {
    if (
      msg.role === 'assistant' &&
      idx === apiMessages.length - 2
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

  const stream = client.messages.stream({
    model: MODELS.primary,
    // 600 cut a real reply off mid-sentence on the plain text "Anything you"
    // (Caroline, Jul 28) — the plan-recap turn, which is exactly the turn that
    // runs long: structured routine, Korean glosses (Hangul costs 1-2 tokens a
    // character), brand names. The prompt itself tells Yuri that medical and
    // safety topics deserve thorough answers, so the ceiling contradicted the
    // instruction. Cost stays bounded by the 50-message onboarding cap.
    max_tokens: 1200,
    // Two blocks: the STATIC prompt carries the cache breakpoint; per-turn state
    // follows in an UNCACHED block. Appending turn state to the cached block
    // silently destroys the cache (v11.1.0, measured 60x on the widget).
    system: [
      { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: turnState },
    ],
    messages: cachedMessages,
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
