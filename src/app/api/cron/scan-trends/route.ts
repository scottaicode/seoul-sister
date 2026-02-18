import { NextResponse } from 'next/server'
import { detectTrendSignals } from '@/lib/learning/trends'
import { verifyCronAuth } from '@/lib/utils/cron-auth'

// POST /api/cron/scan-trends
// Daily: Detect emerging trend signals from community activity
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

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
