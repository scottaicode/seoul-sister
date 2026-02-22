/**
 * Backfill Unmatched Bestsellers
 *
 * When the daily Olive Young bestseller scraper finds products not in our DB,
 * this module scrapes their detail pages, runs Sonnet extraction, inserts them
 * into ss_products, links ingredients, and updates the ss_trending_products row.
 *
 * Designed to run as a cron job 15 min after the bestseller scraper (6:45 AM UTC).
 * Processes up to MAX_PRODUCTS_PER_RUN products per execution within the 60s
 * Vercel cron timeout.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawProductData } from './types'
import { extractProductData } from './extractor'
import { linkSingleProduct } from './ingredient-linker'
import { IngredientCache } from './ingredient-matcher'
import { CostTracker } from './cost-tracker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackfillResult {
  total_unmatched: number
  skipped_non_skincare: number
  already_attempted: number
  attempted: number
  backfilled: number
  dedup_matched: number
  failed: number
  errors: string[]
  cost: { calls: number; input_tokens: number; output_tokens: number; estimated_cost_usd: number }
  duration_ms: number
}

interface UnmatchedRow {
  id: string
  source_product_name: string | null
  source_product_brand: string | null
  source_url: string | null
  raw_data: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PRODUCTS_PER_RUN = 8
const MAX_RETRY_ATTEMPTS = 3

/**
 * Patterns that indicate a product is NOT skincare and should be skipped.
 * Checked against the combined product name + brand string.
 */
const NON_SKINCARE_PATTERNS: RegExp[] = [
  // Supplements / food / health
  /protein shake/i,
  /probiotic/i,
  /collagen.*(?:stick|biotin|pack)/i,
  /cutting jelly/i,
  /\bday supply\b/i,
  /\bsticks?\s*\(\d+-day/i,

  // Beauty devices / tools
  /\bEMS\b/i,
  /\bhair styler\b/i,
  /\bNMODE\b/i,
  /\bLeeds Line\b/i,
  /\bBooster Pro\b/i,
  /\bAge-R\b.*(?:Shot|Booster|Pro)/i,

  // Hair care
  /\bshampoo\b/i,
  /\bconditioner\b/i,
  /\bhair oil\b/i,
  /\bhair ampoule\b/i,
  /\bscalp\b/i,
  /\brosemary root\b/i,
  /\bdamage (?:treatment|repair)\b/i,

  // Makeup
  /\btint\b.*(?:colors?|set|single)/i,
  /\bcushion\b.*(?:shades?|refill)/i,
  /\bshades?\b.*\bcushion\b/i,
  /\bskin nuder cushion\b/i,
  /\bcheek balm\b/i,
  /\blip potion\b/i,
  /\blip chiller\b/i,
  /\bpudding pot\b/i,
  /\bbase prep\b/i,
  /\bpalette\b/i,
  /\bmascara\b/i,
  /\bliner\b.*(?:colors?)/i,
  /\bgloss\b.*(?:colors?|set|single)/i,
  /\blip balm\b.*(?:colors?|set|single)/i,
  /\btinted lip\b/i,
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Find unmatched bestseller products, scrape their details from Olive Young,
 * run Sonnet extraction, insert into ss_products, link ingredients, and
 * update the ss_trending_products row with the new product_id.
 */
export async function backfillUnmatchedBestsellers(
  supabase: SupabaseClient
): Promise<BackfillResult> {
  const startTime = Date.now()
  const costTracker = new CostTracker()
  const result: BackfillResult = {
    total_unmatched: 0,
    skipped_non_skincare: 0,
    already_attempted: 0,
    attempted: 0,
    backfilled: 0,
    dedup_matched: 0,
    failed: 0,
    errors: [],
    cost: { calls: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
    duration_ms: 0,
  }

  // 1. Query all unmatched olive_young trending rows
  const { data: unmatchedRows, error: queryError } = await supabase
    .from('ss_trending_products')
    .select('id, source_product_name, source_product_brand, source_url, raw_data')
    .eq('source', 'olive_young')
    .is('product_id', null)

  if (queryError) {
    result.errors.push(`Query error: ${queryError.message}`)
    result.duration_ms = Date.now() - startTime
    result.cost = costTracker.summary
    return result
  }

  if (!unmatchedRows || unmatchedRows.length === 0) {
    console.log('[backfill] No unmatched bestsellers found')
    result.duration_ms = Date.now() - startTime
    result.cost = costTracker.summary
    return result
  }

  result.total_unmatched = unmatchedRows.length
  console.log(`[backfill] Found ${unmatchedRows.length} unmatched bestsellers`)

  // 2. Filter already-attempted and non-skincare
  const candidates: UnmatchedRow[] = []

  for (const row of unmatchedRows as UnmatchedRow[]) {
    const rd = (row.raw_data ?? {}) as Record<string, unknown>

    // Skip if already marked as non-skincare
    if (rd.backfill_skipped === true) {
      result.already_attempted++
      continue
    }

    // Skip if max retry attempts reached
    const attemptCount = (rd.backfill_attempt_count as number) ?? 0
    if (attemptCount >= MAX_RETRY_ATTEMPTS) {
      result.already_attempted++
      continue
    }

    // Check non-skincare patterns
    const combinedText = `${row.source_product_name ?? ''} ${row.source_product_brand ?? ''}`
    if (isNonSkincare(combinedText)) {
      await markSkipped(supabase, row.id, rd, 'non_skincare')
      result.skipped_non_skincare++
      continue
    }

    candidates.push(row)
  }

  console.log(`[backfill] ${candidates.length} skincare candidates after filtering (${result.skipped_non_skincare} non-skincare skipped, ${result.already_attempted} already attempted)`)

  if (candidates.length === 0) {
    result.duration_ms = Date.now() - startTime
    result.cost = costTracker.summary
    return result
  }

  // 3. Take up to MAX_PRODUCTS_PER_RUN
  const batch = candidates.slice(0, MAX_PRODUCTS_PER_RUN)

  // 4. Load ingredient cache once for all products
  const ingredientCache = new IngredientCache()
  await ingredientCache.load(supabase)

  // 5. Initialize Olive Young scraper (Playwright browser)
  const { OliveYoungScraper } = await import('./sources/olive-young')
  const scraper = new OliveYoungScraper({ delayMs: 1000 })

  try {
    for (const row of batch) {
      result.attempted++
      const rd = (row.raw_data ?? {}) as Record<string, unknown>
      const sourceId = rd.source_id as string | undefined
      const name = row.source_product_name ?? 'Unknown'
      const brand = row.source_product_brand ?? ''

      console.log(`[backfill] Processing: ${brand} - ${name}`)

      try {
        // 5a. Dedup check — maybe another pipeline already added this product
        const existingId = await findExistingProduct(supabase, name, brand)
        if (existingId) {
          console.log(`[backfill]   Dedup match found: ${existingId}`)
          await updateTrendingRow(supabase, row.id, existingId, rd, 'dedup_matched')
          result.dedup_matched++
          continue
        }

        // 5b. Need source_id to scrape detail page
        if (!sourceId) {
          console.log(`[backfill]   No source_id in raw_data, skipping`)
          await markAttempted(supabase, row.id, rd, 'failed', 'No source_id in raw_data')
          result.failed++
          continue
        }

        // 5c. Scrape detail page from Olive Young
        console.log(`[backfill]   Scraping detail page for ${sourceId}...`)
        const detail = await scraper.scrapeProductDetail(sourceId)

        if (!detail) {
          console.log(`[backfill]   Detail scrape returned null`)
          await markAttempted(supabase, row.id, rd, 'failed', 'Detail page scrape returned null')
          result.failed++
          continue
        }

        // 5d. Build RawProductData for Sonnet extraction
        const rawData: RawProductData = {
          source: 'olive_young',
          source_url: detail.source_url,
          source_id: sourceId,
          name_en: detail.name_en,
          name_ko: detail.name_ko,
          brand_en: detail.brand_en || brand,
          brand_ko: detail.brand_ko,
          category_raw: detail.category_raw || '',
          price_krw: detail.price_krw,
          price_usd: detail.price_usd ?? (rd.price_usd as number | null) ?? null,
          description_raw: detail.description_raw || '',
          ingredients_raw: detail.ingredients_raw,
          image_url: detail.image_url ?? (rd.image_url as string | null) ?? null,
          volume_display: detail.volume_display,
          rating_avg: detail.rating_avg,
          review_count: detail.review_count,
          scraped_at: new Date().toISOString(),
        }

        // 5e. Sonnet extraction
        console.log(`[backfill]   Running Sonnet extraction...`)
        const extraction = await extractProductData(rawData)
        costTracker.record(extraction.usage)

        const processed = extraction.data

        // 5f. Second dedup check with cleaned name from Sonnet
        const existingId2 = await findExistingProduct(supabase, processed.name_en, processed.brand_en)
        if (existingId2) {
          console.log(`[backfill]   Dedup match (post-extraction): ${existingId2}`)
          await updateTrendingRow(supabase, row.id, existingId2, rd, 'dedup_matched')
          result.dedup_matched++
          continue
        }

        // 5g. Insert into ss_products
        console.log(`[backfill]   Inserting product: ${processed.brand_en} - ${processed.name_en} (${processed.category})`)
        const newProductId = await insertProduct(supabase, processed)

        if (!newProductId) {
          await markAttempted(supabase, row.id, rd, 'failed', 'Product insert returned no ID')
          result.failed++
          continue
        }

        // 5h. Link ingredients if available
        if (processed.ingredients_raw) {
          try {
            const linkResult = await linkSingleProduct(
              supabase,
              newProductId,
              processed.ingredients_raw,
              ingredientCache,
              costTracker
            )
            console.log(`[backfill]   Linked ${linkResult.linked} ingredients (${linkResult.created} new)`)
          } catch (linkErr) {
            // Non-fatal — product is still inserted, ingredients can be linked later
            const msg = linkErr instanceof Error ? linkErr.message : String(linkErr)
            console.warn(`[backfill]   Ingredient linking failed (non-fatal): ${msg}`)
          }
        }

        // 5i. Update trending row with new product_id
        await updateTrendingRow(supabase, row.id, newProductId, rd, 'success')
        result.backfilled++
        console.log(`[backfill]   Success: ${processed.brand_en} - ${processed.name_en} -> ${newProductId}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`${brand} ${name}: ${msg}`)
        result.failed++
        await markAttempted(supabase, row.id, rd, 'failed', msg).catch(() => {})
        console.error(`[backfill]   Error: ${msg}`)
      }
    }
  } finally {
    await scraper.closeBrowser()
  }

  result.cost = costTracker.summary
  result.duration_ms = Date.now() - startTime

  console.log(`[backfill] Complete: ${result.backfilled} backfilled, ${result.dedup_matched} dedup, ${result.failed} failed, ${result.skipped_non_skincare} non-skincare`)

  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonSkincare(text: string): boolean {
  return NON_SKINCARE_PATTERNS.some((pattern) => pattern.test(text))
}

async function markSkipped(
  supabase: SupabaseClient,
  trendingId: string,
  currentRawData: Record<string, unknown>,
  reason: string
): Promise<void> {
  await supabase
    .from('ss_trending_products')
    .update({
      raw_data: {
        ...currentRawData,
        backfill_skipped: true,
        skip_reason: reason,
      },
    })
    .eq('id', trendingId)
}

async function markAttempted(
  supabase: SupabaseClient,
  trendingId: string,
  currentRawData: Record<string, unknown>,
  result: 'failed',
  error: string
): Promise<void> {
  const attemptCount = ((currentRawData.backfill_attempt_count as number) ?? 0) + 1
  await supabase
    .from('ss_trending_products')
    .update({
      raw_data: {
        ...currentRawData,
        backfill_attempted: true,
        backfill_attempt_count: attemptCount,
        backfill_result: result,
        backfill_error: error,
        backfill_last_attempt: new Date().toISOString(),
      },
    })
    .eq('id', trendingId)
}

async function updateTrendingRow(
  supabase: SupabaseClient,
  trendingId: string,
  productId: string,
  currentRawData: Record<string, unknown>,
  result: 'success' | 'dedup_matched'
): Promise<void> {
  await supabase
    .from('ss_trending_products')
    .update({
      product_id: productId,
      raw_data: {
        ...currentRawData,
        backfill_attempted: true,
        backfill_result: result,
        backfill_completed_at: new Date().toISOString(),
      },
    })
    .eq('id', trendingId)
}

async function findExistingProduct(
  supabase: SupabaseClient,
  nameEn: string,
  brandEn: string
): Promise<string | null> {
  if (!nameEn || !brandEn) return null

  // Try exact match first
  const { data } = await supabase
    .from('ss_products')
    .select('id')
    .ilike('brand_en', brandEn)
    .ilike('name_en', `%${nameEn.slice(0, 60)}%`)
    .limit(1)

  if (data && data.length > 0) {
    return data[0].id as string
  }

  return null
}

async function insertProduct(
  supabase: SupabaseClient,
  data: import('./types').ProcessedProductData
): Promise<string | null> {
  const { data: inserted, error } = await supabase
    .from('ss_products')
    .insert({
      name_en: data.name_en,
      name_ko: data.name_ko,
      brand_en: data.brand_en,
      brand_ko: data.brand_ko,
      category: data.category,
      subcategory: data.subcategory,
      description_en: data.description_en,
      volume_ml: data.volume_ml,
      volume_display: data.volume_display,
      price_krw: data.price_krw,
      price_usd: data.price_usd,
      rating_avg: data.rating_avg,
      review_count: data.review_count,
      pao_months: data.pao_months,
      shelf_life_months: data.shelf_life_months,
      image_url: data.image_url,
      is_verified: false,
      ingredients_raw: data.ingredients_raw,
      spf_rating: data.spf_rating,
      pa_rating: data.pa_rating,
      sunscreen_type: data.sunscreen_type,
      white_cast: data.white_cast,
      finish: data.finish,
      under_makeup: data.under_makeup,
      water_resistant: data.water_resistant,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Product insert failed: ${error.message}`)
  }

  return inserted?.id ?? null
}
