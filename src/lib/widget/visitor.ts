/**
 * Persistent anonymous visitor identity management.
 * Adapted from LGAAS's getOrCreateProspect() pattern.
 */

import { getServiceClient } from '@/lib/supabase'

export interface WidgetVisitor {
  id: string
  visitor_id: string
  total_messages: number
  total_sessions: number
  total_tool_calls: number
  ai_memory: Record<string, unknown> | null
}

const MAX_FREE_MESSAGES = 20

/**
 * Get or create a persistent visitor record.
 * Uses UPSERT for atomicity — safe under concurrent requests.
 */
export async function getOrCreateVisitor(
  visitorId: string,
  ipHash: string,
  uaHash: string
): Promise<WidgetVisitor> {
  const supabase = getServiceClient()

  // Try upsert — creates on first visit, updates last_seen on return
  const { data, error } = await supabase
    .from('ss_widget_visitors')
    .upsert(
      {
        visitor_id: visitorId,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'visitor_id', ignoreDuplicates: false }
    )
    .select('id, visitor_id, total_messages, total_sessions, total_tool_calls, ai_memory')
    .single()

  if (error || !data) {
    // Fallback: try to read existing record (upsert may fail on RLS edge cases)
    const { data: existing } = await supabase
      .from('ss_widget_visitors')
      .select('id, visitor_id, total_messages, total_sessions, total_tool_calls, ai_memory')
      .eq('visitor_id', visitorId)
      .single()

    if (existing) return existing as WidgetVisitor

    throw new Error(`Failed to get or create visitor: ${error?.message}`)
  }

  return data as WidgetVisitor
}

/**
 * Increment visitor counters after a message exchange.
 * Uses read-then-write pattern (acceptable for widget traffic levels).
 */
export async function incrementVisitorCounters(
  visitorId: string,
  messagesDelta: number,
  toolCallsDelta: number
): Promise<void> {
  const supabase = getServiceClient()

  // Read current values
  const { data: current, error: readError } = await supabase
    .from('ss_widget_visitors')
    .select('total_messages, total_tool_calls')
    .eq('visitor_id', visitorId)
    .single()

  if (readError || !current) {
    console.error('[Widget] Failed to read visitor counters:', readError?.message)
    return
  }

  // Write incremented values
  const { error: writeError } = await supabase
    .from('ss_widget_visitors')
    .update({
      total_messages: current.total_messages + messagesDelta,
      total_tool_calls: current.total_tool_calls + toolCallsDelta,
      last_seen_at: new Date().toISOString(),
    })
    .eq('visitor_id', visitorId)

  if (writeError) {
    console.error('[Widget] Failed to update visitor counters:', writeError.message)
  }
}

/**
 * Check if visitor has reached the 20-message free limit.
 */
export function isVisitorAtLimit(visitor: WidgetVisitor): boolean {
  return visitor.total_messages >= MAX_FREE_MESSAGES
}
