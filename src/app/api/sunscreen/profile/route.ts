import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchWeather } from '@/lib/intelligence/weather-routine'
import { getServiceClient } from '@/lib/supabase'

/**
 * GET /api/sunscreen/profile
 *
 * Returns the authenticated user's skin profile defaults for sunscreen
 * filter auto-population, plus current UV index if location is available.
 * Returns 200 with nulls for unauthenticated users (graceful degradation).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ profile: null, uv: null })
    }

    // Use anon client ONLY for token verification (auth.getUser is allowed on anon)
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ profile: null, uv: null })
    }

    // Profile read via service client — RLS on ss_user_profiles blocks anon reads.
    // Auth is enforced via the token check above.
    const db = getServiceClient()
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('skin_type, climate, latitude, longitude, skin_concerns, allergies, location_text')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ profile: null, uv: null })
    }

    // Build filter defaults based on skin type and climate
    const defaults = buildFilterDefaults(profile.skin_type, profile.climate)

    // Fetch UV index if user has coordinates
    let uv: { uv_index: number; location: string } | null = null
    if (profile.latitude && profile.longitude) {
      try {
        const weather = await fetchWeather(
          Number(profile.latitude),
          Number(profile.longitude)
        )
        uv = { uv_index: weather.uv_index, location: weather.location }
      } catch {
        // UV fetch is non-critical
      }
    }

    return NextResponse.json({
      profile: {
        skin_type: profile.skin_type,
        climate: profile.climate,
        skin_concerns: profile.skin_concerns,
        allergies: profile.allergies,
        location_text: profile.location_text,
      },
      defaults,
      uv,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

interface FilterDefaults {
  pa_rating: string
  white_cast: string
  finish: string
  sunscreen_type: string
  under_makeup: boolean
  water_resistant: boolean
}

function buildFilterDefaults(
  skinType: string | null,
  climate: string | null
): FilterDefaults {
  const defaults: FilterDefaults = {
    pa_rating: '',
    white_cast: '',
    finish: '',
    sunscreen_type: '',
    under_makeup: false,
    water_resistant: false,
  }

  // Skin type defaults
  switch (skinType) {
    case 'oily':
      defaults.finish = 'matte'
      defaults.under_makeup = true
      break
    case 'dry':
      defaults.finish = 'dewy'
      break
    case 'sensitive':
      defaults.sunscreen_type = 'physical'
      break
  }

  // Climate defaults
  switch (climate) {
    case 'tropical':
    case 'humid':
      defaults.pa_rating = 'PA++++'
      defaults.water_resistant = true
      break
    case 'cold':
    case 'dry':
      if (!defaults.finish) {
        defaults.finish = 'dewy'
      }
      break
  }

  return defaults
}
