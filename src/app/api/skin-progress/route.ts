import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/skin-progress - Get user's skin analysis progress (Premium Feature)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const timeframe = searchParams.get('timeframe') || '6months' // 30days, 3months, 6months, 1year

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Calculate date range based on timeframe
    const now = new Date()
    let startDate = new Date()

    switch (timeframe) {
      case '30days':
        startDate.setDate(now.getDate() - 30)
        break
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setMonth(now.getMonth() - 6)
    }

    // Get user's skin analyses within timeframe
    const { data: analyses, error } = await supabase
      .from('photo_skin_analyses')
      .select(`
        id,
        created_at,
        detected_skin_type,
        acne_score,
        hydration_level,
        brightness_score,
        texture_score,
        analysis_confidence,
        improvement_notes,
        is_baseline,
        primary_recommendations
      `)
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching progress:', error)
      return NextResponse.json({ error: 'Failed to fetch progress data' }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({
        message: 'No skin analyses found for this timeframe',
        progress: [],
        insights: null,
        totalAnalyses: 0
      })
    }

    // Calculate progress insights
    const progressInsights = calculateProgressInsights(analyses)

    // Generate improvement timeline
    const progressTimeline = generateProgressTimeline(analyses)

    // Get latest skin health score
    const latestAnalysis = analyses[analyses.length - 1]
    const skinHealthScore = calculateSkinHealthScore(latestAnalysis)

    return NextResponse.json({
      progress: analyses,
      timeline: progressTimeline,
      insights: progressInsights,
      currentSkinHealth: skinHealthScore,
      totalAnalyses: analyses.length,
      timeframe,
      baseline: analyses.find(a => a.is_baseline) || analyses[0]
    })

  } catch (error) {
    console.error('Error in skin progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Calculate comprehensive progress insights for premium users
function calculateProgressInsights(analyses: any[]) {
  if (analyses.length < 2) {
    return {
      message: 'Need at least 2 analyses to track progress',
      improvementAreas: [],
      concerningTrends: [],
      recommendations: ['Continue current routine and take progress photos weekly']
    }
  }

  const baseline = analyses[0]
  const latest = analyses[analyses.length - 1]

  // Calculate changes in key metrics
  const changes = {
    acne: calculatePercentChange(baseline.acne_score, latest.acne_score, true),
    hydration: calculatePercentChange(baseline.hydration_level, latest.hydration_level),
    brightness: calculatePercentChange(baseline.brightness_score, latest.brightness_score),
    texture: calculatePercentChange(baseline.texture_score, latest.texture_score)
  }

  // Identify improvement areas
  const improvementAreas = []
  const concerningTrends = []

  Object.entries(changes).forEach(([metric, change]) => {
    if (change > 15) {
      improvementAreas.push({
        metric,
        improvement: change,
        message: getImprovementMessage(metric, change)
      })
    } else if (change < -10) {
      concerningTrends.push({
        metric,
        decline: Math.abs(change),
        message: getConcernMessage(metric, Math.abs(change))
      })
    }
  })

  // Generate smart recommendations
  const recommendations = generateSmartRecommendations(changes, analyses)

  return {
    overallProgress: calculateOverallProgress(changes),
    improvementAreas,
    concerningTrends,
    recommendations,
    analysisFrequency: calculateAnalysisFrequency(analyses),
    consistencyScore: calculateConsistencyScore(analyses)
  }
}

function calculatePercentChange(before: number, after: number, lowerIsBetter = false): number {
  if (!before || !after) return 0

  const change = ((after - before) / before) * 100
  return lowerIsBetter ? -change : change
}

function getImprovementMessage(metric: string, improvement: number): string {
  const messages = {
    acne: `🎯 Acne concerns reduced by ${improvement.toFixed(1)}%`,
    hydration: `💧 Hydration levels improved by ${improvement.toFixed(1)}%`,
    brightness: `☀️ Skin brightness increased by ${improvement.toFixed(1)}%`,
    texture: `🎨 Skin texture smoothness improved by ${improvement.toFixed(1)}%`
  }
  return messages[metric as keyof typeof messages] || `${metric} improved by ${improvement.toFixed(1)}%`
}

function getConcernMessage(metric: string, decline: number): string {
  const messages = {
    acne: `⚠️ Acne concerns increased by ${decline.toFixed(1)}%`,
    hydration: `⚠️ Hydration levels decreased by ${decline.toFixed(1)}%`,
    brightness: `⚠️ Skin brightness declined by ${decline.toFixed(1)}%`,
    texture: `⚠️ Skin texture roughness increased by ${decline.toFixed(1)}%`
  }
  return messages[metric as keyof typeof messages] || `${metric} declined by ${decline.toFixed(1)}%`
}

function generateSmartRecommendations(changes: any, analyses: any[]): string[] {
  const recommendations = []

  // Hydration-based recommendations
  if (changes.hydration < -5) {
    recommendations.push('💧 Consider adding a hydrating essence or serum to your routine')
    recommendations.push('🌙 Use an overnight sleeping mask 2-3 times per week')
  }

  // Acne-based recommendations
  if (changes.acne < -10) {
    recommendations.push('🎯 Your acne may be purging - continue current routine for 2-4 more weeks')
    recommendations.push('🧴 Ensure you\'re not over-cleansing (max 2x daily)')
  }

  // Brightness recommendations
  if (changes.brightness < -5) {
    recommendations.push('☀️ Add vitamin C serum to morning routine for brightness')
    recommendations.push('🌟 Consider gentle exfoliation 1-2x per week')
  }

  // Texture recommendations
  if (changes.texture < -5) {
    recommendations.push('🎨 Add a gentle AHA/BHA product for smoother texture')
    recommendations.push('💆‍♀️ Ensure proper cleansing technique')
  }

  // Analysis frequency recommendations
  const frequency = calculateAnalysisFrequency(analyses)
  if (frequency > 14) {
    recommendations.push('📅 Take progress photos weekly for best tracking')
  }

  // Default recommendations if no specific issues
  if (recommendations.length === 0) {
    recommendations.push('✨ Your skin routine is working well - maintain consistency')
    recommendations.push('📊 Continue taking weekly progress photos')
    recommendations.push('🔄 Consider adding a new targeted treatment if desired')
  }

  return recommendations.slice(0, 5) // Limit to 5 recommendations
}

function generateProgressTimeline(analyses: any[]) {
  return analyses.map((analysis, index) => ({
    date: analysis.created_at,
    analysisId: analysis.id,
    skinHealth: calculateSkinHealthScore(analysis),
    keyImprovement: analysis.improvement_notes || (index === 0 ? 'Baseline analysis' : 'Routine maintenance'),
    milestones: identifyMilestones(analysis, index, analyses)
  }))
}

function calculateSkinHealthScore(analysis: any): number {
  // Weighted calculation of overall skin health (0-100)
  const hydrationWeight = 0.25
  const acneWeight = 0.3  // Inverted since lower is better
  const brightnessWeight = 0.25
  const textureWeight = 0.2

  const hydrationScore = (analysis.hydration_level || 0) * 100
  const acneScore = (1 - (analysis.acne_score || 0)) * 100 // Invert acne score
  const brightnessScore = (analysis.brightness_score || 0) * 100
  const textureScore = (analysis.texture_score || 0) * 100

  return Math.round(
    hydrationScore * hydrationWeight +
    acneScore * acneWeight +
    brightnessScore * brightnessWeight +
    textureScore * textureWeight
  )
}

function identifyMilestones(analysis: any, index: number, allAnalyses: any[]): string[] {
  const milestones = []

  if (index === 0) {
    milestones.push('🎯 Baseline established')
  }

  if (analysis.is_baseline) {
    milestones.push('📊 Progress tracking started')
  }

  // Check for significant improvements
  if (index > 0) {
    const previous = allAnalyses[index - 1]

    if ((analysis.hydration_level - previous.hydration_level) > 0.15) {
      milestones.push('💧 Major hydration boost')
    }

    if ((previous.acne_score - analysis.acne_score) > 0.2) {
      milestones.push('✨ Significant acne improvement')
    }

    if ((analysis.brightness_score - previous.brightness_score) > 0.15) {
      milestones.push('☀️ Noticeable brightness gain')
    }
  }

  return milestones
}

function calculateAnalysisFrequency(analyses: any[]): number {
  if (analyses.length < 2) return 0

  const timeSpans = []
  for (let i = 1; i < analyses.length; i++) {
    const current = new Date(analyses[i].created_at)
    const previous = new Date(analyses[i - 1].created_at)
    const daysDiff = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    timeSpans.push(daysDiff)
  }

  return timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length
}

function calculateConsistencyScore(analyses: any[]): number {
  // Score based on regularity of analyses (0-100)
  if (analyses.length < 3) return 100

  const frequency = calculateAnalysisFrequency(analyses)

  // Ideal frequency is weekly (7 days)
  if (frequency <= 10) return 100
  if (frequency <= 14) return 85
  if (frequency <= 21) return 70
  if (frequency <= 30) return 55
  return 40
}

function calculateOverallProgress(changes: any): number {
  const values = Object.values(changes) as number[]
  const positiveChanges = values.filter(change => change > 0)

  if (positiveChanges.length === 0) return 0

  const averageImprovement = positiveChanges.reduce((sum, change) => sum + change, 0) / positiveChanges.length
  return Math.min(Math.round(averageImprovement), 100)
}