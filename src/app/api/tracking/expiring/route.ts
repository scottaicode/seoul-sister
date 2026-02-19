import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('ss_user_product_tracking')
      .select(`
        id, user_id, product_id, custom_product_name,
        opened_date, expiry_date, pao_months,
        notes, status, created_at,
        product:product_id (id, name_en, brand_en, category, image_url)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', futureDateStr)
      .gte('expiry_date', todayStr)
      .order('expiry_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ expiring: data ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
