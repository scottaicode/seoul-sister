import { NextRequest, NextResponse } from 'next/server'
import type { UserProfile } from '@/types/user'
import type { Product } from '@/hooks/useProducts'

export async function POST(request: NextRequest) {
  try {
    const { user_profile, routine_type, complexity_level, available_products } = await request.json()

    if (!user_profile || !routine_type) {
      return NextResponse.json(
        { error: 'User profile and routine type are required' },
        { status: 400 }
      )
    }

    // Generate AI-powered routine
    const generatedRoutine = await generateAIRoutine(
      user_profile,
      routine_type,
      complexity_level,
      available_products
    )

    return NextResponse.json({
      routine: generatedRoutine,
      generation_metadata: {
        model: 'claude-opus-4.1',
        confidence: 0.9,
        generation_time: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error generating AI routine:', error)
    return NextResponse.json(
      { error: 'Failed to generate routine' },
      { status: 500 }
    )
  }
}

async function generateAIRoutine(
  userProfile: UserProfile,
  routineType: string,
  complexityLevel: string,
  availableProducts: Product[]
): Promise<any> {

  // Build context for AI generation
  const prompt = buildRoutinePrompt(userProfile, routineType, complexityLevel, availableProducts)

  try {
    // Call Claude API for routine generation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API failed: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.content[0]?.text

    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    // Parse AI response into routine structure
    const parsedRoutine = parseAIRoutineResponse(aiResponse, userProfile, routineType, complexityLevel)

    return parsedRoutine

  } catch (error) {
    console.error('Error calling Claude API:', error)

    // Fallback to rule-based routine generation
    return generateFallbackRoutine(userProfile, routineType, complexityLevel, availableProducts)
  }
}

function buildRoutinePrompt(
  userProfile: UserProfile,
  routineType: string,
  complexityLevel: string,
  availableProducts: Product[]
): string {
  const concerns = userProfile.skin_concerns?.join(', ') || 'general maintenance'
  const skinType = userProfile.skin_type || 'normal'
  const experience = userProfile.skincare_experience || 'intermediate'

  return `As a Korean skincare expert, create a personalized ${routineType} skincare routine for this user:

USER PROFILE:
- Skin Type: ${skinType}
- Main Concerns: ${concerns}
- Experience Level: ${experience}
- Routine Complexity: ${complexityLevel}
- Time Commitment: ${userProfile.time_commitment || '10-15 minutes'}

AVAILABLE PRODUCTS:
${availableProducts.slice(0, 10).map(p => `- ${p.name_english} by ${p.brand} (${p.category})`).join('\n')}

REQUIREMENTS:
1. Create a ${complexityLevel} routine with appropriate number of steps
2. Focus on addressing user's main concerns: ${concerns}
3. Consider Korean skincare principles (layering, gentle ingredients)
4. Provide specific application instructions for each step
5. Include product recommendations from available products when possible

Please respond in this JSON format:
{
  "name": "Personalized ${routineType.charAt(0).toUpperCase() + routineType.slice(1)} Routine",
  "description": "Brief description of routine goals",
  "estimated_time_minutes": number,
  "primary_goals": ["goal1", "goal2"],
  "steps": [
    {
      "step_order": 1,
      "product_category": "cleanser",
      "custom_product_name": "Specific product name if recommended",
      "application_method": "How to apply",
      "amount_description": "Amount to use",
      "wait_time_seconds": 0,
      "frequency": "daily",
      "instructions": "Detailed instructions",
      "tips": "Helpful tips",
      "rationale": "Why this step is important for this user"
    }
  ]
}

Focus on:
- ${routineType === 'morning' ? 'Protection and preparation for the day' : 'Repair and treatment for overnight'}
- Korean skincare order: cleanser → toner → essence → serum → moisturizer ${routineType === 'morning' ? '→ sunscreen' : ''}
- User's specific needs based on ${skinType} skin and ${concerns} concerns`
}

function parseAIRoutineResponse(aiResponse: string, userProfile: UserProfile, routineType: string, complexityLevel: string): any {
  try {
    // Extract JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and enhance the parsed routine
    return {
      ...parsed,
      routine_type: routineType,
      complexity_level: complexityLevel,
      generated_by_ai: true,
      generation_prompt: 'AI-generated routine based on user profile',
      ai_confidence: 0.9,
      steps: parsed.steps?.map((step: any, index: number) => ({
        id: `ai_step_${index + 1}`,
        step_order: index + 1,
        product_category: step.product_category || 'unknown',
        custom_product_name: step.custom_product_name,
        application_method: step.application_method || 'Apply gently to skin',
        amount_description: step.amount_description || 'Small amount',
        wait_time_seconds: step.wait_time_seconds || 0,
        frequency: step.frequency || 'daily',
        instructions: step.instructions || 'Apply evenly to face',
        tips: step.tips,
        warnings: step.warnings,
        ai_generated: true,
        rationale: step.rationale
      })) || []
    }

  } catch (error) {
    console.error('Error parsing AI response:', error)
    throw new Error('Failed to parse AI routine response')
  }
}

function generateFallbackRoutine(
  userProfile: UserProfile,
  routineType: string,
  complexityLevel: string,
  availableProducts: Product[]
): any {

  const stepCount = {
    'minimal': 4,
    'moderate': 6,
    'extensive': 8
  }[complexityLevel] || 6

  const baseSteps = routineType === 'morning'
    ? ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']
    : ['cleanser', 'toner', 'essence', 'serum', 'moisturizer']

  // Add extra steps for complexity
  if (complexityLevel === 'extensive') {
    if (routineType === 'evening') {
      baseSteps.splice(1, 0, 'oil_cleanser') // Double cleansing
      baseSteps.splice(-1, 0, 'eye_cream')
    } else {
      baseSteps.splice(2, 0, 'essence')
      baseSteps.splice(-1, 0, 'eye_cream')
    }
  }

  const steps = baseSteps.slice(0, stepCount).map((category, index) => ({
    id: `fallback_step_${index + 1}`,
    step_order: index + 1,
    product_category: category,
    application_method: getApplicationMethod(category),
    amount_description: getAmountDescription(category),
    wait_time_seconds: getWaitTime(category),
    frequency: 'daily',
    instructions: getInstructions(category, userProfile.skin_type),
    tips: getTips(category),
    ai_generated: false,
    rationale: getRationale(category, userProfile.skin_concerns)
  }))

  return {
    name: `${routineType.charAt(0).toUpperCase() + routineType.slice(1)} Routine for ${userProfile.skin_type || 'Your'} Skin`,
    description: `A ${complexityLevel} ${routineType} routine targeting ${userProfile.skin_concerns?.join(', ') || 'general skin health'}`,
    routine_type: routineType,
    complexity_level: complexityLevel,
    estimated_time_minutes: Math.ceil(steps.length * 1.5 + 2),
    primary_goals: userProfile.skin_concerns || ['hydration', 'protection'],
    generated_by_ai: false,
    steps
  }
}

// Helper functions for fallback routine generation
function getApplicationMethod(category: string): string {
  const methods: Record<string, string> = {
    'cleanser': 'Gently massage onto damp skin in circular motions',
    'oil_cleanser': 'Massage onto dry skin, then emulsify with water',
    'toner': 'Pat gently with hands or apply with cotton pad',
    'essence': 'Pat gently into skin with palms',
    'serum': 'Apply with gentle pressing motions',
    'moisturizer': 'Smooth evenly across face and neck',
    'sunscreen': 'Apply generously and evenly',
    'eye_cream': 'Gently tap around eye area with ring finger'
  }
  return methods[category] || 'Apply gently to skin'
}

function getAmountDescription(category: string): string {
  const amounts: Record<string, string> = {
    'cleanser': 'Coin-sized amount',
    'oil_cleanser': '2-3 pumps',
    'toner': '2-3 drops or cotton pad amount',
    'essence': '2-3 drops',
    'serum': '2-3 drops',
    'moisturizer': 'Pea-sized amount',
    'sunscreen': 'Generous amount (1/4 teaspoon)',
    'eye_cream': 'Rice grain amount'
  }
  return amounts[category] || 'Small amount'
}

function getWaitTime(category: string): number {
  const waitTimes: Record<string, number> = {
    'serum': 30,
    'essence': 15,
    'sunscreen': 60
  }
  return waitTimes[category] || 0
}

function getInstructions(category: string, skinType?: string): string {
  const baseInstructions: Record<string, string> = {
    'cleanser': 'Wet face with lukewarm water, apply cleanser, massage for 30 seconds, rinse thoroughly',
    'toner': 'Apply to clean skin to balance pH and prep for next steps',
    'essence': 'Apply to slightly damp skin for better absorption',
    'serum': 'Focus on areas of concern, avoid eye area',
    'moisturizer': 'Apply while skin is still slightly damp to lock in hydration',
    'sunscreen': 'Apply 15 minutes before sun exposure, reapply every 2 hours'
  }

  let instruction = baseInstructions[category] || 'Apply evenly to face'

  // Add skin type specific notes
  if (skinType === 'sensitive' && category === 'cleanser') {
    instruction += '. Use gentle, fragrance-free formula'
  } else if (skinType === 'oily' && category === 'moisturizer') {
    instruction += '. Choose lightweight, non-comedogenic formula'
  }

  return instruction
}

function getTips(category: string): string {
  const tips: Record<string, string> = {
    'cleanser': 'Avoid over-cleansing; once in morning, twice in evening if wearing makeup',
    'toner': 'Pat, don\'t rub, to avoid irritation',
    'essence': 'This is the heart of Korean skincare - don\'t skip!',
    'serum': 'Use different serums for different concerns',
    'moisturizer': 'Apply upward motions to help with firmness',
    'sunscreen': 'Most important step for preventing aging and damage'
  }
  return tips[category] || ''
}

function getRationale(category: string, concerns?: string[]): string {
  const basePurpose: Record<string, string> = {
    'cleanser': 'Removes impurities and prepares skin for treatment',
    'toner': 'Balances skin pH and enhances absorption of following products',
    'essence': 'Provides hydration and prepares skin for targeted treatments',
    'serum': 'Delivers concentrated active ingredients for specific concerns',
    'moisturizer': 'Seals in treatments and maintains skin barrier',
    'sunscreen': 'Protects against UV damage and prevents premature aging'
  }

  let rationale = basePurpose[category] || 'Important step for skin health'

  // Add concern-specific rationale
  if (concerns?.includes('acne') && category === 'serum') {
    rationale += '. Look for salicylic acid or niacinamide for acne control'
  } else if (concerns?.includes('aging') && category === 'serum') {
    rationale += '. Consider vitamin C (morning) or retinol (evening) for anti-aging'
  }

  return rationale
}