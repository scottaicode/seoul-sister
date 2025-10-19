import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔍 Checking database schema for Korean beauty intelligence tables...')

    // Check if korean_influencers table exists and get its structure
    const { data: influencersTableInfo, error: influencersError } = await supabaseAdmin
      .rpc('get_table_structure', { table_name: 'korean_influencers' })
      .single()

    // Check if influencer_content table exists and get its structure
    const { data: contentTableInfo, error: contentError } = await supabaseAdmin
      .rpc('get_table_structure', { table_name: 'influencer_content' })
      .single()

    // If RPC doesn't exist, try direct table queries
    let influencersExists = false
    let contentExists = false
    let influencersColumns: any[] = []
    let contentColumns: any[] = []

    try {
      // Check korean_influencers table
      const { data: influencersData, error: infError } = await supabaseAdmin
        .from('korean_influencers')
        .select('*')
        .limit(1)

      if (!infError) {
        influencersExists = true
        if (influencersData && influencersData.length > 0) {
          influencersColumns = Object.keys(influencersData[0])
        }
      }
    } catch (error) {
      console.log('korean_influencers table does not exist')
    }

    try {
      // Check influencer_content table
      const { data: contentData, error: contError } = await supabaseAdmin
        .from('influencer_content')
        .select('*')
        .limit(1)

      if (!contError) {
        contentExists = true
        if (contentData && contentData.length > 0) {
          contentColumns = Object.keys(contentData[0])
        }
      }
    } catch (error) {
      console.log('influencer_content table does not exist')
    }

    // Check content_transcriptions table
    let transcriptionsExists = false
    let transcriptionsColumns: any[] = []

    try {
      const { data: transcriptionsData, error: transError } = await supabaseAdmin
        .from('content_transcriptions')
        .select('*')
        .limit(1)

      if (!transError) {
        transcriptionsExists = true
        if (transcriptionsData && transcriptionsData.length > 0) {
          transcriptionsColumns = Object.keys(transcriptionsData[0])
        }
      }
    } catch (error) {
      console.log('content_transcriptions table does not exist')
    }

    // Get sample data counts
    let influencersCount = 0
    let contentCount = 0
    let transcriptionsCount = 0

    if (influencersExists) {
      const { count } = await supabaseAdmin
        .from('korean_influencers')
        .select('*', { count: 'exact', head: true })
      influencersCount = count || 0
    }

    if (contentExists) {
      const { count } = await supabaseAdmin
        .from('influencer_content')
        .select('*', { count: 'exact', head: true })
      contentCount = count || 0
    }

    if (transcriptionsExists) {
      const { count } = await supabaseAdmin
        .from('content_transcriptions')
        .select('*', { count: 'exact', head: true })
      transcriptionsCount = count || 0
    }

    return NextResponse.json({
      schemaStatus: 'checked',
      timestamp: new Date().toISOString(),
      tables: {
        korean_influencers: {
          exists: influencersExists,
          columns: influencersColumns,
          recordCount: influencersCount,
          requiredColumns: [
            'id', 'name', 'handle', 'platform', 'follower_count',
            'engagement_rate', 'category', 'language', 'location',
            'verified', 'monitoring_active', 'last_scraped_at',
            'created_at', 'updated_at'
          ]
        },
        influencer_content: {
          exists: contentExists,
          columns: contentColumns,
          recordCount: contentCount,
          requiredColumns: [
            'id', 'influencer_id', 'platform_post_id', 'platform',
            'content_type', 'post_url', 'caption', 'hashtags',
            'mentions', 'media_urls', 'view_count', 'like_count',
            'comment_count', 'share_count', 'published_at',
            'scraped_at', 'created_at'
          ]
        },
        content_transcriptions: {
          exists: transcriptionsExists,
          columns: transcriptionsColumns,
          recordCount: transcriptionsCount,
          requiredColumns: [
            'id', 'content_id', 'video_url', 'transcript_text',
            'language', 'confidence_score', 'processing_status',
            'processing_started_at', 'processing_completed_at',
            'created_at', 'updated_at'
          ]
        }
      },
      recommendations: generateSchemaRecommendations({
        influencersExists,
        contentExists,
        transcriptionsExists,
        influencersColumns,
        contentColumns,
        transcriptionsColumns
      })
    })

  } catch (error) {
    console.error('❌ Database schema check failed:', error)
    return NextResponse.json({
      error: 'Failed to check database schema',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

function generateSchemaRecommendations(schemaInfo: any): string[] {
  const recommendations: string[] = []

  if (!schemaInfo.influencersExists) {
    recommendations.push('❌ korean_influencers table missing - run intelligence schema setup')
  }

  if (!schemaInfo.contentExists) {
    recommendations.push('❌ influencer_content table missing - run intelligence schema setup')
  }

  if (!schemaInfo.transcriptionsExists) {
    recommendations.push('❌ content_transcriptions table missing - run intelligence schema setup')
  }

  const requiredContentColumns = [
    'content_type', 'hashtags', 'mentions', 'media_urls'
  ]

  const missingContentColumns = requiredContentColumns.filter(col =>
    !schemaInfo.contentColumns.includes(col)
  )

  if (missingContentColumns.length > 0) {
    recommendations.push(`⚠️ influencer_content table missing columns: ${missingContentColumns.join(', ')}`)
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All required tables and columns present')
  }

  return recommendations
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Use GET to check database schema status',
    endpoints: {
      check: 'GET /api/admin/check-database-schema',
      setup: 'POST /api/admin/setup-intelligence-tables (if needed)'
    }
  })
}