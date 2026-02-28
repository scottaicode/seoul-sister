import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

export const maxDuration = 60

/**
 * POST /api/cron/scan-reddit-mentions
 *
 * Daily cron job (8:30 AM UTC) that scans K-beauty subreddits for product
 * mentions, matches against the product database, and upserts trends to
 * ss_trending_products with source='reddit'.
 *
 * Cost: $0 (Reddit API is free for authenticated apps)
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()

    const { RedditMentionScanner } = await import('@/lib/reddit/mention-scanner')
    const { aggregateRedditTrends } = await import('@/lib/reddit/trend-aggregator')

    // 1. Initialize scanner and load product index
    const scanner = new RedditMentionScanner()
    await scanner.loadProducts(db)

    // 2. Scan subreddits for mentions
    const scanResult = await scanner.scan()

    // 3. Aggregate and write to database
    const result = await aggregateRedditTrends(db, scanResult)

    return NextResponse.json({
      success: true,
      ...result,
      scanned_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:scan-reddit-mentions] Error:', error)
    return NextResponse.json(
      { error: 'Failed to scan Reddit mentions' },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
