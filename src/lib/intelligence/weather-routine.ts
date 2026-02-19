import type {
  WeatherData,
  WeatherRoutineAdjustment,
  WeatherTrigger,
  SkinProfile,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Weather fetching (Open-Meteo — free, no API key required)
// https://open-meteo.com/en/docs
// ---------------------------------------------------------------------------

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
    uv_index: number
  }
  current_units: Record<string, string>
}

interface GeocodingResult {
  name: string
  country: string
}

/** WMO Weather interpretation codes → human-readable descriptions */
const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: 'clear' },
  1: { description: 'Mainly clear', icon: 'clear' },
  2: { description: 'Partly cloudy', icon: 'cloudy' },
  3: { description: 'Overcast', icon: 'cloudy' },
  45: { description: 'Foggy', icon: 'fog' },
  48: { description: 'Depositing rime fog', icon: 'fog' },
  51: { description: 'Light drizzle', icon: 'drizzle' },
  53: { description: 'Moderate drizzle', icon: 'drizzle' },
  55: { description: 'Dense drizzle', icon: 'drizzle' },
  61: { description: 'Slight rain', icon: 'rain' },
  63: { description: 'Moderate rain', icon: 'rain' },
  65: { description: 'Heavy rain', icon: 'rain' },
  71: { description: 'Slight snow', icon: 'snow' },
  73: { description: 'Moderate snow', icon: 'snow' },
  75: { description: 'Heavy snow', icon: 'snow' },
  80: { description: 'Slight rain showers', icon: 'rain' },
  81: { description: 'Moderate rain showers', icon: 'rain' },
  82: { description: 'Violent rain showers', icon: 'rain' },
  95: { description: 'Thunderstorm', icon: 'storm' },
  96: { description: 'Thunderstorm with hail', icon: 'storm' },
  99: { description: 'Thunderstorm with heavy hail', icon: 'storm' },
}

/**
 * Fetch current weather from Open-Meteo (free, no API key).
 * Includes temperature, humidity, wind, UV index in a single request.
 */
export async function fetchWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const params = [
    `latitude=${lat}`,
    `longitude=${lng}`,
    'current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index',
    'wind_speed_unit=ms',
  ].join('&')

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    { next: { revalidate: 1800 } } // cache 30 min
  )
  if (!weatherRes.ok) {
    throw new Error(`Open-Meteo API error: ${weatherRes.status}`)
  }
  const data: OpenMeteoResponse = await weatherRes.json()
  const c = data.current

  // Reverse-geocode to get a city name (best-effort)
  let locationName = `${lat.toFixed(1)}, ${lng.toFixed(1)}`
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lng}&count=1&format=json`,
      { next: { revalidate: 86400 } } // cache 24 h
    )
    if (geoRes.ok) {
      const geoData = await geoRes.json()
      const result = (geoData.results as GeocodingResult[] | undefined)?.[0]
      if (result) locationName = result.name
    }
  } catch {
    // Location name is non-critical
  }

  const wmo = WMO_CODES[c.weather_code] ?? { description: 'Unknown', icon: 'clear' }

  return {
    temperature: Math.round(c.temperature_2m),
    feels_like: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    uv_index: Math.round(c.uv_index * 10) / 10,
    wind_speed: Math.round(c.wind_speed_10m * 10) / 10,
    condition: wmo.description,
    icon: wmo.icon,
    location: locationName,
  }
}

// ---------------------------------------------------------------------------
// Weather-to-routine adjustment mapping
// ---------------------------------------------------------------------------

interface AdjustmentRule {
  trigger: WeatherTrigger
  /** Returns true when weather matches this trigger */
  match: (w: WeatherData) => boolean
  /** Base adjustments (before skin-type specialisation) */
  adjustments: Omit<WeatherRoutineAdjustment, 'weather_trigger'>[]
  /** Extra adjustments for specific skin types */
  skinTypeExtras?: Partial<
    Record<
      NonNullable<SkinProfile['skin_type']>,
      Omit<WeatherRoutineAdjustment, 'weather_trigger'>[]
    >
  >
}

const ADJUSTMENT_RULES: AdjustmentRule[] = [
  // --- High humidity (>70%) ---
  {
    trigger: 'high_humidity',
    match: (w) => w.humidity > 70,
    adjustments: [
      {
        type: 'swap',
        product_category: 'moisturizer',
        reason: 'High humidity reduces need for heavy moisturizers',
        suggestion: 'Switch to a lighter gel or water-based moisturizer',
      },
      {
        type: 'reduce',
        product_category: 'oil',
        reason: 'Facial oils can feel greasy in humid conditions',
        suggestion: 'Skip face oils today or use only a drop',
      },
    ],
    skinTypeExtras: {
      oily: [
        {
          type: 'add',
          product_category: 'exfoliator',
          reason: 'Humidity increases sebum production on oily skin',
          suggestion: 'Use BHA toner tonight to keep pores clear',
        },
      ],
      combination: [
        {
          type: 'emphasize',
          product_category: 'toner',
          reason: 'Mattifying toner helps control T-zone shine in humidity',
          suggestion: 'Apply niacinamide toner to your T-zone',
        },
      ],
    },
  },

  // --- Low humidity (<30%) ---
  {
    trigger: 'low_humidity',
    match: (w) => w.humidity < 30,
    adjustments: [
      {
        type: 'emphasize',
        product_category: 'moisturizer',
        reason: 'Dry air strips moisture from skin',
        suggestion: 'Use a richer cream moisturizer and consider layering',
      },
      {
        type: 'add',
        product_category: 'essence',
        reason: 'Low humidity dehydrates skin faster',
        suggestion: 'Add a hyaluronic acid essence or hydrating toner',
      },
    ],
    skinTypeExtras: {
      dry: [
        {
          type: 'add',
          product_category: 'oil',
          reason: 'Dry skin needs extra barrier protection in dry air',
          suggestion: 'Seal with a facial oil (squalane or rosehip) after moisturizer',
        },
      ],
      sensitive: [
        {
          type: 'emphasize',
          product_category: 'moisturizer',
          reason: 'Sensitive skin barrier weakens in dry air',
          suggestion: 'Use a ceramide-rich cream to protect your barrier',
        },
      ],
    },
  },

  // --- High UV (>7) ---
  {
    trigger: 'high_uv',
    match: (w) => w.uv_index > 7,
    adjustments: [
      {
        type: 'emphasize',
        product_category: 'sunscreen',
        reason: 'UV index is very high today',
        suggestion: 'Reapply SPF 50+ every 2 hours if outdoors',
      },
      {
        type: 'add',
        product_category: 'serum',
        reason: 'Antioxidants boost UV defence',
        suggestion: 'Use a vitamin C serum in the AM for extra protection',
      },
    ],
  },

  // --- Cold + dry (<5 C and <40% humidity) ---
  {
    trigger: 'cold_dry',
    match: (w) => w.temperature < 5 && w.humidity < 40,
    adjustments: [
      {
        type: 'add',
        product_category: 'moisturizer',
        reason: 'Cold, dry air severely weakens the skin barrier',
        suggestion: 'Layer a heavier occlusives (shea butter, petroleum jelly) over your moisturizer at night',
      },
      {
        type: 'avoid',
        product_category: 'exfoliator',
        reason: 'Barrier is compromised in cold, dry conditions',
        suggestion: 'Skip chemical exfoliants until conditions improve',
      },
    ],
  },

  // --- Hot + humid (>30 C and >60% humidity) ---
  {
    trigger: 'hot_humid',
    match: (w) => w.temperature > 30 && w.humidity > 60,
    adjustments: [
      {
        type: 'swap',
        product_category: 'moisturizer',
        reason: 'Hot humid weather makes heavy creams feel uncomfortable',
        suggestion: 'Use an ultra-light water gel instead of cream',
      },
      {
        type: 'emphasize',
        product_category: 'sunscreen',
        reason: 'Heat and humidity mean more time outdoors',
        suggestion: 'Choose a water-resistant, lightweight sunscreen',
      },
    ],
    skinTypeExtras: {
      oily: [
        {
          type: 'add',
          product_category: 'mask',
          reason: 'Excess oil and sweat in hot weather',
          suggestion: 'Use a clay mask tonight to absorb excess sebum',
        },
      ],
    },
  },

  // --- Windy (>8 m/s) ---
  {
    trigger: 'windy',
    match: (w) => w.wind_speed > 8,
    adjustments: [
      {
        type: 'emphasize',
        product_category: 'moisturizer',
        reason: 'Wind accelerates trans-epidermal water loss',
        suggestion: 'Apply a thicker barrier cream, especially on exposed areas',
      },
    ],
    skinTypeExtras: {
      sensitive: [
        {
          type: 'add',
          product_category: 'serum',
          reason: 'Sensitive skin is more susceptible to wind damage',
          suggestion: 'Use a centella or cica serum for barrier support',
        },
      ],
    },
  },
]

/**
 * Determine which routine adjustments are needed based on current weather
 * and the user's skin type.
 */
export function getWeatherAdjustments(
  weather: WeatherData,
  skinType: SkinProfile['skin_type'] | null
): WeatherRoutineAdjustment[] {
  const adjustments: WeatherRoutineAdjustment[] = []
  const type = skinType ?? 'combination'

  for (const rule of ADJUSTMENT_RULES) {
    if (!rule.match(weather)) continue

    // Base adjustments
    for (const adj of rule.adjustments) {
      adjustments.push({ ...adj, weather_trigger: rule.trigger })
    }

    // Skin-type-specific extras
    const extras = rule.skinTypeExtras?.[type]
    if (extras) {
      for (const adj of extras) {
        adjustments.push({ ...adj, weather_trigger: rule.trigger })
      }
    }
  }

  return adjustments
}

/**
 * Generate a one-line summary of today's weather impact on skincare.
 */
export function getWeatherSummary(
  weather: WeatherData,
  adjustmentCount: number
): string {
  const parts: string[] = []

  if (weather.temperature < 5) parts.push('cold')
  else if (weather.temperature > 30) parts.push('hot')

  if (weather.humidity < 30) parts.push('dry air')
  else if (weather.humidity > 70) parts.push('humid')

  if (weather.uv_index > 7) parts.push('high UV')
  if (weather.wind_speed > 8) parts.push('windy')

  if (parts.length === 0) {
    return 'Conditions are comfortable today — your regular routine works great.'
  }

  const conditionStr = parts.join(', ')
  return `It's ${conditionStr} in ${weather.location} — ${adjustmentCount} routine adjustment${adjustmentCount !== 1 ? 's' : ''} suggested.`
}

