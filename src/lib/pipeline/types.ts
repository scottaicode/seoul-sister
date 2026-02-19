import type { ProductCategory } from '@/types/database'

export type PipelineSource = 'olive_young' | 'yesstyle' | 'soko_glam' | 'amazon' | 'stylekorean'

export type StagingStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'duplicate'

export type PipelineRunType = 'full_scrape' | 'incremental' | 'reprocess' | 'quality_check'

export type PipelineRunStatus = 'running' | 'completed' | 'failed'

/** Raw data as scraped from a retailer source, before AI processing */
export interface RawProductData {
  source: PipelineSource
  source_url: string
  source_id: string
  name_en: string
  name_ko: string | null
  brand_en: string
  brand_ko: string | null
  category_raw: string
  price_krw: number | null
  price_usd: number | null
  description_raw: string
  ingredients_raw: string | null
  image_url: string | null
  volume_display: string | null
  rating_avg: number | null
  review_count: number | null
  scraped_at: string
}

/** Processed product data after Sonnet extraction (used by Phase 9.2) */
export interface ProcessedProductData {
  name_en: string
  name_ko: string | null
  brand_en: string
  brand_ko: string | null
  category: ProductCategory
  subcategory: string | null
  description_en: string
  volume_ml: number | null
  volume_display: string | null
  price_krw: number | null
  price_usd: number | null
  rating_avg: number | null
  review_count: number | null
  pao_months: number | null
  shelf_life_months: number | null
  image_url: string | null
  is_verified: boolean
  ingredients_raw: string | null
  spf_rating: number | null
  pa_rating: string | null
  sunscreen_type: string | null
  white_cast: string | null
  finish: string | null
  under_makeup: boolean | null
  water_resistant: boolean | null
}

/** Staging row from ss_product_staging */
export interface StagingRecord {
  id: string
  source: PipelineSource
  source_id: string
  source_url: string | null
  raw_data: RawProductData
  status: StagingStatus
  processed_product_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/** Pipeline run from ss_pipeline_runs */
export interface PipelineRun {
  id: string
  source: string
  run_type: PipelineRunType
  status: PipelineRunStatus
  products_scraped: number
  products_processed: number
  products_failed: number
  products_duplicates: number
  estimated_cost_usd: number | null
  metadata: Record<string, unknown>
  started_at: string
  completed_at: string | null
}

/** Category mapping for Olive Young */
export interface CategoryMapping {
  olive_young_id: string
  olive_young_name: string
  seoul_sister_category: ProductCategory
}

/** Result from scraping a single product listing page */
export interface ScrapedProductListing {
  source_id: string
  source_url: string
  name_en: string
  name_ko: string | null
  brand_en: string
  price_usd: number | null
  price_krw: number | null
  image_url: string | null
  rating_avg: number | null
  review_count: number | null
}

/** Result from scraping a product detail page */
export interface ScrapedProductDetail extends ScrapedProductListing {
  description_raw: string
  ingredients_raw: string | null
  volume_display: string | null
  category_raw: string
  brand_ko: string | null
}

/** Options for a scrape run */
export interface ScrapeOptions {
  source: PipelineSource
  mode: 'full' | 'incremental'
  categories?: string[]
  max_pages_per_category?: number
  delay_ms?: number
}

/** Stats returned from scrape and processing operations */
export interface PipelineStats {
  scraped: number
  new: number
  duplicates: number
  failed: number
  errors: string[]
}
