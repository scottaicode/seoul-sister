import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { handleApiError } from '@/lib/utils/error-handler'

export const maxDuration = 60

const generateSchema = z.object({
  routine_type: z.enum(['am', 'pm']),
  concerns: z.array(z.string()).optional(),
  budget_range: z.enum(['budget', 'mid', 'premium', 'luxury']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { routine_type, concerns, budget_range } = generateSchema.parse(body)

    // Get user's skin profile
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type, skin_concerns, allergies, climate, age_range, budget_range, experience_level')
      .eq('user_id', user.id)
      .single()

    // Get available products from our database
    const { data: products } = await supabase
      .from('ss_products')
      .select('id, name_en, brand_en, category, price_usd, rating_avg, description_en')
      .eq('is_verified', true)
      .order('rating_avg', { ascending: false })
      .limit(100)

    // Get user's existing routines to avoid conflicts
    const { data: existingRoutines } = await supabase
      .from('ss_user_routines')
      .select(`
        routine_type,
        ss_routine_products (
          product:product_id (name_en, brand_en, category)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Get known ingredient conflicts
    const { data: conflicts } = await supabase
      .from('ss_ingredient_conflicts')
      .select(`
        severity, description,
        ingredient_a:ingredient_a_id (name_inci),
        ingredient_b:ingredient_b_id (name_inci)
      `)

    const skinInfo = profile
      ? `Skin type: ${profile.skin_type}
Concerns: ${(concerns ?? profile.skin_concerns ?? []).join(', ')}
Allergies: ${(profile.allergies ?? []).join(', ') || 'None reported'}
Climate: ${profile.climate ?? 'Unknown'}
Age: ${profile.age_range ?? 'Unknown'}
Budget: ${budget_range ?? profile.budget_range ?? 'mid'}
Experience: ${profile.experience_level ?? 'beginner'}`
      : `No skin profile available. Recommend a balanced routine for combination skin.
Budget: ${budget_range ?? 'mid'}`

    const existingRoutineInfo = existingRoutines?.length
      ? existingRoutines
          .map((r) => {
            const routineProducts = (r.ss_routine_products ?? []) as Array<Record<string, unknown>>
            const prods = routineProducts
              .map((rp) => {
                const product = rp.product as { name_en: string; brand_en: string } | null
                return product ? `${product.name_en} (${product.brand_en})` : ''
              })
              .filter(Boolean)
            return `${r.routine_type.toUpperCase()}: ${prods.join(', ') || 'Empty'}`
          })
          .join('\n')
      : 'No existing routines.'

    const productCatalog = (products ?? [])
      .map((p) => `- ${p.name_en} by ${p.brand_en} [${p.category}] $${p.price_usd ?? '?'} (${p.rating_avg ?? '?'}/5) ID:${p.id}`)
      .join('\n')

    const conflictInfo = (conflicts ?? [])
      .map((c) => {
        const a = c.ingredient_a as unknown as { name_inci: string } | null
        const b = c.ingredient_b as unknown as { name_inci: string } | null
        return `- ${a?.name_inci ?? '?'} + ${b?.name_inci ?? '?'} (${c.severity}): ${c.description}`
      })
      .join('\n')

    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 2000,
      system: `You are Yuri's Routine Architect -- 20+ years of Korean skincare routine design. You build personalized regimens using ONLY products from the Seoul Sister database.

RULES:
1. Only recommend products from the provided catalog (use exact product IDs).
2. Follow Korean layering order: cleanser -> toner -> essence -> serum/ampoule -> eye cream -> moisturizer -> sunscreen (AM) / sleeping mask (PM).
3. Flag any ingredient conflicts between recommended products.
4. The "core 4" for anyone: gentle cleanser + moisturizer + SPF 50+ PA++++ + one targeted active.
5. A simpler routine done consistently beats a complex one abandoned after 2 weeks.
6. For beginners, recommend 4-5 products max. For advanced, up to 7-8.
7. Include wait times where needed (vitamin C: 15 min, AHA/BHA: 20 min).
8. Respect budget constraints.

RESPOND WITH ONLY VALID JSON matching this structure:
{
  "routine_name": "string",
  "steps": [
    {
      "step_order": 1,
      "product_id": "uuid from catalog",
      "product_name": "name for display",
      "brand": "brand name",
      "category": "product category",
      "frequency": "daily" | "every_other_day" | "twice_week" | "weekly",
      "wait_minutes_after": 0,
      "notes": "why this product and how to use it"
    }
  ],
  "conflicts": [
    {
      "product_a": "name",
      "product_b": "name",
      "severity": "low"|"medium"|"high"|"critical",
      "description": "what the conflict is",
      "recommendation": "how to handle it"
    }
  ],
  "rationale": "2-3 sentence explanation of why this routine works for this person",
  "skin_cycling_note": "if PM routine, include skin cycling suggestion or null"
}`,
      messages: [
        {
          role: 'user',
          content: `Build a ${routine_type.toUpperCase()} routine for this person:

${skinInfo}

EXISTING ROUTINES:
${existingRoutineInfo}

KNOWN INGREDIENT CONFLICTS:
${conflictInfo || 'None in database'}

PRODUCT CATALOG (choose ONLY from these):
${productCatalog}`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI routine response')
    }

    const generatedRoutine = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      routine_type,
      generated: generatedRoutine,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
