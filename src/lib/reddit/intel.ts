/**
 * Reddit intelligence capture — instrument the ONE live acquisition channel.
 *
 * WHY THIS EXISTS (Jul 13 2026):
 * glass_skin_atx has 503 contributions, 1,205 karma, comments pulling 265–1,300 views
 * each, and a profile link to the Seoul Sister ingredient checker. And
 * `ss_widget_sessions` has recorded ZERO reddit-sourced sessions — ever. We literally
 * cannot answer "does Reddit send anyone to the site?", which is the question that
 * decides whether the whole channel is worth the evenings being spent on it.
 *
 * Every comment posted is currently unbanked value: the claim, the community's verdict
 * on it, and whether it drove a single visit — all evaporate.
 *
 * SCOPE (per /ship-guard): CAPTURE + ATTRIBUTION only. That is growth/measurement —
 * the always-allowed lane under the feature freeze. The EXTRACTION of validated
 * ingredient claims into Yuri's context is DEFERRED with an explicit unfreeze
 * condition; see REDDIT-INTELLIGENCE-BLUEPRINT.md. The corpus banks now (the data
 * doesn't rot, and Reddit isn't deleting these), so nothing is lost by waiting — but
 * everything is lost by not capturing.
 *
 * THE TEACHER (owner's overriding learning-loop principle — find the LEAST-GAMEABLE
 * teacher in the domain): upvotes + views, and far more valuably, whether an
 * ingredient-literate peer PUBLICLY CORRECTED a factual claim. r/koreanskincare and
 * r/AsianBeauty are full of people who read INCI lists for fun. A claim that survives
 * them is validated; a claim they contradict is a dated, public, graded error. That
 * grader is honest, unforgiving, and free.
 */
import { redditFetch } from './oauth'
import { getServiceClient } from '../supabase'

/** The persona whose comments we capture. */
export const INTEL_AUTHOR = 'glass_skin_atx'

export interface RedditIntelRow {
  permalink: string
  reddit_id: string
  subreddit: string
  thread_title: string | null
  thread_permalink: string | null
  is_reply: boolean
  parent_author: string | null
  body: string
  posted_at: string
  score: number
  reply_count: number
  score_last_checked_at: string
}

/** Shape of the comment objects Reddit returns under /user/{name}/comments. */
interface RedditComment {
  id?: string
  name?: string
  subreddit?: string
  link_title?: string
  link_permalink?: string
  permalink?: string
  body?: string
  score?: number
  ups?: number
  created_utc?: number
  parent_id?: string
  link_id?: string
  num_comments?: number
}

interface RedditListing {
  data?: {
    after?: string | null
    children?: Array<{ data?: RedditComment }>
  }
}

/**
 * Fetch this author's comments from Reddit, newest first, paging until exhausted or
 * `max` is reached.
 *
 * NOTE: Reddit blocks unauthenticated JSON reads now, so this goes through the
 * project's existing OAuth client (src/lib/reddit/oauth.ts) — the same one the
 * scan-reddit-mentions cron uses. redditFetch handles the token and rate limiting.
 */
export async function fetchAuthorComments(
  author: string = INTEL_AUTHOR,
  max = 500
): Promise<RedditIntelRow[]> {
  const rows: RedditIntelRow[] = []
  let after: string | undefined

  while (rows.length < max) {
    const params: Record<string, string> = { limit: '100' }
    if (after) params.after = after

    const listing = (await redditFetch(`/user/${author}/comments`, params)) as RedditListing
    const children = listing?.data?.children ?? []
    if (children.length === 0) break

    for (const child of children) {
      const c = child.data
      if (!c?.permalink || !c.body) continue

      // parent_id t3_* => top-level comment on a post; t1_* => a reply to a comment.
      const isReply = typeof c.parent_id === 'string' && c.parent_id.startsWith('t1_')

      rows.push({
        permalink: `https://www.reddit.com${c.permalink}`,
        reddit_id: c.id ?? c.name ?? '',
        subreddit: c.subreddit ?? 'unknown',
        thread_title: c.link_title ?? null,
        thread_permalink: c.link_permalink ? `https://www.reddit.com${c.link_permalink}` : null,
        is_reply: isReply,
        parent_author: null, // filled by the correction pass, not worth an extra call here
        body: c.body,
        posted_at: c.created_utc
          ? new Date(c.created_utc * 1000).toISOString()
          : new Date().toISOString(),
        score: typeof c.score === 'number' ? c.score : (c.ups ?? 0),
        reply_count: 0,
        score_last_checked_at: new Date().toISOString(),
      })
    }

    after = listing?.data?.after ?? undefined
    if (!after) break
  }

  return rows.slice(0, max)
}

export interface CaptureResult {
  fetched: number
  inserted: number
  updated: number
  negative: number // score < 0 — a public correction is likely; the graded errors
}

/**
 * Upsert captured comments. Keyed on `permalink`, so this is idempotent and re-running
 * it REFRESHES the score — which is the point: a comment's score is not final for
 * hours or days, and we want to watch the teacher's verdict move.
 *
 * Deliberately does NOT touch the extraction columns (extracted_claims, extracted_at,
 * fed_to_yuri) — those belong to the deferred Piece B.
 */
export async function captureComments(rows: RedditIntelRow[]): Promise<CaptureResult> {
  const db = getServiceClient()
  if (rows.length === 0) {
    return { fetched: 0, inserted: 0, updated: 0, negative: 0 }
  }

  // Which permalinks do we already have? (to report insert-vs-update honestly)
  const { data: existing } = await db
    .from('ss_reddit_intel')
    .select('permalink')
    .in('permalink', rows.map((r) => r.permalink))

  const known = new Set((existing ?? []).map((e) => (e as { permalink: string }).permalink))

  const { error } = await db
    .from('ss_reddit_intel')
    .upsert(rows, { onConflict: 'permalink' })

  if (error) {
    console.error('[reddit-intel] upsert failed:', error)
    throw error
  }

  return {
    fetched: rows.length,
    inserted: rows.filter((r) => !known.has(r.permalink)).length,
    updated: rows.filter((r) => known.has(r.permalink)).length,
    negative: rows.filter((r) => r.score < 0).length,
  }
}
