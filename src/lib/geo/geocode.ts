/**
 * Free-text location → coordinates, via Open-Meteo's free geocoding API.
 *
 * No API key, no registration, same provider already used for weather
 * (`fetchWeather` in intelligence/weather-routine.ts), so this adds no new
 * vendor and no new cost.
 *
 * Extracted from `geocodeCity` in lib/yuri/tools.ts (July 29 2026) so the
 * onboarding-finalize path and the Yuri weather tool resolve a location the
 * same way. Two independent geocoders would eventually disagree about where a
 * user lives, and the profile's stored coordinates are what every weather-driven
 * surface reads.
 *
 * ## Why this is more than a single fetch
 *
 * Measured against the exact strings our extraction prompt tells Yuri to
 * produce ("Austin, Texas", "Seoul, Korea", "London, UK"), the naive
 * whole-string query fails on most of them:
 *
 *   "Austin, Texas"     → Austin, Texas ✓
 *   "Seoul, Korea"      → NO RESULT
 *   "London, UK"        → NO RESULT
 *   "Kansas City"       → Kansas City, Missouri ✓
 *   "Iowa"              → Ness City, KANSAS ✗ (wrong state, ~450 miles)
 *
 * So we query the FIRST comma-segment (the place name) and use the remaining
 * segments to VERIFY the result rather than trusting the top hit blindly. A
 * verifiable mismatch is rejected — silently storing coordinates 450 miles from
 * where someone lives is worse than storing none, because "no coordinates"
 * degrades visibly (Yuri asks) while "wrong coordinates" degrades invisibly
 * (Yuri confidently reads another state's weather).
 */

export interface GeocodeResult {
  lat: number
  lng: number
  /** Human-readable "City, Region, Country" as resolved by the provider. */
  name: string
  /** IANA zone (e.g. "America/Chicago"), when the provider supplies one. */
  timezone: string | null
}

interface OpenMeteoPlace {
  latitude: number
  longitude: number
  name: string
  country?: string
  country_code?: string
  admin1?: string
  timezone?: string
  /** GeoNames feature code. "PCLI" and its relatives are whole countries. */
  feature_code?: string
}

/**
 * Country and region abbreviations users actually type.
 *
 * Values are matched against the provider's `admin1` / `country` strings, so
 * each maps to the provider's own full name.
 */
const ALIASES: Record<string, string> = {
  // Countries
  usa: 'united states',
  us: 'united states',
  uk: 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  korea: 'south korea',
  's korea': 'south korea',
  uae: 'united arab emirates',
  // Canadian provinces — commonly written as two letters
  bc: 'british columbia',
  ab: 'alberta',
  sk: 'saskatchewan',
  mb: 'manitoba',
  on: 'ontario',
  qc: 'quebec',
  nb: 'new brunswick',
  ns: 'nova scotia',
  pe: 'prince edward island',
  nl: 'newfoundland and labrador',
}

/**
 * US state two-letter codes. Kept separate from ALIASES because these are
 * matched against `admin1`, and several collide with common words ("in", "or",
 * "me", "hi") — so they are only consulted when the segment is exactly two
 * letters and appears as a qualifier, never as a place name.
 */
const US_STATE_CODES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
  mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina',
  nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee',
  tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
}

function normalize(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
  return ALIASES[cleaned] ?? US_STATE_CODES[cleaned] ?? cleaned
}

async function search(query: string, count: number): Promise<OpenMeteoPlace[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=${count}&language=en&format=json`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) return []
  const data = (await res.json()) as { results?: OpenMeteoPlace[] }
  // A whole country is not somewhere a person lives. The provider lists
  // "Canada" the country first, with coordinates in the Northwest Territories
  // (seen Nov 17 2026), so a member who said only "Canada" would have been
  // given the weather for a point 1,500 miles from most Canadians. Dropped
  // here, a bare country stays unplaced and Yuri is told so.
  return (data.results ?? []).filter((place) => !(place.feature_code ?? '').startsWith('PCL'))
}

/**
 * Does this candidate agree with the qualifiers the user supplied?
 *
 * "Austin, Texas" must not resolve to Austin, Indiana. We accept when a
 * qualifier matches the candidate's region, country, or country code.
 */
function matchesQualifiers(place: OpenMeteoPlace, qualifiers: string[]): boolean {
  if (qualifiers.length === 0) return true

  const haystack = [place.admin1, place.country]
    .filter((v): v is string => Boolean(v))
    .map(normalize)
  // A country CODE is compared whole and as written. Run through `normalize`
  // it became a US state ("CA", Canada's code, turned into "california"), so
  // "London, CA" was accepted as London, Ontario; and "ca" is also a substring
  // of "california".
  const code = (place.country_code ?? '').toLowerCase()

  return qualifiers.some((q) =>
    (code !== '' && q === code) || haystack.some((h) => h === q || h.includes(q) || q.includes(h))
  )
}

/**
 * Does the candidate sit in a REGION the member named (a state or province)?
 * Stricter than `matchesQualifiers`, which a country alone satisfies: nearly
 * every town name exists somewhere in the United States.
 */
function inNamedRegion(place: OpenMeteoPlace, qualifiers: string[]): boolean {
  const region = place.admin1 ? normalize(place.admin1) : ''
  return region !== '' && qualifiers.some((q) => q === region || q.includes(region) || region.includes(q))
}

/** How many leading words may be dropped from a place name. Each is one request to the provider, inside a chat turn. */
const MAX_WORDS_DROPPED = 3

function toResult(place: OpenMeteoPlace): GeocodeResult | null {
  if (
    typeof place.latitude !== 'number' ||
    typeof place.longitude !== 'number' ||
    Number.isNaN(place.latitude) ||
    Number.isNaN(place.longitude)
  ) {
    return null
  }
  return {
    lat: place.latitude,
    lng: place.longitude,
    name: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    timezone: place.timezone || null,
  }
}

/**
 * Resolve a free-text location to coordinates.
 *
 * Returns null for anything unresolvable or unverifiable — an empty string, a
 * joke answer, a place the provider doesn't know, a result that contradicts the
 * user's own qualifiers, a network failure, or a timeout.
 *
 * Callers MUST treat null as "no coordinates", never as an error worth
 * surfacing: a profile without coordinates is the pre-existing status quo, and
 * nobody should be blocked from finishing onboarding because a geocoder was
 * slow or unsure.
 */
export async function geocodeLocation(
  location: string
): Promise<GeocodeResult | null> {
  const raw = location.trim()
  if (!raw) return null

  const segments = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (segments.length === 0) return null

  const place = segments[0]
  const qualifiers = segments.slice(1).map(normalize)

  try {
    // Whole string first — when it works it is the most specific answer we can
    // get, and it is the only form that resolves some multi-word places.
    if (segments.length > 1) {
      const exact = await search(raw, 1)
      if (exact[0] && matchesQualifiers(exact[0], qualifiers)) {
        return toResult(exact[0])
      }
    }

    // Fall back to the place name alone, then verify against the qualifiers the
    // user gave us. This is the path that rescues "Seoul, Korea" and
    // "London, UK", which return nothing when queried whole.
    let candidates = await search(place, 10)
    // People say where they live the way they talk: "near Sacramento", "just
    // outside Austin". The provider knows no place called "near Sacramento",
    // so a member who said exactly that got no coordinates and no weather
    // (Nov 16 2026). Drop leading words one at a time until the provider
    // knows the name. The town they named is the right weather for someone
    // near it. ONLY when they also named a state or province the result sits
    // in. Without one, dropping words turns "Northern California" into
    // California, Missouri and "somewhere warm" into Warm, Netherlands; with
    // only a country, "rural Iowa, USA" becomes Iowa, Louisiana (all
    // measured). Wrong coordinates are worse than none.
    let placeName = place
    let dropped = 0
    while (candidates.length === 0 && qualifiers.length > 0 && placeName.includes(' ') && dropped < MAX_WORDS_DROPPED) {
      placeName = placeName.slice(placeName.indexOf(' ') + 1).trim()
      dropped++
      candidates = (await search(placeName, 10)).filter((c) => inNamedRegion(c, qualifiers))
    }
    if (candidates.length === 0) return null

    if (qualifiers.length === 0) {
      // A bare, unqualified place name. The provider indexes populated places,
      // not administrative regions, so a user who writes only their STATE gets
      // the nearest name-similar town — "Iowa" returns Ness City, KANSAS, ~450
      // miles from anywhere in Iowa. Left unguarded that becomes confident,
      // invisible, wrong weather.
      //
      // So when the query looks like a region rather than a settlement, only
      // accept a candidate that actually sits in a region of that name.
      const asRegion = normalize(placeName)
      const looksLikeRegion = candidates.some(
        (c) => normalize(c.admin1 ?? '') === asRegion
      )
      if (looksLikeRegion) {
        const inRegion = candidates.find(
          (c) => normalize(c.admin1 ?? '') === asRegion
        )
        return inRegion ? toResult(inRegion) : null
      }

      const top = candidates[0]
      // Reject an obvious near-miss: the provider fuzzy-matches, so a name that
      // isn't really the place the user typed should not become their location.
      if (normalize(top.name) !== asRegion && !normalize(top.name).includes(asRegion)) {
        return null
      }
      return toResult(top)
    }

    const verified = candidates.find((c) => matchesQualifiers(c, qualifiers))
    if (verified) return toResult(verified)

    // The user told us a region and NOTHING the provider returned agrees with
    // it. Reject rather than guess: "Iowa" resolving to Ness City, Kansas is
    // the failure this guard exists to prevent.
    return null
  } catch {
    // Network failure, timeout, or malformed JSON. The caller proceeds without
    // coordinates — this is a convenience, never a gate.
    return null
  }
}
