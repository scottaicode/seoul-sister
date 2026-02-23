import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { calculateGapScores } from '@/lib/intelligence/trend-scorer'

export const maxDuration = 60

/**
 * POST /api/cron/calculate-gap-scores
 *
 * Runs daily at 9:00 AM UTC (via vercel.json), after both the Olive Young
 * bestseller scraper (6:30 AM) and the Reddit mention scanner (8:30 AM)
 * have completed.
 *
 * Cross-references Korean sales rankings against Reddit mention counts to
 * calculate gap scores — products trending in Korea but unknown in the US.
 *
 * Secured with CRON_SECRET header.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const db = getServiceClient()
    const result = await calculateGapScores(db)

    return NextResponse.json({
      success: true,
      ...result,
      calculated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron:calculate-gap-scores] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate gap scores' },
      { status: 500 }
    )
  }
}
