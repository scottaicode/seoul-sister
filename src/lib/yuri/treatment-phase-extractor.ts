/**
 * Phase 13.D — Treatment Phase Extraction Pipeline
 *
 * Background Sonnet 4.5 job that runs fire-and-forget after every Yuri
 * conversation. Mirrors the extractAndSaveDecisionMemory pattern in memory.ts.
 *
 * Job:
 *   1. Read the conversation + the user's current ss_treatment_phases rows.
 *   2. Ask Sonnet to judge the conversation AS A WHOLE — did Yuri establish
 *      a new phase, complete the active phase, or update the active phase's
 *      protocol? Or no phase-state change at all?
 *   3. Upsert ss_treatment_phases accordingly via service-role client.
 *   4. When a phase change is detected, also append it to the conversation's
 *      decision_memory as a "decision" entry so Yuri sees the transition in
 *      her natural context-load path on the next conversation (Principle 3:
 *      close the learning loop into the layer Yuri already reads from).
 *
 * Design notes:
 *   - Conservative threshold: Sonnet must include a verbatim quote from the
 *     conversation supporting any phase change. No quote = no_change.
 *   - The model reasons about the whole conversation, not regex keyword
 *     matches. Principle 2 — trust model intelligence.
 *   - Non-blocking: failures log to console.error but never throw upward.
 *   - Service-role writes only. Users cannot edit phases from UI.
 */

import { getServiceClient } from '@/lib/supabase'

interface PhaseRow {
  id: string
  phase_number: number
  name: string
  goal: string | null
  status: 'planned' | 'active' | 'completed' | 'paused'
  started_at: string | null
  completed_at: string | null
  protocol: Record<string, unknown>
  decisions: unknown[]
  watch_for: unknown[]
  outcomes: Record<string, unknown>
}

type ExtractionAction =
  | { action: 'no_change' }
  | {
      action: 'create_phase'
      phase_number: number
      name: string
      goal: string
      protocol: Record<string, unknown>
      decisions: Array<{ decision: string; date: string }>
      watch_for: string[]
      supporting_quote: string
    }
  | {
      action: 'complete_phase'
      phase_number: number
      outcomes: {
        what_worked?: string[]
        what_didnt?: string[]
        carried_forward?: string[]
        notes?: string
      }
      supporting_quote: string
    }
  | {
      action: 'update_phase'
      phase_number: number
      protocol_changes?: Record<string, unknown>
      new_decisions?: Array<{ decision: string; date: string }>
      new_watch_for?: string[]
      supporting_quote: string
    }

const SYSTEM_RULE = `You analyze a K-beauty advisor conversation and decide whether the user's TREATMENT PHASE STATE changed during this conversation.

Yuri (the advisor) sometimes structures her advice as numbered phases for a user — "Phase 1: barrier repair," "Phase 2: introduce actives," "Phase 3: brightening," etc. Each phase has a goal, a protocol (AM/PM routine specifics), decisions Yuri made for the user, and "watch for" notes about what could go wrong.

Your job: determine if THIS conversation contains an explicit phase-state change. Be CONSERVATIVE. Only emit a change when Yuri's language (or the user-and-Yuri exchange together) literally establishes a phase transition. Implicit shifts ("you can introduce a serum now") DO NOT create a phase — they at most update the active phase's protocol.

ACTIONS YOU CAN RETURN:

1. "no_change" — most common. The conversation is general advice, troubleshooting, or operating within the existing phase. No phase transition occurred.

2. "create_phase" — Yuri explicitly established a new phase that doesn't exist yet in the user's phase list. Required language signals include phrases like "Phase N starts," "moving to Phase N," "next phase begins," "I'm starting you on Phase N." A vague "next steps" sentence is NOT enough.

3. "complete_phase" — Yuri explicitly marked an existing phase complete. Signals: "Phase N is done," "we're past Phase N," "successfully completed Phase N," "moving you out of Phase N." Note: starting Phase N+1 often implicitly completes Phase N. If you emit "create_phase" for N+1 and N is currently "active" in EXISTING PHASES below, also emit "complete_phase" for N (you may emit BOTH in the same response — return them as an array).

4. "update_phase" — the active phase's protocol changed (new product added, frequency adjusted, ingredient swap) WITHOUT the phase number changing. Only emit if the change is substantial (a new active introduced, a frequency change, a new "watch for" item).

CRITICAL: Every action other than "no_change" MUST include a "supporting_quote" — a verbatim excerpt (≤200 chars) from the conversation that supports your judgment. If you cannot quote the conversation literally, return "no_change."

INPUT FORMAT:
- EXISTING PHASES: the user's current phases (JSON array)
- TODAY'S DATE: ISO date string
- CONVERSATION: the user/Yuri exchange you're analyzing

OUTPUT FORMAT:
Return ONLY valid JSON. Either:
  { "actions": [{ "action": "no_change" }] }
or an array of one or more action objects:
  { "actions": [{ "action": "create_phase", "phase_number": N, "name": "...", ... }, { "action": "complete_phase", "phase_number": N-1, ... }] }`

export async function extractAndSaveTreatmentPhases(
  userId: string,
  conversationId: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<void> {
  if (!userId || !conversationId) return
  if (!Array.isArray(conversationHistory) || conversationHistory.length < 2) return

  const { getAnthropicClient, MODELS, callAnthropicWithRetry } = await import('@/lib/anthropic')
  const client = getAnthropicClient()
  const db = getServiceClient()

  // Load user's existing phases
  const { data: existingPhases, error: phasesErr } = await db
    .from('ss_treatment_phases')
    .select(
      'id, phase_number, name, goal, status, started_at, completed_at, protocol, decisions, watch_for, outcomes'
    )
    .eq('user_id', userId)
    .order('phase_number', { ascending: true })

  if (phasesErr) {
    console.error('[treatment-phase-extractor] phases load failed:', phasesErr.message)
    return
  }

  const phases = (existingPhases || []) as PhaseRow[]

  // Build the condensed transcript — Yuri's responses can be 1,500-3,000 chars,
  // and phase language usually appears mid-response, so use generous per-msg budget
  const transcript = conversationHistory
    .slice(-20)
    .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content.slice(0, 1500)}`)
    .join('\n')

  const today = new Date().toISOString().split('T')[0]

  const existingPhasesSummary = phases.map((p) => ({
    phase_number: p.phase_number,
    name: p.name,
    status: p.status,
    started_at: p.started_at,
    completed_at: p.completed_at,
  }))

  let response
  try {
    response = await callAnthropicWithRetry(
      () =>
        client.messages.create({
          model: MODELS.background,
          max_tokens: 1200,
          system: SYSTEM_RULE,
          messages: [
            {
              role: 'user',
              content: `EXISTING PHASES:
${JSON.stringify(existingPhasesSummary, null, 2)}

TODAY'S DATE: ${today}

CONVERSATION:
${transcript}

Return JSON only.`,
            },
          ],
        }),
      1
    )
  } catch (err) {
    console.error('[treatment-phase-extractor] Sonnet call failed:', err)
    return
  }

  const block = response.content[0]
  if (!block || block.type !== 'text') return

  let parsed: { actions?: unknown }
  try {
    const text = block.text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '')
    parsed = JSON.parse(text)
  } catch {
    return // Parse failure — skip silently
  }

  if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) return

  const actions = parsed.actions as ExtractionAction[]

  // Apply each action sequentially. We want phase creation to happen before
  // completion of the prior phase, so phase IDs are available for the
  // decision_memory feedback loop.
  const orderedActions = [...actions].sort((a, b) => {
    const order = { create_phase: 0, update_phase: 1, complete_phase: 2, no_change: 3 } as const
    return order[a.action] - order[b.action]
  })

  const appliedPhaseChanges: Array<{ topic: string; decision: string; date: string }> = []

  for (const action of orderedActions) {
    if (action.action === 'no_change') continue

    if (!('supporting_quote' in action) || !action.supporting_quote) {
      // Conservative gate: no quote, no change.
      continue
    }

    try {
      if (action.action === 'create_phase') {
        const existing = phases.find((p) => p.phase_number === action.phase_number)
        if (existing) {
          // Already exists — treat as update instead.
          await db
            .from('ss_treatment_phases')
            .update({
              name: action.name,
              goal: action.goal,
              protocol: action.protocol,
              decisions: action.decisions,
              watch_for: action.watch_for,
              status: existing.status === 'completed' ? 'completed' : 'active',
              created_from_conversation_id: conversationId,
              last_yuri_update_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await db.from('ss_treatment_phases').insert({
            user_id: userId,
            phase_number: action.phase_number,
            name: action.name,
            goal: action.goal,
            status: 'active',
            started_at: new Date().toISOString(),
            protocol: action.protocol,
            decisions: action.decisions,
            watch_for: action.watch_for,
            created_from_conversation_id: conversationId,
            last_yuri_update_at: new Date().toISOString(),
          })
        }
        appliedPhaseChanges.push({
          topic: `phase_${action.phase_number}_started`,
          decision: `Phase ${action.phase_number} (${action.name}) started`,
          date: today,
        })
      } else if (action.action === 'complete_phase') {
        const existing = phases.find((p) => p.phase_number === action.phase_number)
        if (!existing) continue
        if (existing.status === 'completed') continue
        await db
          .from('ss_treatment_phases')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            outcomes: action.outcomes || {},
            last_yuri_update_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        appliedPhaseChanges.push({
          topic: `phase_${action.phase_number}_completed`,
          decision: `Phase ${action.phase_number} (${existing.name}) completed`,
          date: today,
        })
      } else if (action.action === 'update_phase') {
        const existing = phases.find((p) => p.phase_number === action.phase_number)
        if (!existing) continue
        const updatedProtocol = action.protocol_changes
          ? { ...existing.protocol, ...action.protocol_changes }
          : existing.protocol
        const updatedDecisions = action.new_decisions
          ? [...(Array.isArray(existing.decisions) ? existing.decisions : []), ...action.new_decisions]
          : existing.decisions
        const updatedWatchFor = action.new_watch_for
          ? [...(Array.isArray(existing.watch_for) ? existing.watch_for : []), ...action.new_watch_for]
          : existing.watch_for
        await db
          .from('ss_treatment_phases')
          .update({
            protocol: updatedProtocol,
            decisions: updatedDecisions,
            watch_for: updatedWatchFor,
            last_yuri_update_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        appliedPhaseChanges.push({
          topic: `phase_${action.phase_number}_updated`,
          decision: `Phase ${action.phase_number} protocol updated`,
          date: today,
        })
      }
    } catch (err) {
      console.error('[treatment-phase-extractor] action apply failed:', action.action, err)
    }
  }

  // Principle 3 feedback loop: inject phase transitions into the conversation's
  // decision_memory so Yuri sees them at conversation time via her existing
  // memory-load path, not just via a separate phase-table read.
  if (appliedPhaseChanges.length > 0) {
    try {
      const { data: conv } = await db
        .from('ss_yuri_conversations')
        .select('decision_memory')
        .eq('id', conversationId)
        .single()

      const existingMemory = (conv?.decision_memory || {}) as {
        decisions?: Array<{ topic: string; decision: string; date: string }>
        preferences?: unknown[]
        commitments?: unknown[]
        corrections?: unknown[]
        extracted_at?: string
      }

      const existingDecisions = Array.isArray(existingMemory.decisions) ? existingMemory.decisions : []

      // Dedupe by topic — phase change for the same topic shouldn't double up
      const mergedDecisions = [...existingDecisions]
      for (const change of appliedPhaseChanges) {
        const existingIdx = mergedDecisions.findIndex((d) => d.topic === change.topic)
        if (existingIdx >= 0) {
          mergedDecisions[existingIdx] = change
        } else {
          mergedDecisions.push(change)
        }
      }

      await db
        .from('ss_yuri_conversations')
        .update({
          decision_memory: {
            ...existingMemory,
            decisions: mergedDecisions,
            extracted_at: new Date().toISOString(),
          },
        })
        .eq('id', conversationId)
    } catch (err) {
      console.error('[treatment-phase-extractor] decision_memory feedback failed:', err)
    }
  }
}
