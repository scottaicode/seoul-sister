/**
 * One-time price-change announcement ($9.99/month + 7-day trial), Oct 31 2026.
 * Copy: src/lib/email/price-change-email.ts (reviewed; see
 * reports/DRAFT-FOUNDING-MEMBER-EMAIL-OCT30.md).
 *
 * WHO GETS IT: every unsuppressed row in ss_nurture_leads (free accounts +
 * homepage-chat emails, each with a one-click unsubscribe token), EXCEPT:
 *   - anyone with ANY ss_subscriptions row (no trial for them; the email would lie)
 *   - internal/admin/demo/excluded_from_metrics accounts, NURTURE_EXCLUDE_EMAILS
 *   - PRICE_CHANGE_SKIP_EMAILS (owner/test addresses, personal-offer leads; .env.local only)
 *   - anyone already in the sent log (re-running never double-sends)
 *
 * SAFETY
 *   - DRY RUN BY DEFAULT: prints the list, writes both rendered versions to reports/.
 *   - --test-to <email>: sends BOTH versions to that address only (needs the address set).
 *   - --send: refuses unless EMAIL_POSTAL_ADDRESS is set (CAN-SPAM). One at a time,
 *     with a pause. Each send is appended to the sent log immediately, and the
 *     lead's last_sent_at is stamped so the nurture sequence waits its normal gap.
 *
 * USAGE
 *   npx tsx scripts/send-price-change-email.ts                     # dry run
 *   npx tsx scripts/send-price-change-email.ts --test-to me@x.com  # preview in inbox
 *   npx tsx scripts/send-price-change-email.ts --send              # live
 */
import './load-env'
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, wrapEmailHtml, postalAddress } from '../src/lib/email/send'
import { buildPriceChangeEmail, type PriceChangeCohort } from '../src/lib/email/price-change-email'

const SITE = 'https://www.seoulsister.com'
const SENT_LOG = 'reports/price-change-sent-log.jsonl'
/** Addresses to skip, comma-separated, from .env.local (never in the repo): the owner's
 * own/test addresses and leads with a personal offer. */
const SKIP_EMAILS = new Set(
  (process.env.PRICE_CHANGE_SKIP_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
)
const PAUSE_MS = 1500

const args = process.argv.slice(2)
const SEND = args.includes('--send')
const testIdx = args.indexOf('--test-to')
const TEST_TO = testIdx >= 0 ? args[testIdx + 1] : null

function sentAlready(): Set<string> {
  if (!existsSync(SENT_LOG)) return new Set()
  return new Set(
    readFileSync(SENT_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => (JSON.parse(l).email as string).toLowerCase())
  )
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  if ((SEND || TEST_TO) && !postalAddress()) {
    console.error('REFUSING: EMAIL_POSTAL_ADDRESS is not set. Marketing email must carry a postal address.')
    process.exit(1)
  }

  const [leadsRes, subsRes, profRes, usersRes] = await Promise.all([
    db.from('ss_nurture_leads').select('id, email, user_id, cohort, unsubscribe_token').eq('suppressed', false),
    db.from('ss_subscriptions').select('user_id'),
    db.from('ss_user_profiles').select('user_id, is_admin, is_demo, excluded_from_metrics'),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  for (const r of [leadsRes, subsRes, profRes]) if (r.error) throw new Error(r.error.message)
  if (usersRes.error) throw new Error(usersRes.error.message)

  const emailToUser = new Map(usersRes.data.users.map((u) => [u.email?.toLowerCase() ?? '', u.id]))
  const everSubscribed = new Set((subsRes.data ?? []).map((r) => r.user_id as string))
  const internal = new Set(
    (profRes.data ?? []).filter((p) => p.is_admin || p.is_demo || p.excluded_from_metrics).map((p) => p.user_id as string)
  )
  const excluded = new Set(
    (process.env.NURTURE_EXCLUDE_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  )
  const done = sentAlready()

  const skipped: Record<string, number> = {}
  const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1 }
  const recipients: Array<{ id: string; email: string; cohort: PriceChangeCohort; token: string }> = []
  const seen = new Set<string>()

  for (const l of leadsRes.data ?? []) {
    const email = (l.email as string).toLowerCase()
    // A widget-only email can still belong to an account: check both links.
    const uid = (l.user_id as string | null) ?? emailToUser.get(email) ?? null
    if (seen.has(email)) { skip('duplicate'); continue }
    seen.add(email)
    if (SKIP_EMAILS.has(email)) { skip('skip_list'); continue }
    if (excluded.has(email)) { skip('excluded_env'); continue }
    if (uid && internal.has(uid)) { skip('internal'); continue }
    if (uid && everSubscribed.has(uid)) { skip('had_subscription'); continue }
    if (done.has(email)) { skip('already_sent'); continue }
    // Has an account (registered cohort or matched) -> "log in" version.
    const cohort: PriceChangeCohort = uid ? 'registered' : 'widget'
    recipients.push({ id: l.id as string, email, cohort, token: l.unsubscribe_token as string })
  }

  const byCohort = recipients.reduce<Record<string, number>>((a, r) => ((a[r.cohort] = (a[r.cohort] ?? 0) + 1), a), {})
  console.log(`Recipients: ${recipients.length}`, byCohort)
  console.log('Skipped:', skipped)

  mkdirSync('reports', { recursive: true })
  for (const c of ['registered', 'widget'] as const) {
    const e = buildPriceChangeEmail(c, `${SITE}/api/email/unsubscribe?token=EXAMPLE`)
    writeFileSync(`reports/price-change-preview-${c}.html`, wrapEmailHtml(e.bodyHtml, e.footerHtml))
  }
  console.log('Previews: reports/price-change-preview-registered.html, reports/price-change-preview-widget.html')

  if (TEST_TO) {
    for (const c of ['registered', 'widget'] as const) {
      const url = `${SITE}/api/email/unsubscribe?token=00000000-0000-0000-0000-000000000000`
      const e = buildPriceChangeEmail(c, url)
      const r = await sendEmail(TEST_TO, `[TEST ${c}] ${e.subject}`, wrapEmailHtml(e.bodyHtml, e.footerHtml), { unsubscribeUrl: url })
      console.log(`test ${c} ->`, TEST_TO, r.sent ? 'sent' : `FAILED ${JSON.stringify(r)}`)
    }
    return
  }

  if (!SEND) {
    console.log('\nDRY RUN. Nothing sent. Re-run with --send to send.')
    for (const r of recipients) console.log(`  ${r.cohort.padEnd(10)} ${r.email}`)
    return
  }

  let sent = 0, failed = 0
  for (const r of recipients) {
    const url = `${SITE}/api/email/unsubscribe?token=${r.token}`
    const e = buildPriceChangeEmail(r.cohort, url)
    const res = await sendEmail(r.email, e.subject, wrapEmailHtml(e.bodyHtml, e.footerHtml), { unsubscribeUrl: url })
    if (res.sent) {
      sent++
      appendFileSync(SENT_LOG, JSON.stringify({ email: r.email, cohort: r.cohort, at: new Date().toISOString() }) + '\n')
      // Space the nurture sequence's next email from this one.
      const { error } = await db.from('ss_nurture_leads').update({ last_sent_at: new Date().toISOString() }).eq('id', r.id)
      if (error) console.error(`  last_sent_at update failed for ${r.email}: ${error.message}`)
      console.log(`  sent    ${r.email}`)
    } else {
      failed++
      console.error(`  FAILED  ${r.email}: ${JSON.stringify(res)}`)
    }
    await new Promise((ok) => setTimeout(ok, PAUSE_MS))
  }
  const { error: logErr } = await db.from('ss_pipeline_runs').insert({
    run_type: 'price_change_email',
    status: failed ? 'completed_with_errors' : 'completed',
    completed_at: new Date().toISOString(),
    metadata: { sent, failed, skipped, by_cohort: byCohort },
  })
  if (logErr) console.error('pipeline run log failed:', logErr.message)
  console.log(`\nDone: ${sent} sent, ${failed} failed.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
