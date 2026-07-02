import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { processDueSends } from '@/lib/email/nurture'
import { buildNurtureEmail } from '@/lib/email/nurture-copy'
import { sendEmail, wrapEmailHtml } from '@/lib/email/send'

export const maxDuration = 60

/**
 * POST/GET /api/cron/nurture-sequence
 *
 * The "Honest Three" nurture sequence (July 1 2026). Scheduled Tue–Thu
 * 16:00 UTC (9am PT — the research-backed send window). Each run:
 *   1. Enrolls any new leads (registered-not-paid + widget email captures)
 *   2. Sends the next due step to each unsuppressed lead (max 20/run)
 *   3. Exits converted leads silently, logs a run summary to ss_pipeline_runs
 *
 * Test mode (never touches the leads table):
 *   POST with JSON { "test_email": "you@example.com", "step": 1 }
 * sends that single step to that address — the approve-what-you-receive path.
 *
 * Secured with CRON_SECRET (verifyCronAuth).
 */
async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const db = getServiceClient()

  // Test mode — single send to a specified inbox, no state changes.
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}))
    if (body?.test_email) {
      const step = ([1, 2, 3].includes(body.step) ? body.step : 1) as 1 | 2 | 3
      const cohort = body.cohort === 'widget' ? 'widget' : 'registered'
      const { subject, bodyHtml, footerHtml } = buildNurtureEmail(step, cohort, 'test-token')
      const result = await sendEmail(body.test_email, subject, wrapEmailHtml(bodyHtml, footerHtml))
      return NextResponse.json({ test: true, step, cohort, ...result })
    }
  }

  const startedAt = Date.now()
  const summary = await processDueSends(db)

  await db.from('ss_pipeline_runs').insert({
    source: 'system',
    run_type: 'nurture_sequence',
    status: summary.errors > 0 ? 'completed_with_errors' : 'completed',
    completed_at: new Date().toISOString(),
    metadata: { ...summary, duration_ms: Date.now() - startedAt },
  })

  if (summary.errors > 0) {
    console.warn(`[nurture-sequence] completed with ${summary.errors} send errors`, summary)
  }

  return NextResponse.json({ success: true, ...summary })
}

export { handler as GET, handler as POST }
