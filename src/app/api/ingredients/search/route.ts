import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { sanitizeSearchTerm } from '@/lib/utils/sanitize-search'
import { excludePollutedIngredientRows } from '@/lib/pipeline/ingredient-parser'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('q') || searchParams.get('query') || ''
    const query = raw.replace(/[%_\\]/g, '').trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ ingredients: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Pollution guard: this is the route the /ingredients page search box
    // actually calls, and it serves inactive rows too — without the guard,
    // unsplit INCI dump rows (2,614 exist, deactivated) leak into results for
    // any term with fewer than 20 clean active matches.
    const dbQuery = excludePollutedIngredientRows(
      supabase
        .from('ss_ingredients')
        .select('id, name_inci, name_en, function, is_active, is_fragrance, comedogenic_rating, safety_rating')
        .or(`name_inci.ilike.%${sanitizeSearchTerm(query)}%,name_en.ilike.%${sanitizeSearchTerm(query)}%`)
    )
      .order('is_active', { ascending: false })
      .order('name_en', { ascending: true })
      .limit(20)

    const { data, error } = await dbQuery

    if (error) throw error

    return NextResponse.json({ ingredients: data ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
