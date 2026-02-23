/**
 * CLI script to manually run the Reddit K-beauty mention scanner.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/run-reddit.ts
 *   npx tsx --tsconfig tsconfig.json scripts/run-reddit.ts --dry-run
 *   npx tsx --tsconfig tsconfig.json scripts/run-reddit.ts --stats
 *   npx tsx --tsconfig tsconfig.json scripts/run-reddit.ts --subreddit AsianBeauty
 *
 * Options:
 *   --dry-run     Scan Reddit but don't write to database
 *   --stats       Show current Reddit trend data in the database
 *   --subreddit   Scan only a specific subreddit (default: all 5)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually (no dotenv dependency)
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.warn('Could not read .env.local — ensure env vars are set')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function showStats() {
  console.log('\n=== Reddit Trend Stats ===\n')

  const { data: redditTrends, error } = await supabase
    .from('ss_trending_products')
    .select('id, product_id, source_product_name, source_product_brand, trend_score, mention_count, sentiment_score, days_on_list, raw_data, source_url')
    .eq('source', 'reddit')
    .order('trend_score', { ascending: false })

  if (error) {
    console.error('Error fetching Reddit trends:', error.message)
    return
  }

  if (!redditTrends || redditTrends.length === 0) {
    console.log('No Reddit trend data found. Run the scanner first.')
    return
  }

  console.log(`Total Reddit trends: ${redditTrends.length}\n`)

  console.log('  #  Score  Mentions  Sentiment  Days  Brand                Product')
  console.log('  -  -----  --------  ---------  ----  -------------------  -------')

  for (let i = 0; i < redditTrends.length; i++) {
    const t = redditTrends[i]
    const rd = (t.raw_data ?? {}) as Record<string, unknown>
    const subreddits = (rd.subreddits as string[]) ?? []

    console.log(
      `  ${String(i + 1).padStart(2)}  ` +
      `${String(t.trend_score).padStart(5)}  ` +
      `${String(t.mention_count).padStart(8)}  ` +
      `${String(t.sentiment_score ?? '-').padStart(9)}  ` +
      `${String(t.days_on_list ?? 1).padStart(4)}  ` +
      `${(t.source_product_brand || '').padEnd(19).slice(0, 19)}  ` +
      `${(t.source_product_name || '').slice(0, 50)}`
    )
    if (subreddits.length > 0) {
      console.log(`                                                    r/${subreddits.join(', r/')}`)
    }
  }

  // Show recent tracking records
  const { data: trackingRecords } = await supabase
    .from('ss_trend_data_sources')
    .select('*')
    .eq('source', 'reddit')
    .order('started_at', { ascending: false })
    .limit(3)

  if (trackingRecords && trackingRecords.length > 0) {
    console.log('\n--- Recent Scan History ---\n')
    for (const rec of trackingRecords) {
      const meta = (rec.metadata ?? {}) as Record<string, unknown>
      console.log(
        `  ${rec.status?.padEnd(10)}  ` +
        `Started: ${rec.started_at?.slice(0, 19)}  ` +
        `Posts: ${rec.items_scraped ?? '-'}  ` +
        `Mentions: ${rec.items_matched ?? '-'}  ` +
        `Trends: ${rec.items_new ?? '-'}  ` +
        `Subs: ${meta.subreddits_scanned ?? '-'}`
      )
    }
  }
}

async function dryRun(subredditName?: string) {
  console.log('\n=== Dry Run — Scan Without Writing ===\n')

  const { RedditMentionScanner, KBEAUTY_SUBREDDITS } = await import(
    '../src/lib/reddit/mention-scanner'
  )

  const scanner = new RedditMentionScanner()
  const productCount = await scanner.loadProducts(supabase)
  console.log(`Loaded ${productCount} products for matching\n`)

  const subreddits = subredditName
    ? KBEAUTY_SUBREDDITS.filter(s => s.name.toLowerCase() === subredditName.toLowerCase())
    : KBEAUTY_SUBREDDITS

  if (subreddits.length === 0) {
    console.error(`Subreddit "${subredditName}" not in configured list`)
    console.log('Available:', KBEAUTY_SUBREDDITS.map(s => s.name).join(', '))
    return
  }

  console.log(`Scanning: ${subreddits.map(s => `r/${s.name}`).join(', ')}\n`)

  const scanResult = await scanner.scan(subreddits)

  console.log('\n--- Results (NOT written to DB) ---\n')
  console.log(`Posts scanned:      ${scanResult.posts_scanned}`)
  console.log(`Mentions found:     ${scanResult.mentions_found}`)
  console.log(`Products mentioned: ${scanResult.products_mentioned}`)
  console.log(`Subreddits scanned: ${scanResult.subreddits_scanned}`)

  if (scanResult.aggregates.length > 0) {
    console.log('\n  #  Mentions  Upvotes  Sentiment  Subreddits  Brand / Product')
    console.log('  -  --------  -------  ---------  ----------  ---------------')

    for (let i = 0; i < Math.min(30, scanResult.aggregates.length); i++) {
      const agg = scanResult.aggregates[i]
      console.log(
        `  ${String(i + 1).padStart(2)}  ` +
        `${String(agg.mention_count).padStart(8)}  ` +
        `${String(agg.total_upvotes).padStart(7)}  ` +
        `${String(agg.avg_sentiment).padStart(9)}  ` +
        `${agg.subreddits.map(s => `r/${s}`).join(', ').padEnd(10).slice(0, 10)}  ` +
        `${agg.product_brand} — ${agg.product_name.slice(0, 45)}`
      )
    }

    if (scanResult.aggregates.length > 30) {
      console.log(`\n  ... and ${scanResult.aggregates.length - 30} more`)
    }
  }

  if (scanResult.errors.length > 0) {
    console.log(`\nErrors (${scanResult.errors.length}):`)
    for (const e of scanResult.errors.slice(0, 5)) {
      console.log(`  - ${e}`)
    }
  }
}

async function fullRun(subredditName?: string) {
  console.log('\n=== Running Reddit Mention Scanner ===\n')
  const startTime = Date.now()

  const { RedditMentionScanner, KBEAUTY_SUBREDDITS } = await import(
    '../src/lib/reddit/mention-scanner'
  )
  const { aggregateRedditTrends } = await import(
    '../src/lib/reddit/trend-aggregator'
  )

  const scanner = new RedditMentionScanner()
  const productCount = await scanner.loadProducts(supabase)
  console.log(`Loaded ${productCount} products\n`)

  const subreddits = subredditName
    ? KBEAUTY_SUBREDDITS.filter(s => s.name.toLowerCase() === subredditName.toLowerCase())
    : KBEAUTY_SUBREDDITS

  console.log(`Scanning: ${subreddits.map(s => `r/${s.name}`).join(', ')}\n`)

  const scanResult = await scanner.scan(subreddits)
  const result = await aggregateRedditTrends(supabase, scanResult)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\nCompleted in ${elapsed}s:`)
  console.log(`  Posts scanned:      ${result.posts_scanned}`)
  console.log(`  Mentions found:     ${result.mentions_found}`)
  console.log(`  Products mentioned: ${result.products_mentioned}`)
  console.log(`  Subreddits scanned: ${result.subreddits_scanned}`)
  console.log(`  Trends upserted:    ${result.upserted}`)
  console.log(`  Old trends removed: ${result.removed}`)

  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`)
    for (const e of result.errors.slice(0, 10)) {
      console.log(`    - ${e}`)
    }
  }

  console.log('\nRun with --stats to see current Reddit trends')
}

async function main() {
  const args = process.argv.slice(2)
  const subredditIdx = args.indexOf('--subreddit')
  const subredditName = subredditIdx >= 0 ? args[subredditIdx + 1] : undefined

  if (args.includes('--stats')) {
    await showStats()
  } else if (args.includes('--dry-run')) {
    await dryRun(subredditName)
  } else {
    await fullRun(subredditName)
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
