import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { getServiceClient } from '@/lib/supabase'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { runBetGrader } from '@/lib/seo/grade-bets'

// SEO Guardian Phase 3 — grades dated bets against later GSC snapshots and
// writes verdicts back onto ss_seo_reports.grades. The strategist reads those
// grades in its weekly prompt, which is what closes the learning loop.
//
// Runs BEFORE the Sunday 10:00 strategist so the same morning's report already
// sees the fresh verdicts. Pure deterministic measurement + live page fetches
// for execution verification; no AI in the grading path.
export const maxDuration = 300

async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  const db = getServiceClient()

  try {
    const result = await runBetGrader(db)

    await logPipelineRun(db, {
      run_type: 'seo_grade_bets',
      // A failed grade run must be VISIBLE as failed — a tripwire that only
      // writes to console.warn has not closed the loop (the price-refresher
      // lesson: ~130 nights of total failure logged as `completed`).
      status: result.status === 'failed' ? 'failed' : 'completed',
      products_processed: result.gradedNow,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly',
        duration_ms: Date.now() - startedAt,
        bets_examined: result.betsExamined,
        bets_graded_total: result.betsGraded,
        graded_this_run: result.gradedNow,
        summary: result.summary,
        error: result.error ?? null,
      },
    })

    return NextResponse.json({
      success: result.status !== 'failed',
      status: result.status,
      graded_this_run: result.gradedNow,
      bets_graded_total: result.betsGraded,
      summary: result.summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[seo-grade-bets] run failed:', message)
    await logPipelineRun(db, {
      run_type: 'seo_grade_bets',
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { trigger: 'cron', duration_ms: Date.now() - startedAt, error: message },
    })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
