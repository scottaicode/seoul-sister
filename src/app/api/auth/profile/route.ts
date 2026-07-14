import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { skinProfileSchema, attributionSchema } from '@/lib/utils/validation'
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

    // First-touch attribution (Jul 13 2026). Sent as its OWN body field, not
    // through skinProfileSchema — that schema is strict and would strip unknown
    // keys, which is exactly how a capture like this silently becomes a no-op.
    // Validated separately, and every field is optional: a signup must never
    // fail because attribution was missing or malformed.
    const attribution = attributionSchema.safeParse(body.attribution)

    // FIRST-TOUCH IS IMMUTABLE. Only stamp attribution when the profile does not
    // already carry it. The upsert below runs on every profile save (including
    // later edits), so without this guard a returning user who arrives direct
    // would overwrite Bailey's bio-link credit with "direct" — silently deleting
    // the signal this whole change exists to capture.
    let attributionFields = {}
    if (attribution.success && attribution.data) {
      const { data: existing } = await supabase
        .from('ss_user_profiles')
        .select('attribution_locked_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing?.attribution_locked_at) {
        attributionFields = {
          utm_source: attribution.data.utm_source ?? null,
          utm_medium: attribution.data.utm_medium ?? null,
          utm_campaign: attribution.data.utm_campaign ?? null,
          utm_content: attribution.data.utm_content ?? null,
          referrer: attribution.data.referrer ?? null,
          landing_path: attribution.data.landing_path ?? null,
          first_seen_at: attribution.data.first_seen_at ?? null,
          attribution_locked_at: new Date().toISOString(),
        }
      }
    }

    const { data, error } = await supabase
      .from('ss_user_profiles')
      .upsert({
        user_id: user.id,
        ...validated,
        ...attributionFields,
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
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new AppError(error.message, 500)
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    return handleApiError(error)
  }
}
