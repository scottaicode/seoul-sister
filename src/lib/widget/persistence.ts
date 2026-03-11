/**
 * Message persistence and cross-session AI memory.
 * Every message stored. Tool calls logged as JSONB.
 * Memory generated via Sonnet (fire-and-forget).
 */

import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'

export interface ToolCallLog {
  name: string
  input: Record<string, unknown>
  result_summary: string
}

/**
 * Save a user message to the database.
 */
export async function saveUserMessage(
  sessionId: string,
  visitorId: string,
  content: string,
  specialistDetected: string | null,
  intentSignals: string[]
): Promise<string> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('ss_widget_messages')
    .insert({
      session_id: sessionId,
      visitor_id: visitorId,
      role: 'user',
      content,
      specialist_detected: specialistDetected,
      intent_signals: intentSignals,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[widget/persistence] Failed to save user message:', error?.message)
    return ''
  }

  return data.id
}

/**
 * Save an assistant message with tool call logs.
 */
export async function saveAssistantMessage(
  sessionId: string,
  visitorId: string,
  content: string,
  toolCalls: ToolCallLog[],
  tokensUsed: number | null
): Promise<string> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('ss_widget_messages')
    .insert({
      session_id: sessionId,
      visitor_id: visitorId,
      role: 'assistant',
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
      tokens_used: tokensUsed,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[widget/persistence] Failed to save assistant message:', error?.message)
    return ''
  }

  return data.id
}

/**
 * Truncate tool result for storage. Keep first 200 chars.
 */
export function truncateToolResult(result: string, maxLength = 200): string {
  if (result.length <= maxLength) return result
  return result.slice(0, maxLength) + '...'
}

/**
 * Load previous conversation context for a returning visitor.
 * Returns a prompt injection string for the system prompt, or null for new visitors.
 */
export async function getPreviousConversationContext(
  visitorId: string,
  aiMemory: Record<string, unknown> | null
): Promise<string | null> {
  if (!aiMemory || Object.keys(aiMemory).length === 0) return null

  const summary = aiMemory.summary as string | undefined
  if (!summary) return null

  const topics = (aiMemory.topics_discussed as string[]) || []
  const concerns = (aiMemory.skin_concerns as string[]) || []
  const products = (aiMemory.products_interested_in as string[]) || []
  const interestLevel = (aiMemory.interest_level as string) || 'browsing'
  const approach = (aiMemory.recommended_approach as string) || ''

  let context = `\n\n## Returning Visitor Context
This visitor has chatted with you before. Here's what you know about them:
- Summary: ${summary}`

  if (topics.length > 0) context += `\n- Topics discussed: ${topics.join(', ')}`
  if (concerns.length > 0) context += `\n- Skin concerns: ${concerns.join(', ')}`
  if (products.length > 0) context += `\n- Products interested in: ${products.join(', ')}`
  context += `\n- Interest level: ${interestLevel}`
  if (approach) context += `\n- Recommended approach: ${approach}`

  context += `\n\nUse this context naturally. Don't say "I remember you" explicitly — just demonstrate knowledge. If they asked about vitamin C serums last time, naturally reference that when relevant.`

  return context
}

/**
 * Generate and save AI memory for a visitor. Fire-and-forget.
 * Merges existing memory with current session messages.
 * Triggered every 3rd message in a session.
 */
export async function generateAndSaveMemory(
  visitorId: string,
  sessionMessages: Array<{ role: string; content: string }>
): Promise<void> {
  try {
    const supabase = getServiceClient()

    // Load existing memory
    const { data: visitor } = await supabase
      .from('ss_widget_visitors')
      .select('ai_memory')
      .eq('visitor_id', visitorId)
      .single()

    const existingMemory = (visitor?.ai_memory as Record<string, unknown>) || {}

    const anthropic = getAnthropicClient()

    const conversationText = sessionMessages
      .map(m => `${m.role === 'user' ? 'Visitor' : 'Yuri'}: ${m.content.slice(0, 500)}`)
      .join('\n')

    const existingContext = Object.keys(existingMemory).length > 0
      ? `\n\nPrevious memory about this visitor:\n${JSON.stringify(existingMemory, null, 2)}`
      : ''

    const response = await anthropic.messages.create({
      model: MODELS.background,
      max_tokens: 400,
      system: `You are a memory extraction system for a K-beauty AI advisor. Given conversation messages and any previous memory, generate an updated memory profile for this anonymous visitor. Return ONLY valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Extract and merge a memory profile from this conversation.${existingContext}

Current conversation:
${conversationText}

Return JSON with these fields:
{
  "summary": "2-3 sentence overview of ALL conversations with this visitor",
  "topics_discussed": ["array of topics across all sessions"],
  "skin_concerns": ["extracted skin concerns like acne, dryness, sensitivity"],
  "products_interested_in": ["products they asked about or showed interest in"],
  "interest_level": "browsing | curious | engaged | ready_to_buy",
  "recommended_approach": "how Yuri should approach this visitor next time"
}`,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const memory = JSON.parse(jsonMatch[0])

    await supabase
      .from('ss_widget_visitors')
      .update({ ai_memory: memory })
      .eq('visitor_id', visitorId)
  } catch (err) {
    console.error('[widget/persistence] Memory generation failed:', err)
    // Non-critical — never break the conversation
  }
}
