import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { handleApiError } from '@/lib/utils/error-handler'
import { MAX_INCI_NAME_LENGTH } from '@/lib/pipeline/ingredient-parser'

const ingredientSearchSchema = z.object({
  query: z.string().optional(),
  function: z.string().optional(),
  safety_min: z.number().min(1).max(5).optional(),
  is_active: z.boolean().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(30),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = ingredientSearchSchema.parse({
      query: searchParams.get('query') || undefined,
      function: searchParams.get('function') || undefined,
      safety_min: searchParams.get('safety_min') ? Number(searchParams.get('safety_min')) : undefined,
      is_active: searchParams.get('is_active') === 'true' ? true : searchParams.get('is_active') === 'false' ? false : undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 30,
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let query = supabase.from('ss_ingredients').select('*', { count: 'exact' })

    // Never surface unsplit INCI dumps (rows containing "@" / "[" / "]" or longer
    // than any real INCI name). A parser bug ingested whole multi-shade ingredient
    // lists as single "ingredients" — one is 6,081 chars — and they were showing up
    // as top hits in ingredient search. The parser is fixed, but this guards the
    // read path so no consumer can render a dump even if a bad row slips in again.
    // NOTE: distinct from `is_active`, which means "is an active skincare
    // ingredient" (a solvent like 1,2-Hexanediol is legitimately is_active=false).
    // The length guard uses a 61-underscore LIKE pattern: in SQL, `_` matches
    // exactly one char, so any name longer than 60 chars matches it. This keeps
    // the filter server-side so `count` and pagination stay correct (filtering
    // the fetched page in JS would leave holes and a wrong total).
    const TOO_LONG = '_'.repeat(MAX_INCI_NAME_LENGTH + 1) + '%'
    query = query
      .not('name_inci', 'ilike', '%@%')
      .not('name_inci', 'ilike', '%[%')
      .not('name_inci', 'ilike', '%]%')
      .not('name_inci', 'like', TOO_LONG)

    if (params.query) {
      query = query.or(
        `name_inci.ilike.%${params.query}%,name_en.ilike.%${params.query}%,name_ko.ilike.%${params.query}%`
      )
    }
    if (params.function) {
      query = query.ilike('function', `%${params.function}%`)
    }
    if (params.safety_min !== undefined) {
      query = query.gte('safety_rating', params.safety_min)
    }
    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active)
    }

    query = query.order('name_inci', { ascending: true })

    const offset = (params.page - 1) * params.limit
    query = query.range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      ingredients: data ?? [],
      total: count ?? 0,
      page: params.page,
      total_pages: Math.ceil((count ?? 0) / params.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
