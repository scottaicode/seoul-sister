import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { IrritationAnalysis } from '@/types/bailey-profile'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bailey's irritation knowledge base
const IRRITATION_PATTERNS = {
  'product-reaction': {
    signs: ['sudden onset', 'after new product', 'specific area', 'burning', 'stinging'],
    timeline: '24-72 hours after product use',
    treatment: ['discontinue product', 'gentle cleanser only', 'barrier repair cream', 'avoid actives']
  },
  'hormonal': {
    signs: ['cyclical', 'jawline', 'chin', 'deep cysts', 'monthly pattern'],
    timeline: 'Monthly cycle correlation',
    treatment: ['salicylic acid spot treatment', 'maintain routine', 'avoid heavy products']
  },
  'weather': {
    signs: ['seasonal', 'dryness', 'windburn', 'sun exposure', 'humidity change'],
    timeline: 'Weather/season change',
    treatment: ['adjust moisturizer weight', 'add hydrating layers', 'barrier protection']
  },
  'stress': {
    signs: ['sudden breakouts', 'inflammation', 'sensitivity increase', 'life events'],
    timeline: 'Correlates with stress periods',
    treatment: ['gentle routine', 'calming ingredients', 'stress management']
  },
  'diet': {
    signs: ['after specific foods', 'dairy correlation', 'sugar spike', 'inflammatory'],
    timeline: '1-3 days after consumption',
    treatment: ['food diary', 'anti-inflammatory diet', 'probiotics']
  },
  'over-exfoliation': {
    signs: ['shiny skin', 'increased sensitivity', 'redness', 'tightness', 'more breakouts'],
    timeline: 'Gradual over weeks',
    treatment: ['stop all actives', 'barrier repair', 'gentle products only', '2-week recovery']
  }
}

// Treatment recommendations database
const SPOT_TREATMENTS = {
  'acne': [
    { name: 'Salicylic Acid Spot Treatment', reason: 'Penetrates pores to clear blockages', brands: ['COSRX', 'Paula\'s Choice'] },
    { name: 'Benzoyl Peroxide 2.5%', reason: 'Kills acne bacteria', brands: ['Clean & Clear', 'Neutrogena'] },
    { name: 'Sulfur Treatment', reason: 'Dries out blemishes gently', brands: ['Mario Badescu', 'Kate Somerville'] },
    { name: 'Tea Tree Oil (diluted)', reason: 'Natural antibacterial', brands: ['The Body Shop', 'Thursday Plantation'] }
  ],
  'redness': [
    { name: 'Centella Asiatica Cream', reason: 'Soothes and reduces inflammation', brands: ['Purito', 'COSRX'] },
    { name: 'Azelaic Acid 10%', reason: 'Calms redness and inflammation', brands: ['The Ordinary', 'Paula\'s Choice'] },
    { name: 'Green Tea Extract', reason: 'Anti-inflammatory and calming', brands: ['Innisfree', 'COSRX'] },
    { name: 'Niacinamide 5%', reason: 'Reduces inflammation and strengthens barrier', brands: ['The Ordinary', 'Good Molecules'] }
  ],
  'dryness': [
    { name: 'Hyaluronic Acid Serum', reason: 'Intensive hydration', brands: ['Hada Labo', 'The Ordinary'] },
    { name: 'Ceramide Cream', reason: 'Repairs skin barrier', brands: ['CeraVe', 'Illiyoon'] },
    { name: 'Squalane Oil', reason: 'Locks in moisture', brands: ['The Ordinary', 'Biossance'] },
    { name: 'Sleeping Mask', reason: 'Overnight intensive repair', brands: ['Laneige', 'COSRX'] }
  ],
  'sensitivity': [
    { name: 'Calamine Lotion', reason: 'Immediate soothing relief', brands: ['Generic pharmacy'] },
    { name: 'Aloe Vera Gel', reason: 'Cooling and healing', brands: ['Nature Republic', 'Holika Holika'] },
    { name: 'Panthenol Cream', reason: 'Healing and barrier repair', brands: ['La Roche-Posay', 'Bepanthen'] },
    { name: 'Colloidal Oatmeal', reason: 'Anti-itch and soothing', brands: ['Aveeno', 'First Aid Beauty'] }
  ]
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      whatsappNumber,
      photoUrl,
      symptoms,
      startedDate,
      recentChanges,
      currentProducts
    } = await request.json()

    if (!photoUrl) {
      return NextResponse.json({ error: 'Photo is required for analysis' }, { status: 400 })
    }

    // Analyze irritation photo with Claude Vision
    const irritationAnalysis = await analyzeIrritationPhoto(photoUrl, symptoms)

    // Get user's profile and history for context
    const { data: userProfile } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    const { data: recentProducts } = await supabase
      .from('current_routine_products')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .order('started_using', { ascending: false })
      .limit(5)

    // Determine most likely cause
    const causeAnalysis = await determineCause(
      irritationAnalysis,
      symptoms,
      recentChanges,
      recentProducts,
      userProfile,
      startedDate
    )

    // Generate treatment plan
    const treatmentPlan = generateTreatmentPlan(
      irritationAnalysis,
      causeAnalysis,
      userProfile
    )

    // Generate prevention strategies
    const preventionStrategies = generatePreventionStrategies(
      causeAnalysis,
      userProfile
    )

    // Save analysis to database
    const { data: savedAnalysis, error } = await supabase
      .from('irritation_analysis')
      .insert({
        user_id: userId,
        whatsapp_number: whatsappNumber,
        photo_url: photoUrl,
        irritation_type: irritationAnalysis.type,
        severity: irritationAnalysis.severity,
        affected_areas: irritationAnalysis.affectedAreas,
        potential_causes: causeAnalysis,
        started_date: startedDate,
        suspected_product: causeAnalysis.suspectedProduct,
        ai_diagnosis: irritationAnalysis,
        recommended_treatments: treatmentPlan.treatments,
        spot_treatment_suggestions: treatmentPlan.spotTreatments,
        preventative_measures: preventionStrategies,
        should_discontinue_products: treatmentPlan.discontinueProducts
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving irritation analysis:', error)
    }

    // Generate Bailey's caring response
    const baileyResponse = generateBaileyResponse(
      irritationAnalysis,
      causeAnalysis,
      treatmentPlan,
      preventionStrategies
    )

    return NextResponse.json({
      success: true,
      analysis: irritationAnalysis,
      cause: causeAnalysis,
      treatment: treatmentPlan,
      prevention: preventionStrategies,
      baileyAdvice: baileyResponse,
      savedId: savedAnalysis?.id
    })

  } catch (error) {
    console.error('Error analyzing irritation:', error)
    return NextResponse.json({ error: 'Failed to analyze irritation' }, { status: 500 })
  }
}

async function analyzeIrritationPhoto(photoUrl: string, userSymptoms: any) {
  try {
    const imageResponse = await fetch(photoUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2500,
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
              text: `You are Bailey's expert dermatological AI assistant. Analyze this skin irritation photo carefully.

User reported symptoms: ${JSON.stringify(userSymptoms)}

Please provide a detailed JSON analysis:
{
  "type": "redness|bumps|acne|dryness|peeling|burning|itching|hives|mixed",
  "severity": "mild|moderate|severe",
  "pattern": {
    "distribution": "localized|widespread|patchy|linear",
    "description": "detailed pattern description",
    "symmetry": "symmetrical|asymmetrical"
  },
  "affectedAreas": ["specific face/body areas"],
  "characteristics": {
    "texture": "raised|flat|scaly|smooth",
    "color": "red|pink|brown|white",
    "hasFluid": boolean,
    "hasPus": boolean,
    "borders": "defined|undefined"
  },
  "visualIndicators": {
    "isAcne": boolean,
    "isAllergic": boolean,
    "isContact": boolean,
    "isHormonal": boolean,
    "isPurging": boolean,
    "isOverExfoliation": boolean
  },
  "stage": "early|active|healing|chronic",
  "similarTo": ["conditions this resembles"],
  "urgency": "low|medium|high",
  "requiresMedical": boolean,
  "medicalReason": "reason if medical attention needed",
  "confidence": 0.0-1.0
}

Important: Be thorough but remember this is skincare guidance, not medical diagnosis.
If you see signs of serious conditions (infection, severe allergic reaction, etc), flag for medical attention.`
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

    throw new Error('Failed to parse irritation analysis')

  } catch (error) {
    console.error('Error in photo analysis:', error)
    // Return conservative analysis if AI fails
    return {
      type: 'unknown',
      severity: 'moderate',
      pattern: { distribution: 'unknown' },
      affectedAreas: ['visible areas'],
      requiresMedical: false,
      confidence: 0.3
    }
  }
}

async function determineCause(
  irritationAnalysis: any,
  symptoms: any,
  recentChanges: any,
  recentProducts: any,
  userProfile: any,
  startedDate: string
) {
  // Calculate days since irritation started
  const daysSinceStart = Math.floor(
    (Date.now() - new Date(startedDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  const causeScores: Record<string, number> = {
    'product-reaction': 0,
    'hormonal': 0,
    'weather': 0,
    'stress': 0,
    'diet': 0,
    'over-exfoliation': 0
  }

  // Check for new product correlation
  if (recentProducts && recentProducts.length > 0) {
    const newProducts = recentProducts.filter((p: any) => {
      const productDays = Math.floor(
        (Date.now() - new Date(p.started_using).getTime()) / (1000 * 60 * 60 * 24)
      )
      return productDays <= 7
    })

    if (newProducts.length > 0) {
      causeScores['product-reaction'] += 40
    }
  }

  // Check irritation pattern
  if (irritationAnalysis.visualIndicators?.isHormonal) {
    causeScores['hormonal'] += 30
  }

  if (irritationAnalysis.visualIndicators?.isOverExfoliation) {
    causeScores['over-exfoliation'] += 35
  }

  // Check timing
  if (daysSinceStart <= 3) {
    causeScores['product-reaction'] += 20
    causeScores['diet'] += 10
  }

  // Check user-reported factors
  if (recentChanges?.stress) {
    causeScores['stress'] += 25
  }

  if (recentChanges?.weather) {
    causeScores['weather'] += 20
  }

  // Find most likely cause
  const mostLikelyCause = Object.entries(causeScores)
    .sort(([, a], [, b]) => b - a)[0][0]

  // Find suspected product if product reaction
  let suspectedProduct = null
  if (mostLikelyCause === 'product-reaction' && recentProducts) {
    suspectedProduct = recentProducts[0]?.product_name
  }

  return {
    mostLikely: mostLikelyCause,
    confidence: causeScores[mostLikelyCause] / 100,
    explanation: IRRITATION_PATTERNS[mostLikelyCause as keyof typeof IRRITATION_PATTERNS].timeline,
    suspectedProduct,
    allScores: causeScores
  }
}

function generateTreatmentPlan(
  irritationAnalysis: any,
  causeAnalysis: any,
  userProfile: any
) {
  const plan = {
    immediate: [] as string[],
    treatments: [] as string[],
    spotTreatments: [] as any[],
    discontinueProducts: [] as string[],
    expectedRecovery: ''
  }

  // Immediate actions based on severity
  if (irritationAnalysis.severity === 'severe') {
    plan.immediate.push('Stop ALL active products immediately')
    plan.immediate.push('Use only gentle cleanser and basic moisturizer')
    plan.immediate.push('Consider seeing a dermatologist if no improvement in 48 hours')
  } else {
    plan.immediate.push('Identify and stop suspected trigger product')
    plan.immediate.push('Simplify routine to basics')
  }

  // Get cause-specific treatment
  const causePattern = IRRITATION_PATTERNS[causeAnalysis.mostLikely as keyof typeof IRRITATION_PATTERNS]
  if (causePattern) {
    plan.treatments.push(...causePattern.treatment)
  }

  // Add spot treatments based on irritation type
  const spotTreatmentCategory =
    irritationAnalysis.type === 'acne' ? 'acne' :
    irritationAnalysis.type === 'redness' ? 'redness' :
    irritationAnalysis.type === 'dryness' ? 'dryness' : 'sensitivity'

  plan.spotTreatments = SPOT_TREATMENTS[spotTreatmentCategory as keyof typeof SPOT_TREATMENTS] || []

  // Products to discontinue
  if (causeAnalysis.mostLikely === 'product-reaction' && causeAnalysis.suspectedProduct) {
    plan.discontinueProducts.push(causeAnalysis.suspectedProduct)
  }

  if (causeAnalysis.mostLikely === 'over-exfoliation') {
    plan.discontinueProducts.push('All exfoliants', 'Retinoids', 'Vitamin C', 'AHA/BHA')
  }

  // Recovery timeline
  plan.expectedRecovery =
    irritationAnalysis.severity === 'mild' ? '3-5 days with proper care' :
    irritationAnalysis.severity === 'moderate' ? '1-2 weeks' :
    '2-3 weeks, consider professional help'

  return plan
}

function generatePreventionStrategies(causeAnalysis: any, userProfile: any) {
  const strategies = [] as string[]

  // Universal prevention
  strategies.push('Always patch test new products for 24-48 hours')
  strategies.push('Introduce one new product at a time')
  strategies.push('Keep a skincare diary to track reactions')

  // Cause-specific prevention
  switch (causeAnalysis.mostLikely) {
    case 'product-reaction':
      strategies.push('Research ingredients before purchasing')
      strategies.push('Start with lower concentrations of actives')
      strategies.push('Check for known allergens in your profile')
      break

    case 'hormonal':
      strategies.push('Track breakouts with menstrual cycle')
      strategies.push('Consider hormone-balancing ingredients (spearmint tea, zinc)')
      strategies.push('Maintain consistent routine throughout the month')
      break

    case 'over-exfoliation':
      strategies.push('Limit exfoliation to 2-3 times per week maximum')
      strategies.push('Never combine multiple exfoliants')
      strategies.push('Watch for warning signs: shininess, increased sensitivity')
      break

    case 'weather':
      strategies.push('Adjust routine seasonally')
      strategies.push('Use heavier moisturizers in winter')
      strategies.push('Always use SPF, even in winter')
      break

    case 'stress':
      strategies.push('Maintain simple routine during stressful periods')
      strategies.push('Focus on calming ingredients (centella, green tea)')
      strategies.push('Practice stress management techniques')
      break

    case 'diet':
      strategies.push('Keep a food diary to identify triggers')
      strategies.push('Consider eliminating common triggers (dairy, high-glycemic foods)')
      strategies.push('Stay hydrated and eat anti-inflammatory foods')
      break
  }

  // User-specific prevention
  if (userProfile?.current_skin_type === 'sensitive') {
    strategies.push('Always choose fragrance-free products')
    strategies.push('Avoid essential oils and botanical extracts')
  }

  return strategies
}

function generateBaileyResponse(
  irritationAnalysis: any,
  causeAnalysis: any,
  treatmentPlan: any,
  preventionStrategies: any
) {
  let response = ''

  // Empathy first
  response += "I understand how frustrating skin irritation can be. Let's get you healed! "

  // Severity-based opening
  if (irritationAnalysis.severity === 'severe') {
    response += "⚠️ This looks quite inflamed. We need to act quickly but gently. "
  } else if (irritationAnalysis.severity === 'mild') {
    response += "✨ Good news - this appears mild and should heal quickly with proper care. "
  }

  // Cause explanation
  response += `Based on my analysis, this appears to be ${causeAnalysis.mostLikely.replace('-', ' ')}. `

  if (causeAnalysis.suspectedProduct) {
    response += `The timing suggests ${causeAnalysis.suspectedProduct} might be the trigger. `
  }

  // Treatment focus
  response += "Your recovery plan: "
  response += treatmentPlan.immediate[0] + ". "

  // Reassurance
  if (irritationAnalysis.visualIndicators?.isPurging) {
    response += "This might be purging, which means your skin is actually improving! "
  }

  response += `With proper care, expect improvement in ${treatmentPlan.expectedRecovery}. `

  // Prevention reminder
  response += "Remember: your skin is resilient and will heal. Be patient and gentle. 💕"

  // Medical disclaimer if needed
  if (irritationAnalysis.requiresMedical) {
    response += ` ⚠️ Important: ${irritationAnalysis.medicalReason}. Please consult a dermatologist.`
  }

  return response
}