import { NextResponse } from 'next/server'
import { recalculateEffectivenessFromReviews } from '@/lib/learning/effectiveness'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

// POST /api/cron/update-effectiveness
// Daily: Recalculate ingredient effectiveness scores from new data
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const result = await recalculateEffectivenessFromReviews()

    return NextResponse.json({
      success: true,
      ...result,
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update effectiveness error:', error)
    return NextResponse.json(
      { error: 'Failed to update effectiveness scores' },
      { status: 500 }
    )
  }
}
