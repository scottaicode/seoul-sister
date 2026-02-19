import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { enrichScanResult } from '@/lib/scanning/enrich-scan'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Soft auth — enrichment works for anonymous users too (minus personalization)
    let userId: string | null = null
    let skinType: string | undefined
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
        const { data: profile } = await supabase
          .from('ss_user_profiles')
          .select('skin_type')
          .eq('user_id', user.id)
          .single()
        skinType = profile?.skin_type || undefined
      }
    }

    // Fetch product brand for counterfeit + pricing queries
    const { data: product, error: productError } = await supabase
      .from('ss_products')
      .select('brand_en')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch ingredient names for personalization matching
    const { data: productIngredients } = await supabase
      .from('ss_product_ingredients')
      .select('ingredient:ss_ingredients(name_en, name_inci)')
      .eq('product_id', id)

    const ingredientNames = (productIngredients || [])
      .map((pi: Record<string, unknown>) => {
        const ing = pi.ingredient as { name_en: string | null; name_inci: string } | null
        return ing?.name_en || ing?.name_inci || ''
      })
      .filter(Boolean)

    const enrichment = await enrichScanResult(
      supabase,
      userId || '',
      id,
      product.brand_en || '',
      ingredientNames,
      skinType
    )

    return NextResponse.json(enrichment)
  } catch (error) {
    return handleApiError(error)
  }
}
