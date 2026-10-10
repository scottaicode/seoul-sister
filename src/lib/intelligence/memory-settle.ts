/**
 * Settle a conversation's memory once it goes quiet (Oct 9-10 2026).
 *
 * THE DEFECT: the advisor extracts summary + decision memory + treatment phase
 * only on a cadence (message 2, 6, then every 5th; advisor.ts), and onboarding
 * never extracts them at all. Whatever happened after the last cadence point
 * was never remembered. One subscriber's summary was written 53 seconds before
 * she asked for a starter routine and Yuri built it, so every later proactive
 * note offered to build a routine that already existed.
 *
 * THE FIX: when a conversation has been idle for IDLE_MINUTES and was not
 * settled since its last message, re-run the EXISTING extractors over the whole
 * conversation, IN SEQUENCE (summary, decision memory, then phases: the last
 * two write the same JSON column). Settled is recorded only when every step
 * succeeded (memory_settled_at); failures back off exponentially and stop after
 * MAX_SETTLE_ATTEMPTS, visibly, instead of retrying hourly at the head of the
 * queue. External users are processed before internal (admin/demo/excluded).
 *
 * DRY RUN (settleUserDry) computes the same summary and merged decision memory
 * without writing, using the SAME prior-conversation selection as the live path
 * (pickPriorConversations), so a dry run shows what apply would do.
 */

import { safeSlice } from '@/lib/utils/text-slice'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { YuriMessage } from '@/types/database'
import { generateConversationSummary } from '@/lib/yuri/advisor'
import {
  extractAndSaveDecisionMemory,
  extractDecisionMemory,
  mergeDecisionMemory,
  loadConversationMessages,
  saveConversationSummary,
  loopsOnRecord,
  applyLoopChanges,
  pickPriorConversations,
  isOpenLoop,
  type DecisionMemory,
} from '@/lib/yuri/memory'
import { extractAndSaveTreatmentPhases } from '@/lib/yuri/treatment-phase-extractor'

export const IDLE_MINUTES = 30
/**
 * Default scope: a user's 3 most recent conversations (the window Yuri's
 * context reads) or anything with a message in the last RECENT_DAYS. Re-extracting
 * a February thread re-opens loops nobody is living in any more; 'all' widens
 * deliberately.
 */
export const RECENT_CONVERSATIONS = 3
export const RECENT_DAYS = 60
/** After this many consecutive failures a conversation is left alone (visible in the run row). */
export const MAX_SETTLE_ATTEMPTS = 6
const PAGE = 1000

export interface UnsettledConversation {
  id: string
  userId: string
  createdAt: string
  conversationType: string | null
  lastMessageAt: string
  summaryGeneratedAt: string | null
  hasSummary: boolean
  attempts: number
  internal: boolean
  existingDecisionMemory: DecisionMemory | null
}

export interface SettleProposal {
  conversationId: string
  userId: string
  summary: { summaryBody: string; openerText: string | null } | null
  decisionMemory: DecisionMemory | null
  openLoopsBefore: string[]
  openLoopsAfter: string[]
  resolvedOpenLoops: string[]
  applied: boolean
  errors: string[]
}

export interface SettleState {
  lastMessageAt: string | null
  hasUserMessage: boolean
  /** memory_settled_at (falls back to summary_generated_at before the migration). */
  settledAt: string | null
  nextAttemptAt: string | null
  attempts: number
}

/**
 * Pure selection rule, exported for tests: the person said something, it has
 * been quiet for IDLE_MINUTES, it was not settled since its last message, it is
 * not in backoff, and it has not exhausted its attempts.
 */
export function needsSettling(c: SettleState, now: number, idleMinutes: number = IDLE_MINUTES): boolean {
  if (!c.hasUserMessage || !c.lastMessageAt) return false
  if (now - new Date(c.lastMessageAt).getTime() < idleMinutes * 60 * 1000) return false
  if (c.attempts >= MAX_SETTLE_ATTEMPTS) return false
  if (c.nextAttemptAt && new Date(c.nextAttemptAt).getTime() > now) return false
  return !c.settledAt || c.settledAt < c.lastMessageAt
}

/**
 * Processing order, exported for tests: external users before internal ones,
 * then fewest failed attempts (so a stuck row cannot starve fresh ones), then
 * oldest last message first (so a later conversation can resolve a loop an
 * earlier one opened).
 */
export function orderForSettling<T extends { internal: boolean; attempts: number; lastMessageAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(a.internal) - Number(b.internal) ||
      a.attempts - b.attempts ||
      a.lastMessageAt.localeCompare(b.lastMessageAt)
  )
}

/** Hours to wait after the n-th consecutive failure: 1, 2, 4, 8, 16, 32. */
export function backoffHours(attempts: number): number {
  return 2 ** Math.max(0, attempts - 1)
}

async function fetchAll<T>(db: SupabaseClient, table: string, cols: string, userIds?: string[]): Promise<T[]> {
  let countQ = db.from(table).select('*', { count: 'exact', head: true })
  if (userIds?.length && table === 'ss_yuri_conversations') countQ = countQ.in('user_id', userIds)
  const { count, error } = await countQ
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  const out: T[] = []
  for (let from = 0; from < (count ?? 0); from += PAGE) {
    let q = db.from(table).select(cols).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (userIds?.length && table === 'ss_yuri_conversations') q = q.in('user_id', userIds)
    const { data, error: e } = await q
    if (e) throw new Error(`${table} page failed: ${e.message}`)
    out.push(...((data ?? []) as T[]))
  }
  // PostgREST caps silently; a short read must not look like a full scan.
  if (out.length !== (count ?? 0)) throw new Error(`${table}: read ${out.length} of ${count} rows`)
  return out
}

type ConvRow = {
  id: string
  user_id: string
  created_at: string
  conversation_type: string | null
  summary: string | null
  summary_generated_at: string | null
  decision_memory: DecisionMemory | null
  memory_settled_at?: string | null
  memory_settle_attempts?: number | null
  memory_settle_next_at?: string | null
}

const BASE_COLS = 'id, user_id, created_at, conversation_type, summary, summary_generated_at, decision_memory'
const STATE_COLS = `${BASE_COLS}, memory_settled_at, memory_settle_attempts, memory_settle_next_at`

/**
 * Has migration 20261010000001 (settle state columns) been applied? Without it
 * "settled" cannot be recorded, so a LIVE settle would redo the same AI work
 * every hour. The live route and --apply refuse; the dry run proceeds.
 */
export async function settleStateMigrated(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from('ss_yuri_conversations').select('memory_settled_at').limit(1)
  if (error) {
    if (/memory_settled_at/.test(error.message) || error.code === '42703' || error.code === 'PGRST204') return false
    throw new Error(`settle-state check failed: ${error.message}`)
  }
  // And 20261010000002 (activity-only updated_at trigger): its RPC marker.
  const { error: rpcErr } = await db.rpc('ss_conversation_activity_trigger_version')
  if (rpcErr) {
    if (rpcErr.code === 'PGRST202' || /ss_conversation_activity_trigger_version/.test(rpcErr.message)) return false
    throw new Error(`trigger-marker check failed: ${rpcErr.message}`)
  }
  return true
}

export async function findUnsettled(
  db: SupabaseClient,
  opts: { now?: number; userIds?: string[]; idleMinutes?: number; scope?: 'recent' | 'all' } = {}
): Promise<UnsettledConversation[]> {
  const now = opts.now ?? Date.now()
  let convs: ConvRow[]
  let stateTracked = true
  try {
    convs = await fetchAll<ConvRow>(db, 'ss_yuri_conversations', STATE_COLS, opts.userIds)
  } catch (err) {
    // Before 20261010000001 is applied the state columns do not exist. Only the
    // DRY RUN can meaningfully proceed then; fall back to summary_generated_at.
    if (!/memory_settle/.test(String(err))) throw err
    stateTracked = false
    convs = await fetchAll<ConvRow>(db, 'ss_yuri_conversations', BASE_COLS, opts.userIds)
  }
  type Msg = { conversation_id: string; role: string; created_at: string }
  const ids = new Set(convs.map((c) => c.id))
  const msgs = (await fetchAll<Msg>(db, 'ss_yuri_messages', 'conversation_id, role, created_at')).filter((m) =>
    ids.has(m.conversation_id)
  )
  const last = new Map<string, string>()
  const hasUser = new Set<string>()
  for (const m of msgs) {
    if ((last.get(m.conversation_id) ?? '') < m.created_at) last.set(m.conversation_id, m.created_at)
    if (m.role === 'user') hasUser.add(m.conversation_id)
  }

  const { data: internalRows, error: iErr } = await db
    .from('ss_user_profiles')
    .select('user_id')
    .or('is_admin.eq.true,is_demo.eq.true,excluded_from_metrics.eq.true')
  if (iErr) throw new Error(`internal-user load failed: ${iErr.message}`)
  const internal = new Set((internalRows ?? []).map((r) => r.user_id as string))

  // The user's most recent conversations, by created_at (same as the loader).
  const recentIds = new Set<string>()
  const byUser = new Map<string, ConvRow[]>()
  for (const c of convs) byUser.set(c.user_id, [...(byUser.get(c.user_id) ?? []), c])
  for (const list of byUser.values()) {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RECENT_CONVERSATIONS).forEach((c) => recentIds.add(c.id))
  }
  const recentCutoff = new Date(now - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const selected = convs
    .filter((c) => opts.scope === 'all' || recentIds.has(c.id) || (last.get(c.id) ?? '') >= recentCutoff)
    .filter((c) =>
      needsSettling(
        {
          lastMessageAt: last.get(c.id) ?? null,
          hasUserMessage: hasUser.has(c.id),
          settledAt: stateTracked ? (c.memory_settled_at ?? null) : c.summary ? c.summary_generated_at : null,
          nextAttemptAt: c.memory_settle_next_at ?? null,
          attempts: c.memory_settle_attempts ?? 0,
        },
        now,
        opts.idleMinutes
      )
    )
    .map((c) => ({
      id: c.id,
      userId: c.user_id,
      createdAt: c.created_at,
      conversationType: c.conversation_type,
      lastMessageAt: last.get(c.id)!,
      summaryGeneratedAt: c.summary_generated_at,
      hasSummary: !!c.summary,
      attempts: c.memory_settle_attempts ?? 0,
      internal: internal.has(c.user_id),
      existingDecisionMemory:
        c.decision_memory && Object.keys(c.decision_memory).length ? c.decision_memory : null,
    }))
  return orderForSettling(selected)
}

function splitForSummary(messages: YuriMessage[]) {
  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
  return {
    history: (lastIsAssistant ? messages.slice(0, -1) : messages) as YuriMessage[],
    latest: lastIsAssistant ? messages[messages.length - 1].content : '',
    transcript: messages.map((m) => ({ role: m.role, content: m.content })),
  }
}

/**
 * LIVE settle of one conversation: summary, then decision memory, then phases,
 * strictly in sequence. Records memory_settled_at only if every step succeeded;
 * otherwise increments attempts and backs off.
 */
export async function settleConversation(
  db: SupabaseClient,
  c: UnsettledConversation,
  opts: { timezone: string | null }
): Promise<SettleProposal> {
  const startedAt = new Date().toISOString()
  const proposal: SettleProposal = {
    conversationId: c.id,
    userId: c.userId,
    summary: null,
    decisionMemory: null,
    openLoopsBefore: (c.existingDecisionMemory?.open_loops ?? []).filter(isOpenLoop).map((l) => l.topic),
    openLoopsAfter: [],
    resolvedOpenLoops: [],
    applied: false,
    errors: [],
  }

  try {
    const messages = (await loadConversationMessages(c.id)).filter((m) => m.role === 'user' || m.role === 'assistant')
    const { history, latest, transcript } = splitForSummary(messages)

    const summary = await generateConversationSummary(history, latest)
    if (!summary) throw new Error('summary: no text returned')
    await saveConversationSummary(c.id, summary.summaryBody, summary.openerText)

    const dmOutcome = await extractAndSaveDecisionMemory(c.userId, c.id, transcript, opts.timezone, new Date(c.lastMessageAt))
    if (dmOutcome === 'unusable' || dmOutcome === 'save_failed') throw new Error(`decision_memory: ${dmOutcome}`)

    await extractAndSaveTreatmentPhases(c.userId, c.id, transcript)
    proposal.applied = true
  } catch (err) {
    proposal.errors.push(err instanceof Error ? err.message : String(err))
  }

  const attempts = proposal.applied ? 0 : c.attempts + 1
  const { error } = await db
    .from('ss_yuri_conversations')
    .update(
      proposal.applied
        ? { memory_settled_at: startedAt, memory_settle_attempts: 0, memory_settle_next_at: null, memory_settle_last_error: null }
        : {
            memory_settle_attempts: attempts,
            memory_settle_next_at: new Date(Date.now() + backoffHours(attempts) * 3600 * 1000).toISOString(),
            memory_settle_last_error: safeSlice(proposal.errors.join('; '), 500),
          }
    )
    .eq('id', c.id)
  if (error) proposal.errors.push(`settle state write failed: ${error.message}`)
  if (error && proposal.applied) proposal.applied = false
  return proposal
}

/**
 * DRY RUN for one user: settle their unsettled conversations in order,
 * applying each extraction's soft closes to the in-memory decision memory of
 * the prior conversations chosen by pickPriorConversations, exactly as the live
 * path does in the database. Writes nothing. Returns a proposal per settled
 * conversation plus one per prior conversation whose loops it closed.
 */
export async function settleUserDry(
  db: SupabaseClient,
  userId: string,
  pending: UnsettledConversation[],
  timezone: string | null
): Promise<SettleProposal[]> {
  const { data, error } = await db
    .from('ss_yuri_conversations')
    .select('id, created_at, decision_memory')
    .eq('user_id', userId)
  if (error) throw new Error(`user conversations load: ${error.message}`)
  const rows = new Map<string, { id: string; created_at: string; decision_memory: DecisionMemory | null }>()
  for (const c of data ?? []) {
    rows.set(c.id as string, {
      id: c.id as string,
      created_at: c.created_at as string,
      decision_memory: (c.decision_memory as DecisionMemory | null) ?? null,
    })
  }
  const openTopics = (dm: DecisionMemory | null) => (dm?.open_loops ?? []).filter(isOpenLoop).map((l) => l.topic)
  const before = new Map([...rows].map(([k, v]) => [k, openTopics(v.decision_memory)]))

  const proposals = new Map<string, SettleProposal>()
  const touched = new Set<string>()
  const blank = (id: string): SettleProposal => ({
    conversationId: id,
    userId,
    summary: null,
    decisionMemory: null,
    openLoopsBefore: before.get(id) ?? [],
    openLoopsAfter: [],
    resolvedOpenLoops: [],
    applied: false,
    errors: [],
  })

  for (const c of orderForSettling(pending)) {
    const p = blank(c.id)
    proposals.set(c.id, p)
    const messages = (await loadConversationMessages(c.id)).filter((m) => m.role === 'user' || m.role === 'assistant')
    const { history, latest, transcript } = splitForSummary(messages)
    try {
      p.summary = await generateConversationSummary(history, latest)
      if (!p.summary) p.errors.push('summary: no text returned')
    } catch (err) {
      p.errors.push(`summary: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      const self = rows.get(c.id)
      const own = self?.decision_memory && Object.keys(self.decision_memory).length ? self.decision_memory : null
      const prior = pickPriorConversations([...rows.values()], c.id, self?.created_at ?? c.createdAt)
      const extracted = await extractDecisionMemory(
        c.id,
        transcript,
        timezone,
        loopsOnRecord(own, prior),
        new Date(c.lastMessageAt)
      )
      if (!extracted) {
        p.errors.push('decision_memory: unusable extraction')
        continue
      }
      p.resolvedOpenLoops = [
        ...extracted.resolutions.map((r) => `${r.topic} (${r.reason})`),
        ...extracted.reopenings.map((r) => `REOPENED ${r.topic} (${r.reason})`),
      ]
      if (self) {
        self.decision_memory = mergeDecisionMemory(own, extracted.incoming, extracted.resolutions, c.id, undefined, extracted.reopenings)
      }
      const keep = extracted.incoming.open_loops.map((l) => l.topic)
      for (const o of prior) {
        const row = rows.get(o.conversationId)
        const updated = applyLoopChanges(row?.decision_memory ?? null, extracted.resolutions, extracted.reopenings, keep, c.id)
        if (row && updated) {
          row.decision_memory = updated
          touched.add(o.conversationId)
        }
      }
    } catch (err) {
      p.errors.push(`decision_memory: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  for (const id of touched) if (!proposals.has(id)) proposals.set(id, blank(id))
  for (const p of proposals.values()) {
    p.decisionMemory = rows.get(p.conversationId)?.decision_memory ?? null
    p.openLoopsAfter = openTopics(p.decisionMemory)
  }
  return [...proposals.values()]
}
