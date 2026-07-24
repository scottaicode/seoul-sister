import { NextResponse } from 'next/server'
import { marked } from 'marked'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { getServiceClient } from '@/lib/supabase'
import { logPipelineRun } from '@/lib/pipeline/log-run'
import { sendEmail, wrapEmailHtml } from '@/lib/email/send'
import { runSeoGuardian } from '@/lib/seo/seo-guardian'

// Weekly SEO Guardian (Phase 1, report-only): pulls Search Console data,
// Opus strategist writes the weekly report + dated bets, emails the owner.
// Report generation reads a 28-day GSC window + prior bets — needs headroom
// beyond the default 60s when GSC pagination and Opus are both slow.
export const maxDuration = 300

async function handler(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startedAt = Date.now()
  const db = getServiceClient()

  try {
    const result = await runSeoGuardian(db)

    if (result.status === 'completed' && result.reportMd) {
      const recipient = process.env.GUARDIAN_ALERT_EMAIL
      if (recipient) {
        const bodyHtml = await marked.parse(result.reportMd)
        const betsHtml =
          result.bets && result.bets.length > 0
            ? `<hr><h3>This week's bets (${result.bets.length})</h3><ul>${result.bets
                .map(
                  (b) =>
                    `<li><strong>${b.action}</strong> (${b.confidence})<br>Expected: ${b.expected_outcome}<br>Review after: ${b.review_after || 'unset'}</li>`
                )
                .join('')}</ul>`
            : ''
        // Internal owner email — plain transport chrome, custom footer so the
        // visitor-facing default footer never renders here
        const emailResult = await sendEmail(
          recipient,
          `SEO Guardian weekly report — seoulsister.com`,
          wrapEmailHtml(
            bodyHtml + betsHtml,
            `<p style="color:#999;font-size:12px">Seoul Sister SEO Guardian · automated weekly report · full data in ss_seo_reports</p>`
          )
        )
        if (!emailResult.sent) {
          console.warn(`[seo-guardian] report email not sent: ${emailResult.reason ?? emailResult.error}`)
        }
      } else {
        console.warn('[seo-guardian] GUARDIAN_ALERT_EMAIL not set — report stored but not emailed')
      }
    }

    await logPipelineRun(db, {
      run_type: 'seo_guardian',
      status: result.status === 'failed' ? 'failed' : 'completed',
      products_processed: result.bets?.length ?? 0,
      completed_at: new Date().toISOString(),
      metadata: {
        trigger: 'cron',
        schedule: 'weekly',
        duration_ms: Date.now() - startedAt,
        guardian_status: result.status,
        report_id: result.reportId ?? null,
        estimated_cost_usd: result.costUsd ?? null,
      },
    })

    return NextResponse.json({
      success: true,
      status: result.status,
      report_id: result.reportId ?? null,
      bets: result.bets?.length ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[seo-guardian] run failed:', message)
    await logPipelineRun(db, {
      run_type: 'seo_guardian',
      status: 'failed',
      completed_at: new Date().toISOString(),
      metadata: { trigger: 'cron', duration_ms: Date.now() - startedAt, error: message },
    })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export { handler as GET, handler as POST }
