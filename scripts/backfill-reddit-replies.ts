/**
 * Backfill reply/pushback data across the whole Reddit corpus.
 *
 *   npx tsx scripts/backfill-reddit-replies.ts            # sweep everything
 *   npx tsx scripts/backfill-reddit-replies.ts --limit 50 # one bounded pass
 *
 * WHY THIS EXISTS SEPARATE FROM THE CRON
 *
 * The correction pass costs one Reddit call per comment at ~1.1s each, so a
 * serverless function is the wrong shape for a 600-comment backlog — the cron
 * is capped by its own time budget and would take days. This has no timeout.
 *
 * Idempotent and resumable: it only picks up rows where replies_checked_at IS
 * NULL, so an interrupted run loses nothing and re-running continues where it
 * stopped. Safe to Ctrl-C.
 *
 * $0 — Reddit's API is free for authenticated apps and there is no AI call.
 * Nothing here grades anything: pushback_confirmed stays NULL for a human.
 */
import './load-env'
import { runCorrectionPass, REPLY_CHECK_BATCH } from '../src/lib/reddit/intel'
import { getServiceClient } from '../src/lib/supabase'

async function remaining(): Promise<number> {
  const db = getServiceClient()
  const { count, error } = await db
    .from('ss_reddit_intel')
    .select('*', { count: 'exact', head: true })
    .is('replies_checked_at', null)
  if (error) throw error
  return count ?? 0
}

async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const perPass = limitIdx !== -1 ? Number(args[limitIdx + 1]) : REPLY_CHECK_BATCH
  const singlePass = limitIdx !== -1

  const startTotal = await remaining()
  console.log(`[backfill] ${startTotal} comment(s) have never had replies checked`)
  if (startTotal === 0) {
    console.log('[backfill] nothing to do')
    return
  }

  const totals = { checked: 0, withReplies: 0, pushback: 0, failed: 0 }
  const byKind: Record<string, number> = {}
  let pass = 0

  // Loop until the queue drains or a pass makes no progress. A pass that checks
  // nothing while rows remain means every candidate is failing — stop rather
  // than spin, so a systemic breakage is visible instead of looping silently.
  for (;;) {
    pass++
    const before = await remaining()
    if (before === 0) break

    const r = await runCorrectionPass(perPass)
    totals.checked += r.checked
    totals.withReplies += r.withReplies
    totals.pushback += r.pushbackFound
    totals.failed += r.failed
    for (const [k, v] of Object.entries(r.byKind)) byKind[k] = (byKind[k] ?? 0) + v

    const after = await remaining()
    console.log(
      `[backfill] pass ${pass}: checked=${r.checked} withReplies=${r.withReplies} ` +
      `pushback=${r.pushbackFound} failed=${r.failed} | ${after} remaining`
    )

    if (singlePass) break
    if (after >= before) {
      console.error(
        `[backfill] STOPPING — pass ${pass} did not reduce the queue ` +
        `(${before} -> ${after}). Every candidate is failing; investigate rather than loop.`
      )
      break
    }
  }

  console.log('\n[backfill] done')
  console.log(`  checked:        ${totals.checked}`)
  console.log(`  with replies:   ${totals.withReplies}`)
  console.log(`  pushback found: ${totals.pushback}`)
  console.log(`  failures:       ${totals.failed}`)
  console.log(`  by kind:        ${JSON.stringify(byKind)}`)
  console.log(`  still unchecked:${await remaining()}`)
  console.log('\nNothing was graded. Review the queue:')
  console.log("  SELECT subreddit, score, pushback_kind, pushback_score, pushback_quote, permalink")
  console.log("  FROM ss_reddit_intel WHERE pushback_kind IS NOT NULL AND pushback_confirmed IS NULL;")
}

main().catch((err) => {
  // A crash must not read as a completed backfill.
  console.error('[backfill] FAILED — the sweep did NOT complete:', err)
  process.exit(1)
})
