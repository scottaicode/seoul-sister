import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 60

/**
 * POST /api/cron/backfill-trending
 *
 * Runs daily at 6:45 AM UTC (via vercel.json), 15 min after the bestseller scraper.
 * Finds unmatched bestseller products (product_id IS NULL) in ss_trending_products,
 * scrapes their detail pages from Olive Young, runs Sonnet extraction, inserts into
 * ss_products, links ingredients, and updates the trending row with the new product_id.
 *
 * Processes up to 8 products per run within the 60s Vercel cron timeout.
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()

    // Dynamic import to avoid loading Playwright at module level
    const { backfillUnmatchedBestsellers } = await import(
      '@/lib/pipeline/backfill-trending'
    )

    const result = await backfillUnmatchedBestsellers(db)

    return NextResponse.json({
      success: true,
      ...result,
      ran_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:backfill-trending] Error:', error)
    return NextResponse.json(
      { error: 'Failed to backfill trending products' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
