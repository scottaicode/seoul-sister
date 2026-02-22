/**
 * CLI script to manually run the Olive Young bestseller scraper.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/run-bestsellers.ts
 *   npx tsx --tsconfig tsconfig.json scripts/run-bestsellers.ts --scrape-only
 *   npx tsx --tsconfig tsconfig.json scripts/run-bestsellers.ts --stats
 *
 * Options:
 *   --scrape-only   Only scrape bestsellers, don't upsert to DB
 *   --stats         Show current bestseller data in ss_trending_products
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
  console.log('\n=== Current Olive Young Bestseller Data ===\n')

  const { data: trends, error } = await supabase
    .from('ss_trending_products')
    .select('source_product_name, source_product_brand, rank_position, rank_change, days_on_list, trend_score, product_id, data_date')
    .eq('source', 'olive_young')
    .order('rank_position', { ascending: true })

  if (error) {
    console.error('Error fetching trends:', error.message)
    return
  }

  if (!trends || trends.length === 0) {
    console.log('No Olive Young bestseller data found.')
    return
  }

  console.log(`Total: ${trends.length} products (data_date: ${trends[0].data_date})\n`)

  for (const t of trends) {
    const rankChange = t.rank_change !== null
      ? t.rank_change > 0
        ? ` (+${t.rank_change})`
        : t.rank_change < 0
        ? ` (${t.rank_change})`
        : ' (=)'
      : ' (NEW)'
    const matched = t.product_id ? 'MATCHED' : 'unmatched'
    console.log(
      `#${String(t.rank_position).padStart(2)} ${rankChange.padEnd(8)} [${String(t.trend_score).padStart(3)}] ${(t.source_product_brand || '').padEnd(20)} ${t.source_product_name} [${matched}] ${t.days_on_list}d`
    )
  }

  const matchedCount = trends.filter(t => t.product_id).length
  console.log(`\nMatched: ${matchedCount}/${trends.length} (${Math.round(matchedCount / trends.length * 100)}%)`)

  // Show scrape history
  const { data: sources } = await supabase
    .from('ss_trend_data_sources')
    .select('*')
    .eq('source', 'olive_young')
    .order('started_at', { ascending: false })
    .limit(5)

  if (sources && sources.length > 0) {
    console.log('\n=== Recent Scrape History ===\n')
    for (const s of sources) {
      console.log(
        `${s.started_at} [${s.status}] scraped:${s.items_scraped} matched:${s.items_matched} new:${s.items_new}`
      )
    }
  }
}

async function runScrape(scrapeOnly: boolean) {
  const { OliveYoungBestsellerScraper } = await import(
    '../src/lib/pipeline/sources/olive-young-bestsellers'
  )

  const scraper = new OliveYoungBestsellerScraper()

  if (scrapeOnly) {
    console.log('\n=== Scrape Only Mode ===\n')
    // Just scrape and print results, no DB writes
    const result = await scraper.scrapeBestsellers()
    console.log(`Scraped ${result.products.length} bestsellers (${result.scrape_date})\n`)

    for (const p of result.products) {
      console.log(
        `#${String(p.rank).padStart(2)} ${p.brand.padEnd(20)} ${p.name} ${p.price_usd ? `$${p.price_usd}` : ''}`
      )
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:', result.errors)
    }

    await scraper.closeBrowser()
    return
  }

  console.log('\n=== Full Bestseller Pipeline ===\n')
  const startTime = Date.now()
  const result = await scraper.run(supabase)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\nCompleted in ${elapsed}s:`)
  console.log(`  Scraped:   ${result.scraped}`)
  console.log(`  Matched:   ${result.matched}`)
  console.log(`  Unmatched: ${result.unmatched}`)
  console.log(`  Upserted:  ${result.upserted}`)

  if (result.errors.length > 0) {
    console.log(`  Errors:    ${result.errors.length}`)
    for (const e of result.errors.slice(0, 5)) {
      console.log(`    - ${e}`)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--stats')) {
    await showStats()
  } else if (args.includes('--scrape-only')) {
    await runScrape(true)
  } else {
    await runScrape(false)
    console.log('\nRun with --stats to see current data')
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
