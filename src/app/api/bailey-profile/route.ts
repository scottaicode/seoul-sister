import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BaileyUserProfile } from '@/types/bailey-profile'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const profile: Partial<BaileyUserProfile> = await request.json()

    // Get or create user (for now using WhatsApp number or email)
    const userId = profile.id || `temp_${Date.now()}`

    // Prepare the enhanced profile data
    const enhancedProfileData = {
      whatsapp_number: profile.email || `user_${Date.now()}@seoul-sister.com`,
      age: profile.age,
      birth_date: profile.birthDate,
      location_city: profile.location?.city,
      location_state: profile.location?.state,
      location_country: profile.location?.country || 'US',
      climate_type: profile.location?.climate,
      ethnicity: profile.ethnicity,
      lifestyle_factors: profile.lifestyle || {},
      current_medications: profile.medical?.currentMedications || [],
      medical_conditions: profile.medical?.medicalConditions || [],
      skincare_goals: profile.goals?.secondary || [],
      routine_commitment_level: profile.goals?.commitment,
      budget_range: profile.preferences?.budgetRange,

      // Skin profile
      current_skin_type: profile.skin?.type,
      skin_concerns: profile.skin?.concerns || [],
      preferred_categories: profile.preferences?.texturePreferences || [],

      // Store full profile as JSON for flexibility
      ai_analysis: {
        fullProfile: profile,
        createdAt: new Date().toISOString(),
        version: '1.0-bailey'
      }
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', enhancedProfileData.whatsapp_number)
      .single()

    let result
    if (existingProfile) {
      // Update existing profile
      result = await supabase
        .from('user_skin_profiles')
        .update(enhancedProfileData)
        .eq('whatsapp_number', enhancedProfileData.whatsapp_number)
        .select()
        .single()
    } else {
      // Create new profile
      result = await supabase
        .from('user_skin_profiles')
        .insert(enhancedProfileData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving Bailey profile:', result.error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    // Generate initial recommendations based on Bailey's comprehensive profile
    const recommendations = await generateBaileyRecommendations(profile, result.data)

    return NextResponse.json({
      success: true,
      profile: result.data,
      recommendations,
      message: 'Your personalized skin journey begins now!'
    })

  } catch (error) {
    console.error('Error in Bailey profile creation:', error)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}

async function generateBaileyRecommendations(
  profile: Partial<BaileyUserProfile>,
  savedProfile: any
) {
  // Bailey's intelligent recommendation logic
  const recommendations = {
    routineType: determineRoutineType(profile),
    priorityProducts: [] as string[],
    avoidProducts: [] as string[],
    specialConsiderations: [] as any[],
    introductionPlan: null as any
  }

  // Determine routine complexity based on Bailey's factors
  if (profile.goals?.commitment === 'minimal') {
    recommendations.routineType = 'essential-3-step'
    recommendations.priorityProducts = ['gentle-cleanser', 'moisturizer', 'sunscreen']
  } else if (profile.goals?.commitment === 'moderate') {
    recommendations.routineType = 'balanced-5-step'
    recommendations.priorityProducts = ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']
  } else {
    recommendations.routineType = 'comprehensive-7-step'
    recommendations.priorityProducts = ['oil-cleanser', 'water-cleanser', 'toner', 'essence', 'serum', 'moisturizer', 'sunscreen']
  }

  // Climate-specific recommendations (Bailey's insight)
  if (profile.location?.climate === 'dry' || profile.location?.humidity === 'low') {
    (recommendations.specialConsiderations as any[]).push({
      type: 'hydration-boost',
      reason: 'Your dry climate requires extra hydration',
      suggestions: ['Add hyaluronic acid serum', 'Use heavier night cream', 'Consider humidifier']
    })
  }

  if (profile.location?.climate === 'tropical' || profile.location?.humidity === 'high') {
    (recommendations.specialConsiderations as any[]).push({
      type: 'humidity-control',
      reason: 'High humidity requires lighter formulations',
      suggestions: ['Gel-based moisturizers', 'Oil-free sunscreen', 'Clay masks weekly']
    })
  }

  // Age-specific recommendations (Bailey's wisdom)
  const getAgeNumber = (age: string | number): number => {
    if (typeof age === 'number') return age
    if (typeof age === 'string') {
      if (age === '13-17') return 15
      if (age === '18-24') return 21
      if (age === '25-34') return 29
      if (age === '35-44') return 39
      if (age === '45-54') return 49
      if (age === '55-64') return 59
      if (age === '65+') return 70
    }
    return 25 // default
  }

  const ageNum = profile.age ? getAgeNumber(profile.age) : 25
  if (ageNum < 25) {
    recommendations.specialConsiderations.push({
      type: 'prevention-focus',
      reason: 'Focus on prevention and establishing good habits',
      suggestions: ['Sunscreen daily', 'Gentle retinol introduction', 'Antioxidant serums']
    })
  } else if (ageNum >= 35) {
    recommendations.specialConsiderations.push({
      type: 'anti-aging-focus',
      reason: 'Target existing concerns while preventing further damage',
      suggestions: ['Retinol/retinoid treatment', 'Peptide serums', 'Rich night creams']
    })
  }

  // Medical considerations (Bailey's safety first)
  if (profile.medical?.currentMedications?.some(med =>
    med.toLowerCase().includes('accutane') || med.toLowerCase().includes('isotretinoin')
  )) {
    recommendations.avoidProducts = ['retinol', 'exfoliating-acids', 'harsh-cleansers']
    recommendations.specialConsiderations.push({
      type: 'accutane-protocol',
      reason: 'Your medication requires gentle, hydrating products only',
      suggestions: ['Extra gentle cleanser', 'Heavy moisturizer', 'Healing balm for lips']
    })
  }

  // Lifestyle adjustments (Bailey's holistic approach)
  if (profile.lifestyle?.smokingStatus === 'regular') {
    recommendations.specialConsiderations.push({
      type: 'antioxidant-boost',
      reason: 'Smoking accelerates aging and reduces oxygen to skin',
      suggestions: ['Vitamin C serum', 'Niacinamide treatment', 'Extra hydration']
    })
  }

  if (profile.lifestyle?.waterIntake === 'insufficient') {
    recommendations.specialConsiderations.push({
      type: 'hydration-support',
      reason: 'Low water intake affects skin hydration',
      suggestions: ['Hydrating toner', 'Hyaluronic acid serum', 'Increase water intake to 8 glasses']
    })
  }

  // Create gradual introduction plan (Bailey's wisdom about starting slow)
  if (!savedProfile.has_routine) {
    recommendations.introductionPlan = {
      week1: {
        products: ['gentle-cleanser'],
        morning: ['rinse with water', 'moisturizer', 'sunscreen'],
        evening: ['gentle cleanser', 'moisturizer'],
        notes: 'Start simple to establish habit'
      },
      week2: {
        products: ['add-toner'],
        morning: ['gentle cleanser', 'toner', 'moisturizer', 'sunscreen'],
        evening: ['gentle cleanser', 'toner', 'moisturizer'],
        notes: 'Introduce hydrating toner'
      },
      week3: {
        products: ['add-serum'],
        morning: ['gentle cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen'],
        evening: ['gentle cleanser', 'toner', 'serum', 'moisturizer'],
        notes: 'Add targeted treatment serum'
      },
      week4: {
        products: ['optimize-routine'],
        morning: ['gentle cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen'],
        evening: ['gentle cleanser', 'toner', 'serum', 'moisturizer'],
        notes: 'Evaluate what is working, adjust as needed'
      }
    }
  }

  return recommendations
}

function determineRoutineType(profile: Partial<BaileyUserProfile>): string {
  // Bailey's intelligent routine determination
  const factors = {
    commitment: profile.goals?.commitment || 'moderate',
    time: profile.goals?.commitment === 'minimal' ? 5 : profile.goals?.commitment === 'dedicated' ? 20 : 10,
    complexity: profile.goals?.commitment === 'minimal' ? 'simple' : 'comprehensive'
  }

  if (factors.commitment === 'minimal') {
    return 'essential-only'
  } else if (factors.commitment === 'dedicated' && profile.preferences?.budgetRange !== 'budget') {
    return 'full-korean-routine'
  } else {
    return 'balanced-routine'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const whatsappNumber = searchParams.get('whatsapp_number') || searchParams.get('email')

    if (!whatsappNumber) {
      return NextResponse.json({ error: 'Identifier required' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Reconstruct Bailey's full profile from stored data
    const baileyProfile: Partial<BaileyUserProfile> = {
      age: profile.age,
      ethnicity: profile.ethnicity,
      location: {
        city: profile.location_city,
        state: profile.location_state,
        country: profile.location_country,
        climate: profile.climate_type
      },
      lifestyle: profile.lifestyle_factors,
      medical: {
        currentMedications: profile.current_medications,
        medicalConditions: profile.medical_conditions,
        allergies: []
      },
      skin: {
        type: profile.current_skin_type,
        concerns: profile.skin_concerns,
        tone: 'medium', // Would need to add this field
        sensitivities: [],
        currentCondition: 'good'
      },
      goals: {
        primary: profile.skincare_goals?.[0] || '',
        secondary: profile.skincare_goals || [],
        timeline: '3-months',
        commitment: profile.routine_commitment_level,
        willingToInvest: profile.budget_range !== 'budget'
      },
      preferences: {
        budgetRange: profile.budget_range,
        preferClean: true,
        preferKBeauty: true,
        preferFragranceFree: false,
        preferCrueltyFree: false,
        texturePreferences: profile.preferred_categories || [],
        avoidIngredients: []
      }
    }

    return NextResponse.json({
      profile: baileyProfile,
      rawData: profile
    })

  } catch (error) {
    console.error('Error fetching Bailey profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}