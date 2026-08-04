/**
 * Deliver nudge emails that were written before the email channel existed.
 *
 * WHY THIS IS A ONE-OFF AND NOT A FEATURE
 *
 * v11.23.0 added email delivery to the proactive nudge cron, but the send fires
 * only on NEWLY created nudges. Two paying subscribers already had a `pending`
 * nudge written before that shipped:
 *
 *   Kim Wells  — Jul 28, "open_loop_pm_routine_build"     (renewal Aug 21)
 *   Caroline   — Aug 3,  "open_loop_moisturizer_identity"
 *
 * Neither will ever be re-nudged on those threads: the cron skips any
 * trigger_reason it has already used, so these exact messages would sit unsent
 * forever while both subscribers drift. This script delivers what Yuri already
 * wrote. It is not a backfill of a broken pipeline — the pipeline works now;
 * this is the two rows that predate it.
 *
 * WHAT IT DOES NOT DO
 *
 * Does not generate any message (these were written by Opus in Yuri's voice at
 * the time and are used verbatim). Does not touch `status` — the dashboard card
 * must still be able to surface the same row. Does not bypass the opt-out. Does
 * not re-send anything that already has an email_status, so re-running is a
 * no-op — the same guarded-update discipline as
 * scripts/fix-fabricated-routine-matches.ts.
 *
 * Dry run:  npx tsx scripts/send-pending-nudge-emails.ts
 * Apply:    npx tsx scripts/send-pending-nudge-emails.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL')!
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = get('RESEND_API_KEY')
const EMAIL_FROM = get('EMAIL_FROM') || 'Yuri at Seoul Sister <yuri@seoulsister.com>'
const EMAIL_REPLY_TO = get('EMAIL_REPLY_TO')

const APPLY = process.argv.includes('--apply')
const SITE = 'https://www.seoulsister.com'

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Inlined rather than imported from src/lib/email/* — those use the `@/` path
// alias that tsx won't resolve outside Next's build. Kept deliberately identical
// in behavior to lib/email/nudge-email.ts; this file is deleted after the run.
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const SUBJECTS: Record<string, string> = {
  open_loop: 'Picking back up where we left off',
  phase_routine_mismatch: 'Your routine is a step behind your skin',
  cycle_timed_brightening: 'Good week for this, if you want to',
  glass_skin_cadence: 'Worth a fresh look at your progress',
}

function buildHtml(message: string, deepLink: string | null, token: string | null) {
  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  const href = deepLink
    ? `${SITE}${deepLink}${deepLink.includes('?') ? '&' : '?'}from=nudge_email`
    : `${SITE}/yuri?from=nudge_email`

  const unsub = token ? `${SITE}/api/email/unsubscribe?nudge_token=${encodeURIComponent(token)}` : null
  const optOut = unsub
    ? ` <a href="${unsub}" style="color:#999;">Turn off check-in emails</a> and I'll keep them to the app instead.`
    : ''

  return {
    unsubscribeUrl: unsub,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#2b2b2b;max-width:560px;margin:0 auto;padding:24px;">
<p style="margin:0 0 14px;">Hi, it's Yuri.</p>
${paragraphs}
<p style="margin:22px 0 0;"><a href="${href}" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">Pick this up with Yuri</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;">
<p style="font-size:12px;color:#999;margin:0;">Seoul Sister, your K-beauty intelligence advisor. You're getting this because you're a subscriber and we have an open thread on your skin.${optOut}</p>
</body></html>`,
  }
}

function toPlainText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(?:br|\/p|\/li|\/h[1-6]|\/div|\/ol|\/ul)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function main() {
  console.log(APPLY ? '=== APPLY (real sends) ===' : '=== DRY RUN (no sends) ===\n')

  // Only nudges that are still pending AND have never had a send attempt.
  // email_status IS NULL is the re-run guard: once a row records any outcome,
  // this script will never touch it again.
  const { data: nudges, error } = await db
    .from('ss_user_nudges')
    .select('id, user_id, nudge_type, trigger_reason, message, deep_link, nudge_sequence, status, email_status, created_at')
    .eq('status', 'pending')
    .is('email_status', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }
  if (!nudges?.length) {
    console.log('No pending nudges without a send attempt. Nothing to do.')
    return
  }

  console.log(`Found ${nudges.length} pending nudge(s) with no prior send attempt.\n`)

  for (const n of nudges) {
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('nudge_email_opt_out, nudge_unsubscribe_token')
      .eq('user_id', n.user_id)
      .maybeSingle()

    const { data: authUser } = await db.auth.admin.getUserById(n.user_id)
    const email = authUser?.user?.email ?? null

    console.log('─'.repeat(72))
    console.log(`nudge     ${n.id}`)
    console.log(`to        ${email ?? '(no address)'}`)
    console.log(`type      ${n.nudge_type}  ·  seq ${n.nudge_sequence}  ·  written ${n.created_at.slice(0, 10)}`)
    console.log(`reason    ${n.trigger_reason}`)

    if (profile?.nudge_email_opt_out) {
      console.log('SKIP      user opted out of nudge emails')
      continue
    }
    if (!email) {
      console.log('SKIP      no email address on file')
      continue
    }

    const subject = SUBJECTS[n.nudge_type] ?? 'A quick check-in on your skin'
    const { html, unsubscribeUrl } = buildHtml(
      n.message,
      n.deep_link,
      profile?.nudge_unsubscribe_token ?? null
    )

    console.log(`subject   ${subject}`)
    console.log(`\n${toPlainText(html)}\n`)

    if (!APPLY) {
      console.log('DRY RUN   would send the above')
      continue
    }

    if (!RESEND_API_KEY) {
      console.error('ERROR     RESEND_API_KEY missing — cannot send')
      continue
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
        text: toPlainText(html),
        ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
        ...(unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown')
      console.error(`FAILED    resend_${res.status}: ${body}`)
      // Record the failure so the outcome is never invisible.
      await db
        .from('ss_user_nudges')
        .update({
          email_status: 'send_failed',
          email_status_updated_at: new Date().toISOString(),
        })
        .eq('id', n.id)
        .is('email_status', null)
      continue
    }

    let providerId: string | undefined
    try {
      providerId = ((await res.json()) as { id?: string })?.id
    } catch {
      /* send succeeded; no id to record */
    }

    const nowIso = new Date().toISOString()
    const { error: updErr } = await db
      .from('ss_user_nudges')
      .update({
        email_status: 'sent',
        email_sent_at: nowIso,
        email_status_updated_at: nowIso,
        ...(providerId ? { email_provider_id: providerId } : {}),
      })
      .eq('id', n.id)
      .is('email_status', null) // guard: never overwrite a recorded outcome

    if (updErr) console.error(`WARN      sent but status not recorded: ${updErr.message}`)
    console.log(`SENT      provider id ${providerId ?? '(none returned)'}`)
  }

  console.log('─'.repeat(72))
  if (!APPLY) console.log('\nDry run complete. Re-run with --apply to send.')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
