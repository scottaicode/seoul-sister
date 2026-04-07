import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 300

/**
 * POST /api/cron/scan-korean-bestsellers
 *
 * Runs daily at 6:30 AM UTC (via vercel.json).
 * Scrapes Olive Young Global bestseller page for real Korean sales rankings.
 * Matches bestseller products against ss_products database.
 * Upserts results into ss_trending_products with source='olive_young'.
 *
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()

    // Dynamic import to avoid loading Playwright at module level
    const { OliveYoungBestsellerScraper } = await import(
      '@/lib/pipeline/sources/olive-young-bestsellers'
    )

    const scraper = new OliveYoungBestsellerScraper()

    // Guard: abort if approaching the 300s function timeout
    const TIMEOUT_MS = 270_000 // 270s, leaving 30s buffer
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Approaching function timeout (270s)')), TIMEOUT_MS)
    )

    const result = await Promise.race([scraper.run(db), timeoutPromise])
      .finally(() => scraper.closeBrowser())

    return NextResponse.json({
      success: true,
      ...result,
      scanned_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:scan-korean-bestsellers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to scan Korean bestsellers' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
