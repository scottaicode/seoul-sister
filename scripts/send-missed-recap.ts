/**
 * One-off recovery: send a lead recap that the dedup bug silently swallowed.
 *
 * On 2026-07-21 a real visitor had a 14-message consultation, gave his email at
 * message 11, and was told three times the recap was on its way. It never sent:
 * the cross-visitor dedup guard matched a capture of the same address from 3
 * days earlier and skipped the send with no trace (see commit fcce2ab).
 *
 * The guard is fixed going forward. This recovers the ONE lead already lost,
 * and doubles as an end-to-end exercise of the real send path: it calls the
 * production `generateLeadEmail()` (Yuri writes it, and keeps her should_send /
 * address-ownership judgment) and the production `sendEmail()`, then records
 * the outcome via `recordRecapStatus()`. Nothing here is reimplemented, so a
 * pass here is evidence the live path works — not evidence that a parallel
 * script works.
 *
 * DRY RUN BY DEFAULT. Prints the generated subject/body and sends nothing.
 *   npx tsx scripts/send-missed-recap.ts                 # dry run
 *   npx tsx scripts/send-missed-recap.ts --send          # actually send
 *
 * Target is passed explicitly so this can never fire at a whole table.
 */

import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { generateLeadEmail } from '../src/lib/email/lead-email'
import { sendEmail, wrapEmailHtml } from '../src/lib/email/send'
import { recordRecapStatus } from '../src/lib/widget/visitor'
import type { ConversationTurn, VisitorMemoryFacts } from '../src/lib/email/lead-email'

const VISITOR_ID = '4848fbee-a2cc-407c-93dd-74d1a911485a'
const APPLY = process.argv.includes('--send')

async function main() {
  const db = getServiceClient()

  const { data: visitor, error: vErr } = await db
    .from('ss_widget_visitors')
    .select('visitor_id, captured_email, ai_memory, recap_status, total_messages')
    .eq('visitor_id', VISITOR_ID)
    .single()

  if (vErr || !visitor) {
    console.error('Visitor not found:', vErr?.message)
    process.exit(1)
  }
  if (!visitor.captured_email) {
    console.error('No captured_email on this visitor — nothing to send to.')
    process.exit(1)
  }

  // Guard: never double-send. If a recap already went out, stop.
  if (visitor.recap_status === 'sent' || visitor.recap_status === 'delivered') {
    console.error(`recap_status is already "${visitor.recap_status}" — refusing to double-send.`)
    process.exit(1)
  }

  const { data: messages, error: mErr } = await db
    .from('ss_widget_messages')
    .select('role, content, created_at')
    .eq('visitor_id', VISITOR_ID)
    .order('created_at', { ascending: true })

  if (mErr || !messages?.length) {
    console.error('No messages found:', mErr?.message)
    process.exit(1)
  }

  const conversation: ConversationTurn[] = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  console.log(`Visitor:        ${VISITOR_ID}`)
  console.log(`To:             ${visitor.captured_email}`)
  console.log(`Turns:          ${conversation.length}`)
  console.log(`recap_status:   ${visitor.recap_status ?? 'NULL (the bug)'}`)
  console.log(`Mode:           ${APPLY ? 'SEND' : 'DRY RUN'}\n`)

  // Yuri writes it — same generator the widget route uses, same judgments.
  const result = await generateLeadEmail(
    (visitor.ai_memory || {}) as VisitorMemoryFacts,
    conversation,
    visitor.captured_email as string,
    VISITOR_ID
  )

  if (result.outcome !== 'send') {
    console.error(`Yuri returned outcome "${result.outcome}" — sending nothing.`)
    console.error('That is her judgment and it is respected. No status written.')
    process.exit(1)
  }

  console.log('--- SUBJECT ---')
  console.log(result.email.subject)
  console.log('\n--- BODY (html) ---')
  console.log(result.email.bodyHtml)
  console.log('\n-------------------\n')

  if (!APPLY) {
    console.log('DRY RUN — nothing sent. Re-run with --send to deliver.')
    return
  }

  const send = await sendEmail(
    visitor.captured_email as string,
    result.email.subject,
    wrapEmailHtml(result.email.bodyHtml)
  )
  await recordRecapStatus(VISITOR_ID, send.sent ? 'sent' : 'send_failed', {
    providerId: send.providerId,
  })

  console.log(
    send.sent
      ? `SENT. provider id: ${send.providerId ?? '(none returned)'}`
      : `SEND FAILED: ${send.reason ?? 'unknown'} — recorded as send_failed.`
  )
}

main().catch((err) => {
  console.error('Script threw:', err)
  process.exit(1)
})
