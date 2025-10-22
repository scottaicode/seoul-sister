import { NextRequest, NextResponse } from 'next/server'
import { supadataService } from '@/lib/services/supadata-transcription'

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({
        error: 'videoUrl is required',
        example: {
          videoUrl: 'https://instagram.com/p/DQDbCVQkkga/'
        }
      }, { status: 400 })
    }

    console.log(`🧪 Testing Supadata with video URL: ${videoUrl}`)

    // Test the Supadata integration
    const result = await supadataService.processKoreanBeautyVideo({
      videoUrl,
      contentId: 'test-content-id',
      platform: 'instagram',
      influencerHandle: 'test-influencer'
    })

    console.log(`🧪 Supadata test result:`, result)

    return NextResponse.json({
      success: true,
      supadata_configured: Boolean(process.env.SUPADATA_API_KEY),
      result,
      test_info: {
        videoUrl,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Supadata test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      supadata_configured: Boolean(process.env.SUPADATA_API_KEY)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Supadata Test Endpoint',
    usage: 'POST with { "videoUrl": "https://instagram.com/p/..." }',
    configured: Boolean(process.env.SUPADATA_API_KEY)
  })
}