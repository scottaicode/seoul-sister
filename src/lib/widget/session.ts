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
  source?: string | null,
  /** Site-relative path of the page the visitor arrived FROM (path only). */
  landingPath?: string | null
): Promise<WidgetSession> {
  const supabase = getServiceClient()

  const sessionNumber = currentSessionCount + 1
  const selectCols =
    'id, visitor_id, session_number, message_count, tool_calls_count, specialist_domains_detected, intent_signals_detected, source, landing_path'

  // Insert with `source` (first-touch feeder attribution). The column was added
  // by a manual migration; if it isn't present yet, gracefully retry without it
  // so conversations never break on a missing-column error.
  const { data, error } = await supabase
    .from('ss_widget_sessions')
    .insert({
      visitor_id: visitorId,
      session_number: sessionNumber,
      source: source ?? null,
      landing_path: landingPath ?? null,
    })
    .select(selectCols)
    .single()

  // Same graceful degradation as `source`: a missing column must never break a
  // conversation. Matches BOTH column names so the retry fires whichever of the
  // two migrations has not been applied yet.
  if (error && /source|landing_path/i.test(error.message) && /column/i.test(error.message)) {
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

const SESSION_COLS =
  'id, visitor_id, session_number, message_count, tool_calls_count, specialist_domains_detected, intent_signals_detected, source'

/**
 * Load an existing session by ID — only if it belongs to this visitor.
 *
 * The visitor check was added Oct 26 2026: a session id alone is not proof of
 * ownership, and the route rehydrates Yuri's history from the session, so a
 * foreign id would have let one browser continue someone else's conversation.
 * A failed query throws rather than reading as "no session".
 */
export async function getSession(sessionId: string, visitorId: string): Promise<WidgetSession | null> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('ss_widget_sessions')
    .select(SESSION_COLS)
    .eq('id', sessionId)
    .eq('visitor_id', visitorId)
    .maybeSingle()

  if (error) throw new Error(`widget session lookup failed: ${error.message}`)
  return (data as WidgetSession) || null
}

/**
 * How long a visitor can be away and still resume the same conversation.
 *
 * Why (Oct 26 2026): the session id lives in sessionStorage, which dies with
 * the tab, so a visitor who came back in a new tab (or whose phone discarded the
 * tab) started a fresh, empty conversation and Yuri forgot everything — two of
 * two real visitors that weekend, one re-asked where she lives, one had a
 * product-label question misread as a blog glitch. Measured across all history:
 * of 24 returns, 7 came back within an hour and 9 within 6 hours; the other 13
 * were a day or more later, when a fresh conversation is the right default.
 *
 * ONE hour, not six: a review pointed out that resuming also repaints the old
 * transcript on screen, so on a shared device the next person sees it. One hour
 * keeps 7 of the 9 helpful resumes with a sixth of the exposure. (Yuri's
 * cross-visit ai_memory already spans people on a shared browser; this window is
 * about the verbatim transcript.)
 */
export const RESUME_WINDOW_MS = 60 * 60 * 1000

/**
 * The visitor's most recent conversation, if they were active in it within
 * RESUME_WINDOW_MS. Null otherwise. Throws on a failed query.
 */
export async function findResumableSession(
  visitorId: string,
  now: number = Date.now()
): Promise<WidgetSession | null> {
  const supabase = getServiceClient()
  const since = new Date(now - RESUME_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('ss_widget_sessions')
    .select(SESSION_COLS)
    .eq('visitor_id', visitorId)
    .gt('message_count', 0)
    .not('ended_naturally', 'is', true) // the visitor chose "Start over"
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`resumable session lookup failed: ${error.message}`)
  return (data?.[0] as WidgetSession) || null
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
export async function markSessionEnded(sessionId: string, visitorId: string): Promise<boolean> {
  // Oct 26 2026: used by the widget's "Start over". An ended conversation is
  // never resumed (findResumableSession skips it). Ownership-checked, and a
  // failed write throws so the client can still start fresh via `fresh: true`.
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('ss_widget_sessions')
    .update({ ended_naturally: true })
    .eq('id', sessionId)
    .eq('visitor_id', visitorId)
    .select('id')
  if (error) throw new Error(`end session failed: ${error.message}`)
  // false = no such session for this visitor (nothing ended), distinct from success.
  // Note: ended_naturally was documented as "hit the message limit" but had no
  // writer or reader before this; it now means "the visitor chose Start over".
  return (data?.length ?? 0) > 0
}

/**
 * When a resumed conversation arrives from a feeder page, record that touch on
 * the row if it has none. createSession is the only other writer of these
 * columns, and it no longer runs for an in-window return — without this, the
 * blog page a returning visitor came back from would never be recorded (the
 * only landing_path row in production history was exactly such a return).
 * First touch wins; a later touch only fills an empty column. Throws on error.
 */
export async function fillSessionAttribution(
  sessionId: string,
  source: string | null | undefined,
  landingPath: string | null | undefined
): Promise<void> {
  const supabase = getServiceClient()
  if (source) {
    const { error } = await supabase.from('ss_widget_sessions').update({ source }).eq('id', sessionId).is('source', null)
    if (error) throw new Error(`session source fill failed: ${error.message}`)
  }
  if (landingPath) {
    const { error } = await supabase
      .from('ss_widget_sessions').update({ landing_path: landingPath }).eq('id', sessionId).is('landing_path', null)
    if (error) throw new Error(`session landing_path fill failed: ${error.message}`)
  }
}
