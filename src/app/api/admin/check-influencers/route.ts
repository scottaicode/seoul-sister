import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Check Korean influencers in database
    const { data: influencers, error: influencersError } = await supabaseAdmin
      .from('korean_influencers')
      .select('*')
      .order('priority')

    if (influencersError) {
      console.error('Failed to fetch influencers:', influencersError)
      return NextResponse.json({
        error: 'Failed to fetch influencers',
        details: influencersError.message
      }, { status: 500 })
    }

    // Check content count per influencer
    const { data: contentStats, error: contentError } = await supabaseAdmin
      .from('influencer_content')
      .select('influencer_id, korean_influencers!inner(handle, name)')

    const contentByInfluencer = contentStats?.reduce((acc, item) => {
      const handle = (item as any).korean_influencers?.handle || 'unknown'
      acc[handle] = (acc[handle] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    return NextResponse.json({
      success: true,
      totalInfluencers: influencers?.length || 0,
      influencers: influencers?.map((inf: any) => ({
        id: inf.id,
        name: inf.name,
        handle: inf.handle,
        platform: inf.platform,
        tier: inf.tier,
        priority: inf.priority,
        contentCount: contentByInfluencer[inf.handle] || 0
      })) || [],
      contentByInfluencer
    })

  } catch (error) {
    console.error('❌ Check influencers error:', error)
    return NextResponse.json({
      error: 'Failed to check influencers',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}