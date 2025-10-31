import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SkinProgress {
  date: string
  scores: {
    hydration: number
    clarity: number
    texture: number
    overall: number
  }
  improvements: string[]
  concerns: string[]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string

    // Get user's skin history
    let previousAnalyses: SkinProgress[] = []

    if (userId) {
      // In production, fetch from skin_progress table
      // For now, simulate progress data
      previousAnalyses = generateProgressHistory()
    }

    // Simulate current analysis (would use AI in production)
    const currentAnalysis: SkinProgress = {
      date: new Date().toISOString(),
      scores: {
        hydration: 75,
        clarity: 82,
        texture: 78,
        overall: 79
      },
      improvements: [
        "Reduced redness in T-zone",
        "Improved skin texture",
        "Better hydration levels"
      ],
      concerns: [
        "Slight purging from new product",
        "Minor breakout on chin"
      ]
    }

    // Calculate improvements
    const progressMetrics = calculateProgress(previousAnalyses, currentAnalysis)

    // Generate Bailey's progress analysis
    const baileyAnalysis = generateBaileyProgressAnalysis(
      previousAnalyses,
      currentAnalysis,
      progressMetrics
    )

    // Identify potential issues
    const skinIssues = identifySkinIssues(currentAnalysis, previousAnalyses)

    return NextResponse.json({
      currentScores: currentAnalysis.scores,
      progressHistory: previousAnalyses.map(a => ({
        date: a.date,
        overall: a.scores.overall
      })),
      improvements: currentAnalysis.improvements,
      concerns: currentAnalysis.concerns,
      progressMetrics,
      baileyAnalysis,
      recommendations: generateProgressRecommendations(progressMetrics, skinIssues),
      skinIssues,
      timeline: {
        weeks: previousAnalyses.length,
        startDate: previousAnalyses[0]?.date || currentAnalysis.date,
        trend: progressMetrics.trend
      }
    })

  } catch (error) {
    console.error('Progress tracking error:', error)

    // Return demo progress data
    return NextResponse.json({
      currentScores: {
        hydration: 75,
        clarity: 82,
        texture: 78,
        overall: 79
      },
      progressHistory: [
        { date: "2024-10-01", overall: 65 },
        { date: "2024-10-08", overall: 68 },
        { date: "2024-10-15", overall: 72 },
        { date: "2024-10-22", overall: 75 },
        { date: "2024-10-29", overall: 79 }
      ],
      improvements: [
        "Skin texture significantly smoother",
        "Dark spots fading (15% reduction)",
        "Pore size visibly reduced"
      ],
      concerns: [
        "Minor purging from retinol introduction",
        "Seasonal dryness developing"
      ],
      progressMetrics: {
        overallChange: "+14%",
        trend: "improving",
        bestCategory: "clarity",
        needsAttention: "hydration"
      },
      baileyAnalysis: "Fantastic progress! I can see a 14% overall improvement in your skin health over the past month. Your skin clarity has improved the most - those dark spots are definitely fading! The minor purging you're experiencing is completely normal with retinol introduction and should subside within 1-2 weeks. I'm slightly concerned about your hydration levels dropping - this is common as we enter winter. Let's add a hydrating essence or switch to a richer moisturizer. Keep taking weekly photos - you're on the right track!",
      recommendations: [
        "Add hydrating essence for moisture boost",
        "Continue retinol but reduce to 2x/week during purging",
        "Consider adding ceramide cream for winter",
        "Keep using vitamin C - it's working for your dark spots!"
      ],
      skinIssues: {
        purging: true,
        dehydration: true,
        breakouts: false
      },
      timeline: {
        weeks: 5,
        startDate: "2024-10-01",
        trend: "improving"
      }
    })
  }
}

function generateProgressHistory(): SkinProgress[] {
  const history: SkinProgress[] = []
  const weeks = 4

  for (let i = 0; i < weeks; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (7 * (weeks - i)))

    history.push({
      date: date.toISOString(),
      scores: {
        hydration: 60 + (i * 3),
        clarity: 65 + (i * 4),
        texture: 62 + (i * 3.5),
        overall: 63 + (i * 3.5)
      },
      improvements: [],
      concerns: []
    })
  }

  return history
}

function calculateProgress(
  history: SkinProgress[],
  current: SkinProgress
): any {
  if (history.length === 0) {
    return {
      overallChange: "First analysis",
      trend: "baseline",
      bestCategory: "overall",
      needsAttention: null
    }
  }

  const firstScore = history[0].scores.overall
  const change = ((current.scores.overall - firstScore) / firstScore) * 100

  // Find best performing category
  const categories = ['hydration', 'clarity', 'texture'] as const
  let bestCategory = 'overall'
  let maxImprovement = 0

  categories.forEach(cat => {
    const improvement = current.scores[cat] - history[0].scores[cat]
    if (improvement > maxImprovement) {
      maxImprovement = improvement
      bestCategory = cat
    }
  })

  // Find category needing attention
  let needsAttention = null
  let minScore = 100

  categories.forEach(cat => {
    if (current.scores[cat] < minScore) {
      minScore = current.scores[cat]
      needsAttention = cat
    }
  })

  return {
    overallChange: `${change > 0 ? '+' : ''}${change.toFixed(0)}%`,
    trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
    bestCategory,
    needsAttention: minScore < 70 ? needsAttention : null
  }
}

function generateBaileyProgressAnalysis(
  history: SkinProgress[],
  current: SkinProgress,
  metrics: any
): string {
  let analysis = ""

  // Opening based on trend
  if (metrics.trend === 'improving') {
    analysis = "Fantastic progress! "
  } else if (metrics.trend === 'stable') {
    analysis = "Your skin is maintaining well! "
  } else {
    analysis = "Let's work on getting back on track! "
  }

  // Specific improvements
  if (metrics.overallChange !== "First analysis") {
    analysis += `I can see a ${metrics.overallChange} overall improvement in your skin health. `
  }

  if (metrics.bestCategory) {
    analysis += `Your skin ${metrics.bestCategory} has improved the most. `
  }

  // Address concerns
  if (current.concerns.length > 0) {
    const concern = current.concerns[0]
    if (concern.includes('purging')) {
      analysis += "The purging you're experiencing is completely normal and shows the product is working. It should subside within 1-2 weeks. "
    } else if (concern.includes('breakout')) {
      analysis += "I notice some breakouts - let's review your recent product additions. "
    }
  }

  // Hydration concern
  if (metrics.needsAttention === 'hydration') {
    analysis += "I'm slightly concerned about your hydration levels. Consider adding a hydrating layer. "
  }

  // Encouragement
  if (history.length >= 4) {
    analysis += "Keep taking weekly photos - consistency is key! "
  }

  return analysis
}

function identifySkinIssues(
  current: SkinProgress,
  history: SkinProgress[]
): any {
  const issues = {
    purging: false,
    dehydration: false,
    breakouts: false,
    irritation: false
  }

  // Check for purging patterns
  if (current.concerns.some(c => c.toLowerCase().includes('purging'))) {
    issues.purging = true
  }

  // Check hydration
  if (current.scores.hydration < 70) {
    issues.dehydration = true
  }

  // Check for breakouts
  if (current.concerns.some(c => c.toLowerCase().includes('breakout'))) {
    issues.breakouts = true
  }

  return issues
}

function generateProgressRecommendations(
  metrics: any,
  issues: any
): string[] {
  const recommendations: string[] = []

  if (issues.dehydration) {
    recommendations.push("Add hydrating essence or serum with hyaluronic acid")
  }

  if (issues.purging) {
    recommendations.push("Reduce active ingredient frequency temporarily")
    recommendations.push("Focus on barrier repair with ceramides")
  }

  if (metrics.trend === 'improving') {
    recommendations.push("Keep current routine - it's working well!")
  }

  if (metrics.needsAttention) {
    recommendations.push(`Focus on improving ${metrics.needsAttention} with targeted products`)
  }

  return recommendations
}