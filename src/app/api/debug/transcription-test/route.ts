import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing transcription table schema and data...')

    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Supabase admin client not configured'
      }, { status: 500 })
    }

    // Test 1: Try to access content_transcriptions table directly
    const { data: existingData, error: dataError } = await supabaseAdmin
      .from('content_transcriptions')
      .select('*')
      .limit(3)

    const tableExists = !dataError || (dataError && !dataError.message.includes('relation') && !dataError.message.includes('does not exist'))

    // Test 2: Check recent influencer content that should have transcriptions
    const { data: recentContent, error: contentError } = await supabaseAdmin
      .from('influencer_content')
      .select('id, platform_post_id, media_urls, scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(5)

    const videoContent = recentContent?.filter((item: any) =>
      item.media_urls?.some((url: string) =>
        url?.includes('.mp4') || url?.includes('video') || url?.includes('reel')
      )
    ) || []

    return NextResponse.json({
      success: true,
      tableExists,
      existingTranscriptions: existingData?.length || 0,
      dataError: dataError?.message || null,
      recentVideoContent: videoContent.length,
      sampleVideoContent: videoContent.slice(0, 2),
      sampleTranscriptions: existingData?.slice(0, 2) || [],
      diagnosis: {
        tableStatus: tableExists ? 'exists' : 'missing',
        dataStatus: (existingData?.length || 0) > 0 ? 'has_data' : 'empty',
        videoContentAvailable: videoContent.length > 0 ? 'yes' : 'no'
      }
    })

  } catch (error) {
    console.error('❌ Transcription test failed:', error)
    return NextResponse.json({
      error: 'Transcription test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}