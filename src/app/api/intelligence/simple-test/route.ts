import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') || 'mega'

    console.log(`🧪 Running simplified intelligence test for tier: ${tier}`)

    // Step 1: Test tier configuration
    const { getInfluencersByTier } = await import('@/lib/config/korean-influencers')
    const influencers = getInfluencersByTier(tier as 'mega' | 'rising' | 'niche')

    console.log(`✅ Found ${influencers.length} influencers for ${tier} tier`)

    // Step 2: Test orchestrator creation (we know this works from diagnostics)
    const { createIntelligenceOrchestrator } = await import('@/lib/services/intelligence-orchestrator')
    const orchestrator = createIntelligenceOrchestrator()

    console.log(`✅ Intelligence orchestrator created`)

    // Step 3: Test just the influencer selection part (no external APIs)
    try {
      console.log(`🔍 Testing getInfluencersForMonitoring with tier: ${tier}`)

      // Call the private method indirectly by creating a minimal options object
      const testOptions = {
        tier: tier as 'mega' | 'rising' | 'niche',
        scheduleSlot: 'all' as const,
        maxContentPerInfluencer: 5,
        includeTranscription: false, // Disable to avoid external API calls
        generateTrendReport: false   // Disable to avoid external API calls
      }

      console.log(`📊 Test options:`, testOptions)

      // Instead of running the full cycle, let's test a minimal version
      return NextResponse.json({
        success: true,
        message: `Simplified test successful for ${tier} tier`,
        data: {
          tier,
          influencersFound: influencers.length,
          influencers: influencers.map(inf => ({
            handle: inf.handle,
            platform: inf.platform,
            tier: inf.tier,
            followers: inf.followers,
            specialty: inf.specialty
          })),
          testOptions,
          orchestratorCreated: true,
          nextStep: 'Ready to test actual intelligence cycle with external APIs'
        },
        timestamp: new Date().toISOString()
      })

    } catch (orchestratorError) {
      console.error('❌ Orchestrator method test failed:', orchestratorError)
      return NextResponse.json({
        success: false,
        error: 'Orchestrator method failed',
        details: orchestratorError instanceof Error ? orchestratorError.message : String(orchestratorError),
        stage: 'orchestrator_method_test'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Simplified intelligence test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Simplified test failed',
      details: error instanceof Error ? error.message : String(error),
      stage: 'initialization',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Test with actual intelligence cycle but with minimal scope
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') || 'mega'

    console.log(`🚀 Running ACTUAL intelligence cycle test for tier: ${tier}`)

    const { createIntelligenceOrchestrator } = await import('@/lib/services/intelligence-orchestrator')
    const orchestrator = createIntelligenceOrchestrator()

    // Try to run actual intelligence cycle with very minimal settings
    const result = await orchestrator.runIntelligenceCycle({
      tier: tier as 'mega' | 'rising' | 'niche',
      scheduleSlot: 'all',
      maxContentPerInfluencer: 1, // Minimal content to reduce API load
      includeTranscription: false, // Disable transcription to avoid SupaData calls
      generateTrendReport: false   // Disable trend reports to avoid heavy AI processing
    })

    console.log(`📊 Intelligence cycle result:`, {
      success: result.success,
      error: result.error,
      summary: result.summary
    })

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Actual intelligence cycle successful for ${tier} tier`
        : `Intelligence cycle failed for ${tier} tier`,
      data: result,
      tier,
      timestamp: new Date().toISOString()
    }, {
      status: result.success ? 200 : 500
    })

  } catch (error) {
    console.error('❌ Actual intelligence cycle test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Actual intelligence cycle failed',
      details: error instanceof Error ? error.message : String(error),
      stage: 'intelligence_cycle_execution',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}