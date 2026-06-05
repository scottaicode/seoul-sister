/**
 * Seoul Sister Guardian — Health Check (READ-ONLY)
 * ================================================
 * Queries the observability spine and emits a structured JSON health report
 * with a severity per signal. Writes NOTHING anywhere (per GUARDIAN-CHARTER.md
 * Tier 3: monitoring reads are fine; writes to the corpus never).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/guardian-healthcheck.ts
 * Output: a JSON object on stdout. The /guardian-run agent reads it, classifies
 * findings into charter tiers, and acts/escalates accordingly.
 *
 * Severity scale: 'ok' | 'info' | 'warn' | 'critical'
 *   - ok:       nominal, nothing to do
 *   - info:     worth noting in the briefing, no action
 *   - warn:     likely a Tier 1 fix candidate (agent investigates)
 *   - critical: escalate immediately (likely Tier 2/3)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// --- Connection (service-role, read-only usage) -----------------------------
const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const supabase: SupabaseClient = createClient(
  get('NEXT_PUBLIC_SUPABASE_URL')!,
  get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Severity = 'ok' | 'info' | 'warn' | 'critical'
interface Signal {
  key: string
  severity: Severity
  summary: string
  detail?: Record<string, unknown>
}

const BAILEY = '551569d3-aed0-4feb-a340-47bfb146a835'
const nowIso = () => new Date().toISOString()
const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

const signals: Signal[] = []
function push(s: Signal) {
  signals.push(s)
}

// Safe count helper — never throws; a query failure is itself a signal.
async function safeCount(
  label: string,
  fn: () => Promise<{ count: number | null; error: unknown }>
): Promise<number | null> {
  try {
    const { count, error } = await fn()
    if (error) {
      push({ key: `query_error:${label}`, severity: 'warn', summary: `Health query "${label}" failed`, detail: { error: String((error as { message?: string })?.message || error) } })
      return null
    }
    return count ?? 0
  } catch (err) {
    push({ key: `query_threw:${label}`, severity: 'warn', summary: `Health query "${label}" threw`, detail: { error: String(err) } })
    return null
  }
}

async function main() {
  // 1. Yuri response health (last 24h) — empty / error assistant messages
  const since24 = hoursAgoIso(24)
  try {
    const { data, error } = await supabase
      .from('ss_yuri_messages')
      .select('content, role, created_at')
      .eq('role', 'assistant')
      .gte('created_at', since24)
    if (error) throw error
    const total = data?.length ?? 0
    const empty = (data ?? []).filter((m) => !m.content || String(m.content).trim().length < 5).length
    const errorish = (data ?? []).filter((m) => /something went wrong|i'?m having a moment|stream error/i.test(String(m.content || ''))).length
    const bad = empty + errorish
    push({
      key: 'yuri_response_health_24h',
      severity: bad === 0 ? 'ok' : bad / Math.max(total, 1) > 0.05 ? 'critical' : 'warn',
      summary: `Yuri 24h: ${total} responses, ${empty} empty, ${errorish} error-text`,
      detail: { total, empty, errorish },
    })
  } catch (err) {
    push({ key: 'yuri_response_health_24h', severity: 'warn', summary: 'Could not assess Yuri response health', detail: { error: String(err) } })
  }

  // 2. Decision-memory silent-extraction failures (the v10.3.4 class):
  //    conversations with >=6 messages but empty decision_memory, last 7d.
  try {
    const { data: convos, error } = await supabase
      .from('ss_yuri_conversations')
      .select('id, decision_memory, created_at')
      .gte('created_at', daysAgoIso(7))
    if (error) throw error
    let suspect = 0
    for (const c of convos ?? []) {
      const dm = c.decision_memory as Record<string, unknown> | null
      const emptyDm = !dm || Object.keys(dm).length === 0
      if (!emptyDm) continue
      const { count } = await supabase
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
    push({ key: 'decision_memory_extraction_7d', severity: 'warn', summary: 'Could not assess decision-memory extraction', detail: { error: String(err) } })
  }

  // 3. AI usage error / anomaly (last 24h) — model tier + volume sanity
  try {
    const { data, error } = await supabase
      .from('ss_ai_usage')
      .select('feature, model, created_at')
      .gte('created_at', since24)
    if (error) throw error
    const byModel: Record<string, number> = {}
    for (const r of data ?? []) byModel[String(r.model)] = (byModel[String(r.model)] || 0) + 1
    // Flag any user-facing yuri_chat NOT on an opus model (charter Principle 1 tripwire)
    const downgraded = (data ?? []).filter((r) => r.feature === 'yuri_chat' && r.model && !/opus/i.test(String(r.model))).length
    push({
      key: 'ai_usage_24h',
      severity: downgraded > 0 ? 'critical' : 'ok',
      summary: `AI usage 24h: ${data?.length ?? 0} calls; ${downgraded} yuri_chat on non-Opus`,
      detail: { byModel, yuri_chat_non_opus: downgraded },
    })
  } catch (err) {
    push({ key: 'ai_usage_24h', severity: 'info', summary: 'Could not assess AI usage', detail: { error: String(err) } })
  }

  // 4. Cron / pipeline health — failed or stuck runs (last 48h)
  try {
    const { data, error } = await supabase
      .from('ss_pipeline_runs')
      .select('source, status, started_at, completed_at, products_scraped, products_failed')
      .gte('started_at', hoursAgoIso(48))
      .order('started_at', { ascending: false })
    if (error) throw error
    const failed = (data ?? []).filter((r) => r.status === 'failed')
    const stuck = (data ?? []).filter((r) => r.status === 'running' && r.started_at && Date.now() - new Date(r.started_at).getTime() > 15 * 60_000)
    const zeroResult = (data ?? []).filter((r) => r.status === 'completed' && (r.products_scraped ?? null) === 0 && /scrape|scan|bestseller/i.test(String(r.source)))
    const sev: Severity = failed.length || stuck.length ? 'warn' : zeroResult.length ? 'warn' : 'ok'
    push({
      key: 'pipeline_health_48h',
      severity: sev,
      summary: `Pipeline 48h: ${failed.length} failed, ${stuck.length} stuck, ${zeroResult.length} zero-result scrapes`,
      detail: { failed: failed.map((r) => r.source), stuck: stuck.map((r) => r.source), zeroResult: zeroResult.map((r) => r.source) },
    })
  } catch (err) {
    push({ key: 'pipeline_health_48h', severity: 'info', summary: 'Could not assess pipeline health', detail: { error: String(err) } })
  }

  // 5. Product image health — null images + drift-prone non-OY URLs
  const nullImg = await safeCount('null_images', async () => {
    const { count, error } = await supabase
      .from('ss_products')
      .select('id', { count: 'exact', head: true })
      .is('image_url', null)
      .eq('is_verified', true)
    return { count, error }
  })
  if (nullImg !== null) {
    push({
      key: 'product_null_images',
      severity: nullImg > 600 ? 'warn' : 'info',
      summary: `${nullImg} verified products with NULL image_url`,
      detail: { nullImg },
    })
  }

  // 6. Widget funnel (report-only; strategy is Tier 2/3 per charter)
  try {
    const { data, error } = await supabase
      .from('ss_widget_visitors')
      .select('captured_email, converted_at, created_at')
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
    push({ key: 'widget_funnel', severity: 'info', summary: 'Could not assess widget funnel', detail: { error: String(err) } })
  }

  // 7. Bailey experience sanity (READ-ONLY) — recent activity + last score
  try {
    const { data: lastMsg } = await supabase
      .from('ss_yuri_messages')
      .select('created_at, conversation_id')
      .order('created_at', { ascending: false })
      .limit(1)
    const { count: baileyConvos } = await supabase
      .from('ss_yuri_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', BAILEY)
      .gte('updated_at', daysAgoIso(7))
    push({
      key: 'bailey_activity_7d',
      severity: 'info',
      summary: `Bailey: ${baileyConvos ?? 0} conversations touched in last 7d`,
      detail: { conversations_7d: baileyConvos ?? 0, latest_message_at: lastMsg?.[0]?.created_at ?? null },
    })
  } catch (err) {
    push({ key: 'bailey_activity_7d', severity: 'info', summary: 'Could not assess Bailey activity', detail: { error: String(err) } })
  }

  // --- Roll up & emit -------------------------------------------------------
  const order: Record<Severity, number> = { critical: 3, warn: 2, info: 1, ok: 0 }
  const worst = signals.reduce<Severity>((acc, s) => (order[s.severity] > order[acc] ? s.severity : acc), 'ok')
  const report = {
    generated_at: nowIso(),
    overall: worst,
    counts: {
      critical: signals.filter((s) => s.severity === 'critical').length,
      warn: signals.filter((s) => s.severity === 'warn').length,
      info: signals.filter((s) => s.severity === 'info').length,
      ok: signals.filter((s) => s.severity === 'ok').length,
    },
    signals,
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ generated_at: nowIso(), overall: 'critical', error: String(err), signals: [] }, null, 2) + '\n'
  )
  process.exit(1)
})
