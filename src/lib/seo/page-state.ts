import { liveAnchorIds, stripHtml } from './execution-verifier'

// ---------------------------------------------------------------------------
// Current page state: what is on each page RIGHT NOW, handed to the strategist
// as a fact before it bets.
//
// Why this exists (measured Oct 19 2026): the strategist never saw the pages it
// bets on. The grader's evidence said "cannot distinguish a paraphrase from
// non-execution", and the Oct 18 report chose "paraphrase" and built its
// headline on it. Ten bets across 13 weekly reports (Jul 24 – Oct 18) targeted
// the BoJ sunscreen review. Its title/meta rewrite shipped; the on-page INCI
// section, the "mineral or chemical" block and the `#full-ingredients-list`
// anchor named by four bets never did. The same report also asked for a "best
// by skin type" block on the cleansing-oils post, which already has one
// ("Grounded picks by skin type").
//
// Facts only. Which pages are listed never limits what the strategist may bet
// on, and the block says plainly what it cannot see.
// ---------------------------------------------------------------------------

const SITE = 'https://www.seoulsister.com'
const MAX_PAGES = 25
const MAX_HEADINGS = 30
const MAX_IDS = 20
const CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 8_000

export interface PageState {
  path: string
  ok: boolean
  error?: string
  title?: string
  metaDescription?: string
  headings?: string[]
  /** Headings drawn by site code (carry a class). Shown only when a page has no written headings. */
  codeHeadings?: string[]
  anchorIds?: string[]
}

/** Strip host, query, fragment and trailing slash so a bet target matches however it was written. */
export function normalizePath(p: string): string {
  return p.replace(/^https?:\/\/(www\.)?seoulsister\.com/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
}

/**
 * Title, meta description, h1-h3 headings and anchor ids from rendered HTML.
 *
 * Headings written by the content pipeline render bare; headings drawn by site
 * code carry a `class` (checked Oct 19 2026 on all 56 blog posts, /best,
 * /ingredients and /products pages). On a blog post the classed ones are the
 * post TEMPLATE ("Key Ingredients Mentioned", on every post); listed as
 * content, that would read as a shipped ingredients section on a page that
 * has none. So they are kept apart, and shown only for pages like /best/*
 * where site code draws every heading.
 *
 * Framework ids are dropped (React `_r_` / `:r0:`, product-page `b:0`); they
 * are not anchors.
 */
export function parsePageState(path: string, html: string): PageState {
  const title = stripHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  const metaDescription = stripHtml(html.match(/name="description"\s+content="([^"]*)"/i)?.[1] ?? '').trim()
  const headings: string[] = []
  const codeHeadings: string[] = []
  for (const m of html.matchAll(/<h([1-3])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripHtml(m[3]).trim()
    if (!text) continue
    ;(/\bclass=/i.test(m[2] ?? '') ? codeHeadings : headings).push(`h${m[1]}: ${text}`)
  }
  return {
    path,
    ok: true,
    title,
    metaDescription,
    headings: headings.slice(0, MAX_HEADINGS),
    codeHeadings: codeHeadings.slice(0, 12),
    anchorIds: [...liveAnchorIds(html)].filter((id) => /^[a-z0-9][a-z0-9-]{2,}$/.test(id)).slice(0, MAX_IDS),
  }
}

/** Top pages by clicks first, then every prior bet's target, deduped, capped. */
export function selectPages(
  pageAggs: Array<{ page: string; clicks: number }>,
  betTargets: Array<string | null | undefined>,
  topN = 15
): string[] {
  const out: string[] = []
  const add = (raw: string | null | undefined) => {
    if (!raw) return
    if (/^https?:\/\//i.test(raw) && !/^https?:\/\/(www\.)?seoulsister\.com/i.test(raw)) return
    const p = normalizePath(raw)
    if (!p.startsWith('/') || out.includes(p) || out.length >= MAX_PAGES) return
    out.push(p)
  }
  ;[...pageAggs].sort((a, b) => b.clicks - a.clicks).slice(0, topN).forEach((p) => add(p.page))
  betTargets.forEach(add)
  return out
}

/** How many prior bets targeted each page, and since when. A fact for the strategist, not a limit. */
export function countBetsByPage(
  bets: Array<{ target_page?: string | null; date?: string }>
): Map<string, { count: number; since: string }> {
  const map = new Map<string, { count: number; since: string }>()
  for (const b of bets) {
    if (!b.target_page) continue
    const p = normalizePath(b.target_page)
    const d = b.date ?? ''
    const cur = map.get(p)
    if (!cur) map.set(p, { count: 1, since: d })
    else map.set(p, { count: cur.count + 1, since: d && (!cur.since || d < cur.since) ? d : cur.since })
  }
  return map
}

async function fetchOne(path: string): Promise<PageState> {
  try {
    const res = await fetch(`${SITE}${path}`, {
      headers: { 'user-agent': 'SeoulSisterSeoGuardian/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.status === 404) return { path, ok: false, error: 'HTTP 404: the page does not exist' }
    if (!res.ok) return { path, ok: false, error: `HTTP ${res.status}` }
    return parsePageState(path, await res.text())
  } catch (err) {
    return { path, ok: false, error: err instanceof Error ? err.message : 'fetch failed' }
  }
}

export async function fetchPageStates(paths: string[]): Promise<PageState[]> {
  const results: PageState[] = []
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(paths.slice(i, i + CONCURRENCY).map(fetchOne))))
  }
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error(`[seo-guardian] page state: ${failed.length}/${results.length} fetches failed:`, failed.map((f) => `${f.path} (${f.error})`).join(', '))
  }
  return results
}

function formatOne(s: PageState, bets?: { count: number; since: string }): string {
  const betLine = bets ? `\n  prior bets on this page (last 12 reports): ${bets.count} since ${bets.since || 'unknown'}` : ''
  if (!s.ok) {
    return s.error?.startsWith('HTTP 404')
      ? `${s.path}${betLine}\n  (${s.error})`
      : `${s.path}${betLine}\n  (could not fetch: ${s.error}. State UNKNOWN, not empty)`
  }
  const ids = s.anchorIds && s.anchorIds.length > 0 ? s.anchorIds.map((i) => `#${i}`).join(', ') : 'none'
  const written = s.headings ?? []
  const code = s.codeHeadings ?? []
  let body: string
  if (written.length > 0) body = written.join('\n  ')
  else if (s.path.startsWith('/blog/')) {
    // Every blog post had written headings (56 of 56, Oct 19 2026). None means
    // the renderer changed, not that the post has no content.
    body = "(no written headings found on a blog post: the parser may not match this page's template. Headings UNKNOWN, not absent)"
  } else if (code.length > 0) {
    body = `(no written headings: site code draws this page, so content-pipeline edits do not apply to its body)\n  ${code.join('\n  ')}`
  } else body = '(no headings)'
  return `${s.path}${betLine}\n  title: ${s.title}\n  meta description: ${s.metaDescription || '(none)'}\n  anchor ids: ${ids}\n  ${body}`
}

export function formatPageStates(
  states: PageState[] | null,
  today: string,
  betsByPage?: Map<string, { count: number; since: string }>
): string {
  if (!states || states.length === 0) {
    return 'CURRENT PAGE STATE: UNAVAILABLE this run (the fetch step failed). You cannot see what is on any page this week, so do not conclude from this block that anything is missing.'
  }
  return `CURRENT PAGE STATE (fetched live ${today}). Pages: your top pages by clicks, plus every page a recent bet targeted. Pages NOT listed here were not checked; their state is unknown, not empty.
What this shows: title, meta description, h1-h3 headings (on blog posts, the post template's own headings are left out) and anchor ids. A heading, anchor or meta text present here is direct evidence it is live. Absence is evidence only for work that would have produced a heading or anchor. Paragraph blocks, FAQ answers, prose edits inside existing sections and internal links are not visible here; for those, the grader's execution line in PRIOR BETS is the evidence. Neither source shows WHEN a heading first appeared, so a heading can pre-date the bet that asked for it.

${states.map((s) => formatOne(s, betsByPage?.get(s.path))).join('\n\n')}`
}
