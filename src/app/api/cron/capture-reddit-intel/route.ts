import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { logPipelineRun } from '@/lib/pipeline/run-log'

// Vercel Pro budget. The correction pass costs one Reddit call per comment at
// ~1.1s each (oauth.ts MIN_REQUEST_INTERVAL_MS), so the old 60s ceiling capped
// it at ~40 comments/run and the 621-comment backlog would have taken two
// weeks. Same budget the Olive Young price refresher already uses.
export const maxDuration = 300

/**
 * POST /api/cron/capture-reddit-intel
 *
 * Daily. Captures glass_skin_atx's Reddit comments + the community's verdict on them
 * (score, replies), and attributes reddit-sourced widget sessions back to the channel.
 *
 * WHY: Reddit is Seoul Sister's ONLY live acquisition channel — 503 contributions,
 * 1,205 karma, comments pulling 265–1,300 views, a profile link to the ingredient
 * checker. And `ss_widget_sessions` has recorded ZERO reddit-sourced sessions, ever.
 * We could not answer "does Reddit send anyone to the site?" — the top of the only
 * funnel we have was uninstrumented, and every comment's outcome evaporated.
 *
 * This is growth/measurement (the always-allowed lane under the feature freeze).
 * Claim EXTRACTION into Yuri is DEFERRED — see REDDIT-INTELLIGENCE-BLUEPRINT.md.
 *
 * Idempotent: keyed on permalink, so re-runs REFRESH scores. That's deliberate — a
 * comment's score isn't final for hours or days, and watching the teacher's verdict
 * move is the whole point.
 *
 * Cost: $0 (Reddit API is free for authenticated apps; no AI calls here).
 */
/**
 * Log this run to ss_pipeline_runs.
 *
 * WHY (July 29 2026): this was the ONLY cron that never wrote a run row. It
 * stopped executing after July 14 and nobody could tell, because "ran and found
 * nothing" and "never ran" produced the IDENTICAL database state. The route's
 * own console.error guard was correct and had nothing to fire into that anyone
 * reads. Diagnosis needed a hand-invocation, which immediately captured 82
 * comments that had been sitting there for 15 days.
 *
 * The DB row is the signal. Nothing here depends on an email arriving.
 */
async function logRun(
  startedAt: string,
  status: 'completed' | 'failed',
  scraped: number,
  processed: number,
  metadata: Record<string, unknown>,
  expected = false
): Promise<void> {
  await logPipelineRun({
    source: 'reddit',
    runType: 'capture_reddit_intel',
    startedAt,
    status,
    scraped,
    processed,
    expected,
    metadata,
  })
}

async function handler(request: Request) {
  const startedAt = new Date().toISOString()
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const {
      fetchAuthorComments,
      captureComments,
      attributeSessionsToComments,
      runCorrectionPass,
      INTEL_AUTHOR,
    } = await import('@/lib/reddit/intel')

    const rows = await fetchAuthorComments(INTEL_AUTHOR)

    // Zero rows when we historically have some is a SILENT-FAILURE signal (the
    // scraper-zero-result bug class — cf. the Olive Young P0). Make it loud.
    if (rows.length === 0) {
      const db = getServiceClient()
      const { count } = await db
        .from('ss_reddit_intel')
        .select('*', { count: 'exact', head: true })
      if ((count ?? 0) > 0) {
        console.error(
          `[capture-reddit-intel] expected comments, got 0 (corpus has ${count}). ` +
          'Reddit OAuth creds or API shape may have changed.'
        )
      }
      // Log the empty run too. A zero-result run that leaves no trace is
      // indistinguishable from a cron that never fired — which is exactly how
      // this job went unnoticed for 15 days (see logRun below).
      await logRun(
        startedAt,
        'completed',
        0,
        0,
        { warning: 'no comments returned', corpus_size: count ?? 0 },
        // A corpus that already has rows means zero is anomalous, so the row
        // lands as `stale` and a SQL query can find it without reading logs.
        (count ?? 0) > 0
      )
      return NextResponse.json({ success: true, fetched: 0, warning: 'no comments returned' })
    }

    const result = await captureComments(rows)

    // --- Attribution: did Reddit actually send anyone? -----------------------
    // The number that decides whether this channel is real. Counts widget sessions
    // tagged source='reddit'. Currently ZERO — that is the finding, not a bug.
    const db = getServiceClient()
    const { count: redditSessions } = await db
      .from('ss_widget_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'reddit')

    // Push that total DOWN to the individual comments, so the question stops
    // being "did Reddit send anyone" (one platform-wide number) and becomes
    // "which comments, and from which subreddits, correlate with visits".
    // Coarse by necessity — Reddit exposes no per-comment referral — and it
    // reports honestly when there is nothing to attribute. Non-fatal: a failure
    // here must not lose the capture that already succeeded.
    let attribution: Awaited<ReturnType<typeof attributeSessionsToComments>> | null = null
    try {
      attribution = await attributeSessionsToComments()
    } catch (attrErr) {
      console.error('[capture-reddit-intel] attribution failed:', attrErr)
    }

    // --- Correction pass: what did the community say back? -------------------
    // The least-gameable teacher available here. `/user/{name}/comments` does
    // NOT return replies, so this costs one call per comment and runs a bounded
    // batch per day, oldest-unchecked first. It PROPOSES only — pushback_confirmed
    // stays NULL until a human looks. Non-fatal for the same reason as
    // attribution: a failure here must not lose the capture that succeeded.
    let correction: Awaited<ReturnType<typeof runCorrectionPass>> | null = null
    try {
      correction = await runCorrectionPass()
    } catch (corrErr) {
      console.error('[capture-reddit-intel] correction pass failed:', corrErr)
    }

    console.log(
      `[capture-reddit-intel] fetched=${result.fetched} inserted=${result.inserted} ` +
      `updated=${result.updated} negative=${result.negative} reddit_sessions=${redditSessions ?? 0} ` +
      `attributed_comments=${attribution?.commentsCredited ?? 0} ` +
      `replies_checked=${correction?.checked ?? 0} pushback=${correction?.pushbackFound ?? 0}`
    )

    // An AI callout is the one finding that is NOT about skincare accuracy — it
    // means the account's cover is slipping, which is the only failure that can
    // end the channel outright. Make it loud rather than a row nobody queries.
    if (correction?.byKind?.ai_callout) {
      console.error(
        `[capture-reddit-intel] AI CALLOUT detected in ${correction.byKind.ai_callout} ` +
        `comment thread(s) — review ss_reddit_intel WHERE pushback_kind = 'ai_callout'`
      )
    }

    await logRun(startedAt, 'completed', result.fetched, result.inserted + result.updated, {
      inserted: result.inserted,
      updated: result.updated,
      negative: result.negative,
      reddit_attributed_sessions: redditSessions ?? 0,
      // `attribution_ran` distinguishes "attributed nothing because there is no
      // reddit traffic yet" from "the attribution step threw and never ran".
      // Without it both leave an all-zero table.
      attribution_ran: attribution !== null,
      attribution_had_signal: attribution?.hadSignal ?? false,
      comments_credited: attribution?.commentsCredited ?? 0,
      sessions_unattributed: attribution?.unattributedSessions ?? 0,
      // Same distinction as attribution_ran: "checked and found no pushback"
      // and "the pass threw and never ran" must not both read as zero.
      correction_pass_ran: correction !== null,
      replies_checked: correction?.checked ?? 0,
      comments_with_replies: correction?.withReplies ?? 0,
      pushback_found: correction?.pushbackFound ?? 0,
      pushback_by_kind: correction?.byKind ?? {},
      correction_failures: correction?.failed ?? 0,
    })

    return NextResponse.json({
      success: true,
      ...result,
      reddit_attributed_sessions: redditSessions ?? 0,
    })
  } catch (error) {
    console.error('[capture-reddit-intel] failed:', error)
    // A failed run must leave a trace too — a silent failure is the bug class
    // this whole change exists to close.
    await logRun(startedAt, 'failed', 0, 0, {
      error: error instanceof Error ? error.message : 'capture failed',
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'capture failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron invokes with GET. This route exported POST only, so every scheduled
// run since it shipped got a 405 before reaching the handler — which is why it
// never wrote a run row, never fired its own zero-result console.error, and looked
// EXACTLY like a cron that was never registered. The route's header documents the
// same silence happening once before (Jul 14) and being "fixed" by a hand
// invocation; the hand invocation used POST, so it worked and the real defect
// survived. Every other cron route in this tree already uses this alias pair.
export const POST = handler
export { handler as GET }
