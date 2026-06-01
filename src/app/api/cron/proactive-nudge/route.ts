import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { getAIContext } from '@/lib/ai-config'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { getCyclePhase } from '@/lib/intelligence/cycle-routine'
import {
  pickNudgeOpportunity,
  type NudgeEligibilityInput,
  type NudgeOpportunity,
  type NudgeTypePerformanceMap,
  type OpenLoop,
} from '@/lib/intelligence/nudge-eligibility'
import { getNudgeTypePerformance } from '@/lib/intelligence/nudge-outcome-grader'
import type { DecisionMemory } from '@/lib/yuri/memory'

export const maxDuration = 60

/**
 * POST /api/cron/proactive-nudge  (also GET — Vercel cron sends GET)
 *
 * Daily (via vercel.json). For each active subscriber, decides whether there's a
 * worthwhile, well-timed nudge and — if so — generates a Yuri-voiced message
 * (Opus 4.8) and writes it to ss_user_nudges (status 'pending'). The dashboard
 * surfaces pending nudges; push is a future delivery adapter on the same rows.
 *
 * Guardrails (the "don't nag / don't pressure" discipline, made mechanical —
 * adapted from LGAAS's nudge crons):
 *   - MAX_NUDGES total per user (3), SPACING_DAYS between them (3)
 *   - Timezone-gated: only queue if it's daytime in the user's local time
 *   - Eligibility is signal-driven (cycle/phase/open-loops/glass-skin), not raw
 *     inactivity — and conservative (null far more often than not)
 *   - Escalation ladder: nudge #1 warm + specific; #2 value; #3 low-pressure, no guilt
 *
 * The message is Yuri continuing care, NOT a standalone recommender — it routes
 * the user back to Yuri with a prefilled ?ask= (Yuri Sole Authority Principle).
 *
 * Observability: every decision (eligible/skipped + why) is logged; the run is
 * recorded to ss_pipeline_runs. No fire-and-forget silent failure (v10.3.4 lesson).
 *
 * Secured with CRON_SECRET header.
 */

const MAX_NUDGES = 3
const SPACING_DAYS = 3
const DAYTIME_START_HOUR = 9 // local
const DAYTIME_END_HOUR = 20 // local (8pm)

interface ProfileRow {
  user_id: string
  skin_type: string | null
  timezone: string | null
  avg_cycle_length: number | null
  cycle_tracking_enabled: boolean | null
  onboarding_completed: boolean | null
  plan: string | null
}

/** Local hour in an IANA timezone, defaulting to a safe daytime hour if unknown. */
function localHour(timezone: string | null): number {
  if (!timezone) return 12 // unknown tz → treat as midday (safe to send)
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).formatToParts(new Date())
    const h = parts.find((p) => p.type === 'hour')?.value
    const n = h ? parseInt(h, 10) : 12
    return Number.isNaN(n) ? 12 : n % 24
  } catch {
    return 12
  }
}

const ESCALATION = [
  // nudge #1
  `This is the FIRST nudge. Warm, specific, low-friction. Reference the actual thing and suggest one concrete next step. One short paragraph.`,
  // nudge #2
  `This is the SECOND nudge. Focus on what they'd gain by picking this back up — the value they're missing. Still warm, no pressure. One short paragraph.`,
  // nudge #3
  `This is the FINAL nudge. Low pressure, leave the door open, NO guilt. Make it clear you're here whenever they're ready and you won't keep bringing it up. One or two sentences.`,
]

async function generateNudgeMessage(
  opportunity: NudgeOpportunity,
  nudgeSequence: number,
  skinType: string | null
): Promise<{ message: string; inputTokens: number; outputTokens: number } | null> {
  const client = getAnthropicClient()
  const ctx = getAIContext('PROACTIVE_NUDGE')
  const ladder = ESCALATION[Math.min(nudgeSequence - 1, ESCALATION.length - 1)]

  const system = `You are Yuri (유리), Seoul Sister's K-beauty advisor — a warm, sharp, Korean-lab-trained older-sister figure. You are writing a SHORT proactive check-in message to a subscriber you've been working with, to gently bring them back at the right moment.

This is NOT a marketing email. It's you continuing their care. It will appear as a small card on their dashboard with a button that opens a conversation with you.

Hard rules:
- Speak in second person ("you"/"your"). You are talking TO her.
- Do NOT make a new skincare recommendation here. You're inviting her back into a conversation where you'll work it out together with her full context. Reference what's pending; don't prescribe.
- No subject line, no greeting like "Hi [name]", no sign-off. Just the message body.
- No em dashes. No "Great question!" / "I'd be happy to" AI-isms.
- Warm and real, like a knowledgeable friend who remembered. Never guilt-trip, never "you haven't been here in a while."
${skinType ? `- Her skin type: ${skinType}.` : ''}

${ladder}`

  const user = `Context (what's pending and why now):
${opportunity.context}

Write the check-in message body now.`

  try {
    const response = await callAnthropicWithRetry(
      () =>
        client.messages.create({
          model: ctx.model,
          max_tokens: ctx.maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      1
    )
    const block = response.content[0]
    if (!block || block.type !== 'text') return null
    const message = block.text.trim()
    if (!message) return null
    return {
      message,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    }
  } catch (err) {
    console.error('[proactive-nudge] message generation failed:', err)
    return null
  }
}

async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  // QA-only timezone-gate bypass. Lets us verify the pipeline outside a user's
  // 9am-8pm window. Hardened so it CANNOT be triggered with the cron secret alone:
  // it requires BOTH ?test=1 AND a separate `x-nudge-test-key` header matching the
  // dedicated NUDGE_TEST_KEY env var. If NUDGE_TEST_KEY is unset, the bypass is
  // simply unavailable (fails closed) — so the timezone gate is always live for
  // the scheduled Vercel cron (which never sends the test key). This keeps the QA
  // tool without coupling it to CRON_SECRET, so a leaked cron secret can't queue
  // off-hours nudges. Every OTHER guard (eligibility, cap, spacing, dedup) stays
  // active regardless, so a test-triggered nudge is still a genuine one.
  const testKey = process.env.NUDGE_TEST_KEY
  const bypassTimezone =
    !!testKey &&
    new URL(request.url).searchParams.get('test') === '1' &&
    request.headers.get('x-nudge-test-key') === testKey

  const startedAt = Date.now()
  const db = getServiceClient()

  const stats = {
    subscribersScanned: 0,
    skippedTimezone: 0,
    skippedCapOrSpacing: 0,
    skippedNoOpportunity: 0,
    skippedDuplicate: 0,
    nudgesCreated: 0,
    errors: 0,
  }

  try {
    // Active subscribers only: onboarded + a pro plan.
    const { data: profiles, error: profErr } = await db
      .from('ss_user_profiles')
      .select('user_id, skin_type, timezone, avg_cycle_length, cycle_tracking_enabled, onboarding_completed, plan')
      .eq('onboarding_completed', true)
      .like('plan', 'pro%')

    if (profErr) {
      console.error('[proactive-nudge] profile load failed:', profErr.message)
      return NextResponse.json({ error: 'profile load failed' }, { status: 500 })
    }

    const todayIso = new Date().toISOString().slice(0, 10)

    // v10.11.0 — measured-outcome calibration. Load once; passed into every
    // eligibility call so the engine deprioritizes nudge types that the outcome
    // teacher has shown don't move skin. Empty map until enough graded data exists,
    // in which case it has no effect (conservative — see nudge-eligibility.ts).
    const typePerformance: NudgeTypePerformanceMap = await getNudgeTypePerformance()

    for (const p of (profiles ?? []) as ProfileRow[]) {
      stats.subscribersScanned++
      try {
        // --- Timezone gate: only queue during local daytime ---
        // (?test=1 bypasses this gate only — see handler top.)
        const hour = localHour(p.timezone)
        if (!bypassTimezone && (hour < DAYTIME_START_HOUR || hour >= DAYTIME_END_HOUR)) {
          stats.skippedTimezone++
          continue
        }

        // --- Cap + spacing gate ---
        const { data: priorNudges } = await db
          .from('ss_user_nudges')
          .select('id, created_at, reason: trigger_reason, status')
          .eq('user_id', p.user_id)
          .order('created_at', { ascending: false })

        const nudgeCount = priorNudges?.length ?? 0
        if (nudgeCount >= MAX_NUDGES) {
          stats.skippedCapOrSpacing++
          continue
        }
        if (nudgeCount > 0) {
          const last = new Date(priorNudges![0].created_at).getTime()
          const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24)
          if (daysSince < SPACING_DAYS) {
            stats.skippedCapOrSpacing++
            continue
          }
        }

        // --- Gather signals ---
        // Active treatment phase
        const { data: activePhaseRow } = await db
          .from('ss_treatment_phases')
          .select('phase_number, name, goal')
          .eq('user_id', p.user_id)
          .eq('status', 'active')
          .maybeSingle()

        // Active routines → which phase numbers do their names reference?
        const { data: routines } = await db
          .from('ss_user_routines')
          .select('name')
          .eq('user_id', p.user_id)
          .eq('is_active', true)
        const activeRoutinePhaseNumbers = Array.from(
          new Set(
            (routines ?? [])
              .map((r) => {
                const m = (r.name || '').match(/phase\s+(\d+)/i)
                return m ? parseInt(m[1], 10) : null
              })
              .filter((n): n is number => n !== null)
          )
        )

        // Open loops from the most recent conversation memory
        const { data: memConvs } = await db
          .from('ss_yuri_conversations')
          .select('decision_memory')
          .eq('user_id', p.user_id)
          .not('decision_memory', 'eq', '{}')
          .order('created_at', { ascending: false })
          .limit(3)
        const openLoopMap = new Map<string, OpenLoop>()
        for (const c of memConvs ?? []) {
          const dm = c.decision_memory as DecisionMemory | null
          for (const l of dm?.open_loops ?? []) {
            const key = l.topic.toLowerCase()
            const prev = openLoopMap.get(key)
            // keep earliest opened_date for honest staleness
            if (!prev || l.opened_date < prev.opened_date) openLoopMap.set(key, l)
          }
        }
        const openLoops = Array.from(openLoopMap.values())

        // Glass skin staleness
        const { data: lastScore } = await db
          .from('ss_glass_skin_scores')
          .select('created_at')
          .eq('user_id', p.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const daysSinceLastGlassScore = lastScore?.created_at
          ? Math.floor((Date.now() - new Date(lastScore.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : null

        // Cycle snapshot
        let cycle: NudgeEligibilityInput['cycle'] = null
        if (p.cycle_tracking_enabled) {
          const { data: cycleEntry } = await db
            .from('ss_user_cycle_tracking')
            .select('cycle_start_date, cycle_length_days')
            .eq('user_id', p.user_id)
            .order('cycle_start_date', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (cycleEntry?.cycle_start_date) {
            const len = p.avg_cycle_length || cycleEntry.cycle_length_days || 28
            const info = getCyclePhase(cycleEntry.cycle_start_date, len)
            cycle = { phase: info.phase, dayInCycle: info.day_in_cycle }
          }
        }

        // --- Decide ---
        const opportunity = pickNudgeOpportunity({
          activePhase: activePhaseRow
            ? {
                phase_number: activePhaseRow.phase_number,
                name: activePhaseRow.name,
                goal: activePhaseRow.goal,
              }
            : null,
          activeRoutinePhaseNumbers,
          openLoops,
          daysSinceLastGlassScore,
          cycle,
          todayIso,
          typePerformance,
        })

        if (!opportunity) {
          stats.skippedNoOpportunity++
          continue
        }

        // Don't repeat the same reason we've already nudged about.
        const alreadyNudgedReason = (priorNudges ?? []).some(
          (n) => (n as { reason?: string }).reason === opportunity.reason
        )
        if (alreadyNudgedReason) {
          stats.skippedDuplicate++
          continue
        }

        // --- Generate the Yuri-voiced message (Opus 4.8) ---
        const nudgeSequence = nudgeCount + 1
        const gen = await generateNudgeMessage(opportunity, nudgeSequence, p.skin_type)
        if (!gen) {
          stats.errors++
          continue
        }

        void logAIUsage({
          feature: 'proactive_nudge',
          model: getAIContext('PROACTIVE_NUDGE').model,
          inputTokens: gen.inputTokens,
          outputTokens: gen.outputTokens,
          userId: p.user_id,
        })

        const deepLink = `/yuri?ask=${encodeURIComponent(opportunity.suggestedAsk)}`

        const { error: insErr } = await db.from('ss_user_nudges').insert({
          user_id: p.user_id,
          nudge_type: opportunity.type,
          trigger_reason: opportunity.reason,
          message: gen.message,
          deep_link: deepLink,
          nudge_sequence: nudgeSequence,
          status: 'pending',
        })
        if (insErr) {
          stats.errors++
          console.error(`[proactive-nudge] insert failed for ${p.user_id}:`, insErr.message)
          continue
        }
        stats.nudgesCreated++
      } catch (err) {
        stats.errors++
        console.error(`[proactive-nudge] error for ${p.user_id}:`, err)
      }
    }

    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'proactive_nudge',
      status: 'completed',
      products_scraped: stats.subscribersScanned,
      products_processed: stats.nudgesCreated,
      products_failed: stats.errors,
      completed_at: new Date().toISOString(),
      metadata: { trigger: bypassTimezone ? 'manual_test' : 'cron', schedule: 'daily', timezone_bypassed: bypassTimezone, ...stats, duration_ms: Date.now() - startedAt },
    }).then(({ error }) => {
      if (error) console.error('[proactive-nudge] run log insert failed:', error.message)
    })

    return NextResponse.json({ success: true, ...stats })
  } catch (err) {
    console.error('[proactive-nudge] failed:', err)
    return NextResponse.json({ error: 'nudge run failed' }, { status: 500 })
  }
}

export const POST = handler
export { handler as GET }
