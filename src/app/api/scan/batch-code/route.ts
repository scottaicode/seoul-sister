import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { analyzeBatchCode } from '@/lib/counterfeit/analyzer'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const batchCodeSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  batch_code: z.string().min(1, 'Batch code is required'),
  product_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brand, batch_code, product_id } = batchCodeSchema.parse(body)

    const analysis = await analyzeBatchCode(brand, batch_code)

    // Save verification if user is authenticated
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)

      if (user) {
        await supabase.from('ss_batch_code_verifications').insert({
          user_id: user.id,
          product_id: product_id || null,
          brand: analysis.brand,
          batch_code: analysis.batch_code,
          decoded_info: {
            manufacture_date: analysis.manufacture_date,
            expiry_date: analysis.expiry_date,
            factory_location: analysis.factory_location,
            product_line: analysis.product_line,
            is_expired: analysis.is_expired,
            age_months: analysis.age_months,
          },
          is_valid: analysis.is_valid,
          confidence: analysis.confidence,
          notes: analysis.notes,
        })
      }
    }

    return NextResponse.json({
      success: true,
      verification: analysis,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
