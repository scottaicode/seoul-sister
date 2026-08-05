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
 * Pushback taxonomy. Four ways a reply can push back, and they are NOT the same
 * signal — which is the entire reason `was_corrected` stayed a useless boolean.
 *
 * Ground truth, Aug 5 2026: all three negative-scoring comments in the corpus
 * were fetched with their reply threads. They were three different things.
 *
 *   on7e1qd (-4) AI_CALLOUT. "Why bother replying using AI generated responses?"
 *                (+5). No factual error whatsoever — the comment was a precise,
 *                correct distinction between Real Barrier Extreme Cream (lavender
 *                only) and the Light/Special Set variants (sage, patchouli,
 *                cardamom, chamomile, juniper). Flagging it as an error on score
 *                alone would have fed the account's BEST factual work back as a
 *                graded mistake.
 *   oc2erhk (-3) FACTUAL_CORRECTION. "300 is higher! 50 is the lowest" (+3).
 *   p1j0ipt (-1) DISAGREEMENT. "This is very strange advice. I don't think it's
 *                true at all" (+2).
 *
 * So: score is not the teacher. The reply is.
 */
export type PushbackKind =
  | 'factual_correction'
  | 'disagreement'
  | 'ai_callout'
  | 'clarifying_question'

/**
 * Cues per kind, ordered by severity when a reply matches more than one.
 *
 * `ai_callout` outranks everything on purpose. It is not a skincare error at
 * all — it is the one signal that the account's cover is slipping, which is the
 * only failure that could end the channel outright rather than cost one comment.
 *
 * These are CUES FOR A HUMAN QUEUE, not a verdict. Nothing here grades anything:
 * `pushback_confirmed` stays NULL until a person looks. Same discipline as
 * nudge-outcome-grader.ts — abstain rather than fabricate a verdict.
 */
const PUSHBACK_CUES: Array<{ kind: PushbackKind; re: RegExp }> = [
  {
    kind: 'ai_callout',
    re: /\b(ai[- ]?generated|chat ?gpt|is this (ai|a bot)|are you a bot|bot account|written by (an )?ai|ai slop|llm)\b/i,
  },
  {
    kind: 'factual_correction',
    re: /\b(that'?s (not|incorrect|wrong)|isn'?t (true|right|correct)|actually,? (it|the|they)|isn'?t how|not how it works|you'?re (wrong|mistaken)|wrong about|incorrect|is higher|is lower|is the lowest|is the highest|mixed up|got that backwards)\b/i,
  },
  {
    kind: 'disagreement',
    re: /\b(strange advice|bad advice|terrible advice|i (don'?t|do not) (think|agree)|disagree|hard disagree|that'?s not my experience|wouldn'?t recommend|please don'?t)\b/i,
  },
  {
    kind: 'clarifying_question',
    re: /\b(what do you mean|can you clarify|source\??$|any source|where did you (read|hear)|citation)\b/i,
  },
]

/**
 * Classify one reply. Returns the most severe kind it matches, or null.
 * Pure — no IO, no model, fully testable.
 */
export function classifyPushback(body: string): PushbackKind | null {
  if (!body) return null
  for (const { kind, re } of PUSHBACK_CUES) {
    if (re.test(body)) return kind
  }
  return null
}

/** A reply as we need it for classification. */
export interface ReplyRow {
  author: string
  body: string
  score: number
}

/**
 * Pick the reply worth surfacing, if any.
 *
 * Severity first (an ai_callout outranks a factual correction outranks a
 * disagreement), then reply score as the tiebreak — a +5 correction against a
 * -4 comment is a far stronger signal than a -1 reply nobody agreed with.
 *
 * Replies BY the author are skipped: glass_skin_atx correcting themselves in a
 * follow-up is not the community pushing back.
 */
export function selectPushback(
  replies: ReplyRow[],
  author: string = INTEL_AUTHOR
): { kind: PushbackKind; reply: ReplyRow } | null {
  const severity: Record<PushbackKind, number> = {
    ai_callout: 4,
    factual_correction: 3,
    disagreement: 2,
    clarifying_question: 1,
  }
  let best: { kind: PushbackKind; reply: ReplyRow } | null = null
  for (const reply of replies) {
    if (reply.author?.toLowerCase() === author.toLowerCase()) continue
    const kind = classifyPushback(reply.body)
    if (!kind) continue
    if (
      !best ||
      severity[kind] > severity[best.kind] ||
      (severity[kind] === severity[best.kind] && reply.score > best.reply.score)
    ) {
      best = { kind, reply }
    }
  }
  return best
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

/** Max comments to check per run. Reddit's rate limiter is the real constraint. */
export const REPLY_CHECK_BATCH = 40

export interface CorrectionPassResult {
  checked: number
  withReplies: number
  pushbackFound: number
  byKind: Record<string, number>
  failed: number
}

/**
 * Fetch replies for comments we have never checked, classify any pushback, and
 * queue it for human review.
 *
 * WHY A SEPARATE PASS AND NOT PART OF CAPTURE
 *
 * `/user/{name}/comments` does NOT return replies — which is why `reply_count`
 * was hardcoded to 0 since the table shipped. Replies require one call per
 * comment against the thread endpoint, so this is inherently slower and rate
 * limited. Oldest-unchecked-first with a per-run batch means the corpus fills in
 * over days instead of hammering the API in one run.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not grade anything. `pushback_confirmed` is left NULL — the pass
 * PROPOSES, a human disposes. The corpus is the moat, and an auto-labelled
 * corpus built on regex cues would poison it permanently. Compare the
 * MIN_SAMPLE=5 floor in the nudge grader and the 23%-precision classifier that
 * was measured and DISCARDED rather than tuned (v11.21.0): when a classifier
 * needs hand-tuning, that is the signal to stop, not to keep adjusting.
 *
 * `replies_checked_at` is written on EVERY checked comment, including those with
 * no replies at all. "Checked and found nothing" and "never checked" must not
 * collapse into the same NULL — that conflation is what hid a dead cron for six
 * days and is the most expensive bug class in this repo.
 */
export async function runCorrectionPass(
  limit = REPLY_CHECK_BATCH
): Promise<CorrectionPassResult> {
  const db = getServiceClient()
  const result: CorrectionPassResult = {
    checked: 0,
    withReplies: 0,
    pushbackFound: 0,
    byKind: {},
    failed: 0,
  }

  // Oldest unchecked first: a comment's replies are effectively final after a
  // few days, so the backlog is the reliable part of the signal.
  const { data, error } = await db
    .from('ss_reddit_intel')
    .select('id, permalink, subreddit, reddit_id')
    .is('replies_checked_at', null)
    .order('posted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[reddit-intel] correction pass: queue query failed:', error)
    throw error
  }

  const queue = (data ?? []) as Array<{
    id: string
    permalink: string
    subreddit: string
    reddit_id: string
  }>

  for (const row of queue) {
    // Derive the thread path from the permalink rather than reconstructing it:
    // .../r/{sub}/comments/{postId}/{slug}/{commentId}/
    const match = row.permalink.match(/\/r\/([^/]+)\/comments\/([^/]+)\/[^/]*\/([^/]+)\/?$/)
    if (!match) {
      // Cannot address it — mark checked so it does not block the queue forever,
      // but count it as failed so a systematic parse break is visible.
      result.failed++
      await db
        .from('ss_reddit_intel')
        .update({ replies_checked_at: new Date().toISOString() })
        .eq('id', row.id)
      continue
    }
    const [, sub, postId, commentId] = match

    let replies: ReplyRow[] = []
    try {
      const listing = (await redditFetch(`/r/${sub}/comments/${postId}/_/${commentId}`, {
        context: '0',
        limit: '30',
        depth: '3',
      })) as unknown[]

      // Reddit returns [postListing, commentListing]; our comment is the first
      // child of the second listing, with its replies nested underneath.
      const commentListing = listing?.[1] as { data?: { children?: unknown[] } } | undefined
      const self = (commentListing?.data?.children?.[0] as { data?: Record<string, unknown> })
        ?.data
      const rawReplies = self?.replies as { data?: { children?: unknown[] } } | string | undefined

      // Reddit returns an EMPTY STRING (not null, not an empty object) when a
      // comment has no replies. Treating that as an object silently yields zero
      // replies and looks identical to a parse failure.
      if (rawReplies && typeof rawReplies !== 'string') {
        replies = (rawReplies.data?.children ?? [])
          .map((c) => c as { kind?: string; data?: Record<string, unknown> })
          .filter((c) => c.kind === 't1')
          .map((c) => ({
            author: String(c.data?.author ?? ''),
            body: String(c.data?.body ?? ''),
            score: typeof c.data?.score === 'number' ? (c.data.score as number) : 0,
          }))
      }
    } catch (err) {
      // A fetch failure must NOT mark the row checked — otherwise a transient
      // Reddit error permanently hides that comment's replies.
      console.error(`[reddit-intel] reply fetch failed for ${row.reddit_id}:`, err)
      result.failed++
      continue
    }

    result.checked++
    if (replies.length > 0) result.withReplies++

    const pushback = selectPushback(replies)
    const update: Record<string, unknown> = {
      replies_checked_at: new Date().toISOString(),
      reply_count: replies.length,
    }

    if (pushback) {
      result.pushbackFound++
      result.byKind[pushback.kind] = (result.byKind[pushback.kind] ?? 0) + 1
      update.pushback_kind = pushback.kind
      update.pushback_quote = pushback.reply.body.slice(0, 500)
      update.pushback_score = pushback.reply.score
      update.pushback_author = pushback.reply.author
      // pushback_confirmed stays NULL on purpose — this is a proposal.
      // A factual_correction is also the historical meaning of was_corrected,
      // so keep that column truthful for anything already reading it. An
      // ai_callout is NOT a factual correction and must not set it.
      if (pushback.kind === 'factual_correction') update.was_corrected = true
    }

    const { error: writeErr } = await db
      .from('ss_reddit_intel')
      .update(update)
      .eq('id', row.id)
    if (writeErr) {
      console.error(`[reddit-intel] pushback write failed for ${row.id}:`, writeErr)
      result.failed++
    }
  }

  return result
}
