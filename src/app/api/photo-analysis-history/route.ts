import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/photo-analysis-history?user_id=xxx - Get user's photo analysis history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { data: analyses, error } = await supabase
      .from('photo_skin_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    // Calculate progress metrics if multiple analyses exist
    const progressMetrics = analyses.length > 1 ? calculateProgressMetrics(analyses) : null

    return NextResponse.json({
      analyses,
      progress_metrics: progressMetrics,
      total_analyses: analyses.length
    })

  } catch (error) {
    console.error('Error fetching photo analysis history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis history' },
      { status: 500 }
    )
  }
}

// POST /api/photo-analysis-history - Save new photo analysis
export async function POST(request: NextRequest) {
  try {
    const { user_id, analysis_data, photo_url } = await request.json()

    if (!user_id || !analysis_data || !photo_url) {
      return NextResponse.json(
        { error: 'User ID, analysis data, and photo URL are required' },
        { status: 400 }
      )
    }

    // Generate photo hash for duplicate detection
    const photoHash = await generatePhotoHash(photo_url)

    // Check for recent duplicate analysis
    const { data: existingAnalysis } = await supabase
      .from('photo_skin_analyses')
      .select('id')
      .eq('user_id', user_id)
      .eq('photo_hash', photoHash)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Within last hour
      .limit(1)

    if (existingAnalysis && existingAnalysis.length > 0) {
      return NextResponse.json(
        { message: 'Similar analysis already exists', analysis_id: existingAnalysis[0].id },
        { status: 200 }
      )
    }

    // Get previous analysis for progress tracking
    const { data: previousAnalyses } = await supabase
      .from('photo_skin_analyses')
      .select('id')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)

    const previousAnalysisId = previousAnalyses && previousAnalyses.length > 0
      ? previousAnalyses[0].id
      : null

    // Determine if this is a baseline analysis
    const isBaseline = !previousAnalysisId

    // Save analysis to database
    const { data: savedAnalysis, error } = await supabase
      .from('photo_skin_analyses')
      .insert([{
        user_id,
        photo_url,
        photo_hash: photoHash,
        ai_model_version: 'claude-opus-4.1',
        analysis_confidence: analysis_data.aiConfidence || 0.8,
        detected_skin_type: analysis_data.skinType,
        detected_skin_tone: analysis_data.skinTone,
        estimated_age_range: analysis_data.ageRange,
        acne_score: analysis_data.concernScores?.acne || 0,
        wrinkles_score: analysis_data.concernScores?.wrinkles || 0,
        dark_spots_score: analysis_data.concernScores?.dark_spots || 0,
        dryness_score: analysis_data.concernScores?.dryness || 0,
        oiliness_score: analysis_data.concernScores?.oiliness || 0,
        enlarged_pores_score: analysis_data.concernScores?.enlarged_pores || 0,
        redness_score: analysis_data.concernScores?.redness || 0,
        dullness_score: analysis_data.concernScores?.dullness || 0,
        hydration_level: analysis_data.hydrationLevel || 0.5,
        oil_level: analysis_data.oilLevel || 0.5,
        texture_score: analysis_data.textureScore || 0.5,
        elasticity_score: analysis_data.elasticityScore || 0.5,
        brightness_score: analysis_data.brightnessScore || 0.5,
        ai_detailed_analysis: analysis_data.detailedAnalysis,
        primary_recommendations: analysis_data.primaryRecommendations || [],
        detected_concerns: analysis_data.concerns || [],
        is_baseline: isBaseline,
        previous_analysis_id: previousAnalysisId
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update user profile with latest analysis if this is their first or shows significant changes
    if (isBaseline || await hasSignificantChanges(analysis_data, previousAnalysisId)) {
      await updateUserProfileFromAnalysis(user_id, analysis_data)
    }

    return NextResponse.json({
      analysis: savedAnalysis,
      is_baseline: isBaseline,
      message: isBaseline ? 'Baseline analysis saved' : 'Progress analysis saved'
    }, { status: 201 })

  } catch (error) {
    console.error('Error saving photo analysis:', error)
    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    )
  }
}

// Helper function to generate photo hash for duplicate detection
async function generatePhotoHash(photoUrl: string): Promise<string> {
  // Simple hash based on URL and timestamp - in production, use actual image hashing
  const encoder = new TextEncoder()
  const data = encoder.encode(photoUrl.substring(0, 100)) // Use first 100 chars
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
}

// Calculate progress metrics between analyses
function calculateProgressMetrics(analyses: any[]): any {
  if (analyses.length < 2) return null

  const latest = analyses[0]
  const baseline = analyses[analyses.length - 1]

  const improvements = {
    hydration: ((latest.hydration_level - baseline.hydration_level) * 100).toFixed(1),
    brightness: ((latest.brightness_score - baseline.brightness_score) * 100).toFixed(1),
    texture: ((latest.texture_score - baseline.texture_score) * 100).toFixed(1),
    overall_concerns: calculateOverallConcernImprovement(latest, baseline)
  }

  const timespan = {
    days: Math.floor((new Date(latest.created_at).getTime() - new Date(baseline.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    total_analyses: analyses.length
  }

  return {
    improvements,
    timespan,
    trend: determineOverallTrend(improvements)
  }
}

// Calculate overall concern improvement
function calculateOverallConcernImprovement(latest: any, baseline: any): string {
  const concernFields = ['acne_score', 'wrinkles_score', 'dark_spots_score', 'dryness_score', 'oiliness_score', 'enlarged_pores_score', 'redness_score', 'dullness_score']

  const latestTotal = concernFields.reduce((sum, field) => sum + (latest[field] || 0), 0)
  const baselineTotal = concernFields.reduce((sum, field) => sum + (baseline[field] || 0), 0)

  const improvement = ((baselineTotal - latestTotal) / Math.max(baselineTotal, 0.1) * 100).toFixed(1)
  return improvement
}

// Determine overall trend
function determineOverallTrend(improvements: any): 'improving' | 'stable' | 'declining' {
  const values = Object.values(improvements).map(v => parseFloat(v as string))
  const average = values.reduce((sum, val) => sum + val, 0) / values.length

  if (average > 5) return 'improving'
  if (average < -5) return 'declining'
  return 'stable'
}

// Check if analysis shows significant changes
async function hasSignificantChanges(newAnalysis: any, previousAnalysisId: string | null): Promise<boolean> {
  if (!previousAnalysisId) return true

  try {
    const { data: previousAnalysis } = await supabase
      .from('photo_skin_analyses')
      .select('*')
      .eq('id', previousAnalysisId)
      .single()

    if (!previousAnalysis) return true

    // Check for significant changes in key metrics
    const hydrationChange = Math.abs((newAnalysis.hydrationLevel || 0.5) - (previousAnalysis.hydration_level || 0.5))
    const brightnessChange = Math.abs((newAnalysis.brightnessScore || 0.5) - (previousAnalysis.brightness_score || 0.5))
    const skinTypeChange = newAnalysis.skinType !== previousAnalysis.detected_skin_type

    return hydrationChange > 0.1 || brightnessChange > 0.1 || skinTypeChange

  } catch (error) {
    console.error('Error checking for significant changes:', error)
    return true // Default to true if we can't determine
  }
}

// Update user profile based on latest analysis
async function updateUserProfileFromAnalysis(userId: string, analysisData: any): Promise<void> {
  try {
    const updates: any = {}

    // Update skin type if detected with high confidence
    if (analysisData.aiConfidence > 0.8 && analysisData.skinType) {
      updates.skin_type = analysisData.skinType
    }

    // Update skin tone
    if (analysisData.skinTone) {
      updates.skin_tone = analysisData.skinTone
    }

    // Update skin concerns based on detected issues
    if (analysisData.concerns && analysisData.concerns.length > 0) {
      updates.skin_concerns = analysisData.concerns
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
    }

  } catch (error) {
    console.error('Error updating user profile from analysis:', error)
  }
}