import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { logPipelineRun } from '@/lib/pipeline/log-run'

/**
 * GLOBAL widget spend circuit breaker (July 27 2026).
 *
 * Every pre-existing widget limit is scoped to ONE visitor or ONE IP:
 *   - 12 lifetime messages per visitor UUID
 *   - 40 preview messages per IP / 30 days
 *   - 25 messages per IP / day (abuse)
 *
 * None of them bounds TOTAL spend. A thousand distinct IPs each behaving
 * perfectly legally under those limits produces an unbounded Opus bill with
 * nothing to stop it — which is exactly the traffic-surge scenario this exists
 * for. This is the only ceiling that caps the whole surface at once.
 *
 * It is a COST backstop, not an abuse filter. It cannot tell a bot from a
 * genuine visitor and does not try to: past the ceiling, everyone gets the
 * degraded path. That is deliberate — the failure mode of guessing wrong about
 * who is real is worse than the failure mode of throttling everyone briefly.
 *
 * Sized for ~30x current volume (~5-15 msgs/day), so under normal operation it
 * NEVER fires. If it starts tripping routinely that is a signal to raise the
 * ceiling (real growth) — not a limit to live inside.
 */

/** Max widget messages across ALL visitors per rolling window. */
export const GLOBAL_DAILY_MESSAGE_CEILING = Number(
  process.env.WIDGET_GLOBAL_DAILY_CEILING || 500
)

export const GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000

/** Fixed key — not per-visitor/IP. That's the whole point. */
const GLOBAL_KEY = 'widget-global-daily'

export interface BreakerState {
  tripped: boolean
  remaining: number
  resetIn: number
}

/**
 * Consume one unit of the global budget. Call ONCE per message that will
 * actually reach Opus, before the model call.
 *
 * Fails OPEN: if the counter itself errors, visitors keep talking to Yuri. A
 * broken meter must never take the product down — the spend alert and the
 * per-visitor caps are the backstop behind this backstop.
 */
export async function consumeGlobalBudget(): Promise<BreakerState> {
  try {
    const result = await checkRateLimit(
      GLOBAL_KEY,
      GLOBAL_DAILY_MESSAGE_CEILING,
      GLOBAL_WINDOW_MS
    )
    return {
      tripped: !result.allowed,
      remaining: result.remaining,
      resetIn: result.resetIn,
    }
  } catch (err) {
    console.error(
      '[widget-breaker] budget check FAILED — failing open, Yuri stays up:',
      err
    )
    return { tripped: false, remaining: -1, resetIn: 0 }
  }
}

/**
 * Record a breaker trip to ss_pipeline_runs so a surge is VISIBLE rather than a
 * silent wall of degraded conversations. Deliberately mirrors the cron logging
 * convention (the v10.3.4 / May-5 silent-failure class): if this fires, it must
 * show up somewhere Scott actually looks.
 *
 * De-duped to one log per hour — a real surge trips this on every request, and
 * a thousand identical rows would bury the signal it exists to send.
 */
let lastTripLoggedAt = 0
const TRIP_LOG_INTERVAL_MS = 60 * 60 * 1000

export async function logBreakerTrip(state: BreakerState): Promise<void> {
  const now = Date.now()
  if (now - lastTripLoggedAt < TRIP_LOG_INTERVAL_MS) return
  lastTripLoggedAt = now

  console.warn(
    `[widget-breaker] TRIPPED — global ceiling of ${GLOBAL_DAILY_MESSAGE_CEILING} widget messages/24h reached. ` +
      `Widget is in degraded (email-capture) mode; resets in ~${Math.ceil(state.resetIn / 60000)}m.`
  )

  try {
    await logPipelineRun(getServiceClient(), {
      run_type: 'widget_circuit_breaker',
      status: 'completed_with_errors',
      source: 'widget',
      metadata: {
        event: 'global_ceiling_reached',
        ceiling: GLOBAL_DAILY_MESSAGE_CEILING,
        reset_in_ms: state.resetIn,
        tripped_at: new Date().toISOString(),
        note: 'Widget degraded to email capture. Raise WIDGET_GLOBAL_DAILY_CEILING if this is real growth.',
      },
    })
  } catch (err) {
    console.error('[widget-breaker] trip logging failed:', err)
  }
}

/**
 * The visitor-facing degraded message.
 *
 * Deliberately NOT a templated skincare answer. Yuri does not run here, so she
 * does not speak here — a canned reply wearing her voice would be exactly the
 * fake-confidence failure the v10.2.1 tool-call-honesty rule exists to prevent,
 * and the Yuri Sole Authority Principle means no non-Yuri surface invents
 * advice. This says plainly that she's at capacity and offers the one genuinely
 * useful thing available: leave an email and she picks it up for real.
 */
export const BREAKER_MESSAGE =
  "Yuri's at capacity right now — a lot of people showed up at once. " +
  "Leave your email and she'll pick this up with you personally as soon as she's free."
