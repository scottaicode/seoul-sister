import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Yuri chats per landing page, for the SEO Guardian's weekly facts (Oct 14 2026).
 *
 * The Guardian ranked pages by Google clicks alone and never saw which pages
 * turn readers into Yuri conversations, the step that actually produces leads.
 * Measured Sep 14 - Oct 11 2026: the most-clicked post (acne scars, 156
 * sessions) produced 0 chats while a sunscreen post with 20 produced 3. This
 * hands the strategist that second number as a FACT; what to do with it is its
 * judgment.
 *
 * landing_path exists only for chats that started from a Seoul Sister page
 * (recorded since Sep 2026). Chats from the home page or an external referrer
 * have no page and are counted separately, so "no chats" is never confused
 * with "not recorded".
 */

export interface PageChatRow {
  landing_path: string | null
  message_count: number | null
  visitor_id: string | null
}

export interface PageChatAgg {
  path: string
  chats: number
  messages: number
  emails: number
}

export interface PageChatFacts {
  ok: boolean
  error?: string
  totalChats: number
  unattributedChats: number
  pages: PageChatAgg[]
}

/** Pure: aggregate session rows into per-page facts. */
export function aggregatePageChats(rows: PageChatRow[], emailVisitors: Set<string>): Omit<PageChatFacts, 'ok' | 'error'> {
  const byPath = new Map<string, PageChatAgg>()
  let unattributed = 0
  for (const r of rows) {
    if (!r.landing_path) {
      unattributed++
      continue
    }
    const agg = byPath.get(r.landing_path) ?? { path: r.landing_path, chats: 0, messages: 0, emails: 0 }
    agg.chats++
    agg.messages += r.message_count ?? 0
    if (r.visitor_id && emailVisitors.has(r.visitor_id)) agg.emails++
    byPath.set(r.landing_path, agg)
  }
  const pages = [...byPath.values()].sort((a, b) => b.chats - a.chats || b.messages - a.messages || a.path.localeCompare(b.path))
  return { totalChats: rows.length, unattributedChats: unattributed, pages }
}

/** Pure: the prompt section. A failed fetch says so; it never reads as zero chats. */
export function formatPageChats(f: PageChatFacts, windowStart: string, windowEnd: string): string {
  if (!f.ok) {
    return `YURI CHATS BY LANDING PAGE: UNAVAILABLE this run (${f.error ?? 'query failed'}). Do not read this as zero chats.`
  }
  const head = `YURI CHATS BY LANDING PAGE (first-party, ${windowStart} to ${windowEnd}; a chat = a visitor who sent Yuri at least one message after arriving from that page; "emails" = that visitor gave an email). Clicks are the step before this one; these are the leads. ${f.totalChats} chats in the window, ${f.unattributedChats} with no page recorded (home page or external arrival). Pages with clicks but absent below produced no chats.`
  if (f.pages.length === 0) return `${head}\n(no page-attributed chats in the window)`
  return `${head}\npath | chats | total messages | emails\n${f.pages.map((p) => `${p.path} | ${p.chats} | ${p.messages} | ${p.emails}`).join('\n')}`
}

/** Fetch and aggregate. Never throws; a failure is returned as ok:false. */
export async function fetchPageChats(db: SupabaseClient, windowStart: string, windowEnd: string): Promise<PageChatFacts> {
  const empty = { totalChats: 0, unattributedChats: 0, pages: [] as PageChatAgg[] }
  try {
    const { data, error, count } = await db
      .from('ss_widget_sessions')
      .select('landing_path, message_count, visitor_id', { count: 'exact' })
      .gte('created_at', `${windowStart}T00:00:00Z`)
      .lte('created_at', `${windowEnd}T23:59:59Z`)
      .gt('message_count', 0)
      .range(0, 4999)
    if (error) return { ok: false, error: error.message, ...empty }
    const rows = (data ?? []) as PageChatRow[]
    // PostgREST caps silently; a partial scan must not look like a full one.
    if (typeof count === 'number' && count > rows.length) {
      return { ok: false, error: `fetched ${rows.length} of ${count} sessions`, ...empty }
    }
    const visitorIds = [...new Set(rows.map((r) => r.visitor_id).filter((v): v is string => !!v))]
    const emailVisitors = new Set<string>()
    if (visitorIds.length > 0) {
      const { data: vis, error: vErr } = await db
        .from('ss_widget_visitors')
        .select('visitor_id')
        .in('visitor_id', visitorIds)
        .not('captured_email', 'is', null)
      if (vErr) return { ok: false, error: `visitor lookup: ${vErr.message}`, ...empty }
      for (const v of (vis ?? []) as Array<{ visitor_id: string | null }>) if (v.visitor_id) emailVisitors.add(v.visitor_id)
    }
    return { ok: true, ...aggregatePageChats(rows, emailVisitors) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ...empty }
  }
}
