/**
 * Backfill Olive Young prices from ss_product_staging into ss_product_prices.
 *
 * The original Olive Young scrape captured USD prices in raw_data but never
 * wrote them to the prices table. This unlocks ~4,900 product prices (83% coverage)
 * with zero external API calls.
 *
 * Run with: npx tsx --tsconfig tsconfig.json scripts/backfill-olive-young-prices.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  console.error('Failed to read .env.local')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OY_RETAILER_ID = '7a77cb65-225a-4b8b-aa67-f74804347cd9'
const BATCH_SIZE = 500

async function main() {
  console.log('=== Backfill Olive Young Prices ===\n')

  // 1. Get all products that already have an Olive Young price (to skip)
  const existingPrices = new Set<string>()
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('ss_product_prices')
      .select('product_id')
      .eq('retailer_id', OY_RETAILER_ID)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    for (const row of data) existingPrices.add(row.product_id)
    offset += data.length
  }
  console.log(`Products already with OY price: ${existingPrices.size}`)

  // 2. Fetch staging data with OY prices in batches
  let totalFetched = 0
  let totalInserted = 0
  let totalSkipped = 0
  let pageOffset = 0

  while (true) {
    const { data: staged, error } = await supabase
      .from('ss_product_staging')
      .select('processed_product_id, raw_data, source_url')
      .eq('source', 'olive_young')
      .eq('status', 'processed')
      .not('processed_product_id', 'is', null)
      .range(pageOffset, pageOffset + BATCH_SIZE - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      break
    }
    if (!staged || staged.length === 0) break

    totalFetched += staged.length

    // Filter to rows with valid prices that we don't already have
    const toInsert: Array<{
      product_id: string
      retailer_id: string
      price_usd: number
      url: string
      in_stock: boolean
      last_checked: string
    }> = []

    for (const row of staged) {
      const productId = row.processed_product_id
      if (!productId || existingPrices.has(productId)) {
        totalSkipped++
        continue
      }

      const rawData = row.raw_data as Record<string, unknown> | null
      const priceStr = rawData?.price_usd as string | undefined
      if (!priceStr) {
        totalSkipped++
        continue
      }

      const priceUsd = parseFloat(priceStr)
      if (isNaN(priceUsd) || priceUsd <= 0) {
        totalSkipped++
        continue
      }

      const sourceUrl = (rawData?.source_url as string) || row.source_url || ''

      toInsert.push({
        product_id: productId,
        retailer_id: OY_RETAILER_ID,
        price_usd: Math.round(priceUsd * 100) / 100,
        url: sourceUrl,
        in_stock: true,
        last_checked: new Date().toISOString(),
      })

      // Track to avoid dupes within this run
      existingPrices.add(productId)
    }

    // Batch insert
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('ss_product_prices')
        .insert(toInsert)

      if (insertErr) {
        console.error(`Insert error at offset ${pageOffset}:`, insertErr.message)
        // Try one-by-one for this batch to skip dupes
        for (const row of toInsert) {
          const { error: singleErr } = await supabase
            .from('ss_product_prices')
            .insert(row)
          if (!singleErr) totalInserted++
        }
      } else {
        totalInserted += toInsert.length
      }
    }

    if (totalFetched % 2000 === 0 || staged.length < BATCH_SIZE) {
      console.log(`  Processed ${totalFetched} staging rows, inserted ${totalInserted}, skipped ${totalSkipped}`)
    }

    pageOffset += staged.length
    if (staged.length < BATCH_SIZE) break
  }

  console.log(`\n=== Complete ===`)
  console.log(`  Staging rows processed: ${totalFetched}`)
  console.log(`  Prices inserted: ${totalInserted}`)
  console.log(`  Skipped (existing/no price): ${totalSkipped}`)

  // 3. Verify final state
  const { count } = await supabase
    .from('ss_product_prices')
    .select('*', { count: 'exact', head: true })
  const { count: distinctProducts } = await supabase
    .from('ss_product_prices')
    .select('product_id', { count: 'exact', head: true })

  console.log(`\n  Total price records: ${count}`)
  console.log(`  Unique products with prices: ${distinctProducts}`)
  console.log(`  Coverage: ${((distinctProducts ?? 0) / 5878 * 100).toFixed(1)}%`)
}

main().catch(console.error)
