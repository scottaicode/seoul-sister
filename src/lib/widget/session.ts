/**
 * Widget session lifecycle management.
 * Sessions created on first message only (ghost prevention).
 * Adapted from LGAAS's handleStartAndMessage() pattern.
 */

import { getServiceClient } from '@/lib/supabase'

export interface WidgetSession {
  id: string
  visitor_id: string
  session_number: number
  message_count: number
  tool_calls_count: number
  specialist_domains_detected: string[]
  intent_signals_detected: string[]
  /** First-touch feeder attribution (blog/product/ingredient/nav/...). Null for direct hero visits. */
  source: string | null
}

/**
 * Create a new session on first message.
 * Also increments visitor.total_sessions.
 */
export async function createSession(
  visitorId: string,
  currentSessionCount: number,
  source?: string
): Promise<WidgetSession> {
  const supabase = getServiceClient()

  const sessionNumber = currentSessionCount + 1
  const selectCols =
    'id, visitor_id, session_number, message_count, tool_calls_count, specialist_domains_detected, intent_signals_detected, source'

  // Insert with `source` (first-touch feeder attribution). The column was added
  // by a manual migration; if it isn't present yet, gracefully retry without it
  // so conversations never break on a missing-column error.
  const { data, error } = await supabase
    .from('ss_widget_sessions')
    .insert({ visitor_id: visitorId, session_number: sessionNumber, source: source ?? null })
    .select(selectCols)
    .single()

  if (error && /source/i.test(error.message) && /column/i.test(error.message)) {
    const fallback = await supabase
      .from('ss_widget_sessions')
      .insert({ visitor_id: visitorId, session_number: sessionNumber })
      .select(
        'id, visitor_id, session_number, message_count, tool_calls_count, specialist_domains_detected, intent_signals_detected'
      )
      .single()
    if (fallback.error || !fallback.data) {
      throw new Error(`Failed to create session: ${fallback.error?.message}`)
    }
    await supabase
      .from('ss_widget_visitors')
      .update({ total_sessions: sessionNumber })
      .eq('visitor_id', visitorId)
    return { ...(fallback.data as unknown as WidgetSession), source: null }
  }

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message}`)
  }

  // Increment visitor session count
  await supabase
    .from('ss_widget_visitors')
    .update({ total_sessions: sessionNumber })
    .eq('visitor_id', visitorId)

  return data as WidgetSession
}

/**
 * Load an existing session by ID.
 */
export async function getSession(sessionId: string): Promise<WidgetSession | null> {
  const supabase = getServiceClient()

  const { data } = await supabase
    .from('ss_widget_sessions')
    .select('id, visitor_id, session_number, message_count, tool_calls_count, specialist_domains_detected, intent_signals_detected, source')
    .eq('id', sessionId)
    .single()

  return (data as WidgetSession) || null
}

/**
 * Increment session counters after a message exchange.
 */
export async function incrementSessionCounters(
  sessionId: string,
  toolCallsDelta: number
): Promise<void> {
  const supabase = getServiceClient()

  const { data: current } = await supabase
    .from('ss_widget_sessions')
    .select('message_count, tool_calls_count')
    .eq('id', sessionId)
    .single()

  if (current) {
    await supabase
      .from('ss_widget_sessions')
      .update({
        message_count: current.message_count + 1,
        tool_calls_count: current.tool_calls_count + toolCallsDelta,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
  }
}

/**
 * Append specialist domains and intent signals to session metadata.
 */
export async function updateSessionMetadata(
  sessionId: string,
  newSpecialistDomains: string[],
  newIntentSignals: string[]
): Promise<void> {
  const supabase = getServiceClient()

  const { data: current } = await supabase
    .from('ss_widget_sessions')
    .select('specialist_domains_detected, intent_signals_detected')
    .eq('id', sessionId)
    .single()

  if (!current) return

  const specialists = current.specialist_domains_detected || []
  const signals = current.intent_signals_detected || []

  // Deduplicate before appending
  const updatedSpecialists = [...new Set([...specialists, ...newSpecialistDomains])]
  const updatedSignals = [...new Set([...signals, ...newIntentSignals])]

  await supabase
    .from('ss_widget_sessions')
    .update({
      specialist_domains_detected: updatedSpecialists,
      intent_signals_detected: updatedSignals,
    })
    .eq('id', sessionId)
}

/**
 * Mark session as ended naturally (hit message limit).
 */
export async function markSessionEnded(sessionId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('ss_widget_sessions')
    .update({ ended_naturally: true })
    .eq('id', sessionId)
}
