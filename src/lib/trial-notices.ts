import type { SupabaseClient } from '@supabase/supabase-js'
import { trialEndingLine, type TrialEndingState } from '@/lib/email/trial-emails'

/**
 * Send each running trial ONE plain notice about two days before it ends
 * (Nov 10 2026). Stripe's endpoint here is not subscribed to
 * `customer.subscription.trial_will_end`, and Stripe's own reminder email is a
 * Dashboard setting nobody has confirmed, so without this the only warnings
 * were the in-app notice and the day-0 email.
 *
 * Deterministic, no AI. Runs from the hourly check-in cron whatever
 * YURI_WAKES_UP_MODE says: an account notice must not depend on a feature flag.
 * `ending_notice_sent_at` is stamped only AFTER a send succeeds, so a failure
 * is retried next hour; a trial is noticed at most once.
 *
 * Dependencies are injected so the test executes this against fakes.
 */
export const TRIAL_NOTICE_HOURS_BEFORE = 48

export interface TrialNoticeDeps {
  liveState: (subscriptionId: string) => Promise<TrialEndingState & object>
  emailForUser: (userId: string) => Promise<string | null>
  timezoneForUser: (userId: string) => Promise<string | null>
  send: (to: string, line: string) => Promise<{ sent: boolean; reason?: string }>
}

export interface TrialNoticeResult {
  due: number
  sent: number
  skipped: Record<string, number>
  errors: string[]
}

export async function sendTrialEndingNotices(db: SupabaseClient, deps: TrialNoticeDeps, now: number = Date.now()): Promise<TrialNoticeResult> {
  const out: TrialNoticeResult = { due: 0, sent: 0, skipped: {}, errors: [] }
  const skip = (why: string) => { out.skipped[why] = (out.skipped[why] ?? 0) + 1 }
  const horizon = new Date(now + TRIAL_NOTICE_HOURS_BEFORE * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('ss_trial_starts')
    .select('id, user_id, stripe_subscription_id, trial_end, offer_percent_off')
    .is('ending_notice_sent_at', null)
    .is('paid_at', null)
    .is('lapsed_at', null)
    .gt('trial_end', new Date(now).toISOString())
    .lte('trial_end', horizon)
    .limit(50)
  if (error) {
    out.errors.push(`trial notice load: ${error.message}`)
    return out
  }

  for (const t of (data ?? []) as Array<{ id: string; user_id: string | null; stripe_subscription_id: string | null; trial_end: string; offer_percent_off?: number | string | null }>) {
    out.due++
    try {
      if (!t.user_id) { skip('no_account'); continue }
      const to = await deps.emailForUser(t.user_id)
      if (!to) { skip('no_email'); continue }
      // Ask Stripe; if it cannot be asked the notice still goes, with the date only.
      let state: TrialEndingState = null
      if (t.stripe_subscription_id) {
        try {
          state = await deps.liveState(t.stripe_subscription_id)
        } catch (err) {
          out.errors.push(`trial state ${t.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      const pct = t.offer_percent_off == null ? null : Number(t.offer_percent_off)
      const line = trialEndingLine(t.trial_end, state, await deps.timezoneForUser(t.user_id), pct && pct > 0 ? pct : null)
      const result = await deps.send(to, line)
      if (!result.sent) {
        out.errors.push(`trial notice send ${t.id.slice(0, 8)}: ${result.reason ?? 'unknown'}`)
        continue
      }
      const { error: stampErr } = await db
        .from('ss_trial_starts')
        .update({ ending_notice_sent_at: new Date(now).toISOString() })
        .eq('id', t.id)
        .is('ending_notice_sent_at', null)
      if (stampErr) out.errors.push(`trial notice stamp ${t.id.slice(0, 8)}: ${stampErr.message}`)
      out.sent++
    } catch (err) {
      out.errors.push(`trial notice ${t.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return out
}
