/**
 * Phase 9.4: Multi-retailer price scraping CLI.
 *
 * Scrapes prices from YesStyle, Soko Glam, Amazon, and StyleKorean,
 * then fuzzy-matches them to Seoul Sister products and upserts into
 * ss_product_prices + ss_price_history.
 *
 * Run with: npx tsx --tsconfig tsconfig.json scripts/run-prices.ts [options]
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/run-prices.ts --retailer yesstyle --batch 50
 *   npx tsx --tsconfig tsconfig.json scripts/run-prices.ts --retailer all --batch 25
 *   npx tsx --tsconfig tsconfig.json scripts/run-prices.ts --retailer soko_glam --brands "COSRX,Laneige"
 *   npx tsx --tsconfig tsconfig.json scripts/run-prices.ts --stats
 *
 * Options:
 *   --retailer <name>   Which retailer to scrape: yesstyle, soko_glam, amazon, stylekorean, all
 *   --batch <n>         Number of products to search per retailer (default: 50)
 *   --brands <list>     Comma-separated brand names to filter by
 *   --stale <hours>     Skip products priced within N hours (default: 24)
 *   --stats             Show price coverage stats and exit
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local
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
  console.error('Failed to read .env.local — make sure it exists')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE env vars. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

type ValidRetailer = 'yesstyle' | 'soko_glam' | 'amazon' | 'stylekorean'
const VALID_RETAILERS: ValidRetailer[] = ['yesstyle', 'soko_glam', 'amazon', 'stylekorean']

function parseArgs() {
  const args = process.argv.slice(2)
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] : undefined
  }

  return {
    retailer: getArg('--retailer') || 'all',
    batchSize: parseInt(getArg('--batch') || '50', 10),
    brands: getArg('--brands')?.split(',').map(b => b.trim()).filter(Boolean),
    staleHours: parseInt(getArg('--stale') || '24', 10),
    statsOnly: args.includes('--stats'),
  }
}

async function showStats(): Promise<void> {
  console.log('=== PRICE COVERAGE STATS ===\n')

  // Total products
  const { count: totalProducts } = await supabase
    .from('ss_products')
    .select('*', { count: 'exact', head: true })

  // Products with at least one price
  const { data: priceProductIds } = await supabase
    .from('ss_product_prices')
    .select('product_id')

  const uniqueProductsWithPrices = new Set((priceProductIds ?? []).map(r => r.product_id)).size

  console.log(`Total products:            ${totalProducts}`)
  console.log(`Products with prices:      ${uniqueProductsWithPrices}`)
  console.log(`Price coverage:            ${totalProducts ? Math.round((uniqueProductsWithPrices / totalProducts) * 100) : 0}%`)
  console.log('')

  // By retailer
  const { data: allPrices } = await supabase
    .from('ss_product_prices')
    .select('retailer_id, ss_retailers(name)')

  const byRetailer: Record<string, number> = {}
  for (const row of allPrices ?? []) {
    const name = (row.ss_retailers as unknown as { name: string })?.name || 'unknown'
    byRetailer[name] = (byRetailer[name] || 0) + 1
  }

  console.log('Prices by retailer:')
  for (const [name, count] of Object.entries(byRetailer).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(20)} ${count}`)
  }
  console.log('')

  // Stale prices
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: stalePrices } = await supabase
    .from('ss_product_prices')
    .select('*', { count: 'exact', head: true })
    .lt('last_checked', staleThreshold)

  console.log(`Stale prices (>24h):       ${stalePrices}`)

  // Price history
  const { count: historyCount } = await supabase
    .from('ss_price_history')
    .select('*', { count: 'exact', head: true })

  console.log(`Price history records:     ${historyCount}`)

  // Top brands by product count (for targeting)
  const { data: brandCounts } = await supabase
    .rpc('', {}) // Can't aggregate in Supabase client easily, use raw query
    .select('brand_en')

  // Just show available retailers
  console.log('\nAvailable retailers for scraping:')
  for (const r of VALID_RETAILERS) {
    console.log(`  --retailer ${r}`)
  }
}

async function main() {
  const opts = parseArgs()

  if (opts.statsOnly) {
    await showStats()
    return
  }

  const retailerArg = opts.retailer.toLowerCase()
  if (retailerArg !== 'all' && !VALID_RETAILERS.includes(retailerArg as ValidRetailer)) {
    console.error(`Invalid retailer: ${retailerArg}`)
    console.error(`Valid options: ${VALID_RETAILERS.join(', ')}, all`)
    process.exit(1)
  }

  const { PricePipeline } = await import('../src/lib/pipeline/price-pipeline')
  const pipeline = new PricePipeline()

  const startTime = Date.now()

  console.log('=== MULTI-RETAILER PRICE SCRAPING ===')
  console.log(`Retailer:    ${retailerArg}`)
  console.log(`Batch size:  ${opts.batchSize}`)
  console.log(`Stale hours: ${opts.staleHours}`)
  if (opts.brands) console.log(`Brands:      ${opts.brands.join(', ')}`)
  console.log('')

  try {
    if (retailerArg === 'all') {
      const results = await pipeline.runAll(supabase, {
        batch_size: opts.batchSize,
        brands: opts.brands,
        stale_hours: opts.staleHours,
      })

      console.log('\n=== RESULTS BY RETAILER ===')
      let totalNew = 0
      let totalUpdated = 0
      let totalMatched = 0

      for (const result of results) {
        console.log(`\n${result.retailer}:`)
        console.log(`  Searched:   ${result.products_searched}`)
        console.log(`  Found:      ${result.prices_found}`)
        console.log(`  Matched:    ${result.prices_matched}`)
        console.log(`  New prices: ${result.prices_new}`)
        console.log(`  Updated:    ${result.prices_updated}`)
        if (result.errors.length > 0) {
          console.log(`  Errors:     ${result.errors.length}`)
          result.errors.slice(-3).forEach(e => console.log(`    - ${e}`))
        }
        totalNew += result.prices_new
        totalUpdated += result.prices_updated
        totalMatched += result.prices_matched
      }

      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

      console.log('\n=== TOTALS ===')
      console.log(`New prices:     ${totalNew}`)
      console.log(`Updated prices: ${totalUpdated}`)
      console.log(`Total matched:  ${totalMatched}`)
      console.log(`Duration:       ${elapsed} minutes`)
    } else {
      const result = await pipeline.run(supabase, {
        retailer: retailerArg as ValidRetailer,
        batch_size: opts.batchSize,
        brands: opts.brands,
        stale_hours: opts.staleHours,
      })

      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

      console.log('\n=== RESULTS ===')
      console.log(`Retailer:     ${result.retailer}`)
      console.log(`Searched:     ${result.products_searched}`)
      console.log(`Found:        ${result.prices_found}`)
      console.log(`Matched:      ${result.prices_matched}`)
      console.log(`New prices:   ${result.prices_new}`)
      console.log(`Updated:      ${result.prices_updated}`)
      console.log(`Duration:     ${elapsed} minutes`)
      if (result.errors.length > 0) {
        console.log(`Errors:       ${result.errors.length}`)
        result.errors.slice(-5).forEach(e => console.log(`  - ${e}`))
      }
    }
  } catch (error) {
    console.error('FATAL:', error)
    process.exit(1)
  } finally {
    await pipeline.cleanup()
  }
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
