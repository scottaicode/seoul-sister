import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const reportSchema = z.object({
  product_id: z.string().uuid().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  image_urls: z.array(z.string()).default([]),
  seller_name: z.string().optional(),
  purchase_platform: z.string().optional(),
  purchase_url: z.string().url().optional().or(z.literal('')),
  brand: z.string().optional(),
  batch_code: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = reportSchema.parse(body)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Require authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new AppError('Invalid authentication', 401)
    }

    const { data: report, error: insertError } = await supabase
      .from('ss_counterfeit_reports')
      .insert({
        user_id: user.id,
        product_id: validated.product_id || null,
        description: validated.description,
        image_urls: validated.image_urls,
        seller_name: validated.seller_name || null,
        purchase_platform: validated.purchase_platform || null,
        purchase_url: validated.purchase_url || null,
        brand: validated.brand || null,
        batch_code: validated.batch_code || null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      throw new AppError('Failed to submit report', 500)
    }

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Require authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new AppError('Invalid authentication', 401)
    }

    const { data: reports, error } = await supabase
      .from('ss_counterfeit_reports')
      .select('*, product:ss_products(id, name_en, brand_en, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new AppError('Failed to fetch reports', 500)
    }

    return NextResponse.json({ success: true, reports })
  } catch (error) {
    return handleApiError(error)
  }
}
