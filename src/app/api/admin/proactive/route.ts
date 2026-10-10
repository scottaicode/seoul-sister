import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { campaignFunnel, type FunnelRow } from '@/lib/proactive/campaign-funnel'

/**
 * GET /api/admin/proactive — the 30-day kill-test scoreboard for "Yuri Wakes Up
 * First". Every number is counted from rows; a query failure is returned as an
 * error string, never as a zero (a failed count that reads 0 is the silent-
 * failure shape this repo keeps paying for).
 *
 * Kill lines (decided before launch, Oct 9 2026):
 *   - leads: < 5% of leads Yuri emailed restart a chat within 14 days → kill
 *   - subscriber check-ins: any unsubscribe rate > 10%, or 0 engaged across the
 *     first 10 graded check-ins → back to the rule-based nudge only
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = getServiceClient()

  const [judgments, lastRuns, subs] = await Promise.all([
    db
      .from('ss_proactive_judgments')
      .select('audience, decision, delivery_status, sent_at, grade, retained_30d, created_at, context_facts')
      .order('created_at', { ascending: false })
      .limit(1000),
    db
      .from('ss_pipeline_runs')
      .select('status, started_at, metadata')
      .eq('run_type', 'yuri_wakes_up')
      .order('started_at', { ascending: false })
      .limit(1),
    db.from('ss_subscriptions').select('user_id, status, created_at'),
  ])

  const errors = [judgments.error, lastRuns.error, subs.error].filter(Boolean).map((e) => e!.message)

  // Owner dogfood rows are excluded from the kill test, as from Yuri's calibration.
  const rows = (judgments.data ?? []).filter(
    (r) => (r.context_facts as Record<string, unknown> | null)?.dogfood !== true
  )
  const tally = (audience: 'lead' | 'subscriber') => {
    const a = rows.filter((r) => r.audience === audience)
    const sent = a.filter((r) => r.decision === 'speak' && r.sent_at)
    const graded = sent.filter((r) => r.grade)
    const by = (g: string) => graded.filter((r) => r.grade === g).length
    const delivered = graded.filter((r) => r.grade !== 'undelivered').length
    return {
      judged: a.length,
      silent: a.filter((r) => r.decision === 'silent').length,
      failed: a.filter((r) => r.decision === 'failed').length,
      blocked: a.filter((r) => r.decision === 'blocked').length,
      spoke: a.filter((r) => r.decision === 'speak').length,
      sent: sent.length,
      graded: graded.length,
      engaged: by('engaged'),
      converted: by('converted'),
      unsubscribed: by('unsubscribed'),
      no_response: by('no_response'),
      undelivered: by('undelivered'),
      // Rates over graded, DELIVERED sends only; null until there is something to divide.
      engaged_or_converted_pct: delivered ? Math.round(((by('engaged') + by('converted')) / delivered) * 1000) / 10 : null,
      unsubscribe_pct: delivered ? Math.round((by('unsubscribed') / delivered) * 1000) / 10 : null,
      retained_30d: audience === 'subscriber' ? sent.filter((r) => r.retained_30d === true).length : undefined,
      retention_checked: audience === 'subscriber' ? sent.filter((r) => r.retained_30d !== null).length : undefined,
    }
  }

  // Paying subscribers past day 10 of their first period and still active.
  const subRows = subs.data ?? []
  const day10Cohort = subRows.filter((s) => Date.now() - new Date(s.created_at as string).getTime() >= 10 * 86400000)
  const survivedDay10 = day10Cohort.filter((s) => s.status === 'active' || s.status === 'trialing').length

  const last = (lastRuns.data ?? [])[0] ?? null

  // Per-source / per-video funnel. Fails loudly into `errors` (e.g. before the
  // ss_campaign_touches migration is applied) rather than rendering zeros.
  let campaigns: FunnelRow[] = []
  try {
    campaigns = await campaignFunnel(db)
  } catch (err) {
    errors.push(`campaign funnel: ${err instanceof Error ? err.message : String(err)}`)
  }

  return NextResponse.json({
    lastRun: last
      ? { status: last.status, at: last.started_at, mode: (last.metadata as Record<string, unknown> | null)?.mode ?? null }
      : null,
    leads: { ...tally('lead'), kill_line_pct: 5, window_days: 14 },
    subscribers: { ...tally('subscriber'), window_days: 7 },
    paidSurvival: { cohort_past_day10: day10Cohort.length, still_active: survivedDay10 },
    campaigns,
    errors,
  })
}
