import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { requireAuth } from '@/lib/auth'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import type { ShelfScanProduct, ShelfScanCollectionAnalysis, RoutineGradeLevel } from '@/types/database'

export const maxDuration = 60
export const runtime = 'nodejs'

const SHELF_SCAN_SYSTEM_PROMPT = `You are Yuri's Shelf Scan specialist. You analyze photos of skincare product shelves and collections.

Your task:
1. Identify EVERY visible Korean beauty / skincare product in the photo
2. For each product, determine: brand, product name, category, and your confidence level
3. Analyze the collection as a whole

For each product, determine the category from this list:
cleanser, toner, essence, serum, ampoule, moisturizer, sunscreen, mask, eye_care, lip_care, exfoliator, oil, mist, spot_treatment

Respond in JSON format:
{
  "products_identified": [
    {
      "name": "product name in English",
      "brand": "brand name in English",
      "category": "one of the categories above",
      "confidence": 0.0 to 1.0,
      "position_in_image": "brief description like 'front left' or 'back row center'"
    }
  ],
  "collection_analysis": {
    "total_estimated_value": estimated total USD value of all visible products,
    "ingredient_overlap_warnings": ["products that likely overlap significantly in function"],
    "missing_categories": ["categories missing for a complete routine, e.g. 'sunscreen', 'cleanser'"],
    "redundant_products": ["products that are redundant, e.g. 'Two hyaluronic acid serums'"],
    "overall_routine_grade": "A" or "B" or "C" or "D" or "F",
    "grade_rationale": "one sentence explaining the grade",
    "recommendations": ["actionable suggestions to improve the collection"]
  }
}

Grading criteria:
- A: Covers all essential categories (cleanser, toner/essence, serum, moisturizer, sunscreen), good variety, minimal redundancy
- B: Covers most categories, minor gaps or slight redundancy
- C: Missing 1-2 key categories or notable redundancy
- D: Missing several categories or heavy redundancy with no clear routine structure
- F: Very incomplete or entirely redundant with no skincare structure

Be generous but honest in your grading. If you cannot identify a product with confidence, still include it with a lower confidence score and your best guess.`

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const body = await request.json()
    if (!body.image) {
      throw new AppError('Missing image data', 400)
    }

    const match = body.image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const imageBase64 = match[3]

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 4096,
      system: SHELF_SCAN_SYSTEM_PROMPT,
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
              text: 'Analyze this skincare shelf/collection photo. Identify every product and provide a full collection analysis.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    let analysis: { products_identified: ShelfScanProduct[]; collection_analysis: ShelfScanCollectionAnalysis }
    try {
      analysis = JSON.parse(textContent.text.trim())
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      analysis = JSON.parse(jsonMatch[0])
    }

    // Validate grade
    const validGrades: RoutineGradeLevel[] = ['A', 'B', 'C', 'D', 'F']
    if (!validGrades.includes(analysis.collection_analysis?.overall_routine_grade)) {
      analysis.collection_analysis.overall_routine_grade = 'C'
    }

    // Try to match identified products against our database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const matchedProducts: ShelfScanProduct[] = []
    for (const product of analysis.products_identified) {
      try {
        const searchTerm = product.name || product.brand
        if (!searchTerm) {
          matchedProducts.push(product)
          continue
        }

        const { data } = await supabase
          .from('ss_products')
          .select('id, name_en, brand_en, category, price_usd')
          .or(`name_en.ilike.%${searchTerm}%,brand_en.ilike.%${searchTerm}%`)
          .limit(1)

        if (data && data.length > 0) {
          matchedProducts.push({
            ...product,
            matched_product_id: data[0].id,
            name: data[0].name_en || product.name,
            brand: data[0].brand_en || product.brand,
            category: data[0].category || product.category,
          })
        } else {
          matchedProducts.push(product)
        }
      } catch {
        matchedProducts.push(product)
      }
    }

    // Refine estimated value using DB prices where matched
    let refinedValue = 0
    let unmatchedEstimate = 0
    let matchedCount = 0

    for (const product of matchedProducts) {
      if (product.matched_product_id) {
        try {
          const { data: prices } = await supabase
            .from('ss_product_prices')
            .select('price_usd')
            .eq('product_id', product.matched_product_id)
            .order('price_usd', { ascending: true })
            .limit(1)

          if (prices && prices.length > 0) {
            refinedValue += prices[0].price_usd
            matchedCount++
            continue
          }
        } catch {
          // Fall through
        }
      }
      // Estimate per-product from AI total / count
      const productCount = matchedProducts.length || 1
      unmatchedEstimate += (analysis.collection_analysis.total_estimated_value || 0) / productCount
    }

    const totalValue = matchedCount > 0
      ? refinedValue + unmatchedEstimate
      : analysis.collection_analysis.total_estimated_value || 0

    return NextResponse.json({
      success: true,
      products_identified: matchedProducts,
      collection_analysis: {
        ...analysis.collection_analysis,
        total_estimated_value: Math.round(totalValue * 100) / 100,
      },
      products_count: matchedProducts.length,
      matched_count: matchedProducts.filter(p => p.matched_product_id).length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
