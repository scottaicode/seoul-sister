import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing transcription table schema and data...')

    // Test 1: Check if content_transcriptions table exists
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'content_transcriptions')

    if (tablesError) {
      return NextResponse.json({
        error: 'Failed to check table existence',
        details: tablesError.message
      }, { status: 500 })
    }

    const tableExists = tables && tables.length > 0

    // Test 2: If table exists, check schema
    let schema = null
    if (tableExists) {
      const { data: columns, error: schemaError } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'content_transcriptions')

      if (!schemaError) {
        schema = columns
      }
    }

    // Test 3: Check existing transcription data
    let existingData = null
    let dataError = null
    if (tableExists) {
      const { data, error } = await supabaseAdmin
        .from('content_transcriptions')
        .select('*')
        .limit(3)

      existingData = data
      dataError = error
    }

    // Test 4: Check recent influencer content that should have transcriptions
    const { data: recentContent, error: contentError } = await supabaseAdmin
      .from('influencer_content')
      .select('id, platform_post_id, media_urls, scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(5)

    const videoContent = recentContent?.filter(item =>
      item.media_urls?.some((url: string) =>
        url?.includes('.mp4') || url?.includes('video') || url?.includes('reel')
      )
    ) || []

    return NextResponse.json({
      success: true,
      tableExists,
      schema,
      existingTranscriptions: existingData?.length || 0,
      dataError: dataError?.message || null,
      recentVideoContent: videoContent.length,
      sampleVideoContent: videoContent.slice(0, 2),
      diagnosis: {
        tableStatus: tableExists ? 'exists' : 'missing',
        dataStatus: existingData?.length > 0 ? 'has_data' : 'empty',
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