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

/**
 * Sign-ups per landing page (Nov 24 2026).
 *
 * Since Nov 13 2026 the anonymous landing chat is closed by default, so the
 * chat section above reads near zero whatever the pages do. The lead step is
 * now an account: `ss_user_profiles.landing_path` records the first page a
 * new account arrived on, `ss_trial_starts` whether it started a free week,
 * added a card or paid, and `ss_signup_presses` each press of a blog or
 * landing sign-up button. Paid is the least gameable of these; it is listed
 * as a FACT beside clicks, and what to do with it is the strategist's call.
 */

export interface SignupProfileRow {
  user_id: string
  landing_path: string | null
}

export interface SignupTrialRow {
  user_id: string | null
  card_added_at: string | null
  paid_at: string | null
}

export interface SignupPressRow {
  page_path: string | null
}

export interface PageSignupAgg {
  path: string
  accounts: number
  freeWeeks: number
  cards: number
  paid: number
  presses: number
}

export interface PageSignupFacts {
  ok: boolean
  error?: string
  totalAccounts: number
  unattributedAccounts: number
  totalPresses: number
  pages: PageSignupAgg[]
}

/** Pure: per-page accounts, free weeks, cards, paid and button presses. */
export function aggregatePageSignups(
  profiles: SignupProfileRow[],
  trials: SignupTrialRow[],
  presses: SignupPressRow[]
): Omit<PageSignupFacts, 'ok' | 'error'> {
  const trialByUser = new Map<string, SignupTrialRow>()
  for (const t of trials) if (t.user_id) trialByUser.set(t.user_id, t)
  const byPath = new Map<string, PageSignupAgg>()
  const row = (p: string) => {
    const r = byPath.get(p) ?? { path: p, accounts: 0, freeWeeks: 0, cards: 0, paid: 0, presses: 0 }
    byPath.set(p, r)
    return r
  }
  let unattributed = 0
  for (const p of profiles) {
    if (!p.landing_path) {
      unattributed++
      continue
    }
    const r = row(p.landing_path)
    r.accounts++
    const t = trialByUser.get(p.user_id)
    if (t) {
      r.freeWeeks++
      if (t.card_added_at) r.cards++
      if (t.paid_at) r.paid++
    }
  }
  let totalPresses = 0
  for (const pr of presses) {
    totalPresses++
    if (pr.page_path) row(pr.page_path).presses++
  }
  const pages = [...byPath.values()].sort(
    (a, b) => b.paid - a.paid || b.accounts - a.accounts || b.presses - a.presses || a.path.localeCompare(b.path)
  )
  return { totalAccounts: profiles.length, unattributedAccounts: unattributed, totalPresses, pages }
}

/** Pure: the prompt section. A failed fetch says so; it never reads as zero sign-ups. */
export function formatPageSignups(f: PageSignupFacts, windowStart: string, windowEnd: string): string {
  if (!f.ok) {
    return `SIGN-UPS BY LANDING PAGE: UNAVAILABLE this run (${f.error ?? 'query failed'}). Do not read this as zero sign-ups.`
  }
  const head = `SIGN-UPS BY LANDING PAGE (first-party, ${windowStart} to ${windowEnd}; the anonymous landing chat has been closed by default since Nov 13 2026, so talking to Yuri starts with an account and these are the leads now). accounts = new accounts whose first page was this path; free weeks / cards / paid = what those accounts went on to do (paid is the outcome the business needs; clicks are three steps before it); presses = sign-up button presses on this page, counted since Nov 22 2026. ${f.totalAccounts} new accounts in the window, ${f.unattributedAccounts} with no page recorded; ${f.totalPresses} presses. Pages with clicks but absent below produced none.`
  if (f.pages.length === 0) return `${head}\n(no page-attributed sign-ups in the window)`
  return `${head}\npath | accounts | free weeks | cards | paid | presses\n${f.pages
    .map((p) => `${p.path} | ${p.accounts} | ${p.freeWeeks} | ${p.cards} | ${p.paid} | ${p.presses}`)
    .join('\n')}`
}

/** Fetch and aggregate. Never throws; a failure is returned as ok:false. */
export async function fetchPageSignups(db: SupabaseClient, windowStart: string, windowEnd: string): Promise<PageSignupFacts> {
  const empty = { totalAccounts: 0, unattributedAccounts: 0, totalPresses: 0, pages: [] as PageSignupAgg[] }
  const from = `${windowStart}T00:00:00Z`
  const to = `${windowEnd}T23:59:59Z`
  try {
    const { data: prof, error: pErr, count: pCount } = await db
      .from('ss_user_profiles')
      .select('user_id, landing_path', { count: 'exact' })
      .gte('created_at', from)
      .lte('created_at', to)
      .or('excluded_from_metrics.is.null,excluded_from_metrics.eq.false')
      .range(0, 4999)
    if (pErr) return { ok: false, error: `profiles: ${pErr.message}`, ...empty }
    const profiles = (prof ?? []) as SignupProfileRow[]
    // PostgREST caps silently; a partial scan must not look like a full one.
    if (typeof pCount === 'number' && pCount > profiles.length) {
      return { ok: false, error: `fetched ${profiles.length} of ${pCount} profiles`, ...empty }
    }
    let trials: SignupTrialRow[] = []
    const ids = profiles.map((p) => p.user_id).filter(Boolean)
    if (ids.length > 0) {
      const { data: tr, error: tErr } = await db
        .from('ss_trial_starts')
        .select('user_id, card_added_at, paid_at')
        .in('user_id', ids)
      if (tErr) return { ok: false, error: `trial starts: ${tErr.message}`, ...empty }
      trials = (tr ?? []) as SignupTrialRow[]
    }
    const { data: pr, error: prErr, count: prCount } = await db
      .from('ss_signup_presses')
      .select('page_path', { count: 'exact' })
      .gte('pressed_at', from)
      .lte('pressed_at', to)
      .range(0, 4999)
    if (prErr) return { ok: false, error: `presses: ${prErr.message}`, ...empty }
    const presses = (pr ?? []) as SignupPressRow[]
    if (typeof prCount === 'number' && prCount > presses.length) {
      return { ok: false, error: `fetched ${presses.length} of ${prCount} presses`, ...empty }
    }
    return { ok: true, ...aggregatePageSignups(profiles, trials, presses) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ...empty }
  }
}
