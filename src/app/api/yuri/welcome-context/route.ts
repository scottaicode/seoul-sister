import { NextRequest, NextResponse } from 'next/server'
import { supabase, getServiceClient } from '@/lib/supabase'
import { AppError, handleApiError } from '@/lib/utils/error-handler'
import type { DecisionMemory } from '@/lib/yuri/memory'

/**
 * GET /api/yuri/welcome-context
 *
 * Lightweight context for the /yuri page's empty welcome state.
 * Returns just enough for a warm "Welcome back, {name} — picking up where
 * we left off on {phase}" — NOT the full UserContext (that loads inside
 * conversations only). Cheap: one count + one limit-5 SELECT.
 *
 * Returns:
 *   first_name: ss_user_profiles.display_name, then .first_name, then an
 *               OAuth-provided name. NEVER the email local-part — see below.
 *   active_phase: most recent decision_memory.decisions[] topic matching
 *                 /phase|barrier repair|treatment plan/i, truncated to 80 chars
 *   total_conversations: count from ss_yuri_conversations
 *   has_profile: existence of ss_user_profiles row
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) throw new AppError('Unauthorized', 401)

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) throw new AppError('Unauthorized', 401)
    const user = authData.user

    // NEVER derive a name from the email address (July 29 2026).
    //
    // This block used to fall back to the email local-part AND capitalize it, so
    // Bailey's Yuri greeting rendered "Welcome back, Baileydonmartin" — a name
    // she never gave, formatted to look like one she had. The capitalization made
    // it worse than a raw string: it presented a guess as a fact, the same class
    // as the v10.2.1 fake-confidence and the fabricated-Fitzpatrick defects.
    //
    // The onboarding extraction prompt already states the rule for this exact
    // field: "NEVER infer a name from their email address, and never guess. If
    // they didn't say it, omit it." This endpoint now honours it — the fallback
    // order is the name she CHOSE, then the name she volunteered to Yuri, then
    // null, which renders a nameless welcome.
    const metadata = (user.user_metadata || {}) as Record<string, unknown>
    const rawName =
      (typeof metadata.full_name === 'string' && metadata.full_name) ||
      (typeof metadata.name === 'string' && metadata.name) ||
      (typeof metadata.first_name === 'string' && metadata.first_name) ||
      null

    const db = getServiceClient()

    // The user-chosen display name wins, then a volunteered first_name. Read
    // before the parallel block below so it can participate in the fallback.
    const { data: nameRow } = await db
      .from('ss_user_profiles')
      .select('display_name, first_name')
      .eq('user_id', user.id)
      .maybeSingle()

    let firstName: string | null =
      (nameRow?.display_name as string | null) ||
      (nameRow?.first_name as string | null) ||
      null

    if (!firstName && rawName) {
      // OAuth-provided names are volunteered by the user at the provider, so
      // they are legitimate — unlike an email local-part, which is an address.
      const trimmed = rawName.trim()
      if (trimmed.length > 0) {
        firstName = trimmed.split(/\s+/)[0]
      }
    }

    // Parallel: total count + most-recent conversation id + recent decision_memory rows + profile existence
    const [countRes, lastConvRes, recentRes, profileRes] = await Promise.all([
      db
        .from('ss_yuri_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      db
        .from('ss_yuri_conversations')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('ss_yuri_conversations')
        .select('decision_memory, updated_at')
        .eq('user_id', user.id)
        .not('decision_memory', 'eq', '{}')
        .order('updated_at', { ascending: false })
        .limit(5),
      db
        .from('ss_user_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ])

    const totalConversations = countRes.count ?? 0
    const hasProfile = (profileRes.count ?? 0) > 0
    const lastConversationId =
      (lastConvRes.data?.id as string | undefined) ?? null
    const lastConversationTitle =
      (lastConvRes.data?.title as string | undefined) ?? null

    // Find the most recent phase/treatment marker across the last 5 conversations.
    // Decisions are stored in JSONB on the conversation. We scan them in
    // updated_at-descending order and return the first match.
    const PHASE_TOPIC_REGEX = /phase|barrier repair|treatment plan|active treatment/i
    let activePhase: string | null = null

    if (recentRes.data && Array.isArray(recentRes.data)) {
      for (const row of recentRes.data) {
        const dm = row.decision_memory as DecisionMemory | null
        if (!dm?.decisions || !Array.isArray(dm.decisions)) continue

        // Scan this conversation's decisions for a phase-style topic.
        const match = dm.decisions.find(
          (d) => typeof d?.topic === 'string' && PHASE_TOPIC_REGEX.test(d.topic),
        )
        if (match && typeof match.decision === 'string') {
          const decision = match.decision.trim()
          if (decision.length > 0) {
            activePhase = decision.length > 80 ? `${decision.slice(0, 77)}...` : decision
            break
          }
        }
      }
    }

    return NextResponse.json({
      first_name: firstName,
      active_phase: activePhase,
      total_conversations: totalConversations,
      has_profile: hasProfile,
      last_conversation_id: lastConversationId,
      last_conversation_title: lastConversationTitle,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
