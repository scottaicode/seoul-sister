/**
 * Phase 9.2 — Batch Processor
 *
 * Processes pending staged products in batches: fetches from ss_product_staging,
 * runs Sonnet extraction, deduplicates against ss_products, and inserts new records.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractProductData } from './extractor'
import { CostTracker } from './cost-tracker'
import type { RawProductData, ProcessedProductData, StagingStatus } from './types'

export interface BatchResult {
  processed: number
  failed: number
  duplicates: number
  remaining: number
  cost: {
    calls: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
  }
}

const MAX_CONCURRENT = 5

/**
 * Process a batch of pending staged products.
 *
 * 1. Claim `batchSize` rows from staging (pending → processing)
 * 2. Run Sonnet extraction on each (with concurrency limit)
 * 3. Dedup against existing ss_products
 * 4. Insert new products or mark as duplicate
 * 5. Return batch results with cost summary
 */
export async function processBatch(
  supabase: SupabaseClient,
  batchSize: number = 20,
  runId?: string
): Promise<BatchResult> {
  const tracker = new CostTracker()
  let processed = 0
  let failed = 0
  let duplicates = 0

  // 1. Fetch pending staged rows (only enriched ones with ingredients data)
  const { data: rows, error: fetchError } = await supabase
    .from('ss_product_staging')
    .select('*')
    .eq('status', 'pending')
    .not('raw_data->>ingredients_raw', 'is', null)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (fetchError) {
    throw new Error(`Failed to fetch staged products: ${fetchError.message}`)
  }

  if (!rows || rows.length === 0) {
    const remaining = await countPending(supabase)
    return { processed: 0, failed: 0, duplicates: 0, remaining, cost: tracker.summary }
  }

  // 2. Mark claimed rows as 'processing'
  const ids = rows.map((r) => r.id as string)
  await updateStagingStatus(supabase, ids, 'processing')

  // 3. Process in chunks with concurrency limit
  for (let i = 0; i < rows.length; i += MAX_CONCURRENT) {
    const chunk = rows.slice(i, i + MAX_CONCURRENT)
    const results = await Promise.allSettled(
      chunk.map((row) => processOne(supabase, row, tracker))
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const row = chunk[j]
      if (result.status === 'fulfilled') {
        if (result.value === 'duplicate') {
          duplicates++
        } else {
          processed++
        }
      } else {
        failed++
        await supabase
          .from('ss_product_staging')
          .update({
            status: 'failed',
            error_message: result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          })
          .eq('id', row.id)
      }
    }
  }

  // 4. Update pipeline run if provided
  if (runId) {
    const cost = tracker.summary
    await supabase
      .from('ss_pipeline_runs')
      .update({
        products_processed: processed,
        products_failed: failed,
        products_duplicates: duplicates,
        estimated_cost_usd: cost.estimated_cost_usd,
        metadata: {
          batch_size: batchSize,
          cost_details: cost,
        },
      })
      .eq('id', runId)
  }

  const remaining = await countPending(supabase)
  return { processed, failed, duplicates, remaining, cost: tracker.summary }
}

/**
 * Reprocess previously failed staging rows.
 */
export async function reprocessFailed(
  supabase: SupabaseClient,
  batchSize: number = 20
): Promise<BatchResult> {
  // Reset failed rows to pending
  const { data: failedRows } = await supabase
    .from('ss_product_staging')
    .select('id')
    .eq('status', 'failed')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (!failedRows || failedRows.length === 0) {
    return { processed: 0, failed: 0, duplicates: 0, remaining: 0, cost: new CostTracker().summary }
  }

  const ids = failedRows.map((r) => r.id as string)
  await updateStagingStatus(supabase, ids, 'pending')

  return processBatch(supabase, batchSize)
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function processOne(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tracker: CostTracker
): Promise<'processed' | 'duplicate'> {
  const rawData = row.raw_data as RawProductData
  const stagingId = row.id as string

  // Run Sonnet extraction
  const { data: extracted, usage } = await extractProductData(rawData)
  tracker.record(usage)

  // Check for duplicates in ss_products
  const isDuplicate = await checkDuplicate(supabase, extracted)
  if (isDuplicate) {
    await supabase
      .from('ss_product_staging')
      .update({ status: 'duplicate' })
      .eq('id', stagingId)
    return 'duplicate'
  }

  // Insert into ss_products
  const productId = await insertProduct(supabase, extracted)

  // Link staging row to the new product
  await supabase
    .from('ss_product_staging')
    .update({
      status: 'processed',
      processed_product_id: productId,
    })
    .eq('id', stagingId)

  return 'processed'
}

/**
 * Check if a product already exists in ss_products by name + brand (case-insensitive).
 */
async function checkDuplicate(
  supabase: SupabaseClient,
  data: ProcessedProductData
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('ss_products')
    .select('id')
    .ilike('name_en', data.name_en)
    .ilike('brand_en', data.brand_en)
    .limit(1)

  return Boolean(existing && existing.length > 0)
}

/**
 * Insert a processed product into ss_products and return the new row ID.
 */
async function insertProduct(
  supabase: SupabaseClient,
  data: ProcessedProductData
): Promise<string> {
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
      review_count: data.review_count != null ? Math.round(data.review_count) : 0,
      pao_months: data.pao_months,
      shelf_life_months: data.shelf_life_months,
      image_url: data.image_url,
      is_verified: false,
      ingredients_raw: data.ingredients_raw,
      // Sunscreen fields
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

  if (error || !inserted) {
    throw new Error(`Failed to insert product "${data.name_en}": ${error?.message}`)
  }

  return inserted.id
}

async function updateStagingStatus(
  supabase: SupabaseClient,
  ids: string[],
  status: StagingStatus
): Promise<void> {
  const { error } = await supabase
    .from('ss_product_staging')
    .update({ status })
    .in('id', ids)

  if (error) {
    throw new Error(`Failed to update staging status to ${status}: ${error.message}`)
  }
}

async function countPending(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('ss_product_staging')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('raw_data->>ingredients_raw', 'is', null)

  return count ?? 0
}
