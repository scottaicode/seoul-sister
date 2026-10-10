/**
 * Per-source / per-video funnel (Oct 9 2026): landed → chatted → email → paid
 * → survived past day 10 of the first subscription. Grades a traffic source by outcome, not views.
 *
 * Keys: utm_source (falling back to referrer host) × utm_content (the video).
 * Two first-touch records feed it, both keyed to real people:
 *   - ss_campaign_touches (browser first touch) → ss_widget_visitors by visitor_id
 *   - ss_user_profiles.utm_* (signup first touch) for people who never used the widget
 * Paid people are counted once even if both paths credit them.
 *
 * Deterministic counting only. Paginates past PostgREST's silent 1,000-row cap
 * and compares against an exact count, so a partial read is reported, not hidden.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FunnelRow {
  source: string
  content: string | null
  landed: number
  chatted: number
  emailed: number
  paid: number
  pastDay10: number
  survivedDay10: number
}

const PAGE = 1000

async function fetchAll<T>(db: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const { count, error: cErr } = await db.from(table).select('*', { count: 'exact', head: true })
  if (cErr) throw new Error(`${table} count failed: ${cErr.message}`)
  const out: T[] = []
  for (let from = 0; from < (count ?? 0); from += PAGE) {
    const { data, error } = await db.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table} page failed: ${error.message}`)
    out.push(...((data ?? []) as T[]))
  }
  if (out.length !== (count ?? 0)) throw new Error(`${table}: read ${out.length} of ${count} rows`)
  return out
}

export async function campaignFunnel(db: SupabaseClient, now: number = Date.now()): Promise<FunnelRow[]> {
  type Touch = { visitor_id: string; utm_source: string | null; utm_content: string | null; referrer_host: string | null }
  type Visitor = { visitor_id: string; total_messages: number; captured_email: string | null; converted_user_id: string | null }
  type Profile = { user_id: string; utm_source: string | null; utm_content: string | null }
  type Sub = { user_id: string; status: string; created_at: string; canceled_at: string | null }

  const [touches, visitors, profiles, subs] = await Promise.all([
    fetchAll<Touch>(db, 'ss_campaign_touches', 'visitor_id, utm_source, utm_content, referrer_host'),
    fetchAll<Visitor>(db, 'ss_widget_visitors', 'visitor_id, total_messages, captured_email, converted_user_id'),
    fetchAll<Profile>(db, 'ss_user_profiles', 'user_id, utm_source, utm_content'),
    fetchAll<Sub>(db, 'ss_subscriptions', 'user_id, status, created_at, canceled_at'),
  ])

  const visitorById = new Map(visitors.map((v) => [v.visitor_id, v]))
  const subsByUser = new Map<string, Sub[]>()
  for (const s of subs) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s])

  const rows = new Map<string, FunnelRow & { payers: Set<string> }>()
  const row = (source: string, content: string | null) => {
    const k = `${source}\u0000${content ?? ''}`
    if (!rows.has(k)) rows.set(k, { source, content, landed: 0, chatted: 0, emailed: 0, paid: 0, pastDay10: 0, survivedDay10: 0, payers: new Set() })
    return rows.get(k)!
  }

  for (const t of touches) {
    const r = row(t.utm_source || t.referrer_host || 'unknown', t.utm_content)
    r.landed++
    const v = visitorById.get(t.visitor_id)
    if (v && v.total_messages > 0) r.chatted++
    if (v?.captured_email) r.emailed++
    if (v?.converted_user_id) r.payers.add(v.converted_user_id)
  }
  // Signup-path payers who never touched the widget (or predate the beacon).
  for (const p of profiles) {
    if (!p.utm_source || !subsByUser.has(p.user_id)) continue
    row(p.utm_source, p.utm_content).payers.add(p.user_id)
  }

  const DAY10 = 10 * 24 * 60 * 60 * 1000
  for (const r of rows.values()) {
    for (const uid of r.payers) {
      const first = [...(subsByUser.get(uid) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      if (!first) continue
      r.paid++
      const start = new Date(first.created_at).getTime()
      if (now - start < DAY10) continue
      r.pastDay10++
      const canceledAt = first.canceled_at ? new Date(first.canceled_at).getTime() : null
      if (canceledAt === null || canceledAt - start >= DAY10) r.survivedDay10++
    }
  }

  return [...rows.values()]
    .map(({ payers: _p, ...r }) => r)
    .sort((a, b) => b.landed - a.landed || b.paid - a.paid)
}
