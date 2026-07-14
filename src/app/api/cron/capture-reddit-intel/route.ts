import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 60

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
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const { fetchAuthorComments, captureComments, INTEL_AUTHOR } = await import('@/lib/reddit/intel')

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

    console.log(
      `[capture-reddit-intel] fetched=${result.fetched} inserted=${result.inserted} ` +
      `updated=${result.updated} negative=${result.negative} reddit_sessions=${redditSessions ?? 0}`
    )

    return NextResponse.json({
      success: true,
      ...result,
      reddit_attributed_sessions: redditSessions ?? 0,
    })
  } catch (error) {
    console.error('[capture-reddit-intel] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'capture failed' },
      { status: 500 }
    )
  }
}
