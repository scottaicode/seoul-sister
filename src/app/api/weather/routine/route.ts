import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchWeather } from '@/lib/intelligence/weather-routine'

// ---------------------------------------------------------------------------
// GET /api/weather/routine — Live weather data for the dashboard widget
//
// v10.8.10 (Bailey-feedback sweep, May 26 2026): this route previously also
// computed `adjustments` (the getWeatherAdjustments rules engine), `summary`,
// and `seasonal_insight`. None of those have been rendered since v10.6.2, when
// the WeatherRoutineWidget was reduced to weather-data display + an Ask-Yuri
// CTA per the Yuri Sole Authority Principle. The unrendered prescription
// payload was dead weight AND a re-surfacing hazard (the same shape of bug let
// the seasonal "SPRING TIP" survive two prior kills before v10.8.9). Response
// is now just `{ weather }` — the only field the widget reads. Yuri is the
// sole recommender; she receives the raw weather context via the CTA prefill.
// ---------------------------------------------------------------------------

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const db = getServiceClient()

    // Parse query params — accept explicit lat/lng or fall back to saved profile
    const { searchParams } = new URL(request.url)
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')

    // Load profile coordinates + display name (skin_type/climate no longer
    // needed — the unrendered adjustments/seasonal payload was removed)
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('latitude, longitude, location_text')
      .eq('user_id', user.id)
      .maybeSingle()

    let lat: number
    let lng: number

    if (latParam && lngParam) {
      const parsed = querySchema.parse({ lat: latParam, lng: lngParam })
      lat = parsed.lat
      lng = parsed.lng
    } else {
      if (!profile?.latitude || !profile?.longitude) {
        return NextResponse.json(
          { error: 'No location set. Provide lat/lng params or set location in profile.' },
          { status: 400 }
        )
      }
      lat = Number(profile.latitude)
      lng = Number(profile.longitude)
    }

    // Fetch current weather
    const weather = await fetchWeather(lat, lng)

    // Use location_text from profile if available, else keep reverse-geocoded name
    if (profile?.location_text) {
      weather.location = profile.location_text as string
    }

    return NextResponse.json({ weather })
  } catch (error) {
    return handleApiError(error)
  }
}

// ---------------------------------------------------------------------------
// PUT /api/weather/routine — Update location + weather alert preferences
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  weather_alerts_enabled: z.boolean().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const updates = updateSchema.parse(body)

    const db = getServiceClient()

    const updateData: Record<string, unknown> = {}
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude
    if (updates.weather_alerts_enabled !== undefined) {
      updateData.weather_alerts_enabled = updates.weather_alerts_enabled
    }

    // If the user captured new coordinates, reverse-geocode a display name
    // so dashboard widgets can show "Sacramento, California" without re-fetching
    if (updates.latitude !== undefined && updates.longitude !== undefined) {
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${updates.latitude}&longitude=${updates.longitude}&localityLanguage=en`,
          { next: { revalidate: 86400 } }
        )
        if (geoRes.ok) {
          const geoData = (await geoRes.json()) as {
            city?: string
            locality?: string
            principalSubdivision?: string
            countryName?: string
          }
          const city = geoData.city || geoData.locality
          if (city) {
            const parts = [city]
            if (geoData.principalSubdivision) parts.push(geoData.principalSubdivision)
            updateData.location_text = parts.join(', ')
          }
        }
      } catch {
        // Reverse geocoding is non-critical — coordinates are still saved
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await db
      .from('ss_user_profiles')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      location_text: (updateData.location_text as string) ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
