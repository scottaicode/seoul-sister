import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { requireAuth } from '@/lib/auth'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const SCAN_SYSTEM_PROMPT = `You are Yuri's Korean Label Decoder specialist. You analyze Korean beauty product labels photographed by users.

Your task:
1. Read ALL text in the image (Korean and English)
2. Identify the product name, brand, and category
3. Extract the full ingredient list (INCI names)
4. For each ingredient, provide:
   - INCI name
   - English common name
   - Korean name (if visible)
   - Primary function (e.g., humectant, emollient, active, preservative)
   - Safety rating (1-5, where 5 is safest)
   - Comedogenic rating (0-5, where 0 is non-comedogenic)
   - Any common concerns (e.g., "may cause irritation for sensitive skin")

Respond in JSON format:
{
  "product_name_en": "string",
  "product_name_ko": "string or null",
  "brand": "string",
  "category": "string",
  "extracted_text": "full text from label",
  "ingredients": [
    {
      "name_inci": "string",
      "name_en": "string",
      "name_ko": "string or null",
      "function": "string",
      "safety_rating": number,
      "comedogenic_rating": number,
      "concerns": ["string"]
    }
  ],
  "overall_safety_score": number (1-100),
  "key_highlights": ["string"],
  "warnings": ["string"]
}`

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const contentType = request.headers.get('content-type') || ''

    let imageBase64: string
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    if (contentType.includes('application/json')) {
      const body = await request.json()
      if (!body.image) {
        throw new AppError('Missing image data', 400)
      }
      // Expect base64 data URL: "data:image/jpeg;base64,..."
      const match = body.image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
      if (!match) {
        throw new AppError('Invalid image format. Expected base64 data URL.', 400)
      }
      mediaType = match[1] as typeof mediaType
      imageBase64 = match[3]
    } else {
      throw new AppError('Content-Type must be application/json', 400)
    }

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 4096,
      system: SCAN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyze this Korean beauty product label. Extract all ingredients and provide safety analysis.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    // Parse the JSON from Claude's response
    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(textContent.text.trim())
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      analysis = JSON.parse(jsonMatch[0])
    }

    // Try to match against existing products in our database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let productMatch = null
    if (analysis.product_name_en || analysis.brand) {
      const searchTerm = analysis.product_name_en || analysis.brand
      const { data } = await supabase
        .from('ss_products')
        .select('*')
        .or(`name_en.ilike.%${searchTerm}%,name_ko.ilike.%${searchTerm}%`)
        .limit(1)

      if (data && data.length > 0) {
        productMatch = data[0]
      }
    }

    // Check for ingredient conflicts against user's current routine
    let conflicts: Array<{
      scanned_ingredient: string
      routine_ingredient: string
      severity: string
      description: string
      recommendation: string
    }> = []

    try {
      const ingredients = analysis.ingredients as Array<{ name_inci: string }> | undefined
      if (ingredients?.length) {
        // Look up scanned INCI names in our ingredient database
        const inciNames = ingredients.map((i: { name_inci: string }) => i.name_inci)
        const { data: matchedIngredients } = await supabase
          .from('ss_ingredients')
          .select('id, name_inci')
          .in('name_inci', inciNames)

        if (matchedIngredients?.length) {
          const scannedIds = matchedIngredients.map((i) => i.id)

          // Get ingredients from the user's active routine
          const { data: routineIngredients } = await supabase
            .from('ss_user_routines')
            .select(`
              id,
              ss_routine_products (
                ss_product_ingredients:product_id (
                  ingredient_id
                )
              )
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)

          const routineIngredientIds = new Set<string>()
          if (routineIngredients) {
            for (const routine of routineIngredients) {
              const products = routine.ss_routine_products as Array<{
                ss_product_ingredients: Array<{ ingredient_id: string }>
              }> | null
              if (products) {
                for (const product of products) {
                  const pIngredients = product.ss_product_ingredients
                  if (Array.isArray(pIngredients)) {
                    for (const pi of pIngredients) {
                      routineIngredientIds.add(pi.ingredient_id)
                    }
                  }
                }
              }
            }
          }

          if (routineIngredientIds.size > 0) {
            const routineIds = Array.from(routineIngredientIds)

            // Check conflicts in both directions
            const { data: foundConflicts } = await supabase
              .from('ss_ingredient_conflicts')
              .select('ingredient_a_id, ingredient_b_id, severity, description, recommendation')
              .or(
                scannedIds.map((sid) =>
                  routineIds.map((rid) =>
                    `and(ingredient_a_id.eq.${sid},ingredient_b_id.eq.${rid}),and(ingredient_a_id.eq.${rid},ingredient_b_id.eq.${sid})`
                  ).join(',')
                ).join(',')
              )

            if (foundConflicts?.length) {
              // Map ingredient IDs back to names
              const allIds = new Set([
                ...scannedIds,
                ...routineIds,
              ])
              const { data: allNames } = await supabase
                .from('ss_ingredients')
                .select('id, name_inci')
                .in('id', Array.from(allIds))

              const nameMap = new Map(allNames?.map((n) => [n.id, n.name_inci]) ?? [])

              conflicts = foundConflicts.map((c) => ({
                scanned_ingredient: nameMap.get(c.ingredient_a_id) ?? nameMap.get(c.ingredient_b_id) ?? 'Unknown',
                routine_ingredient: nameMap.get(c.ingredient_b_id) ?? nameMap.get(c.ingredient_a_id) ?? 'Unknown',
                severity: c.severity,
                description: c.description,
                recommendation: c.recommendation,
              }))
            }
          }
        }
      }
    } catch {
      // Conflict detection is non-critical — don't fail the scan
    }

    return NextResponse.json({
      success: true,
      analysis,
      product_match: productMatch,
      conflicts,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
