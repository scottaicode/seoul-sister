import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentTrends } from '@/lib/learning/trends'

// GET /api/learning/trends?type=ingredient&limit=10
// Returns current trending ingredients/products/routines
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trendType = searchParams.get('type') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    const trends = await getCurrentTrends(trendType, limit)

    return NextResponse.json({
      trends,
      fetched_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Trends error:', error)
    return NextResponse.json(
      { error: 'Failed to get trends' },
      { status: 500 }
    )
  }
}
