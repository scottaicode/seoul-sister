import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin: Fetching all user profiles...')

    // Fetch all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch profiles', details: profilesError.message },
        { status: 500 }
      )
    }

    // Calculate statistics
    const totalProfiles = profiles?.length || 0

    // Count active users (profiles with analysis in last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const activeUsers = profiles?.filter(profile =>
      profile.last_analysis_date &&
      new Date(profile.last_analysis_date) > sevenDaysAgo
    ).length || 0

    // Fetch conversation context to estimate recommendations and analyses
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversation_context')
      .select('*')

    const totalRecommendations = conversations?.filter(c =>
      c.context_type === 'recommendation'
    ).length || 0

    const totalAnalyses = conversations?.filter(c =>
      c.context_type === 'ingredient_analysis'
    ).length || 0

    console.log(`✅ Admin: Found ${totalProfiles} profiles, ${activeUsers} active users`)

    return NextResponse.json({
      success: true,
      profiles: profiles || [],
      totalProfiles,
      activeUsers,
      totalRecommendations,
      totalAnalyses,
      stats: {
        totalProfiles,
        activeUsers,
        totalRecommendations,
        totalAnalyses
      }
    })

  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch admin data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}