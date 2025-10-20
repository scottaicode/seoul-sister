import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🧹 Cleaning up mock data from influencer_content table...')

    // The ONLY 12 authentic Korean beauty influencers from Apify (updated configuration)
    const authenticInfluencers = [
      'ponysmakeup',
      'risabae_art',
      'directorpi',
      '3ce_official',
      'liahyoo',
      'gothamista',
      'glowwithava',
      'ireneisgood',
      'laneige_kr',
      'innisfreeofficial',
      'etudehouse',
      'amorepacific_official'
    ]

    // First, get all influencer IDs for the authentic accounts
    const { data: authenticInfluencerIds, error: influencerError } = await supabaseAdmin
      .from('korean_influencers')
      .select('id, handle')
      .eq('platform', 'instagram')
      .in('handle', authenticInfluencers)

    if (influencerError) {
      console.error('Failed to fetch authentic influencer IDs:', influencerError)
      return NextResponse.json({
        error: 'Failed to fetch authentic influencer IDs',
        details: influencerError.message
      }, { status: 500 })
    }

    const authenticIds = authenticInfluencerIds?.map(inf => inf.id) || []
    console.log(`✅ Found ${authenticIds.length} authentic influencer IDs`)

    // Get count of content before cleanup
    const { count: totalContentBefore } = await supabaseAdmin
      .from('influencer_content')
      .select('*', { count: 'exact', head: true })

    const { count: authenticContentBefore } = await supabaseAdmin
      .from('influencer_content')
      .select('*', { count: 'exact', head: true })
      .in('influencer_id', authenticIds)

    console.log(`📊 Before cleanup: ${totalContentBefore} total content, ${authenticContentBefore} authentic content`)

    // First, get all content that doesn't belong to authentic influencers
    const { data: contentToDelete } = await supabaseAdmin
      .from('influencer_content')
      .select(`
        id,
        platform_post_id,
        korean_influencers!inner(handle)
      `)

    const mockContentIds: string[] = []
    contentToDelete?.forEach((content: any) => {
      const handle = content.korean_influencers?.handle
      if (!authenticInfluencers.includes(handle)) {
        mockContentIds.push(content.id)
      }
    })

    console.log(`🎯 Found ${mockContentIds.length} mock content items to delete`)

    // Delete mock content in batches
    let deletedCount = 0
    if (mockContentIds.length > 0) {
      const { data: deletedContent, error: deleteError } = await supabaseAdmin
        .from('influencer_content')
        .delete()
        .in('id', mockContentIds)
        .select()

      if (deleteError) {
        console.error('Failed to delete mock content:', deleteError)
        return NextResponse.json({
          error: 'Failed to delete mock content',
          details: deleteError.message
        }, { status: 500 })
      }

      deletedCount = deletedContent?.length || 0
    }
    console.log(`🗑️ Deleted ${deletedCount} mock/fake content items`)

    // Also clean up any content with suspicious patterns
    const suspiciousPatterns = [
      'unknown_influencer',
      'Seoul influencer',
      '@Seoul influencer',
      '@influencer',
      'Korean beauty intelligence analysis from @Seoul',
      'Korean beauty content transcript: Discussing latest skincare trends from Seoul'
    ]

    let additionalDeletes = 0
    for (const pattern of suspiciousPatterns) {
      const { data: suspiciousContent, error: suspiciousError } = await supabaseAdmin
        .from('influencer_content')
        .delete()
        .or(`caption.ilike.%${pattern}%, post_url.ilike.%${pattern}%`)
        .select()

      if (!suspiciousError && suspiciousContent) {
        additionalDeletes += suspiciousContent.length
        console.log(`🧹 Deleted ${suspiciousContent.length} items matching pattern: ${pattern}`)
      }
    }

    // Get remaining content IDs for transcription cleanup
    const { data: remainingContentIds } = await supabaseAdmin
      .from('influencer_content')
      .select('id')

    const contentIds = remainingContentIds?.map(c => c.id) || []

    // Clean up transcriptions that reference deleted content
    const { error: transcriptionCleanupError } = await supabaseAdmin
      .from('content_transcriptions')
      .delete()
      .not('content_id', 'in', contentIds)

    if (transcriptionCleanupError) {
      console.warn('Failed to clean up orphaned transcriptions:', transcriptionCleanupError)
    }

    // Get final counts
    const { count: totalContentAfter } = await supabaseAdmin
      .from('influencer_content')
      .select('*', { count: 'exact', head: true })

    const { data: finalContent } = await supabaseAdmin
      .from('influencer_content')
      .select(`
        id,
        platform_post_id,
        caption,
        korean_influencers!inner(handle, name)
      `)
      .limit(10)

    console.log(`✅ Cleanup completed: ${totalContentAfter} authentic content items remaining`)

    return NextResponse.json({
      success: true,
      message: 'Mock data cleanup completed successfully',
      results: {
        contentBefore: totalContentBefore,
        contentAfter: totalContentAfter,
        deletedMockContent: deletedCount,
        deletedSuspiciousContent: additionalDeletes,
        totalDeleted: deletedCount + additionalDeletes,
        authenticInfluencers: authenticInfluencers.length,
        remainingContent: finalContent?.map(c => ({
          handle: (c as any).korean_influencers?.handle,
          name: (c as any).korean_influencers?.name,
          caption: c.caption?.substring(0, 50) + '...'
        })) || []
      },
      cleanup: {
        purpose: 'Remove all mock/fake data and keep only authentic content from 12 Korean beauty influencers',
        authenticInfluencers,
        patternsRemoved: suspiciousPatterns
      }
    })

  } catch (error) {
    console.error('❌ Error cleaning up mock data:', error)
    return NextResponse.json({
      error: 'Failed to clean up mock data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Mock Data Cleanup',
    description: 'Removes all fake/mock content and keeps only authentic data from 12 Korean beauty influencers',
    authenticInfluencers: [
      'ponysmakeup', 'risabae_art', 'directorpi', '3ce_official',
      'liahyoo', 'gothamista', 'glowwithava', 'ireneisgood',
      'laneige_kr', 'innisfreeofficial', 'etudehouse', 'amorepacific_official'
    ],
    usage: 'POST /api/admin/cleanup-mock-data'
  })
}