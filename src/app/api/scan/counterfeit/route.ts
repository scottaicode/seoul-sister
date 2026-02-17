import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeCounterfeit } from '@/lib/counterfeit/analyzer'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.image) {
      throw new AppError('Missing image data', 400)
    }

    // Parse base64 data URL
    const match = body.image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const imageBase64 = match[3]

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Load known counterfeit markers for the specified brand (if any)
    let knownMarkers: string[] = []
    if (body.brand) {
      const { data: markers } = await supabase
        .from('ss_counterfeit_markers')
        .select('description')
        .ilike('brand', `%${body.brand}%`)

      if (markers) {
        knownMarkers = markers.map(m => m.description)
      }
    }

    // Run Claude Vision counterfeit analysis
    const analysis = await analyzeCounterfeit(imageBase64, mediaType, knownMarkers)

    // Try to match against existing products
    let productMatch = null
    if (analysis.brand_detected || analysis.product_detected) {
      const searchTerm = analysis.product_detected || analysis.brand_detected
      const { data } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, image_url')
        .or(`name_en.ilike.%${searchTerm}%,brand_en.ilike.%${searchTerm}%`)
        .limit(1)

      if (data && data.length > 0) {
        productMatch = data[0]
      }
    }

    // Save the scan result if user is authenticated
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)

      if (user) {
        await supabase.from('ss_counterfeit_scans').insert({
          user_id: user.id,
          product_id: productMatch?.id || null,
          image_urls: [body.image.substring(0, 100) + '...'], // Store truncated reference
          brand_detected: analysis.brand_detected,
          product_detected: analysis.product_detected,
          authenticity_score: analysis.authenticity_score,
          red_flags: analysis.red_flags,
          green_flags: analysis.green_flags,
          analysis_summary: analysis.analysis_summary,
          recommendation: analysis.recommendation,
        })
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      product_match: productMatch,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
