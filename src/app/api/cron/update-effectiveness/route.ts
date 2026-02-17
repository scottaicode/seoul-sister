import { NextResponse } from 'next/server'
import { recalculateEffectivenessFromReviews } from '@/lib/learning/effectiveness'

// POST /api/cron/update-effectiveness
// Daily: Recalculate ingredient effectiveness scores from new data
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
