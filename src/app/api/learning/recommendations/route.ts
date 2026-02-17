import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPersonalizedRecommendations } from '@/lib/learning/recommendations'

// GET /api/learning/recommendations
// Returns personalized product recommendations based on skin profile + learning data
export async function GET(request: Request) {
  try {
    // Authenticate user
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

    const recommendations = await getPersonalizedRecommendations(user.id)

    return NextResponse.json({
      recommendations,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}
