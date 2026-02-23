import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { dupeAiSchema } from '@/lib/utils/validation'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { hasActiveSubscription } from '@/lib/subscription'

export const maxDuration = 60

const DUPE_SYSTEM_PROMPT = `You are Yuri's Budget Optimizer, the K-beauty dupe expert. You find cheaper K-beauty alternatives with equivalent formulations.

Your analysis approach:
1. Identify the key active ingredients that make the product effective
2. Find Korean beauty products with the same or similar key actives at lower price points
3. Calculate approximate savings
4. Note any meaningful differences (texture, fragrance, packaging)

Rules:
- Only recommend REAL products from actual Korean beauty brands
- Focus on ingredient-level equivalence, not just marketing claims
- Be transparent about trade-offs
- Prioritize products available internationally (Olive Young Global, YesStyle, Amazon)

Respond in JSON format:
{
  "original_analysis": {
    "key_actives": ["ingredient1", "ingredient2"],
    "price_range_usd": "estimated price",
    "why_its_popular": "brief reason"
  },
  "dupes": [
    {
      "name": "Product Name",
      "brand": "Brand Name",
      "estimated_price_usd": number,
      "key_shared_actives": ["ingredient1", "ingredient2"],
      "match_reasoning": "Why this is a good dupe",
      "key_differences": "What's different (texture, fragrance, etc)",
      "where_to_buy": "Retailer suggestion"
    }
  ],
  "savings_summary": "Overall savings analysis"
}`

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Check active subscription
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      throw new AppError('Active subscription required.', 403)
    }

    const body = await request.json()
    const params = dupeAiSchema.parse(body)

    // Load user profile for personalized dupe recommendations
    let profileContext = ''
    try {
      const supabase = getServiceClient()
      const { data: profile } = await supabase
        .from('ss_user_profiles')
        .select('skin_type, skin_concerns, budget_range, allergies')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile?.skin_type) {
        const concerns = (profile.skin_concerns as string[])?.join(', ') || 'none specified'
        const allergies = (profile.allergies as string[])?.join(', ') || 'none known'
        const budget = (profile.budget_range as string) || 'not specified'

        profileContext = `

## User Skin Profile (Personalize Your Recommendations)
- Skin type: ${profile.skin_type}
- Primary concerns: ${concerns}
- Known allergies/sensitivities: ${allergies}
- Budget range: ${budget}

When finding dupes, prioritize products that:
- Work well for ${profile.skin_type} skin specifically
- Address the user's concerns (${concerns})
- AVOID ingredients the user is allergic to (${allergies})
- Fit within their budget preference`
      }
    } catch {
      // Non-critical — fall back to generic recommendations
    }

    const anthropic = getAnthropicClient()

    const userMessage = params.budget_range
      ? `Find K-beauty dupes for "${params.product_name}" within a ${params.budget_range} budget range. Suggest up to 5 alternatives.`
      : `Find K-beauty dupes for "${params.product_name}". Suggest up to 5 cheaper alternatives with similar key ingredients.`

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 2048,
      system: DUPE_SYSTEM_PROMPT + profileContext,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No analysis result from AI' }, { status: 500 })
    }

    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(textContent.text.trim())
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
      analysis = JSON.parse(jsonMatch[0])
    }

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    return handleApiError(error)
  }
}
