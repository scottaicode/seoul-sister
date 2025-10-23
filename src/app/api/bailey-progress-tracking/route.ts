import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { WeeklyProgressUpdate } from '@/types/bailey-profile'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bailey's skin improvement indicators
const IMPROVEMENT_MARKERS = {
  positive: [
    'softer', 'smoother', 'brighter', 'clearer', 'hydrated',
    'even-toned', 'glowing', 'plump', 'calm', 'balanced'
  ],
  negative: [
    'dry', 'oily', 'irritated', 'red', 'breaking out',
    'dull', 'flaky', 'tight', 'sensitive', 'congested'
  ],
  purging: [
    'small whiteheads', 'coming to surface', 'turnover',
    'temporary breakouts', 'extraction'
  ]
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      whatsappNumber,
      weekNumber,
      photoUrl,
      userFeedback,
      currentProducts
    } = await request.json()

    // Analyze progress photo if provided
    let photoAnalysis = null
    if (photoUrl) {
      photoAnalysis = await analyzeProgressPhoto(photoUrl, weekNumber)
    }

    // Get previous check-ins for comparison
    const { data: previousCheckIns } = await supabase
      .from('skin_progress_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(3)

    // Generate AI progress analysis
    const progressAnalysis = await generateProgressAnalysis(
      userFeedback,
      photoAnalysis,
      previousCheckIns || [],
      currentProducts,
      weekNumber
    )

    // Calculate progress scores
    const scores = calculateProgressScores(
      userFeedback,
      photoAnalysis,
      previousCheckIns || []
    )

    // Determine if experiencing purging
    const purgingStatus = detectPurging(userFeedback, photoAnalysis)

    // Generate personalized recommendations
    const recommendations = generateRecommendations(
      progressAnalysis,
      purgingStatus,
      weekNumber
    )

    // Save progress update
    const { data: savedProgress, error } = await supabase
      .from('skin_progress_tracking')
      .insert({
        user_id: userId,
        whatsapp_number: whatsappNumber,
        week_number: weekNumber,
        photo_url: photoUrl,
        skin_condition_rating: userFeedback.overallRating || 5,
        specific_concerns: userFeedback.concerns || {},
        product_reactions: userFeedback.reactions || {},
        experiencing_purging: purgingStatus.isPurging,
        purging_areas: purgingStatus.areas || [],
        new_irritations: userFeedback.newIrritations || false,
        irritation_details: userFeedback.irritationDetails || {},
        overall_satisfaction: userFeedback.satisfaction || 3,
        notes: userFeedback.notes || '',
        ai_analysis: progressAnalysis,
        ai_recommendations: recommendations
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving progress:', error)
    }

    // Generate Bailey's weekly report
    const weeklyReport = generateWeeklyReport(
      scores,
      progressAnalysis,
      purgingStatus,
      recommendations,
      weekNumber
    )

    return NextResponse.json({
      success: true,
      weeklyReport,
      scores,
      purgingStatus,
      recommendations,
      savedId: savedProgress?.id,
      baileyMessage: generateBaileyEncouragement(scores, purgingStatus, weekNumber)
    })

  } catch (error) {
    console.error('Error tracking progress:', error)
    return NextResponse.json({ error: 'Failed to track progress' }, { status: 500 })
  }
}

async function analyzeProgressPhoto(photoUrl: string, weekNumber: number) {
  try {
    // Fetch and convert image to base64
    const imageResponse = await fetch(photoUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `You are Bailey's skincare progress analyzer. This is week ${weekNumber} of the user's skincare journey.

Analyze this progress photo and provide detailed assessment:

Please return a JSON response:
{
  "skinCondition": {
    "overall": "improved|stable|declined",
    "score": 1-10,
    "visibleImprovements": ["list specific improvements"],
    "remainingConcerns": ["list ongoing issues"],
    "newIssues": ["any new problems"]
  },
  "texture": {
    "smoothness": 1-10,
    "changes": "description of texture changes",
    "poreAppearance": "improved|same|worse"
  },
  "tone": {
    "evenness": 1-10,
    "brightness": 1-10,
    "hyperpigmentation": "fading|stable|worsening",
    "redness": "reduced|stable|increased"
  },
  "hydration": {
    "level": 1-10,
    "signs": ["plump", "dewy", "dry patches", etc]
  },
  "acne": {
    "activeBreakouts": number,
    "healing": boolean,
    "scarring": "improving|stable|worsening",
    "possiblePurging": boolean,
    "purgingAreas": ["areas if purging detected"]
  },
  "irritation": {
    "present": boolean,
    "severity": "none|mild|moderate|severe",
    "areas": ["affected areas"],
    "type": "redness|burning|itching|peeling"
  },
  "progressAssessment": {
    "comparedToStart": "significant improvement|moderate improvement|slight improvement|no change|slight decline",
    "expectedForWeek": boolean,
    "concerns": ["any concerns"],
    "positives": ["encouraging signs"]
  },
  "confidence": 0.0-1.0
}

Be honest but encouraging. Look for subtle improvements that the user might not notice.`
            }
          ]
        }
      ]
    })

    const analysisText = (response.content[0] as any).text
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return null

  } catch (error) {
    console.error('Error analyzing progress photo:', error)
    return null
  }
}

async function generateProgressAnalysis(
  userFeedback: any,
  photoAnalysis: any,
  previousCheckIns: any[],
  currentProducts: any[],
  weekNumber: number
) {
  const prompt = `
Analyze skincare progress for week ${weekNumber}:

User Feedback:
- Overall rating: ${userFeedback.overallRating}/10
- Concerns: ${JSON.stringify(userFeedback.concerns)}
- Product reactions: ${JSON.stringify(userFeedback.reactions)}
- Notes: ${userFeedback.notes}

Photo Analysis: ${photoAnalysis ? JSON.stringify(photoAnalysis) : 'No photo provided'}

Previous Weeks: ${previousCheckIns.length} check-ins
${previousCheckIns.map(c => `Week ${c.week_number}: Rating ${c.skin_condition_rating}/10`).join(', ')}

Current Products: ${currentProducts?.map((p: any) => p.name).join(', ') || 'Not specified'}

Provide Bailey-style analysis that:
1. Celebrates improvements (even small ones)
2. Addresses concerns with solutions
3. Explains any purging or adjustment periods
4. Provides realistic timeline expectations
5. Offers specific adjustments if needed
6. Maintains encouraging, educational tone

Focus on progress, not perfection!`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    return {
      analysis: (response.content[0] as any).text,
      timestamp: new Date().toISOString(),
      weekNumber
    }

  } catch (error) {
    console.error('Error generating progress analysis:', error)
    return {
      analysis: 'Keep going! Consistency is key to seeing results.',
      timestamp: new Date().toISOString(),
      weekNumber
    }
  }
}

function calculateProgressScores(
  userFeedback: any,
  photoAnalysis: any,
  previousCheckIns: any[]
) {
  const scores = {
    overall: userFeedback.overallRating || 5,
    improvement: 0,
    consistency: 0,
    trajectory: 'stable' as 'improving' | 'stable' | 'declining'
  }

  // Calculate improvement from baseline
  if (previousCheckIns.length > 0) {
    const baseline = previousCheckIns[previousCheckIns.length - 1].skin_condition_rating
    scores.improvement = ((scores.overall - baseline) / baseline) * 100
  }

  // Calculate consistency score based on regular check-ins
  scores.consistency = previousCheckIns.length >= 3 ? 100 : (previousCheckIns.length * 33)

  // Determine trajectory
  if (previousCheckIns.length >= 2) {
    const recent = previousCheckIns.slice(0, 2).map(c => c.skin_condition_rating)
    if (recent[0] > recent[1]) scores.trajectory = 'improving'
    else if (recent[0] < recent[1]) scores.trajectory = 'declining'
  }

  // Incorporate photo analysis if available
  if (photoAnalysis?.skinCondition) {
    if (photoAnalysis.skinCondition.overall === 'improved') {
      scores.improvement += 10
      scores.trajectory = 'improving'
    }
  }

  return scores
}

function detectPurging(userFeedback: any, photoAnalysis: any) {
  const purgingStatus = {
    isPurging: false,
    confidence: 0,
    areas: [] as string[],
    expectedDuration: '',
    advice: ''
  }

  // Check user feedback for purging indicators
  const feedbackText = JSON.stringify(userFeedback).toLowerCase()
  const hasPurgingKeywords = IMPROVEMENT_MARKERS.purging.some(keyword =>
    feedbackText.includes(keyword)
  )

  // Check photo analysis
  if (photoAnalysis?.acne?.possiblePurging) {
    purgingStatus.isPurging = true
    purgingStatus.confidence = 0.8
    purgingStatus.areas = photoAnalysis.acne.purgingAreas || []
  }

  // Check for typical purging pattern: breakouts in usual areas + using actives
  if (userFeedback.reactions?.negative?.some((r: any) =>
    r.reaction?.includes('breakout') && r.product?.includes('acid')
  )) {
    purgingStatus.isPurging = true
    purgingStatus.confidence = 0.7
  }

  if (hasPurgingKeywords) {
    purgingStatus.isPurging = true
    purgingStatus.confidence = Math.max(purgingStatus.confidence, 0.6)
  }

  if (purgingStatus.isPurging) {
    purgingStatus.expectedDuration = '2-6 weeks total'
    purgingStatus.advice = `This appears to be purging, which means your products are working!
    Purging brings trapped debris to the surface. It's temporary and different from a bad reaction.
    Continue using the products unless you experience burning, severe redness, or breakouts in NEW areas.`
  }

  return purgingStatus
}

function generateRecommendations(
  progressAnalysis: any,
  purgingStatus: any,
  weekNumber: number
) {
  const recommendations = {
    immediate: [] as string[],
    nextWeek: [] as string[],
    products: [] as any[],
    routine: [] as string[]
  }

  // Week-specific recommendations
  if (weekNumber <= 2) {
    recommendations.immediate.push('Stay consistent with your basic routine')
    recommendations.nextWeek.push('Consider adding your next planned product')
  } else if (weekNumber <= 4) {
    if (purgingStatus.isPurging) {
      recommendations.immediate.push('Continue current routine - purging is normal')
      recommendations.immediate.push('Add extra hydration to support skin barrier')
    } else {
      recommendations.nextWeek.push('Skin is adjusting well - maintain consistency')
    }
  } else {
    recommendations.immediate.push('Evaluate what\'s working and adjust frequency')
    recommendations.nextWeek.push('Consider introducing next treatment product')
  }

  // Purging-specific recommendations
  if (purgingStatus.isPurging) {
    recommendations.routine = [
      'Don\'t add new products during purging',
      'Use gentle, hydrating products between actives',
      'Avoid picking or extracting',
      'Consider reducing active frequency if severe'
    ]
  }

  // General maintenance
  recommendations.routine.push(
    'Continue taking weekly photos in same lighting',
    'Stay hydrated and maintain healthy diet',
    'Be patient - real change takes 6-12 weeks'
  )

  return recommendations
}

function generateWeeklyReport(
  scores: any,
  progressAnalysis: any,
  purgingStatus: any,
  recommendations: any,
  weekNumber: number
) {
  return {
    weekNumber,
    headline: generateHeadline(scores, purgingStatus, weekNumber),
    scores,
    keyInsights: [
      scores.trajectory === 'improving' ? '✅ Skin is improving!' :
      scores.trajectory === 'stable' ? '➡️ Skin is stable' :
      '⚠️ Some challenges this week',
      purgingStatus.isPurging ? '🔄 Purging detected - this is normal!' : '',
      `Consistency score: ${scores.consistency}%`
    ].filter(Boolean),
    analysis: progressAnalysis.analysis,
    recommendations,
    purgingStatus,
    nextSteps: generateNextSteps(weekNumber, scores, purgingStatus)
  }
}

function generateHeadline(scores: any, purgingStatus: any, weekNumber: number) {
  if (purgingStatus.isPurging) {
    return `Week ${weekNumber}: Your Skin is Detoxing! (Purging Phase)`
  }

  if (scores.trajectory === 'improving') {
    return `Week ${weekNumber}: You're Glowing! Keep It Up! ✨`
  }

  if (weekNumber === 1) {
    return `Week 1: Your Skincare Journey Begins! 🌸`
  }

  if (weekNumber <= 4) {
    return `Week ${weekNumber}: Building Your Routine Foundation`
  }

  return `Week ${weekNumber}: Consistency is Your Superpower!`
}

function generateNextSteps(weekNumber: number, scores: any, purgingStatus: any) {
  const steps = []

  if (weekNumber < 4) {
    steps.push('Continue with gradual product introduction')
  }

  if (purgingStatus.isPurging) {
    steps.push('Maintain routine without changes for 2 more weeks')
    steps.push('Focus on gentle, hydrating products')
  } else if (scores.trajectory === 'improving') {
    steps.push('Ready to optimize your routine further')
    steps.push('Consider adding targeted treatments')
  }

  steps.push('Schedule next week\'s check-in')

  return steps
}

function generateBaileyEncouragement(scores: any, purgingStatus: any, weekNumber: number) {
  let message = ''

  // Week-specific encouragement
  if (weekNumber === 1) {
    message = "🎉 Congratulations on completing your first week! This is the beginning of beautiful skin. "
  } else if (weekNumber === 4) {
    message = "🌟 One month in! You've built a solid foundation. "
  } else if (weekNumber === 8) {
    message = "💕 Two months of consistency! Real transformation is happening. "
  }

  // Progress-based encouragement
  if (scores.trajectory === 'improving') {
    message += "Your skin is responding beautifully! I can see the improvements. "
  } else if (purgingStatus.isPurging) {
    message += "I know purging is frustrating, but it means your products are working! This too shall pass. "
  } else if (scores.trajectory === 'stable') {
    message += "Stability is progress too! Your skin is adjusting. "
  }

  // Consistency praise
  if (scores.consistency >= 75) {
    message += "Your consistency is incredible - that's the secret to great skin! "
  }

  // Future focus
  message += weekNumber < 4
    ? "Keep following your introduction plan. Trust the process! 💪"
    : "You're doing amazing. Real change is happening at the cellular level! 🌸"

  return message
}

// GET endpoint to retrieve progress history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '12')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const { data: progressHistory, error } = await supabase
      .from('skin_progress_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching progress:', error)
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
    }

    // Calculate trends
    const trends = calculateTrends(progressHistory || [])

    return NextResponse.json({
      history: progressHistory,
      trends,
      totalWeeks: progressHistory?.length || 0
    })

  } catch (error) {
    console.error('Error in GET progress:', error)
    return NextResponse.json({ error: 'Failed to retrieve progress' }, { status: 500 })
  }
}

function calculateTrends(history: any[]) {
  if (history.length < 2) {
    return { overall: 'insufficient-data' }
  }

  const ratings = history.map(h => h.skin_condition_rating)
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const recentAvg = ratings.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, ratings.length)

  return {
    overall: recentAvg > avgRating ? 'improving' : recentAvg < avgRating ? 'declining' : 'stable',
    averageRating: avgRating,
    recentAverage: recentAvg,
    purgingWeeks: history.filter(h => h.experiencing_purging).length,
    consistencyRate: (history.length / 12) * 100 // Assuming 12 weeks is full consistency
  }
}