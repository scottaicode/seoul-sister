/**
 * Seoul Sister Guardian — Health Check core (READ-ONLY)
 * =====================================================
 * Shared health-probe logic used by BOTH:
 *   - the server-side always-on watcher cron (`/api/cron/guardian-watch`)
 *   - the local CLI (`scripts/guardian-healthcheck.ts`)
 *
 * Single source of truth. Queries the observability spine and returns a
 * structured report with a severity per signal. Writes NOTHING (per
 * GUARDIAN-CHARTER.md Tier 3: monitoring reads only; corpus writes never).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type Severity = 'ok' | 'info' | 'warn' | 'critical'

export interface Signal {
  key: string
  severity: Severity
  summary: string
  detail?: Record<string, unknown>
}

export interface HealthReport {
  generated_at: string
  overall: Severity
  counts: Record<Severity, number>
  signals: Signal[]
}

const BAILEY = '551569d3-aed0-4feb-a340-47bfb146a835'
const SEVERITY_ORDER: Record<Severity, number> = { critical: 3, warn: 2, info: 1, ok: 0 }

const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

/**
 * Extract a human-readable message from any thrown value. Supabase errors are
 * plain objects, so `String(err)` yields "[object Object]" and hides the real
 * cause. This surfaces the actual message (v10.13.1 — make failures visible,
 * the v10.3.5 fire-and-forget lesson applied to the Guardian's own tooling).
 */
function errMsg(err: unknown): string {
  if (err == null) return 'unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  const o = err as { message?: unknown; error?: unknown; details?: unknown }
  if (typeof o.message === 'string') return o.message
  if (typeof o.error === 'string') return o.error
  if (typeof o.details === 'string') return o.details
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * Run a query thunk, retrying ONCE on failure before giving up (v10.13.1).
 * A single transient connectivity/timeout blip on the standalone CLI Supabase
 * client should NOT trip a false `warn` (the Run #12 false-alarm class). A real
 * outage fails both the attempt and the retry; a blip clears on the retry.
 */
async function withRetry<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    await new Promise((r) => setTimeout(r, 400))
    return await fn() // second failure propagates to the caller's catch
  }
}

/**
 * Run the full read-only health probe. Never throws — a query failure
 * (after one retry) becomes its own `warn` signal so the watcher always
 * produces a report.
 */
export async function runHealthCheck(db: SupabaseClient): Promise<HealthReport> {
  const signals: Signal[] = []
  const push = (s: Signal) => signals.push(s)

  // 1. Yuri response health (last 24h)
  try {
    const { data, error } = await withRetry(() =>
      db
        .from('ss_yuri_messages')
        .select('content, role')
        .eq('role', 'assistant')
        .gte('created_at', hoursAgoIso(24))
    )
    if (error) throw error
    const total = data?.length ?? 0
    const empty = (data ?? []).filter((m) => !m.content || String(m.content).trim().length < 5).length
    const errorish = (data ?? []).filter((m) =>
      /something went wrong|i'?m having a moment|stream error/i.test(String(m.content || ''))
    ).length
    const bad = empty + errorish
    push({
      key: 'yuri_response_health_24h',
      severity: bad === 0 ? 'ok' : bad / Math.max(total, 1) > 0.05 ? 'critical' : 'warn',
      summary: `Yuri 24h: ${total} responses, ${empty} empty, ${errorish} error-text`,
      detail: { total, empty, errorish },
    })
  } catch (err) {
    push({ key: 'yuri_response_health_24h', severity: 'warn', summary: 'Could not assess Yuri response health', detail: { error: errMsg(err) } })
  }

  // 2. Decision-memory silent-extraction failures (v10.3.4 class), last 7d
  try {
    const { data: convos, error } = await withRetry(() =>
      db
        .from('ss_yuri_conversations')
        .select('id, decision_memory')
        .gte('created_at', daysAgoIso(7))
    )
    if (error) throw error
    let suspect = 0
    for (const c of convos ?? []) {
      const dm = c.decision_memory as Record<string, unknown> | null
      if (dm && Object.keys(dm).length > 0) continue
      const { count } = await db
        .from('ss_yuri_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
      if ((count ?? 0) >= 6) suspect++
    }
    push({
      key: 'decision_memory_extraction_7d',
      severity: suspect === 0 ? 'ok' : suspect >= 3 ? 'critical' : 'warn',
      summary: `${suspect} conversation(s) (7d) with >=6 msgs but empty decision_memory`,
      detail: { suspect },
    })
  } catch (err) {
    push({ key: 'decision_memory_extraction_7d', severity: 'warn', summary: 'Could not assess decision-memory extraction', detail: { error: errMsg(err) } })
  }

  // 3. AI usage + model-tier sanity (last 24h)
  try {
    const { data, error } = await withRetry(() =>
      db
        .from('ss_ai_usage')
        .select('feature, model')
        .gte('created_at', hoursAgoIso(24))
    )
    if (error) throw error
    const byModel: Record<string, number> = {}
    for (const r of data ?? []) byModel[String(r.model)] = (byModel[String(r.model)] || 0) + 1
    const downgraded = (data ?? []).filter((r) => r.feature === 'yuri_chat' && r.model && !/opus/i.test(String(r.model))).length
    push({
      key: 'ai_usage_24h',
      severity: downgraded > 0 ? 'critical' : 'ok',
      summary: `AI usage 24h: ${data?.length ?? 0} calls; ${downgraded} yuri_chat on non-Opus`,
      detail: { byModel, yuri_chat_non_opus: downgraded },
    })
  } catch (err) {
    push({ key: 'ai_usage_24h', severity: 'info', summary: 'Could not assess AI usage', detail: { error: errMsg(err) } })
  }

  // 4. Cron / pipeline health (last 48h)
  try {
    const { data, error } = await withRetry(() =>
      db
        .from('ss_pipeline_runs')
        .select('source, status, started_at, products_scraped')
        .gte('started_at', hoursAgoIso(48))
        .order('started_at', { ascending: false })
    )
    if (error) throw error
    // Exclude the Guardian's own watch runs from the pipeline-health view.
    const rows = (data ?? []).filter((r) => String(r.source) !== 'guardian-watch')
    const failed = rows.filter((r) => r.status === 'failed')
    const stuck = rows.filter((r) => r.status === 'running' && r.started_at && Date.now() - new Date(r.started_at).getTime() > 15 * 60_000)
    const zeroResult = rows.filter((r) => r.status === 'completed' && (r.products_scraped ?? null) === 0 && /scrape|scan|bestseller/i.test(String(r.source)))
    push({
      key: 'pipeline_health_48h',
      severity: failed.length || stuck.length || zeroResult.length ? 'warn' : 'ok',
      summary: `Pipeline 48h: ${failed.length} failed, ${stuck.length} stuck, ${zeroResult.length} zero-result scrapes`,
      detail: { failed: failed.map((r) => r.source), stuck: stuck.map((r) => r.source), zeroResult: zeroResult.map((r) => r.source) },
    })
  } catch (err) {
    push({ key: 'pipeline_health_48h', severity: 'info', summary: 'Could not assess pipeline health', detail: { error: errMsg(err) } })
  }

  // 5. Product image health — null images on verified products
  try {
    const { count, error } = await withRetry(() =>
      db
        .from('ss_products')
        .select('id', { count: 'exact', head: true })
        .is('image_url', null)
        .eq('is_verified', true)
    )
    if (error) throw error
    const nullImg = count ?? 0
    push({
      key: 'product_null_images',
      severity: nullImg > 600 ? 'warn' : 'info',
      summary: `${nullImg} verified products with NULL image_url`,
      detail: { nullImg },
    })
  } catch (err) {
    push({ key: 'product_null_images', severity: 'info', summary: 'Could not assess image health', detail: { error: errMsg(err) } })
  }

  // 6. Widget funnel (report-only; strategy is Tier 2/3 per charter)
  try {
    const { data, error } = await withRetry(() =>
      db.from('ss_widget_visitors').select('captured_email, converted_at')
    )
    if (error) throw error
    const visitors = data?.length ?? 0
    const withEmail = (data ?? []).filter((v) => v.captured_email).length
    const converted = (data ?? []).filter((v) => v.converted_at).length
    push({
      key: 'widget_funnel',
      severity: 'info',
      summary: `Widget funnel: ${visitors} visitors, ${withEmail} emails captured, ${converted} converted`,
      detail: { visitors, withEmail, converted },
    })
  } catch (err) {
    push({ key: 'widget_funnel', severity: 'info', summary: 'Could not assess widget funnel', detail: { error: errMsg(err) } })
  }

  // 8. Lead recap-email delivery health (last 7d captures) — v11.5.0.
  // A recap that bounced/failed to a captured lead is a real problem: the lead
  // handed over their email and never got the promised recap. Bounces/complaints
  // are otherwise silently invisible (they live in a status column no one reads),
  // so surface them here. Scoped to recent captures so old rows don't perpetually
  // trip the signal. Tolerates the recap_* columns being absent (pre-migration).
  try {
    const { data, error } = await withRetry(() =>
      db
        .from('ss_widget_visitors')
        .select('captured_email, recap_status')
        .not('captured_email', 'is', null)
        .gte('email_captured_at', daysAgoIso(7))
    )
    if (error) throw error
    const rows = data ?? []
    // Undelivered = the lead didn't get their email for a bad reason.
    const failed = rows.filter((v) =>
      ['bounced', 'complained', 'send_failed'].includes(String(v.recap_status))
    )
    // Captured but no send outcome recorded at all — the recording path may have
    // silently failed (the v10.3.4 class), distinct from a deliberate suppression.
    const noStatus = rows.filter((v) => v.recap_status == null)
    push({
      key: 'lead_recap_delivery_7d',
      severity: failed.length > 0 ? 'warn' : 'info',
      summary: `Lead recaps 7d: ${rows.length} captured, ${failed.length} bounced/failed, ${noStatus.length} no-status`,
      detail: {
        captured: rows.length,
        failed: failed.map((v) => v.captured_email),
        failed_count: failed.length,
        no_status_count: noStatus.length,
      },
    })
  } catch (err) {
    push({ key: 'lead_recap_delivery_7d', severity: 'info', summary: 'Could not assess lead recap delivery', detail: { error: errMsg(err) } })
  }

  // 7. Bailey activity sanity (READ-ONLY)
  try {
    const { count } = await withRetry(() =>
      db
        .from('ss_yuri_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', BAILEY)
        .gte('updated_at', daysAgoIso(7))
    )
    push({
      key: 'bailey_activity_7d',
      severity: 'info',
      summary: `Bailey: ${count ?? 0} conversations touched in last 7d`,
      detail: { conversations_7d: count ?? 0 },
    })
  } catch (err) {
    push({ key: 'bailey_activity_7d', severity: 'info', summary: 'Could not assess Bailey activity', detail: { error: errMsg(err) } })
  }

  // Roll up
  const overall = signals.reduce<Severity>(
    (acc, s) => (SEVERITY_ORDER[s.severity] > SEVERITY_ORDER[acc] ? s.severity : acc),
    'ok'
  )
  return {
    generated_at: new Date().toISOString(),
    overall,
    counts: {
      critical: signals.filter((s) => s.severity === 'critical').length,
      warn: signals.filter((s) => s.severity === 'warn').length,
      info: signals.filter((s) => s.severity === 'info').length,
      ok: signals.filter((s) => s.severity === 'ok').length,
    },
    signals,
  }
}
