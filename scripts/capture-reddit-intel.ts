/**
 * Capture glass_skin_atx's Reddit comments + their community verdict.
 *
 * Run:  npx tsx scripts/capture-reddit-intel.ts
 *
 * Idempotent — keyed on permalink, so re-running REFRESHES scores (a comment's score
 * isn't final for hours/days, and watching the teacher's verdict move is the point).
 *
 * See src/lib/reddit/intel.ts for why this exists, and
 * REDDIT-INTELLIGENCE-BLUEPRINT.md for the deferred extraction loop.
 */
import './load-env'
import { fetchAuthorComments, captureComments, INTEL_AUTHOR } from '../src/lib/reddit/intel'
import { getServiceClient } from '../src/lib/supabase'

async function main() {
  console.log(`\nCapturing Reddit comments for u/${INTEL_AUTHOR}...\n`)

  const rows = await fetchAuthorComments()
  if (rows.length === 0) {
    console.error(
      'No comments returned. Check REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET —\n' +
      'Reddit now blocks unauthenticated JSON reads, so OAuth is required.'
    )
    process.exit(1)
  }

  const res = await captureComments(rows)

  console.log(`  fetched   ${res.fetched}`)
  console.log(`  inserted  ${res.inserted}  (new)`)
  console.log(`  updated   ${res.updated}  (score refreshed)`)
  console.log(`  negative  ${res.negative}  (score < 0 — likely public corrections)\n`)

  // What did we actually bank? Read it back — never trust the write.
  const db = getServiceClient()
  const { data: top } = await db
    .from('ss_reddit_intel')
    .select('subreddit, score, thread_title, body')
    .order('score', { ascending: false })
    .limit(5)

  console.log('Top-scoring captured comments (the validated claims):')
  for (const r of (top ?? []) as Array<{ subreddit: string; score: number; thread_title: string | null; body: string }>) {
    console.log(
      `  [${String(r.score).padStart(3)}] r/${r.subreddit.padEnd(16)} ${(r.thread_title ?? '').slice(0, 44)}`
    )
    console.log(`        ${r.body.replace(/\n/g, ' ').slice(0, 96)}...`)
  }

  const { data: neg } = await db
    .from('ss_reddit_intel')
    .select('score, thread_title, body')
    .lt('score', 0)
    .order('score', { ascending: true })
    .limit(3)

  if (neg?.length) {
    console.log('\nNEGATIVE-SCORE comments — the graded errors (highest-value rows):')
    for (const r of neg as Array<{ score: number; thread_title: string | null; body: string }>) {
      console.log(`  [${r.score}] ${(r.thread_title ?? '').slice(0, 50)}`)
      console.log(`        ${r.body.replace(/\n/g, ' ').slice(0, 96)}...`)
    }
  }

  const { count } = await db
    .from('ss_reddit_intel')
    .select('*', { count: 'exact', head: true })
  console.log(`\nCorpus size: ${count} comments banked.\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
