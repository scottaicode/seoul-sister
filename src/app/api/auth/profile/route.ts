import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { skinProfileSchema } from '@/lib/utils/validation'
import { handleApiError, AppError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Unauthorized', 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new AppError('Unauthorized', 401)
    }

    const body = await request.json()
    const validated = skinProfileSchema.parse(body)

    const { data, error } = await supabase
      .from('ss_user_profiles')
      .upsert({
        user_id: user.id,
        ...validated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      throw new AppError(error.message, 500)
    }

    return NextResponse.json({ success: true, profile: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Unauthorized', 401)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new AppError('Unauthorized', 401)
    }

    const { data, error } = await supabase
      .from('ss_user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new AppError(error.message, 500)
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    return handleApiError(error)
  }
}
