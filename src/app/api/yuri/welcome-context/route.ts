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
 *   first_name: derived from user_metadata.full_name||name, then email username
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

    // Derive first_name. Priority: user_metadata.full_name -> name -> email username -> null.
    const metadata = (user.user_metadata || {}) as Record<string, unknown>
    const rawName =
      (typeof metadata.full_name === 'string' && metadata.full_name) ||
      (typeof metadata.name === 'string' && metadata.name) ||
      (typeof metadata.first_name === 'string' && metadata.first_name) ||
      null

    let firstName: string | null = null
    if (rawName) {
      const trimmed = rawName.trim()
      if (trimmed.length > 0) {
        firstName = trimmed.split(/\s+/)[0]
      }
    }
    if (!firstName && user.email) {
      const local = user.email.split('@')[0]
      // Skip generic-looking email locals so we don't say "Welcome back, info"
      const generic = new Set(['info', 'hello', 'admin', 'team', 'support', 'contact'])
      if (local && !generic.has(local.toLowerCase()) && local.length <= 24) {
        // Capitalize first letter, lowercase the rest, strip non-alphanumeric tail
        const cleaned = local.replace(/[^a-zA-Z]/g, ' ').trim().split(/\s+/)[0]
        if (cleaned) {
          firstName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
        }
      }
    }

    const db = getServiceClient()

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
