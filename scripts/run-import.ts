/**
 * Phase 9.6: Direct import script for 10K Olive Young product scrape.
 *
 * Bypasses the API route to avoid HTTP timeouts and validation limits.
 * Run with: npx tsx --tsconfig tsconfig.json scripts/run-import.ts
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/run-import.ts [--listings-only] [--enrich] [--process] [--link] [--category <id>]
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

// Import the scraper — tsx resolves @/ paths via tsconfig.json
async function main() {
  const args = process.argv.slice(2)
  const listingsOnly = args.includes('--listings-only')
  const enrichOnly = args.includes('--enrich')
  const processOnly = args.includes('--process')
  const linkOnly = args.includes('--link')
  const categoryIdx = args.indexOf('--category')
  const categoryFilter = categoryIdx !== -1 ? args[categoryIdx + 1] : undefined

  // ─── PROCESS MODE: Run Sonnet extraction on enriched staged products ──────
  if (processOnly) {
    console.log('=== PROCESS MODE: Running Sonnet extraction on staged products ===')
    const { processBatch } = await import('../src/lib/pipeline/batch-processor')

    let totalProcessed = 0
    let totalFailed = 0
    let totalDuplicates = 0
    let totalCost = 0
    let batchNum = 0
    let remaining = 1

    while (remaining > 0) {
      batchNum++
      const result = await processBatch(supabase, 20)
      totalProcessed += result.processed
      totalFailed += result.failed
      totalDuplicates += result.duplicates
      totalCost += result.cost.estimated_cost_usd
      remaining = result.remaining
      console.log(
        `Batch ${batchNum}: +${result.processed} processed, +${result.duplicates} dupes, +${result.failed} failed | ` +
        `$${result.cost.estimated_cost_usd.toFixed(4)} | ${remaining} remaining`
      )
    }

    console.log(`\n=== PROCESSING COMPLETE ===`)
    console.log(`Total processed: ${totalProcessed}`)
    console.log(`Total duplicates: ${totalDuplicates}`)
    console.log(`Total failed: ${totalFailed}`)
    console.log(`Estimated cost: $${totalCost.toFixed(2)}`)
    return
  }

  // ─── LINK MODE: Auto-link ingredients for processed products ──────────────
  if (linkOnly) {
    console.log('=== LINK MODE: Auto-linking ingredients for products ===')
    const { linkBatch } = await import('../src/lib/pipeline/ingredient-linker')

    let totalLinked = 0
    let totalSkipped = 0
    let totalFailed = 0
    let totalCreated = 0
    let totalMatched = 0
    let totalCost = 0
    let batchNum = 0
    let remaining = 1

    while (remaining > 0) {
      batchNum++
      const result = await linkBatch(supabase, 50)
      totalLinked += result.products_linked
      totalSkipped += result.products_skipped
      totalFailed += result.products_failed
      totalCreated += result.ingredients_created
      totalMatched += result.ingredients_matched
      totalCost += result.cost.estimated_cost_usd
      remaining = result.remaining
      console.log(
        `Batch ${batchNum}: +${result.products_linked} linked, +${result.products_skipped} skipped, +${result.products_failed} failed | ` +
        `${result.ingredients_created} new ingredients | $${result.cost.estimated_cost_usd.toFixed(4)} | ${remaining} remaining`
      )
      if (result.errors.length > 0) {
        result.errors.slice(-3).forEach(e => console.log(`  ERR: ${e}`))
      }
    }

    console.log(`\n=== INGREDIENT LINKING COMPLETE ===`)
    console.log(`Products linked: ${totalLinked}`)
    console.log(`Products skipped: ${totalSkipped}`)
    console.log(`Products failed: ${totalFailed}`)
    console.log(`Ingredients created: ${totalCreated}`)
    console.log(`Ingredients matched: ${totalMatched}`)
    console.log(`Estimated cost: $${totalCost.toFixed(2)}`)
    return
  }

  // Dynamic import to let tsx resolve paths
  const { OliveYoungScraper } = await import('../src/lib/pipeline/sources/olive-young')

  const scraper = new OliveYoungScraper({ delayMs: 1500 })

  if (enrichOnly) {
    console.log('=== ENRICH MODE: Filling in detail pages for staged products ===')
    let totalEnriched = 0
    let totalFailed = 0
    let remaining = 1 // start loop

    while (remaining > 0) {
      const result = await scraper.enrichDetails(supabase, {
        batchSize: 100,
        concurrency: 8,
      })
      totalEnriched += result.enriched
      totalFailed += result.failed
      remaining = result.remaining
      console.log(`Batch done: +${result.enriched} enriched, +${result.failed} failed, ${remaining} remaining`)
    }

    console.log(`\n=== ENRICHMENT COMPLETE ===`)
    console.log(`Total enriched: ${totalEnriched}`)
    console.log(`Total failed: ${totalFailed}`)
    return
  }

  // Create pipeline run record
  const { data: run, error: runError } = await supabase
    .from('ss_pipeline_runs')
    .insert({
      source: 'olive_young',
      run_type: 'full_scrape',
      status: 'running',
      metadata: {
        script: 'run-import.ts',
        listings_only: listingsOnly,
        category_filter: categoryFilter ?? 'all',
      },
    })
    .select()
    .single()

  if (runError || !run) {
    console.error('Failed to create pipeline run:', runError?.message)
    process.exit(1)
  }

  console.log(`Pipeline run created: ${run.id}`)
  console.log(`Mode: ${listingsOnly ? 'LISTINGS ONLY (fast)' : 'FULL (with details)'}`)
  console.log(`Categories: ${categoryFilter ?? 'ALL'}`)
  console.log('')

  const categories = categoryFilter
    ? [categoryFilter]
    : undefined

  try {
    const stats = await scraper.runScrape(supabase, run.id, {
      mode: 'full',
      categories,
      maxPagesPerCategory: 500, // No API validation limit
      skipDetails: listingsOnly,
    })

    // Mark run as completed
    await supabase
      .from('ss_pipeline_runs')
      .update({
        status: 'completed',
        products_scraped: stats.scraped,
        products_duplicates: stats.duplicates,
        products_failed: stats.failed,
        completed_at: new Date().toISOString(),
        metadata: {
          ...run.metadata,
          new_products: stats.new,
          errors: stats.errors.slice(-20),
        },
      })
      .eq('id', run.id)

    console.log('\n=== SCRAPE COMPLETE ===')
    console.log(`Scraped:    ${stats.scraped}`)
    console.log(`New:        ${stats.new}`)
    console.log(`Duplicates: ${stats.duplicates}`)
    console.log(`Failed:     ${stats.failed}`)
    console.log(`Errors:     ${stats.errors.length}`)
    if (stats.errors.length > 0) {
      console.log('\nLast 5 errors:')
      stats.errors.slice(-5).forEach(e => console.log(`  - ${e}`))
    }
  } catch (error) {
    await supabase
      .from('ss_pipeline_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...run.metadata,
          fatal_error: error instanceof Error ? error.message : String(error),
        },
      })
      .eq('id', run.id)

    console.error('FATAL:', error)
    process.exit(1)
  }

  // Print staging summary
  try {
    const { count } = await supabase
      .from('ss_product_staging')
      .select('id', { count: 'exact', head: true })
    console.log(`\nTotal staging rows: ${count}`)
  } catch {
    // Non-critical
  }
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
