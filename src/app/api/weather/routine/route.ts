import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import {
  fetchWeather,
  fetchSeasonalLearning,
  getWeatherAdjustments,
  getWeatherSummary,
} from '@/lib/intelligence/weather-routine'
import type { SkinProfile } from '@/types/database'

// ---------------------------------------------------------------------------
// GET /api/weather/routine — Weather data + skincare routine adjustments
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

    // Load full profile (coordinates, skin type, climate, location_text)
    const { data: profile } = await db
      .from('ss_user_profiles')
      .select('latitude, longitude, skin_type, climate, location_text')
      .eq('user_id', user.id)
      .single()

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

    const skinType = (profile?.skin_type as SkinProfile['skin_type']) ?? null
    const climate = (profile?.climate as string) ?? null

    // Use location_text from profile if available, else keep reverse-geocoded name
    if (profile?.location_text) {
      weather.location = profile.location_text as string
    }

    // Get weather adjustments with seasonal learning patterns merged in
    const adjustments = await getWeatherAdjustments(weather, skinType, {
      supabase: db,
      climate,
    })
    const summary = getWeatherSummary(weather, adjustments.length)

    // Fetch seasonal insight for the response (displayed separately in the widget)
    let seasonal_insight = null
    if (climate) {
      seasonal_insight = await fetchSeasonalLearning(db, climate)
    }

    return NextResponse.json({ weather, adjustments, summary, seasonal_insight })
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await db
      .from('ss_user_profiles')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
