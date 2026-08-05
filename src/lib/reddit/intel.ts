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

/**
 * How long after a comment a resulting visit is still plausibly attributable.
 *
 * A Reddit comment's traffic is front-loaded but not instant: the thread keeps
 * surfacing for a day or two, and a reader may open the profile later. 48h is a
 * judgment call, not a measurement — there is no ground truth to fit it to.
 * It is exported so the number is inspectable and arguable rather than buried.
 */
export const ATTRIBUTION_WINDOW_HOURS = 48

export interface AttributionResult {
  /** Reddit-sourced widget sessions seen in total (the numerator, platform-wide). */
  redditSessions: number
  /** Comments that received a non-zero share. */
  commentsCredited: number
  /** Sessions that fell inside NO comment's window (posted before the corpus, etc). */
  unattributedSessions: number
  /** True when there was actually something to attribute. */
  hadSignal: boolean
}

/**
 * Attribute reddit-sourced widget sessions back to the comments that plausibly
 * caused them, and write the result to `ss_reddit_intel.attributed_sessions`.
 *
 * WHY THIS IS COARSE, AND WHY THAT IS THE HONEST DESIGN
 *
 * Reddit exposes NO per-comment referral data. A profile-link click carries no
 * comment identity — the visitor reads a comment, opens the profile, clicks the
 * bio link, and everything about which comment moved them is gone. So exact
 * attribution is not merely unbuilt, it is unavailable.
 *
 * What IS available: a session tagged `source='reddit'` has a timestamp, and
 * comments have timestamps. Sessions are credited to every comment posted within
 * the preceding ATTRIBUTION_WINDOW_HOURS, split evenly across them (fractional
 * credit rounded at the end). That cannot say WHICH comment did it. It can
 * answer the question the channel actually hinges on — *do higher-scoring
 * comments, or particular subreddits, correlate with visits at all?* — which is
 * currently unanswerable in either direction.
 *
 * Deliberately even-split rather than score-weighted: weighting by score would
 * bake in the very hypothesis we are trying to test ("good comments drive
 * traffic") and then read it back out as a finding.
 *
 * TWO LIMITS THAT MUST STAY VISIBLE
 *
 *  1. `views` is NULL on every row — the Reddit API does not return it for
 *     comments — so there is no impressions denominator. A comment with 600
 *     views and one with 15 look identical here.
 *  2. As of Aug 5 2026 there are ZERO reddit-sourced sessions, so every row is
 *     legitimately 0. `hadSignal: false` says so explicitly, because a table
 *     full of zeros from a working attributor and a table full of zeros from an
 *     attributor that never ran are otherwise indistinguishable — the exact
 *     failure class that hid a dead cron for six days.
 *
 * Pure measurement. No AI, no judgment, no writes outside the one column.
 */
export async function attributeSessionsToComments(): Promise<AttributionResult> {
  const db = getServiceClient()

  const { data: sessions, error: sessionErr } = await db
    .from('ss_widget_sessions')
    .select('id, started_at')
    .eq('source', 'reddit')

  // A failed query must NOT read as "no reddit traffic". That conflation is how
  // a broken instrument looks like a quiet channel.
  if (sessionErr) {
    console.error('[reddit-intel] attribution: session query failed:', sessionErr)
    throw sessionErr
  }

  const sessionRows = (sessions ?? []) as Array<{ id: string; started_at: string }>

  if (sessionRows.length === 0) {
    return {
      redditSessions: 0,
      commentsCredited: 0,
      unattributedSessions: 0,
      hadSignal: false,
    }
  }

  const { data: comments, error: commentErr } = await db
    .from('ss_reddit_intel')
    .select('id, posted_at')
    .order('posted_at', { ascending: true })

  if (commentErr) {
    console.error('[reddit-intel] attribution: comment query failed:', commentErr)
    throw commentErr
  }

  const commentRows = (comments ?? []) as Array<{ id: string; posted_at: string }>
  if (commentRows.length === 0) {
    return {
      redditSessions: sessionRows.length,
      commentsCredited: 0,
      unattributedSessions: sessionRows.length,
      hadSignal: false,
    }
  }

  const windowMs = ATTRIBUTION_WINDOW_HOURS * 3_600_000
  const credit = new Map<string, number>()
  let unattributed = 0

  for (const session of sessionRows) {
    const at = new Date(session.started_at).getTime()
    // Comments posted in the window BEFORE this session. Never after: crediting
    // a comment for a visit that preceded it would invent causation backwards.
    const eligible = commentRows.filter((c) => {
      const posted = new Date(c.posted_at).getTime()
      return posted <= at && at - posted <= windowMs
    })
    if (eligible.length === 0) {
      unattributed++
      continue
    }
    const share = 1 / eligible.length
    for (const c of eligible) {
      credit.set(c.id, (credit.get(c.id) ?? 0) + share)
    }
  }

  // Write only the rows that earned credit. Rows already at 0 stay 0 — no need
  // to rewrite 621 unchanged rows every run.
  let written = 0
  for (const [id, share] of credit.entries()) {
    const rounded = Math.round(share)
    if (rounded === 0) continue
    const { error } = await db
      .from('ss_reddit_intel')
      .update({ attributed_sessions: rounded })
      .eq('id', id)
    if (error) {
      console.error(`[reddit-intel] attribution: write failed for ${id}:`, error)
      continue
    }
    written++
  }

  return {
    redditSessions: sessionRows.length,
    commentsCredited: written,
    unattributedSessions: unattributed,
    hadSignal: true,
  }
}
