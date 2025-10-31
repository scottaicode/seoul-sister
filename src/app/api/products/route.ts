import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit, rateLimitPresets } from '@/lib/rate-limiter'
import { withAuth, authPresets } from '@/lib/auth-middleware'
import { withErrorHandling, DatabaseError } from '@/lib/error-handler'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const GET = withRateLimit(
  withErrorHandling(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')

    let query = supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)
      .order('savings_percentage', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (featured === 'true') {
      query = query.limit(4)
    }

    const { data, error } = await query

    if (error) {
      throw new DatabaseError('fetch products', error)
    }

    return NextResponse.json({ products: data || [] })
  }),
  rateLimitPresets.public
)

export const POST = withAuth(
  withRateLimit(
    withErrorHandling(async (request: NextRequest) => {
      const body = await request.json()

      const { data, error } = await supabase
        .from('products')
        .insert([body])
        .select()
        .single()

      if (error) {
        throw new DatabaseError('create product', error)
      }

      return NextResponse.json({ product: data })
    }),
    rateLimitPresets.api
  ),
  authPresets.admin
)