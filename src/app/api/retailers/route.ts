import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')
    const sortBy = searchParams.get('sort') || 'trust_score'

    let query = supabase
      .from('ss_retailers')
      .select('*')

    if (brand) {
      query = query.contains('authorized_brands', [brand])
    }

    if (sortBy === 'trust_score') {
      query = query.order('trust_score', { ascending: false })
    } else if (sortBy === 'name') {
      query = query.order('name')
    }

    const { data: retailers, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      retailers: retailers || [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
