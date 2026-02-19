import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/utils/error-handler'
import {
  fetchWeather,
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

    let lat: number
    let lng: number

    if (latParam && lngParam) {
      const parsed = querySchema.parse({ lat: latParam, lng: lngParam })
      lat = parsed.lat
      lng = parsed.lng
    } else {
      // Fall back to saved coordinates in profile
      const { data: profile } = await db
        .from('ss_user_profiles')
        .select('latitude, longitude')
        .eq('user_id', user.id)
        .single()

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

    // Load skin profile for personalised adjustments
    const { data: skinProfile } = await db
      .from('ss_user_profiles')
      .select('skin_type')
      .eq('user_id', user.id)
      .single()

    const skinType = (skinProfile?.skin_type as SkinProfile['skin_type']) ?? null
    const adjustments = getWeatherAdjustments(weather, skinType)
    const summary = getWeatherSummary(weather, adjustments.length)

    return NextResponse.json({ weather, adjustments, summary })
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
