import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Extract anonymized learning patterns from reviews and conversations
// Uses Sonnet 4.5 (background model) for extraction -- cheap + fast
// ---------------------------------------------------------------------------

interface ExtractedPattern {
  pattern_type: string
  skin_type: string | null
  concern: string | null
  description: string
  data: Record<string, unknown>
  confidence: number
}

/**
 * Extract learning patterns from a review.
 * Called by the aggregate-learning cron job for unprocessed reviews.
 */
export async function extractPatternsFromReview(review: {
  id: string
  product_id: string
  rating: number
  body: string
  skin_type: string | null
  skin_concerns: string[]
  reaction: string | null
  usage_duration: string | null
}): Promise<ExtractedPattern[]> {
  const client = getAnthropicClient()

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract anonymized learning patterns from this K-beauty product review. Only extract patterns that have clear signals -- do not infer beyond what's stated.

Review data:
- Rating: ${review.rating}/5
- Skin type: ${review.skin_type || 'not specified'}
- Concerns: ${review.skin_concerns.join(', ') || 'not specified'}
- Reaction: ${review.reaction || 'none'}
- Usage duration: ${review.usage_duration || 'not specified'}
- Review text: "${review.body.slice(0, 500)}"

Return a JSON array of patterns. Each pattern:
{
  "pattern_type": "ingredient_effectiveness" | "routine_success" | "skin_type_correlation",
  "skin_type": string | null,
  "concern": string | null,
  "description": "Brief anonymized description",
  "data": { "product_id": "${review.product_id}", "rating": ${review.rating}, "reaction": "${review.reaction || 'none'}", ...any extracted signals },
  "confidence": 0.0-1.0 (how confident this pattern is)
}

Return ONLY valid JSON array. If no patterns can be extracted, return [].`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') return []

  try {
    const text = block.text.trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as ExtractedPattern[]
  } catch {
    return []
  }
}

/**
 * Extract learning patterns from a Yuri conversation.
 * Called by the aggregate-learning cron job for unprocessed conversations.
 */
export async function extractPatternsFromConversation(conversation: {
  id: string
  specialist_type: string | null
  messages: Array<{ role: string; content: string }>
  user_skin_type: string | null
  user_concerns: string[]
}): Promise<ExtractedPattern[]> {
  if (conversation.messages.length < 2) return []

  const client = getAnthropicClient()

  // Limit message context to last 10 messages to control token cost
  const recentMessages = conversation.messages.slice(-10)
  const transcript = recentMessages
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join('\n')

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract anonymized learning patterns from this K-beauty advisor conversation. Focus on user-reported outcomes, preferences, and reactions. Do NOT include any personally identifying information.

Specialist: ${conversation.specialist_type || 'general'}
User skin type: ${conversation.user_skin_type || 'unknown'}
User concerns: ${conversation.user_concerns.join(', ') || 'unknown'}

Conversation transcript (recent):
${transcript}

Return a JSON array of patterns. Each pattern:
{
  "pattern_type": "ingredient_effectiveness" | "routine_success" | "skin_type_correlation" | "counterfeit_signal",
  "skin_type": string | null,
  "concern": string | null,
  "description": "Brief anonymized description",
  "data": { ...extracted signals },
  "confidence": 0.0-1.0
}

Return ONLY valid JSON array. If no patterns can be extracted, return [].`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') return []

  try {
    const text = block.text.trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as ExtractedPattern[]
  } catch {
    return []
  }
}

/**
 * Store extracted patterns in the database and mark source as processed.
 */
export async function storeLearningPatterns(
  patterns: ExtractedPattern[],
  source: { type: 'review' | 'conversation'; id: string }
): Promise<number> {
  if (patterns.length === 0) return 0

  const db = getServiceClient()
  let stored = 0

  for (const pattern of patterns) {
    // Skip low-confidence patterns
    if (pattern.confidence < 0.3) continue

    const { error } = await db.from('ss_learning_patterns').insert({
      pattern_type: pattern.pattern_type,
      skin_type: pattern.skin_type,
      skin_concerns: pattern.concern ? [pattern.concern] : [],
      concern_filter: pattern.concern,
      pattern_description: pattern.description,
      data: {
        ...pattern.data,
        source_type: source.type,
        source_id: source.id,
      },
      confidence_score: pattern.confidence,
      sample_size: 1,
    })

    if (!error) stored++
  }

  // Mark source as learning-contributed
  const table =
    source.type === 'review' ? 'ss_reviews' : 'ss_yuri_conversations'
  await db
    .from(table)
    .update({ learning_contributed: true })
    .eq('id', source.id)

  return stored
}
