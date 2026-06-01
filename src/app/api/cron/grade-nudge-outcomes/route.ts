import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { gradeNudgeOutcomes } from '@/lib/intelligence/nudge-outcome-grader'

export const maxDuration = 60

/**
 * POST /api/cron/grade-nudge-outcomes  (also GET — Vercel cron sends GET)
 *
 * Weekly (Sundays 8 AM UTC via vercel.json). The MEASURED teacher for the nudge
 * learning loop (v10.11.0). For each acted-but-ungraded nudge, checks whether the
 * user's Glass Skin Score moved in the ≥14 days after she acted, gated hard on
 * attribution + confounders (acted-only, phase-consistent, photo-confidence,
 * noise band) — and abstains (insufficient_data) rather than fabricate a verdict
 * when the data isn't there. Pure deterministic measurement, no AI.
 *
 * See NUDGE-OUTCOME-TEACHER-BLUEPRINT.md. Observability: logs every grade bucket +
 * abstention to ss_pipeline_runs + console (no silent failure — v10.3.4 lesson).
 *
 * Secured with CRON_SECRET header.
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  try {
    const r = await gradeNudgeOutcomes()

    const db = getServiceClient()
    await db.from('ss_pipeline_runs').insert({
      source: 'system',
      run_type: 'nudge_outcome_grading',
      status: r.tableMissing ? 'failed' : 'completed',
      products_scraped: r.scanned,
      products_processed: r.graded,
      products_failed: r.errors,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly_sun_8am_utc',
        helped: r.helped,
        no_change: r.noChange,
        hurt: r.hurt,
        insufficient_data: r.insufficientData,
        still_pending: r.stillPending,
        table_missing: r.tableMissing,
        duration_ms: Date.now() - startedAt,
      },
    }).then(({ error }) => {
      if (error) console.error('[grade-nudge-outcomes] run log insert failed:', error.message)
    })

    if (r.tableMissing) {
      console.warn('[grade-nudge-outcomes] outcome columns not applied yet — no-op')
    } else {
      console.log(
        `[grade-nudge-outcomes] scanned ${r.scanned}, graded ${r.graded} (helped ${r.helped} / no_change ${r.noChange} / hurt ${r.hurt} / insufficient ${r.insufficientData}), pending ${r.stillPending}, errors ${r.errors}`
      )
    }

    return NextResponse.json({ success: true, ...r })
  } catch (err) {
    console.error('[grade-nudge-outcomes] failed:', err)
    return NextResponse.json({ error: 'grading failed' }, { status: 500 })
  }
}

export const POST = handler
export { handler as GET }
