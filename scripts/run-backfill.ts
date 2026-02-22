/**
 * CLI script to manually run the unmatched bestseller backfill pipeline.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/run-backfill.ts
 *   npx tsx --tsconfig tsconfig.json scripts/run-backfill.ts --dry-run
 *   npx tsx --tsconfig tsconfig.json scripts/run-backfill.ts --stats
 *
 * Options:
 *   --dry-run   Show what would be processed without making changes
 *   --stats     Show current unmatched bestseller counts
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
  console.log('\n=== Unmatched Bestseller Stats ===\n')

  // Count total olive_young trending rows
  const { data: allRows, error: allErr } = await supabase
    .from('ss_trending_products')
    .select('id, product_id, source_product_name, source_product_brand, raw_data')
    .eq('source', 'olive_young')

  if (allErr) {
    console.error('Error fetching trends:', allErr.message)
    return
  }

  if (!allRows || allRows.length === 0) {
    console.log('No Olive Young bestseller data found.')
    return
  }

  const matched = allRows.filter(r => r.product_id !== null)
  const unmatched = allRows.filter(r => r.product_id === null)

  console.log(`Total Olive Young bestsellers: ${allRows.length}`)
  console.log(`  Matched to DB:    ${matched.length} (${Math.round(matched.length / allRows.length * 100)}%)`)
  console.log(`  Unmatched:        ${unmatched.length} (${Math.round(unmatched.length / allRows.length * 100)}%)`)

  if (unmatched.length === 0) {
    console.log('\nAll bestsellers are matched!')
    return
  }

  // Categorize unmatched
  let skipped = 0
  let maxRetries = 0
  let ready = 0

  for (const row of unmatched) {
    const rd = (row.raw_data ?? {}) as Record<string, unknown>
    if (rd.backfill_skipped === true) {
      skipped++
    } else if (((rd.backfill_attempt_count as number) ?? 0) >= 3) {
      maxRetries++
    } else {
      ready++
    }
  }

  console.log(`\nUnmatched breakdown:`)
  console.log(`  Ready to backfill:  ${ready}`)
  console.log(`  Skipped (non-skin): ${skipped}`)
  console.log(`  Max retries (3):    ${maxRetries}`)

  console.log(`\nUnmatched products:`)
  for (const row of unmatched) {
    const rd = (row.raw_data ?? {}) as Record<string, unknown>
    const status = rd.backfill_skipped
      ? '[SKIPPED]'
      : ((rd.backfill_attempt_count as number) ?? 0) >= 3
      ? '[MAX_RETRIES]'
      : rd.backfill_result === 'success'
      ? '[SUCCESS]'
      : '[READY]'
    console.log(`  ${status.padEnd(14)} ${(row.source_product_brand || '').padEnd(20)} ${row.source_product_name}`)
  }
}

async function dryRun() {
  console.log('\n=== Dry Run — What Would Be Processed ===\n')

  const { data: unmatchedRows, error } = await supabase
    .from('ss_trending_products')
    .select('id, source_product_name, source_product_brand, source_url, raw_data')
    .eq('source', 'olive_young')
    .is('product_id', null)

  if (error) {
    console.error('Query error:', error.message)
    return
  }

  if (!unmatchedRows || unmatchedRows.length === 0) {
    console.log('No unmatched bestsellers to process.')
    return
  }

  // Simulate the filtering logic from backfill-trending.ts
  const NON_SKINCARE_PATTERNS: RegExp[] = [
    /protein shake/i, /probiotic/i, /collagen.*(?:stick|biotin|pack)/i,
    /cutting jelly/i, /\bday supply\b/i, /\bsticks?\s*\(\d+-day/i,
    /\bEMS\b/i, /\bhair styler\b/i, /\bNMODE\b/i, /\bLeeds Line\b/i,
    /\bBooster Pro\b/i, /\bAge-R\b.*(?:Shot|Booster|Pro)/i,
    /\bshampoo\b/i, /\bconditioner\b/i, /\bhair oil\b/i, /\bhair ampoule\b/i,
    /\bscalp\b/i, /\brosemary root\b/i, /\bdamage (?:treatment|repair)\b/i,
    /\btint\b.*(?:colors?|set|single)/i, /\bcushion\b.*(?:shades?|refill)/i,
    /\bshades?\b.*\bcushion\b/i, /\bskin nuder cushion\b/i,
    /\bcheek balm\b/i, /\blip potion\b/i, /\blip chiller\b/i,
    /\bpudding pot\b/i, /\bbase prep\b/i, /\bpalette\b/i, /\bmascara\b/i,
    /\bliner\b.*(?:colors?)/i, /\bgloss\b.*(?:colors?|set|single)/i,
    /\blip balm\b.*(?:colors?|set|single)/i, /\btinted lip\b/i,
  ]

  let skippedNonSkincare = 0
  let alreadyAttempted = 0
  const candidates: typeof unmatchedRows = []

  for (const row of unmatchedRows) {
    const rd = (row.raw_data ?? {}) as Record<string, unknown>

    if (rd.backfill_skipped === true) {
      alreadyAttempted++
      continue
    }

    const attemptCount = (rd.backfill_attempt_count as number) ?? 0
    if (attemptCount >= 3) {
      alreadyAttempted++
      continue
    }

    const combinedText = `${row.source_product_name ?? ''} ${row.source_product_brand ?? ''}`
    if (NON_SKINCARE_PATTERNS.some(p => p.test(combinedText))) {
      skippedNonSkincare++
      console.log(`  [SKIP non-skincare] ${(row.source_product_brand || '').padEnd(20)} ${row.source_product_name}`)
      continue
    }

    candidates.push(row)
  }

  console.log(`\nTotal unmatched: ${unmatchedRows.length}`)
  console.log(`Already attempted/skipped: ${alreadyAttempted}`)
  console.log(`Would skip (non-skincare): ${skippedNonSkincare}`)
  console.log(`Would process (max 8): ${Math.min(candidates.length, 8)} of ${candidates.length} candidates\n`)

  const batch = candidates.slice(0, 8)
  for (const row of batch) {
    const rd = (row.raw_data ?? {}) as Record<string, unknown>
    const sourceId = rd.source_id as string | undefined
    console.log(`  [WOULD PROCESS] ${(row.source_product_brand || '').padEnd(20)} ${row.source_product_name} (source_id: ${sourceId ?? 'NONE'})`)
  }

  if (candidates.length > 8) {
    console.log(`\n  ... and ${candidates.length - 8} more in subsequent runs`)
  }
}

async function runBackfill() {
  console.log('\n=== Running Backfill Pipeline ===\n')
  const startTime = Date.now()

  const { backfillUnmatchedBestsellers } = await import(
    '../src/lib/pipeline/backfill-trending'
  )

  const result = await backfillUnmatchedBestsellers(supabase)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\nCompleted in ${elapsed}s:`)
  console.log(`  Total unmatched:    ${result.total_unmatched}`)
  console.log(`  Skipped non-skin:   ${result.skipped_non_skincare}`)
  console.log(`  Already attempted:  ${result.already_attempted}`)
  console.log(`  Attempted:          ${result.attempted}`)
  console.log(`  Backfilled:         ${result.backfilled}`)
  console.log(`  Dedup matched:      ${result.dedup_matched}`)
  console.log(`  Failed:             ${result.failed}`)

  if (result.errors.length > 0) {
    console.log(`\n  Errors:`)
    for (const e of result.errors.slice(0, 10)) {
      console.log(`    - ${e}`)
    }
  }

  console.log(`\n  Sonnet API cost:`)
  console.log(`    Calls:          ${result.cost.calls}`)
  console.log(`    Input tokens:   ${result.cost.input_tokens}`)
  console.log(`    Output tokens:  ${result.cost.output_tokens}`)
  console.log(`    Est. cost:      $${result.cost.estimated_cost_usd.toFixed(4)}`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--stats')) {
    await showStats()
  } else if (args.includes('--dry-run')) {
    await dryRun()
  } else {
    await runBackfill()
    console.log('\nRun with --stats to see current state')
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
