import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🧹 COMPLETE DATA WIPE: Removing ALL influencer data from database...')

    // Step 1: Delete ALL content from influencer_content table
    const { error: contentError, data: deletedContent } = await (supabaseAdmin as any)
      .from('influencer_content')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete everything
      .select()

    if (contentError) {
      console.error('Failed to delete influencer content:', contentError)
      return NextResponse.json({
        error: 'Failed to delete influencer content',
        details: contentError.message
      }, { status: 500 })
    }

    const contentDeleted = deletedContent?.length || 0
    console.log(`🗑️ Deleted ${contentDeleted} content items`)

    // Step 2: Delete ALL transcriptions
    const { error: transcriptionError, data: deletedTranscriptions } = await (supabaseAdmin as any)
      .from('content_transcriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete everything
      .select()

    if (transcriptionError) {
      console.warn('Failed to delete transcriptions:', transcriptionError)
    }

    const transcriptionsDeleted = deletedTranscriptions?.length || 0
    console.log(`🗑️ Deleted ${transcriptionsDeleted} transcription items`)

    // Step 3: Delete ALL korean_influencers records
    const { error: influencersError, data: deletedInfluencers } = await (supabaseAdmin as any)
      .from('korean_influencers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete everything
      .select()

    if (influencersError) {
      console.error('Failed to delete influencers:', influencersError)
      return NextResponse.json({
        error: 'Failed to delete influencers',
        details: influencersError.message
      }, { status: 500 })
    }

    const influencersDeleted = deletedInfluencers?.length || 0
    console.log(`🗑️ Deleted ${influencersDeleted} influencer records`)

    // Step 4: Verify all tables are empty
    const { count: remainingContent } = await supabaseAdmin
      .from('influencer_content')
      .select('*', { count: 'exact', head: true })

    const { count: remainingTranscriptions } = await supabaseAdmin
      .from('content_transcriptions')
      .select('*', { count: 'exact', head: true })

    const { count: remainingInfluencers } = await supabaseAdmin
      .from('korean_influencers')
      .select('*', { count: 'exact', head: true })

    console.log('✅ COMPLETE DATA WIPE finished')
    console.log(`📊 Remaining: ${remainingContent} content, ${remainingTranscriptions} transcriptions, ${remainingInfluencers} influencers`)

    return NextResponse.json({
      success: true,
      message: 'Complete data wipe completed successfully',
      results: {
        deletedContent: contentDeleted,
        deletedTranscriptions: transcriptionsDeleted,
        deletedInfluencers: influencersDeleted,
        remainingContent: remainingContent || 0,
        remainingTranscriptions: remainingTranscriptions || 0,
        remainingInfluencers: remainingInfluencers || 0
      },
      verification: {
        allTablesEmpty: (remainingContent || 0) === 0 &&
                       (remainingTranscriptions || 0) === 0 &&
                       (remainingInfluencers || 0) === 0
      }
    })

  } catch (error) {
    console.error('❌ Error in complete data wipe:', error)
    return NextResponse.json({
      error: 'Failed to complete data wipe',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Complete Data Wipe',
    description: 'Completely removes ALL influencer data from all tables for fresh start',
    warning: 'This will delete ALL content, transcriptions, and influencer records',
    usage: 'POST /api/admin/complete-data-wipe'
  })
}