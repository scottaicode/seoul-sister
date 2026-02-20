import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { OliveYoungScraper } from '@/lib/pipeline/sources/olive-young'
import type { PipelineSource } from '@/lib/pipeline/types'

const scrapeSchema = z.object({
  source: z.enum(['olive_young']),
  mode: z.enum(['full', 'incremental']),
  categories: z.array(z.string()).optional(),
  max_pages_per_category: z.number().int().min(1).max(50).optional(),
  delay_ms: z.number().int().min(500).max(10000).optional(),
  skip_details: z.boolean().optional(),
})

const enrichSchema = z.object({
  source: z.enum(['olive_young']),
  batch_size: z.number().int().min(1).max(200).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
})

function verifyAdminAuth(request: NextRequest): void {
  const key = request.headers.get('x-service-key')
    ?? request.headers.get('authorization')?.replace('Bearer ', '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey || !key || key !== serviceKey) {
    throw new AppError('Unauthorized: admin access required', 401)
  }
}

/**
 * POST /api/admin/pipeline/scrape
 *
 * Kicks off a scraping run for the specified source.
 * Protected by service role key (admin only).
 *
 * Body: {
 *   source: 'olive_young',
 *   mode: 'full' | 'incremental',
 *   categories?: string[],
 *   max_pages_per_category?: number,
 *   delay_ms?: number,
 *   skip_details?: boolean   // Fast listing-only mode
 * }
 */
export async function POST(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const body = await request.json()
    const params = scrapeSchema.parse(body)

    const supabase = getServiceClient()

    // Create pipeline run record
    const { data: run, error: runError } = await supabase
      .from('ss_pipeline_runs')
      .insert({
        source: params.source as PipelineSource,
        run_type: params.mode === 'full' ? 'full_scrape' : 'incremental',
        status: 'running',
        metadata: {
          categories: params.categories ?? 'all',
          max_pages: params.max_pages_per_category,
          delay_ms: params.delay_ms,
          skip_details: params.skip_details ?? false,
        },
      })
      .select()
      .single()

    if (runError || !run) {
      throw new AppError('Failed to create pipeline run', 500)
    }

    const scraper = new OliveYoungScraper({
      delayMs: params.delay_ms,
    })

    try {
      const stats = await scraper.runScrape(supabase, run.id, {
        mode: params.mode,
        categories: params.categories,
        maxPagesPerCategory: params.max_pages_per_category,
        skipDetails: params.skip_details,
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

      return NextResponse.json({
        success: true,
        run_id: run.id,
        stats: {
          scraped: stats.scraped,
          new: stats.new,
          duplicates: stats.duplicates,
          failed: stats.failed,
          errors: stats.errors.length,
        },
      })
    } catch (scrapeError) {
      // Mark run as failed
      await supabase
        .from('ss_pipeline_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            ...run.metadata,
            fatal_error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
          },
        })
        .eq('id', run.id)

      throw new AppError(
        `Scrape failed: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}`,
        500
      )
    }
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/admin/pipeline/scrape
 *
 * Enrich staged products with detail page data (ingredients, description, volume).
 * Call after a skip_details scrape to fill in missing data.
 *
 * Body: {
 *   source: 'olive_young',
 *   batch_size?: number (default 50),
 *   concurrency?: number (default 4)
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    const body = await request.json()
    const params = enrichSchema.parse(body)

    const scraper = new OliveYoungScraper()
    const supabase = getServiceClient()

    const result = await scraper.enrichDetails(supabase, {
      batchSize: params.batch_size,
      concurrency: params.concurrency,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** GET /api/admin/pipeline/scrape — List available sources and categories */
export async function GET(request: NextRequest) {
  try {
    verifyAdminAuth(request)

    return NextResponse.json({
      sources: {
        olive_young: {
          name: 'Olive Young Global',
          base_url: 'https://global.oliveyoung.com',
          categories: OliveYoungScraper.getCategories(),
        },
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
