/**
 * Temperature unit presentation — Celsius stays canonical, Fahrenheit is a
 * DISPLAY concern only.
 *
 * Bailey (Austin, Texas), July 31 2026: "Can you change weather to F". She saw
 * "27°C" on her dashboard. There was no unit handling anywhere in the codebase —
 * Open-Meteo defaults to Celsius and every surface rendered it raw.
 *
 * WHY CONVERT AT THE DISPLAY BOUNDARY AND NOT AT THE FETCH: `WeatherData`
 * temperatures feed threshold logic that compares against Celsius numbers —
 * `w.temperature < 5` and `w.temperature > 30` in the adjustment rules
 * (weather-routine.ts), and the cold/hot labels in the seasonal summary. Passing
 * `temperature_unit=fahrenheit` to Open-Meteo would keep every one of those
 * comparisons type-correct and silently wrong: 27°C is a warm day, 27°F is
 * freezing, and `< 5` would never fire again. So `WeatherData.temperature`
 * REMAINS CELSIUS everywhere, and only the strings a human or Yuri reads are
 * converted. This is the "nothing wrong vs nothing checked" discipline applied
 * to units: a silently mis-scaled threshold looks identical to a working one.
 *
 * WHY DERIVED, NOT A USER SETTING: we already know where the user is
 * (`ss_user_profiles.latitude/longitude`, `location_text`). A preference toggle
 * would be one more thing to build, store, migrate and forget to read — and it
 * would ask the user to configure something we can simply observe. Wrong guesses
 * are cosmetic and self-correcting (the number is labelled with its unit either
 * way), which is exactly the risk profile where derivation beats configuration.
 *
 * The Fahrenheit set is deliberately small and sourced from actual civil usage,
 * not from a "not metric" assumption: the US and its territories, plus the
 * Cayman Islands, Liberia, Palau, the Marshall Islands and the FSM. Notably NOT
 * Canada — Canada is metric for weather, which matters here because a real
 * Seoul Sister user (skilback22@) is Canadian.
 */

/** ISO-3166 alpha-2 codes whose civil weather reporting uses Fahrenheit. */
const FAHRENHEIT_COUNTRIES = new Set([
  'US', // United States
  'PR', // Puerto Rico
  'GU', // Guam
  'VI', // U.S. Virgin Islands
  'AS', // American Samoa
  'MP', // Northern Mariana Islands
  'KY', // Cayman Islands
  'LR', // Liberia
  'PW', // Palau
  'MH', // Marshall Islands
  'FM', // Micronesia
])

export type TemperatureUnit = 'C' | 'F'

/**
 * Rough continental-US + Alaska/Hawaii bounding boxes.
 *
 * Coordinates are the strongest signal we have because they are verified —
 * `geocode.ts` refuses to store coordinates it cannot confirm, so a lat/lng on
 * a profile was actually resolved rather than guessed.
 *
 * A NAIVE BOX IS NOT ENOUGH, and the test caught this: the contiguous-US
 * rectangle also contains southern Ontario. Toronto (43.65, -79.38) sits inside
 * it, so a Canadian user would have been shown Fahrenheit — the exact mistake
 * this module exists to avoid, since Canada is metric and a real Seoul Sister
 * user lives there. Southern Ontario, Quebec and the Windsor–Quebec corridor
 * all dip below the 49th parallel, so the border is carved out explicitly.
 */
const US_BOXES: Array<{ latMin: number; latMax: number; lngMin: number; lngMax: number }> = [
  { latMin: 24.5, latMax: 49.0, lngMin: -125, lngMax: -66.9 }, // contiguous
  { latMin: 51.0, latMax: 71.5, lngMin: -180, lngMax: -129 }, // Alaska
  { latMin: 18.9, latMax: 22.3, lngMin: -160.3, lngMax: -154.7 }, // Hawaii
]

/**
 * Parts of Canada that fall inside the contiguous box above. Subtracted from
 * any US match. Deliberately generous — showing a Detroit user Celsius is a
 * cosmetic miss; showing a Toronto user Fahrenheit is the bug we were fixing.
 */
const CANADA_BELOW_49: Array<{
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}> = [
  // Southern Ontario + Quebec corridor (Windsor, Toronto, Ottawa, Montreal).
  { latMin: 41.6, latMax: 49.0, lngMin: -95.2, lngMax: -66.9 },
  // Lower mainland BC / Vancouver Island (Vancouver, Victoria).
  { latMin: 48.0, latMax: 49.0, lngMin: -125, lngMax: -122.0 },
]

function looksUnitedStatesByCoords(lat: number, lng: number): boolean {
  const inCanada = CANADA_BELOW_49.some(
    (b) => lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax
  )
  if (inCanada) return false
  return US_BOXES.some(
    (b) => lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax
  )
}

/**
 * Text fallback for users with no coordinates on file.
 *
 * Deliberately conservative: matches an explicit country name/code, or a US
 * state name or postal abbreviation as a WHOLE WORD. The abbreviation list is
 * the trap here — bare two-letter tokens like "IN", "OR", "OK", "ME", "HI",
 * "DE" and "LA" are ordinary English words, so abbreviations are only accepted
 * when the string looks like a "City, ST" tail. "Ontario, CA" is the known
 * ambiguity (California vs Canada) and is left to the coordinate path.
 */
const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
  'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
  'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
]

const US_STATE_ABBREVS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC',
])

function looksUnitedStatesByText(text: string): boolean {
  const lower = text.toLowerCase()

  // Canada is explicitly metric — check before anything else, since several
  // Canadian place names collide with US state names (London, Windsor…).
  if (/\bcanada\b/.test(lower)) return false

  if (/\b(usa|u\.s\.a\.|united states|u\.s\.)\b/.test(lower)) return true

  // A state NAME counts only when it stands as its own comma-segment ("Austin,
  // Texas" / "Iowa"), never as a substring of a city. "Kansas City" is a city
  // in MISSOURI — matching the bare word `kansas` inside it was a real bug this
  // module's tests caught. Same trap: "New York" vs "New York Mills, MN",
  // "Washington" vs "Washington, DC" vs "Fort Washington".
  const segments = lower.split(',').map((s) => s.trim())
  if (segments.some((seg) => US_STATE_NAMES.includes(seg))) return true

  // "Austin, TX" — abbreviation only in the trailing position after a comma.
  const tail = text.split(',').pop()?.trim().toUpperCase() ?? ''
  if (/^[A-Z]{2}$/.test(tail) && US_STATE_ABBREVS.has(tail)) return true

  return false
}

/**
 * Decide which unit to SHOW this user. Defaults to Celsius — the world default,
 * and the safe answer when we know nothing.
 */
export function resolveTemperatureUnit(profile: {
  latitude?: number | null
  longitude?: number | null
  location_text?: string | null
  country_code?: string | null
}): TemperatureUnit {
  const code = profile.country_code?.trim().toUpperCase()
  if (code) return FAHRENHEIT_COUNTRIES.has(code) ? 'F' : 'C'

  const { latitude, longitude } = profile
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return looksUnitedStatesByCoords(latitude, longitude) ? 'F' : 'C'
  }

  if (profile.location_text && looksUnitedStatesByText(profile.location_text)) return 'F'

  return 'C'
}

/** Celsius -> Fahrenheit. Exact formula, rounded for display only. */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32)
}

/**
 * Render a canonical (Celsius) temperature in the user's unit.
 * Always emits the unit symbol — an unlabelled number is how this class of bug
 * hides in the first place.
 */
export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return unit === 'F' ? `${celsiusToFahrenheit(celsius)}°F` : `${Math.round(celsius)}°C`
}
