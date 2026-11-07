/**
 * 7-day daily forecast for the weekly check-in (Nov 7 2026).
 *
 * Separate from fetchWeather() on purpose: that function feeds the dashboard
 * weather card and the routine-adjustment rules with CURRENT conditions and
 * today's peak UV, and its callers must not change. The weekly check-in is sent
 * on a Sunday about the week ahead, so it needs one row per day.
 *
 * Facts only: dates are the member's LOCAL calendar dates (Open-Meteo is asked
 * for their profile timezone), weekday names are computed here so no model does
 * date arithmetic, and nothing in this file decides what any of it means for
 * their skin. That is Yuri's call.
 */

import { WMO_CODES } from '@/lib/intelligence/weather-routine'

export interface ForecastDay {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Weekday name of `date`, e.g. "Tuesday". */
  weekday: string
  maxC: number | null
  minC: number | null
  humidityMax: number | null
  humidityMin: number | null
  humidityMean: number | null
  uvMax: number | null
  precipMm: number | null
  precipChanceMax: number | null
  condition: string | null
}

export interface WeeklyForecast {
  /** Timezone the dates are in (as Open-Meteo resolved it). */
  timezone: string
  days: ForecastDay[]
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

interface OpenMeteoDaily {
  timezone?: string
  daily?: {
    time?: string[]
    weather_code?: Array<number | null>
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
    relative_humidity_2m_max?: Array<number | null>
    relative_humidity_2m_min?: Array<number | null>
    relative_humidity_2m_mean?: Array<number | null>
    uv_index_max?: Array<number | null>
    precipitation_sum?: Array<number | null>
    precipitation_probability_max?: Array<number | null>
  }
}

const num = (v: number | null | undefined, digits = 0): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/**
 * Shape an Open-Meteo daily response into ForecastDay rows. Pure, exported for
 * tests. A missing value stays null (never 0): "no data" must not read as
 * "dry" or "no UV".
 */
export function shapeDailyForecast(json: OpenMeteoDaily, fallbackTz: string): WeeklyForecast {
  const d = json.daily ?? {}
  const times = d.time ?? []
  const days: ForecastDay[] = []
  for (let i = 0; i < times.length; i++) {
    const date = times[i]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const code = d.weather_code?.[i]
    days.push({
      date,
      weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      maxC: num(d.temperature_2m_max?.[i]),
      minC: num(d.temperature_2m_min?.[i]),
      humidityMax: num(d.relative_humidity_2m_max?.[i]),
      humidityMin: num(d.relative_humidity_2m_min?.[i]),
      humidityMean: num(d.relative_humidity_2m_mean?.[i]),
      uvMax: num(d.uv_index_max?.[i], 1),
      precipMm: num(d.precipitation_sum?.[i], 1),
      precipChanceMax: num(d.precipitation_probability_max?.[i]),
      condition: typeof code === 'number' ? (WMO_CODES[code]?.description ?? null) : null,
    })
  }
  return { timezone: json.timezone || fallbackTz, days }
}

/**
 * Render the forecast as fact lines. `todayIso` is the member's local date, so
 * "today" and "tomorrow" are labelled from their calendar, not the server's.
 */
export function formatForecastFacts(f: WeeklyForecast, todayIso: string, place: string | null = null): string {
  if (!f.days.length) return 'Forecast: no daily rows came back this run. Do not guess it.'
  const lines = [
    `7-day forecast where they live${place ? ` (${place})` : ''}, by their local date (a forecast, not a measurement; later days are less certain):`,
  ]
  const tomorrow = new Date(new Date(`${todayIso}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
  for (const x of f.days) {
    const label = x.date === todayIso ? ' (today)' : x.date === tomorrow ? ' (tomorrow)' : ''
    const parts = [
      x.condition,
      x.maxC != null || x.minC != null ? `high ${x.maxC ?? '?'}°C / low ${x.minC ?? '?'}°C` : null,
      x.humidityMin != null || x.humidityMax != null
        ? `humidity ${x.humidityMin ?? '?'}-${x.humidityMax ?? '?'}%${x.humidityMean != null ? ` (mean ${x.humidityMean}%)` : ''}`
        : null,
      x.uvMax != null ? `peak UV ${x.uvMax}` : null,
      x.precipMm != null ? `precipitation ${x.precipMm} mm${x.precipChanceMax != null ? ` (max chance ${x.precipChanceMax}%)` : ''}` : null,
    ].filter(Boolean)
    lines.push(`- ${x.weekday} ${x.date}${label}: ${parts.join(', ') || 'no data'}`)
  }
  return lines.join('\n')
}

/**
 * Fetch a daily forecast from Open-Meteo (free, no key). `timezone` should be
 * the member's profile timezone so the returned dates are their local dates;
 * without one Open-Meteo resolves it from the coordinates ('auto').
 */
export async function fetchWeeklyForecast(
  lat: number,
  lng: number,
  timezone: string | null,
  days = 7
): Promise<WeeklyForecast> {
  const tz = timezone && timezone.trim() ? timezone.trim() : 'auto'
  const params = [
    `latitude=${lat}`,
    `longitude=${lng}`,
    'daily=weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean,uv_index_max,precipitation_sum,precipitation_probability_max',
    `timezone=${encodeURIComponent(tz)}`,
    `forecast_days=${days}`,
  ].join('&')
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`)
  return shapeDailyForecast((await res.json()) as OpenMeteoDaily, tz)
}
