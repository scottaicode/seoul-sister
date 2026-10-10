/**
 * DRY RUN — Yuri Wakes Up First. Renders exactly what named real recipients
 * would receive, WITHOUT sending and WITHOUT writing anything.
 *
 * Read-only by construction: runYuriWakesUp({ dryRun: true }) skips grading,
 * every insert/update and every send. As belt-and-braces this script also
 * deletes RESEND_API_KEY from its own process, so even a code path that reached
 * sendEmail() would no-op.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/dry-run-yuri-wakes-up.ts <outDir> \
 *     --users <uuid,uuid> --leads <uuid,uuid> [--assume-owner-approval]
 *
 * Output: <outDir>/dry-run.json (full renders) and one .html per recipient.
 * Recipient emails are never written; refs are id prefixes only.
 */
import './load-env'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getServiceClient } from '../src/lib/supabase'
import { runYuriWakesUp } from '../src/lib/proactive/run'

delete process.env.RESEND_API_KEY

function arg(name: string): string[] {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1].split(',').filter(Boolean) : []
}

async function main() {
  const outDir = process.argv[2]
  if (!outDir || outDir.startsWith('--')) throw new Error('usage: dry-run-yuri-wakes-up.ts <outDir> --users a,b --leads c,d')
  mkdirSync(outDir, { recursive: true })

  const users = arg('--users')
  const leads = arg('--leads')
  const result = await runYuriWakesUp(getServiceClient(), {
    dryRun: true,
    leadLimit: leads.length || 5,
    // An empty filter would mean "everyone"; a review run must name its recipients.
    onlyUserIds: users.length ? users : ['00000000-0000-0000-0000-000000000000'],
    onlyLeadIds: leads.length ? leads : ['00000000-0000-0000-0000-000000000000'],
    assumeOwnerApproval: process.argv.includes('--assume-owner-approval'),
    bypassDaytime: true,
  })

  writeFileSync(join(outDir, 'dry-run.json'), JSON.stringify(result, null, 2))
  result.renders.forEach((r, i) => {
    if (r.html) writeFileSync(join(outDir, `${i + 1}-${r.audience}-${r.recipientRef.split(' ')[1]}.html`), r.html)
  })

  for (const r of result.renders) {
    console.log(`\n=== ${r.audience.toUpperCase()} ${r.recipientRef} -> ${r.decision} (${r.signal ?? '-'}, confidence ${r.confidence ?? '-'})`)
    console.log(`reasoning: ${r.reasoning}`)
    if (r.subject) console.log(`subject: ${r.subject}`)
    if (r.suggestedAsk) console.log(`ask: ${r.suggestedAsk}`)
  }
  console.log('\nsubscribers:', JSON.stringify(result.subscribers))
  console.log('leads:', JSON.stringify(result.leads))
  if (result.errors.length) console.log('errors:', result.errors)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
