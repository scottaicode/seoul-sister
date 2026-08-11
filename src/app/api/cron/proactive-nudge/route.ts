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
import {
  getLocalClock,
  clockFactBlock,
  daysBetweenIso,
  type LocalClock,
} from '@/lib/yuri/clock'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { sendNudgeEmail, type NudgeEmailStatus } from '@/lib/email/nudge-email'
import type { SupabaseClient } from '@supabase/supabase-js'

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
 *   - MAX_NUDGES (3) per rolling NUDGE_WINDOW_DAYS (30), SPACING_DAYS (3) apart.
 *     A ROLLING window, not a lifetime cap: a lifetime cap made Yuri permanently
 *     unreachable after 3 nudges, which stranded the most engaged subscriber on
 *     the platform for 53 days. Subscriber care is ongoing; nurture is finite.
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

/** Max nudges per user within NUDGE_WINDOW_DAYS (a rolling window, NOT a lifetime cap). */
const MAX_NUDGES = 3
/**
 * The rolling window the cap applies over (v11.23.1). Chosen to match the
 * monthly billing rhythm: a subscriber can hear from Yuri proactively at most
 * three times per billing period, and never more often than SPACING_DAYS apart.
 */
const NUDGE_WINDOW_DAYS = 30
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
  nudge_email_opt_out: boolean | null
  nudge_unsubscribe_token: string | null
}

/**
 * A subscriber's email address lives ONLY in auth.users — ss_user_profiles has
 * no email column. Resolved per-user after the send decision rather than via a
 * bulk listUsers() up front: only a handful of subscribers clear every gate on
 * any given day, so this is both cheaper and keeps addresses out of memory for
 * users we aren't contacting.
 *
 * Never throws — a failed lookup degrades to an in-app-only nudge (recorded as
 * email_status 'no_address'), which is strictly better than losing the nudge.
 */
async function resolveUserEmail(
  db: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(userId)
    if (error) {
      console.error(`[proactive-nudge] email lookup failed for ${userId}:`, error.message)
      return null
    }
    return data?.user?.email ?? null
  } catch (err) {
    console.error(`[proactive-nudge] email lookup threw for ${userId}:`, err)
    return null
  }
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
  skinType: string | null,
  /**
   * v11.25.0 — the user's local clock, plus the date Yuri promised (when she
   * named one) and how late this nudge is running.
   *
   * Without these, the message-writer had NO clock at all: given a genuine
   * memory that she'd promised to check in Sunday, Yuri wrote "Sunday's here"
   * and it shipped on a Tuesday. She wasn't inventing the promise — she kept it,
   * five times over — she simply had no way to know what day it was.
   */
  clock: LocalClock,
  promise: { checkBackDate: string | null; daysLate: number | null }
): Promise<{ message: string; inputTokens: number; outputTokens: number } | null> {
  const client = getAnthropicClient()
  const ctx = getAIContext('PROACTIVE_NUDGE')
  const ladder = ESCALATION[Math.min(nudgeSequence - 1, ESCALATION.length - 1)]

  const system = `You are Yuri (유리), Seoul Sister's K-beauty advisor — a warm, sharp, Korean-lab-trained older-sister figure. You are writing a SHORT proactive check-in message to a subscriber you've been working with, to gently bring them back at the right moment.

This is NOT a marketing email. It's you continuing their care. She'll see it as a short note from you (in her inbox and on her dashboard) with a button that opens a conversation with you.

Hard rules:
- Speak in second person ("you"/"your"). You are talking TO her.
- Do NOT make a new skincare recommendation here. You're inviting her back into a conversation where you'll work it out together with her full context. Reference what's pending; don't prescribe.
- No subject line, no greeting like "Hi [name]", no sign-off. Just the message body.
- No em dashes. No "Great question!" / "I'd be happy to" AI-isms.
- Any day, date, or timing you reference must come from the TODAY'S DATE facts below. Never state or imply a weekday that isn't given there. If you promised to check in on a day that has already passed, being straightforward about running late is fine and reads as honest; pretending the promised day is today does not.
- Warm and real, like a knowledgeable friend who remembered. Never guilt-trip, never "you haven't been here in a while."
${skinType ? `- Her skin type: ${skinType}.` : ''}

${ladder}`

  // Facts about WHEN this is being sent. Stated, not commanded — Yuri decides
  // what (if anything) to do with them. She may name the day, acknowledge being
  // late, or say nothing about timing at all; all three are legitimate. This
  // block must never become an instruction about what to SAY (guard test:
  // tests/nudge-date-honesty.test.mjs).
  const timing = [
    clockFactBlock(clock),
    promise.checkBackDate
      ? `You told her you'd check back around ${promise.checkBackDate}.${
          promise.daysLate !== null && promise.daysLate > 0
            ? ` That was ${promise.daysLate} day${promise.daysLate === 1 ? '' : 's'} ago, so this check-in is running late.`
            : promise.daysLate === 0
              ? ` That is today.`
              : ''
        }`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const user = `${timing}

Context (what's pending and why now):
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
    emailsSent: 0,
    // Full outcome breakdown so a systemic delivery problem (every send
    // 'no_address', or a run of 'send_failed') is visible in ss_pipeline_runs
    // rather than needing a Resend dashboard login.
    emailOutcomes: {} as Partial<Record<NudgeEmailStatus, number>>,
    errors: 0,
  }

  try {
    // Active subscribers only: onboarded + a pro plan.
    const { data: profiles, error: profErr } = await db
      .from('ss_user_profiles')
      .select('user_id, skin_type, timezone, avg_cycle_length, cycle_tracking_enabled, onboarding_completed, plan, nudge_email_opt_out, nudge_unsubscribe_token')
      .eq('onboarding_completed', true)
      .like('plan', 'pro%')

    if (profErr) {
      console.error('[proactive-nudge] profile load failed:', profErr.message)
      return NextResponse.json({ error: 'profile load failed' }, { status: 500 })
    }

    // NOTE: deliberately NOT a shared UTC "today". A single server-UTC date
    // applied to every user makes a promised check-back land a day early or late
    // for anyone west of Greenwich. Each user's date is resolved from their own
    // timezone below (getLocalClock). See NUDGE-DATE-HONESTY-FIX.md.

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
        // A failed query here would read as "this user has never been nudged"
        // and hand out a fresh quota — the exact silent-failure shape that
        // disabled conflict checking in v11.18.0. Treat it as an error and skip.
        const { data: priorNudges, error: priorErr } = await db
          .from('ss_user_nudges')
          .select('id, created_at, reason: trigger_reason, status')
          .eq('user_id', p.user_id)
          .order('created_at', { ascending: false })

        if (priorErr) {
          stats.errors++
          console.error(
            `[proactive-nudge] prior-nudge load failed for ${p.user_id}:`,
            priorErr.message
          )
          continue
        }

        const allNudges = priorNudges ?? []

        // ROLLING WINDOW (v11.23.1), replacing a LIFETIME cap.
        //
        // MAX_NUDGES used to count every nudge a user had ever received, which
        // made Yuri permanently unreachable after 3. Bailey hit that ceiling on
        // June 11 and the engine could never contact her again — 53 days and
        // counting, for the single most engaged subscriber on the platform.
        //
        // That shape was inherited from lead nurture, where the relationship is
        // finite: warm a prospect a few times, then stop. A paying subscriber is
        // the opposite — the care is ongoing and they are paying for continuity.
        // "Yuri proactively checks in at most three times, ever, then goes
        // silent forever" is not a defensible rule for a $24.99/mo advisor.
        //
        // Every anti-nag property is preserved: at most MAX_NUDGES in any
        // NUDGE_WINDOW_DAYS, and never closer together than SPACING_DAYS. The
        // realistic ceiling stays ~1 per 10 days. What changes is only that the
        // silence eventually lifts.
        const windowStart = Date.now() - NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000
        const nudgesInWindow = allNudges.filter(
          (n) => new Date(n.created_at).getTime() >= windowStart
        )

        if (nudgesInWindow.length >= MAX_NUDGES) {
          stats.skippedCapOrSpacing++
          continue
        }
        // Spacing is measured against the most recent nudge of ALL time, not
        // just the window — otherwise a nudge falling out of the window could
        // let a new one fire too soon after it.
        if (allNudges.length > 0) {
          const last = new Date(allNudges[0].created_at).getTime()
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
        // This user's own calendar date, not the server's.
        const clock = getLocalClock(p.timezone)
        const todayIso = clock.isoDate
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
        // Deliberately LIFETIME-scoped, not window-scoped. The rolling window
        // above governs how OFTEN Yuri may reach out; this governs whether she
        // repeats herself, and repeating an identical ask is annoying no matter
        // how much time has passed. Loosening this is a separate decision that
        // should wait for real acted/dismissed data (there are 5 nudges total on
        // the platform today, and MIN_SAMPLE for the outcome teacher is 5).
        const alreadyNudgedReason = allNudges.some(
          (n) => (n as { reason?: string }).reason === opportunity.reason
        )
        if (alreadyNudgedReason) {
          stats.skippedDuplicate++
          continue
        }

        // --- Generate the Yuri-voiced message (Opus 4.8) ---
        // The escalation ladder is scoped to the WINDOW, not to all time. It has
        // to be: a lifetime sequence means everyone is permanently pinned at
        // rung 3 ("I won't keep bringing it up"), so a check-in six months later
        // would open by apologizing for pestering someone we haven't contacted
        // since spring. Resetting with the window keeps warm/value/back-off in
        // its intended proportion inside each stretch of contact.
        const nudgeSequence = nudgesInWindow.length + 1
        const promisedDate = opportunity.promisedCheckBackDate ?? null
        const gen = await generateNudgeMessage(opportunity, nudgeSequence, p.skin_type, clock, {
          checkBackDate: promisedDate,
          daysLate: promisedDate ? daysBetweenIso(promisedDate, clock.isoDate) : null,
        })
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

        const { data: inserted, error: insErr } = await db
          .from('ss_user_nudges')
          .insert({
            user_id: p.user_id,
            nudge_type: opportunity.type,
            trigger_reason: opportunity.reason,
            message: gen.message,
            deep_link: deepLink,
            nudge_sequence: nudgeSequence,
            status: 'pending',
          })
          .select('id')
          .single()
        if (insErr || !inserted) {
          stats.errors++
          console.error(`[proactive-nudge] insert failed for ${p.user_id}:`, insErr?.message)
          continue
        }
        stats.nudgesCreated++

        // --- Deliver by email (v11.23.0) -------------------------------------
        // The dashboard card alone waits for the user to return in order to
        // deliver a message whose purpose is getting them to return. Email
        // reaches them where they already are. This does NOT touch `status` —
        // the card still surfaces the same row independently.
        //
        // Best-effort: a delivery failure never rolls back the nudge and never
        // aborts the remaining subscribers, but every outcome is persisted to
        // email_status and counted here (no silent failure — v10.3.4).
        const emailStatus = await sendNudgeEmail(
          await resolveUserEmail(db, p.user_id),
          p.nudge_email_opt_out === true,
          {
            nudgeId: inserted.id,
            message: gen.message,
            deepLink,
            nudgeType: opportunity.type,
            nudgeSequence,
            unsubscribeToken: p.nudge_unsubscribe_token ?? null,
          }
        )
        stats.emailOutcomes[emailStatus] = (stats.emailOutcomes[emailStatus] ?? 0) + 1
        if (emailStatus === 'sent') stats.emailsSent++
      } catch (err) {
        stats.errors++
        console.error(`[proactive-nudge] error for ${p.user_id}:`, err)
      }
    }

    await logPipelineRun(db, {
      run_type: 'proactive_nudge',
      status: 'completed',
      products_scraped: stats.subscribersScanned,
      products_processed: stats.nudgesCreated,
      products_failed: stats.errors,
      completed_at: new Date().toISOString(),
      metadata: { trigger: bypassTimezone ? 'manual_test' : 'cron', schedule: 'daily', timezone_bypassed: bypassTimezone, ...stats, duration_ms: Date.now() - startedAt },
    })

    return NextResponse.json({ success: true, ...stats })
  } catch (err) {
    console.error('[proactive-nudge] failed:', err)
    return NextResponse.json({ error: 'nudge run failed' }, { status: 500 })
  }
}

export const POST = handler
export { handler as GET }
