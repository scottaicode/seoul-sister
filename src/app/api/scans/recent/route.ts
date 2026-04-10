import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'

/**
 * GET /api/scans/recent
 *
 * Returns the authenticated user's most recent label scans.
 * Uses service client to bypass RLS safely (auth is enforced via requireAuth).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    const { data, error } = await db
      .from('ss_user_scans')
      .select(`
        id,
        product_id,
        scan_type,
        ingredients_found,
        analysis_result,
        created_at,
        product:ss_products (id, name_en, brand_en, category)
      `)
      .eq('user_id', user.id)
      .eq('scan_type', 'label')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    return NextResponse.json({ scans: data ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
