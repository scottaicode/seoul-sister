/**
 * Message persistence and cross-session AI memory.
 * Every message stored. Tool calls logged as JSONB.
 * Memory generated via Sonnet (fire-and-forget).
 */

import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'

export interface ToolCallLog {
  name: string
  input: Record<string, unknown>
  result_summary: string
  /**
   * Product names this call returned, captured BEFORE `truncateToolResult`.
   *
   * Why it cannot be re-derived from `result_summary`: that field is capped at
   * 200 chars, and a stored row's UUID plus description always exhaust the
   * budget inside the FIRST product. Measured across all 188 search_products
   * calls ever stored: 172 retain exactly one name, 16 retain none, and ZERO
   * retain two. Parsing the stored summary would therefore render a 10-row
   * result identically to a 1-row result — the same "cannot tell nothing-found
   * from found-plenty" bug this record exists to close, one level down. Worse
   * for the live case: "House of Hur sunscreen" would show only the Matcha
   * moisturizer while the catalog carries four House of Hur sunscreens,
   * nudging Yuri toward "we don't carry it" — which is false.
   */
  result_names?: string[]
  /** How many products the call actually returned, before any capping. */
  result_count?: number
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
 * Load the saved transcript for a session, oldest first.
 *
 * Why this exists: the widget client keeps chat history in React state only,
 * while the session id lives in sessionStorage — a same-tab navigation or
 * reload wipes the visible history but keeps the session. Before this loader,
 * the server trusted the (now empty) client history and Yuri greeted a
 * mid-conversation visitor with "this might be our first exchange" — a real
 * one-message-death cause in the July 12 funnel audit. The DB has the full
 * transcript all along; this recovers it.
 */
export async function getSessionTranscript(
  sessionId: string,
  limit = 40
): Promise<
  Array<{
    role: 'user' | 'assistant'
    content: string
    toolCalls: number
    searches: Array<{ query: string; found: string[] }>
  }>
> {
  const supabase = getServiceClient()

  // tool_calls is selected because the grounding instrument needs it and the
  // CLIENT-sent history carries no tool data at all — the database is the only
  // place that knows whether a reply was backed by a search.
  const { data, error } = await supabase
    .from('ss_widget_messages')
    .select('role, content, tool_calls')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) {
    console.error('[widget/persistence] Failed to load session transcript:', error?.message)
    return []
  }

  return (data as Array<{ role: 'user' | 'assistant'; content: string; tool_calls: unknown }>).map(
    (m) => ({
      role: m.role,
      content: m.content,
      toolCalls: Array.isArray(m.tool_calls) ? m.tool_calls.length : 0,
      searches: extractSearches(m.tool_calls),
    })
  )
}

/**
 * What each product search THIS transcript ran actually asked for, and which
 * products came back.
 *
 * Why this is separate from `toolCalls`. The count answers "did a search run",
 * which the grounding instrument treats as the difference between grounded and
 * ungrounded. It cannot answer "did the search find the product she named" —
 * and those are different questions with the same fingerprint. Measured across
 * every brand-naming search ever issued (24 distinct queries, re-run through
 * the live resolver Aug 26 2026): 7 returned something other than the product
 * asked for, and 5 of those 7 returned the RIGHT BRAND with the wrong product
 * — "House of Hur sunscreen" -> Phyto Brew Matcha Cream, "Mixsoon Bifida
 * Cream" -> Master Gentle Foam Cleanser, "Some By Mi tea tree toner" ->
 * Retinol Bakuchiol Dual Cream. A right-brand row reads as confirmation, which
 * is exactly why a brand-level check misses the more dangerous half.
 *
 * WITHIN a turn Yuri sees the full tool output — it is pushed into
 * loopMessages, untruncated. The gap is ACROSS turns: the next request rebuilds
 * the conversation from `history` (text only) plus a count, so by turn N+1 a
 * search that missed and a search that hit are indistinguishable to her. This
 * carries the names forward so they are not.
 *
 * Names only, never a verdict. Deciding whether "Phyto Brew Matcha Cream"
 * answers "House of Hur sunscreen" is a judgment about the visitor's actual
 * question, and per the Yuri Sole Authority Principle that judgment is hers.
 * A classifier here would also have to be market-neutral, and this repo has
 * twice discarded one that needed hand-tuning.
 *
 * Reads `result_names`, captured at call time from the FULL result. It does NOT
 * parse the stored `result_summary`: that field is capped at 200 chars and a
 * row's UUID plus description always exhaust the budget inside the first
 * product. Measured across all 188 stored search_products calls — 172 retain
 * exactly one name, 16 retain none, ZERO retain two — so parsing it would make
 * a 10-row result render identically to a 1-row result, reintroducing the very
 * indistinguishability this record closes. `total` therefore carries the real
 * count, and the rendered line says so when names are missing.
 */
export function parseResultNames(result: string): { names: string[]; count: number } {
  // Parses the FULL tool result, before truncation. JSON.parse rather than a
  // regex: the payload is well-formed here (it is only truncated later), and a
  // regex over the whole document would also match the `name` key inside each
  // product's `key_ingredients`, extracting "Water" and "Niacinamide" as if
  // they were returned products.
  try {
    const parsed = JSON.parse(result) as { products?: Array<{ name?: unknown }> }
    if (!Array.isArray(parsed?.products)) return { names: [], count: 0 }
    const names = parsed.products
      .map((p) => (typeof p?.name === 'string' ? p.name : ''))
      .filter((n) => n.length > 0)
    return { names, count: parsed.products.length }
  } catch {
    // A tool that returned an error string or non-JSON. Absent, not wrong.
    return { names: [], count: 0 }
  }
}

export function extractSearches(
  toolCalls: unknown
): Array<{ query: string; found: string[]; total: number }> {
  if (!Array.isArray(toolCalls)) return []
  const out: Array<{ query: string; found: string[]; total: number }> = []
  for (const raw of toolCalls) {
    const call = raw as {
      name?: unknown
      input?: unknown
      result_names?: unknown
      result_count?: unknown
    }
    if (call?.name !== 'search_products') continue
    const input = (call.input ?? {}) as { query?: unknown; include_ingredients?: unknown }
    const query =
      typeof input.query === 'string' && input.query
        ? input.query
        : // A filter-only search (include_ingredients with no query) is a real
          // search that really ran — 15 of 188 stored calls. Dropping it would
          // make it invisible here while still counting in `toolCalls`, which
          // is the omission this record exists to prevent.
          Array.isArray(input.include_ingredients) && input.include_ingredients.length
          ? `(filter: ${input.include_ingredients.filter((t) => typeof t === 'string').join(', ')})`
          : ''
    if (!query) continue
    const found = Array.isArray(call.result_names)
      ? call.result_names.filter((n): n is string => typeof n === 'string')
      : []
    const total = typeof call.result_count === 'number' ? call.result_count : found.length
    out.push({ query, found, total })
  }
  return out
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

/** Why a memory generation attempt produced no stored row. */
export type MemoryWriteOutcome =
  | 'saved'
  | 'no_json_in_response'
  | 'parse_failed'
  | 'write_failed'
  | 'threw'

/**
 * Generate and save AI memory for a visitor.
 * Merges existing memory with current session messages.
 * Triggered every 3rd message in a session, by the widget chat route.
 *
 * RETURNS THE OUTCOME — do not go back to returning void (Aug 18 2026).
 *
 * THE DEFECT THIS CLOSES. Every failure path here used to be shaped exactly
 * like success: `if (!jsonMatch) return` swallowed a parse miss, and the final
 * `.update(...)` discarded its result entirely (no `error` destructure), so an
 * RLS/constraint/network failure on the write was invisible. The caller got
 * `void` either way. That is the "destructuring only data" class CLAUDE.md
 * names as this repo's most expensive bug.
 *
 * WHAT IT COST. Measured on two real visitors:
 *   - a7db713a (Aug 17): the every-3rd trigger CAME DUE at her message 3
 *     (18:49 UTC) and `ai_memory` is still `{}`.
 *   - f7fdf10b (Aug 18): a due fire in her second session left zero
 *     session-2 content in her stored memory; on her return Yuri re-asked
 *     the climate and burn/tan she had already answered.
 * The trigger fired and nothing was written, and "fired and failed" was
 * indistinguishable from "never fired" in the database — the fourth of the
 * four questions failing on a live loop. The first instinct was to change the
 * `% 3` cadence; that would have been more machinery bolted onto a pipe nobody
 * had ever watched run.
 */
export async function generateAndSaveMemory(
  visitorId: string,
  sessionMessages: Array<{ role: string; content: string }>
): Promise<MemoryWriteOutcome> {
  // Record the outcome on the visitor row as well as returning it. A log line
  // is not observability — the Olive Young refresher warned to console.warn for
  // ~130 consecutive nights while writing nothing, because nobody reads Vercel
  // logs. This makes the failure queryable tomorrow.
  // Deliberately best-effort and never throwing: observability must not be able
  // to break the thing it observes.
  const stamp = async (outcome: MemoryWriteOutcome) => {
    try {
      const { error } = await getServiceClient()
        .from('ss_widget_visitors')
        .update({ memory_write_status: outcome, memory_write_at: new Date().toISOString() })
        .eq('visitor_id', visitorId)
      // A missing column (migration not yet applied) must not look like a
      // memory failure, so this is logged distinctly and swallowed.
      if (error) console.error('[widget/persistence] memory: status stamp failed', {
        visitorId, code: error.code, message: error.message,
      })
    } catch (stampErr) {
      console.error('[widget/persistence] memory: status stamp threw', { visitorId, stampErr })
    }
  }

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

    // Retried (Feature 13.2 wrapper): a transient 529 here silently loses a
    // visitor memory that never gets regenerated for this window otherwise.
    const response = await callAnthropicWithRetry(() => anthropic.messages.create({
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
    }))

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[widget/persistence] memory: no JSON object in model response', {
        visitorId,
        textPreview: text.slice(0, 200),
      })
      await stamp('no_json_in_response')
      return 'no_json_in_response'
    }

    let memory: unknown
    try {
      memory = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      // A truncated or malformed object. Distinct from "the model said nothing
      // JSON-shaped" — they point at different fixes (max_tokens vs prompt).
      console.error('[widget/persistence] memory: JSON.parse failed', { visitorId, parseErr })
      await stamp('parse_failed')
      return 'parse_failed'
    }

    // CHECK THE ERROR. A dead write here used to read as a clean save.
    const { error: writeError } = await supabase
      .from('ss_widget_visitors')
      .update({ ai_memory: memory })
      .eq('visitor_id', visitorId)

    if (writeError) {
      console.error('[widget/persistence] memory: WRITE FAILED', {
        visitorId,
        code: writeError.code,
        message: writeError.message,
      })
      await stamp('write_failed')
      return 'write_failed'
    }

    await stamp('saved')
    return 'saved'
  } catch (err) {
    console.error('[widget/persistence] Memory generation failed:', err)
    // Non-critical — never break the conversation. But the caller now learns
    // that it failed, instead of receiving the same `void` as a success.
    await stamp('threw')
    return 'threw'
  }
}
