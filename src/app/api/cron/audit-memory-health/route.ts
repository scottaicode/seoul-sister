import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 60

/**
 * POST /api/cron/audit-memory-health  (also GET — Vercel cron sends GET)
 *
 * Weekly (Sundays 7:30 AM UTC via vercel.json). The TRIPWIRE for silent memory
 * failure. It writes nothing to memory — it only detects and LOGS conditions that
 * would otherwise stay invisible until a user noticed Yuri forgetting things:
 *
 *   - Conversations with >=6 messages but empty decision_memory ('{}') —
 *     extraction silently failed or never fired (the v10.3.4 class: 3 months of
 *     decision memory were lost this way behind a fire-and-forget .catch()).
 *   - Open loops older than 30 days, still unresolved — stuck loops that the
 *     nudge engine should have closed or the user abandoned.
 *   - Durable corrections store staleness — rollup cron not advancing it.
 *
 * Findings go to ss_pipeline_runs.metadata + console.warn (the v10.3.5 visibility
 * pattern). This is the observability LGAAS wished it had before its May 19 2026
 * extraction-truncation gap went unnoticed for a week.
 *
 * Secured with CRON_SECRET header.
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  const db = getServiceClient()

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Conversations that SHOULD have extracted memory but didn't.
    //    >=6 messages is the extraction-eligibility floor; '{}' means nothing landed.
    const { data: convs, error: convErr } = await db
      .from('ss_yuri_conversations')
      .select('id, user_id, decision_memory, created_at')
      .eq('decision_memory', '{}')

    let emptyMemoryConvos = 0
    const emptyMemorySample: Array<{ id: string; user_id: string; msgs: number }> = []
    if (!convErr && convs) {
      // Only count those with >=6 messages (cheap per-conversation count).
      for (const c of convs) {
        const { count } = await db
          .from('ss_yuri_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
        if ((count ?? 0) >= 6) {
          emptyMemoryConvos++
          if (emptyMemorySample.length < 10) {
            emptyMemorySample.push({ id: c.id, user_id: c.user_id, msgs: count ?? 0 })
          }
        }
      }
    } else if (convErr) {
      console.error('[audit-memory-health] convo scan failed:', convErr.message)
    }

    // 2. Stale open loops (>30 days, still surfaced). Scan recent decision_memory.
    const { data: loopConvs } = await db
      .from('ss_yuri_conversations')
      .select('user_id, decision_memory')
      .not('decision_memory', 'eq', '{}')
    let staleOpenLoops = 0
    const staleLoopSample: Array<{ user_id: string; topic: string; opened: string }> = []
    for (const row of loopConvs ?? []) {
      const dm = row.decision_memory as { open_loops?: Array<{ topic: string; opened_date: string }> } | null
      for (const l of dm?.open_loops ?? []) {
        if (l.opened_date && l.opened_date < thirtyDaysAgo.slice(0, 10)) {
          staleOpenLoops++
          if (staleLoopSample.length < 10) {
            staleLoopSample.push({ user_id: row.user_id, topic: l.topic, opened: l.opened_date })
          }
        }
      }
    }

    // 3. Durable store staleness — is the rollup advancing it?
    let durableUsers = 0
    let durableStaleUsers = 0
    let durableTableMissing = false
    {
      const { data: mem, error: memErr } = await db
        .from('ss_user_memory')
        .select('user_id, updated_at')
      if (memErr) {
        if (
          memErr.code === '42P01' ||
          memErr.message?.toLowerCase().includes('does not exist') ||
          memErr.message?.toLowerCase().includes('could not find the table')
        ) {
          durableTableMissing = true
        } else {
          console.error('[audit-memory-health] durable store scan failed:', memErr.message)
        }
      } else if (mem) {
        durableUsers = mem.length
        for (const m of mem) {
          if (m.updated_at && m.updated_at < thirtyDaysAgo) durableStaleUsers++
        }
      }
    }

    const findings = {
      empty_memory_conversations: emptyMemoryConvos,
      empty_memory_sample: emptyMemorySample,
      stale_open_loops: staleOpenLoops,
      stale_loop_sample: staleLoopSample,
      durable_store_users: durableUsers,
      durable_store_stale_users: durableStaleUsers,
      durable_table_missing: durableTableMissing,
    }

    // VISIBLE warnings — the whole point of this cron.
    if (emptyMemoryConvos > 0) {
      console.warn(
        `[audit-memory-health] ${emptyMemoryConvos} conversation(s) with >=6 messages have EMPTY decision_memory — extraction may be silently failing. Sample: ${JSON.stringify(emptyMemorySample)}`
      )
    }
    if (staleOpenLoops > 0) {
      console.warn(`[audit-memory-health] ${staleOpenLoops} open loop(s) unresolved >30 days.`)
    }
    if (durableTableMissing) {
      console.warn('[audit-memory-health] ss_user_memory not applied yet (migration pending).')
    }

    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'memory_health_audit',
      status: 'completed',
      products_failed: emptyMemoryConvos, // reuse column as the headline alarm count
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly_sun_730am_utc',
        ...findings,
        duration_ms: Date.now() - startedAt,
      },
    }).then(({ error }) => {
      if (error) console.error('[audit-memory-health] run log insert failed:', error.message)
    })

    return NextResponse.json({ success: true, ...findings })
  } catch (err) {
    console.error('[audit-memory-health] failed:', err)
    return NextResponse.json({ error: 'audit failed' }, { status: 500 })
  }
}

export const POST = handler
export { handler as GET }
