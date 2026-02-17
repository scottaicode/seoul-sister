import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { reviewSchema, reviewFilterSchema } from '@/lib/utils/validation'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = reviewFilterSchema.parse({
      product_id: searchParams.get('product_id') || undefined,
      skin_type: searchParams.get('skin_type') || undefined,
      fitzpatrick_scale: searchParams.get('fitzpatrick_scale')
        ? Number(searchParams.get('fitzpatrick_scale'))
        : undefined,
      age_range: searchParams.get('age_range') || undefined,
      concern: searchParams.get('concern') || undefined,
      reaction: searchParams.get('reaction') as 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out' | undefined || undefined,
      sort_by: (searchParams.get('sort_by') as 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    let query = supabase
      .from('ss_reviews')
      .select('*, product:ss_products(id, name_en, brand_en, image_url, category)', { count: 'exact' })

    if (params.product_id) {
      query = query.eq('product_id', params.product_id)
    }
    if (params.skin_type) {
      query = query.eq('skin_type', params.skin_type)
    }
    if (params.fitzpatrick_scale) {
      query = query.eq('fitzpatrick_scale', params.fitzpatrick_scale)
    }
    if (params.age_range) {
      query = query.eq('age_range', params.age_range)
    }
    if (params.concern) {
      query = query.contains('skin_concerns', [params.concern])
    }
    if (params.reaction) {
      query = query.eq('reaction', params.reaction)
    }

    switch (params.sort_by) {
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'highest_rated':
        query = query.order('rating', { ascending: false })
        break
      case 'lowest_rated':
        query = query.order('rating', { ascending: true })
        break
      case 'most_helpful':
        query = query.order('helpful_count', { ascending: false })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    const offset = (params.page - 1) * params.limit
    query = query.range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      reviews: data ?? [],
      total: count ?? 0,
      page: params.page,
      total_pages: Math.ceil((count ?? 0) / params.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new AppError('Invalid authentication', 401)
    }

    const body = await request.json()
    const validated = reviewSchema.parse(body)

    // Get user's skin profile for auto-filling review metadata
    const { data: profile } = await supabase
      .from('ss_user_profiles')
      .select('skin_type, skin_concerns, fitzpatrick_scale, age_range')
      .eq('user_id', user.id)
      .single()

    const { data: review, error } = await supabase
      .from('ss_reviews')
      .insert({
        user_id: user.id,
        product_id: validated.product_id,
        rating: validated.rating,
        title: validated.title,
        body: validated.body,
        reaction: validated.reaction ?? null,
        would_repurchase: validated.would_repurchase ?? null,
        usage_duration: validated.usage_duration ?? null,
        skin_type: profile?.skin_type ?? null,
        skin_concerns: profile?.skin_concerns ?? [],
        fitzpatrick_scale: profile?.fitzpatrick_scale ?? null,
        age_range: profile?.age_range ?? null,
      })
      .select()
      .single()

    if (error) throw error

    // Award community points for review
    await supabase.from('ss_community_points').insert({
      user_id: user.id,
      action: 'review_submitted',
      points: 10,
      reference_id: review.id,
    })

    // Award bonus points for sharing reaction
    if (validated.reaction === 'holy_grail') {
      await supabase.from('ss_community_points').insert({
        user_id: user.id,
        action: 'holy_grail_shared',
        points: 5,
        reference_id: review.id,
      })
    } else if (validated.reaction === 'broke_me_out') {
      await supabase.from('ss_community_points').insert({
        user_id: user.id,
        action: 'broke_me_out_shared',
        points: 5,
        reference_id: review.id,
      })
    }

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
