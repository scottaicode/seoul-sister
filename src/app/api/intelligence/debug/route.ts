import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const steps: any[] = []

  try {
    steps.push({ step: 1, description: 'Route handler started', status: 'success', timestamp: Date.now() })

    // Step 2: Test URL parsing
    try {
      const { searchParams } = new URL(request.url)
      const tier = searchParams.get('tier') || 'mega'
      steps.push({ step: 2, description: 'URL parsing successful', status: 'success', data: { tier }, timestamp: Date.now() })
    } catch (error) {
      steps.push({ step: 2, description: 'URL parsing failed', status: 'error', error: String(error), timestamp: Date.now() })
      throw error
    }

    // Step 3: Test Korean influencers import
    try {
      const koreanInfluencersModule = await import('@/lib/config/korean-influencers')
      steps.push({ step: 3, description: 'Korean influencers module imported', status: 'success', timestamp: Date.now() })

      const { getInfluencersByTier } = koreanInfluencersModule
      steps.push({ step: 4, description: 'getInfluencersByTier function extracted', status: 'success', timestamp: Date.now() })

      const influencers = getInfluencersByTier('mega')
      steps.push({ step: 5, description: 'Influencers retrieved', status: 'success', data: { count: influencers.length }, timestamp: Date.now() })

    } catch (error) {
      steps.push({ step: 3, description: 'Korean influencers import/execution failed', status: 'error', error: String(error), timestamp: Date.now() })
      throw error
    }

    // Step 6: Test orchestrator import (but not creation yet)
    try {
      const orchestratorModule = await import('@/lib/services/intelligence-orchestrator')
      steps.push({ step: 6, description: 'Intelligence orchestrator module imported', status: 'success', timestamp: Date.now() })

      const { createIntelligenceOrchestrator } = orchestratorModule
      steps.push({ step: 7, description: 'createIntelligenceOrchestrator function extracted', status: 'success', timestamp: Date.now() })

    } catch (error) {
      steps.push({ step: 6, description: 'Intelligence orchestrator import failed', status: 'error', error: String(error), timestamp: Date.now() })
      throw error
    }

    // Step 8: Test orchestrator creation (this might be where it fails)
    try {
      const orchestratorModule = await import('@/lib/services/intelligence-orchestrator')
      const { createIntelligenceOrchestrator } = orchestratorModule

      steps.push({ step: 8, description: 'About to create orchestrator...', status: 'info', timestamp: Date.now() })

      const orchestrator = createIntelligenceOrchestrator()

      steps.push({ step: 9, description: 'Intelligence orchestrator created successfully', status: 'success', timestamp: Date.now() })

    } catch (error) {
      steps.push({ step: 8, description: 'Intelligence orchestrator creation failed', status: 'error', error: String(error), timestamp: Date.now() })
      throw error
    }

    // Step 10: Test basic method call
    try {
      const orchestratorModule = await import('@/lib/services/intelligence-orchestrator')
      const { createIntelligenceOrchestrator } = orchestratorModule
      const orchestrator = createIntelligenceOrchestrator()

      // Try calling getDashboardData which should be safe
      steps.push({ step: 10, description: 'About to call getDashboardData...', status: 'info', timestamp: Date.now() })

      const dashboardData = await orchestrator.getDashboardData('daily')

      steps.push({ step: 11, description: 'getDashboardData called successfully', status: 'success', data: { overview: dashboardData.overview }, timestamp: Date.now() })

    } catch (error) {
      steps.push({ step: 10, description: 'getDashboardData call failed', status: 'error', error: String(error), timestamp: Date.now() })
      throw error
    }

    // If we get here, everything worked
    steps.push({ step: 12, description: 'All tests completed successfully', status: 'success', timestamp: Date.now() })

    return NextResponse.json({
      success: true,
      message: 'All debugging steps completed successfully',
      steps,
      summary: {
        totalSteps: steps.length,
        successSteps: steps.filter(s => s.status === 'success').length,
        errorSteps: steps.filter(s => s.status === 'error').length
      },
      conclusion: 'Intelligence system is working correctly - issue may be in specific execution paths'
    })

  } catch (error) {
    steps.push({
      step: 999,
      description: 'Final error catch',
      status: 'fatal_error',
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
      } : String(error),
      timestamp: Date.now()
    })

    return NextResponse.json({
      success: false,
      message: 'Debugging failed at a specific step',
      steps,
      summary: {
        totalSteps: steps.length,
        successSteps: steps.filter(s => s.status === 'success').length,
        errorSteps: steps.filter(s => s.status === 'error').length,
        failedAt: steps.filter(s => s.status === 'error')[0]?.description || 'Unknown step'
      },
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Simple echo test to make sure the route works at all
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    return NextResponse.json({
      success: true,
      message: 'Simple echo test - route is working',
      requestData: {
        method: 'POST',
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        body
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Even the simple echo test failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}