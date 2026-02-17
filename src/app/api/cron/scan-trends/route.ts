import { NextResponse } from 'next/server'
import { detectTrendSignals } from '@/lib/learning/trends'

// POST /api/cron/scan-trends
// Daily: Detect emerging trend signals from community activity
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await detectTrendSignals()

    return NextResponse.json({
      success: true,
      ...result,
      scanned_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Scan trends error:', error)
    return NextResponse.json(
      { error: 'Failed to scan trends' },
      { status: 500 }
    )
  }
}
