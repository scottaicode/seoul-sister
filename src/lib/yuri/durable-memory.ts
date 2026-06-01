/**
 * v10.10.0 — Durable per-user memory (LGAAS Blueprint 79 pattern, adapted).
 *
 * Yuri's `decision_memory.corrections[]` lives on individual conversation rows,
 * and the context loader (loadDecisionMemory) reads only the 3 MOST RECENT
 * conversations. So a correction the user made 5 conversations ago silently ages
 * out of Yuri's context — she'll repeat the mistake the user already corrected.
 *
 * Corrections are ground truth ("every correction by definition is ground truth"),
 * so they must persist FOREVER, not just for 3 conversations. This module
 * consolidates every user's corrections from recent conversations into a durable
 * per-user store (ss_user_memory.durable_corrections), and exposes a loader the
 * Yuri context path can union in.
 *
 * Why a weekly cron rather than inline-on-every-conversation: failure isolation.
 * The rollup runs in a separate execution from the advisor request path, so even
 * if it throws it cannot affect a live Yuri conversation. (LGAAS learned this the
 * hard way — their inline-on-every-turn attempt caused a production outage.)
 * Lag of up to 7 days is acceptable because the windowed pool (3 recent
 * conversations) keeps recent corrections visible during the lag.
 */

import { getServiceClient } from '@/lib/supabase'
import type { DecisionMemory } from './memory'

type Correction = DecisionMemory['corrections'][number]

export interface DurableRollupResult {
  usersScanned: number
  usersUpdated: number
  correctionsPromoted: number
  errors: number
  /** true if ss_user_memory doesn't exist yet (migration not applied) */
  tableMissing: boolean
}

/**
 * Detect "relation does not exist" so the rollup degrades gracefully before the
 * migration is applied (MCP is read-only in this env; migrations apply via Studio).
 */
function isMissingTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  return (
    err.code === '42P01' ||
    !!err.message?.toLowerCase().includes('does not exist') ||
    !!err.message?.toLowerCase().includes('could not find the table')
  )
}

/** Dedup corrections by topic, latest date wins. */
function mergeCorrections(base: Correction[], incoming: Correction[]): Correction[] {
  const map = new Map<string, Correction>()
  for (const c of base) {
    if (c?.topic) map.set(c.topic.toLowerCase(), c)
  }
  for (const c of incoming) {
    if (!c?.topic) continue
    const key = c.topic.toLowerCase()
    const prev = map.get(key)
    // Latest date wins; if no/equal dates, incoming wins (it's from a more recent scan)
    if (!prev || !prev.date || (c.date && c.date >= prev.date)) {
      map.set(key, c)
    }
  }
  return Array.from(map.values())
}

/**
 * Consolidate corrections from every user's recent conversations into the durable
 * per-user store. Pure DB work, no AI. Per-user try/catch so one bad row never
 * aborts the batch.
 */
export async function rollupDurableCorrections(): Promise<DurableRollupResult> {
  const db = getServiceClient()
  const result: DurableRollupResult = {
    usersScanned: 0,
    usersUpdated: 0,
    correctionsPromoted: 0,
    errors: 0,
    tableMissing: false,
  }

  // Find all users who have any conversation with non-empty decision_memory.
  const { data: convs, error: convErr } = await db
    .from('ss_yuri_conversations')
    .select('user_id, decision_memory, updated_at')
    .not('decision_memory', 'eq', '{}')
    .order('updated_at', { ascending: false })

  if (convErr) {
    console.error('[durable-memory] conversation scan failed:', convErr.message)
    result.errors++
    return result
  }

  // Group corrections by user across ALL their conversations (not just recent 3 —
  // this is the whole point: capture corrections the windowed loader would miss).
  const byUser = new Map<string, Correction[]>()
  for (const row of convs ?? []) {
    const dm = row.decision_memory as DecisionMemory | null
    const corrections = dm?.corrections
    if (!Array.isArray(corrections) || corrections.length === 0) continue
    const list = byUser.get(row.user_id) ?? []
    list.push(...corrections.filter((c) => c?.topic && c?.truth))
    byUser.set(row.user_id, list)
  }

  for (const [userId, freshCorrections] of byUser) {
    result.usersScanned++
    try {
      // Load existing durable store
      const { data: existing, error: readErr } = await db
        .from('ss_user_memory')
        .select('durable_corrections')
        .eq('user_id', userId)
        .maybeSingle()

      if (readErr) {
        if (isMissingTable(readErr)) {
          result.tableMissing = true
          console.warn('[durable-memory] ss_user_memory not found — migration not applied yet')
          return result
        }
        result.errors++
        console.error(`[durable-memory] read failed for ${userId}:`, readErr.message)
        continue
      }

      const baseCorrections = (existing?.durable_corrections as Correction[] | null) ?? []
      const merged = mergeCorrections(baseCorrections, freshCorrections)

      // Only write if something changed (avoid pointless updated_at churn).
      if (merged.length === baseCorrections.length) {
        // Same count could still mean a topic's content was refreshed; cheap to
        // compare serialized form.
        if (JSON.stringify(merged) === JSON.stringify(baseCorrections)) continue
      }

      const { error: upErr } = await db.from('ss_user_memory').upsert(
        {
          user_id: userId,
          durable_corrections: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (upErr) {
        if (isMissingTable(upErr)) {
          result.tableMissing = true
          return result
        }
        result.errors++
        console.error(`[durable-memory] upsert failed for ${userId}:`, upErr.message)
        continue
      }

      result.usersUpdated++
      result.correctionsPromoted += merged.length - baseCorrections.length
    } catch (err) {
      result.errors++
      console.error(`[durable-memory] unexpected error for ${userId}:`, err)
    }
  }

  return result
}

/**
 * Load a user's durable corrections for injection into Yuri's context. Returns []
 * if the table doesn't exist yet or on any error (non-critical — the windowed
 * corrections still render).
 */
export async function loadDurableCorrections(
  db: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<Correction[]> {
  try {
    const { data, error } = await db
      .from('ss_user_memory')
      .select('durable_corrections')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return []
    return (data?.durable_corrections as Correction[] | null) ?? []
  } catch {
    return []
  }
}
