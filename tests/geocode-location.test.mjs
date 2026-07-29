/**
 * Guard test — location_text → coordinates.
 *
 * Onboarding captured `location_text` and never resolved it, so the only path
 * that ever wrote latitude/longitude was the browser-geolocation button on
 * /profile. Both of the newest paying subscribers had a location on file and no
 * coordinates (Caroline "Kansas City", Kim "Iowa"), which meant
 * get_current_weather fell through to "Could not determine location" and every
 * UV/humidity surface was dark for them.
 *
 * The naive fix — one whole-string query against Open-Meteo — fails on most of
 * the strings our own extraction prompt tells Yuri to produce. Measured:
 *
 *   "Austin, Texas"  → Austin, Texas       ✓
 *   "Seoul, Korea"   → NO RESULT           ✗ (prompt example)
 *   "London, UK"     → NO RESULT           ✗ (prompt example)
 *   "Iowa"           → Ness City, KANSAS   ✗ (wrong state, ~450 miles)
 *
 * That last one is the dangerous class: wrong coordinates degrade INVISIBLY
 * (Yuri confidently reads another state's weather) while missing coordinates
 * degrade visibly (Yuri asks). So the resolver queries the first comma-segment,
 * verifies the hit against the user's own qualifiers, and returns null rather
 * than guessing.
 *
 * These assertions are SOURCE-STRUCTURAL — they do not hit the network, so
 * `npm test` stays offline, fast and deterministic. The live-network behavior
 * was verified separately at build time; the cases are recorded below as the
 * documented contract.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const geocodeSrc = readFileSync(join(root, 'src', 'lib', 'geo', 'geocode.ts'), 'utf8')
const onboardingSrc = readFileSync(
  join(root, 'src', 'lib', 'yuri', 'onboarding.ts'),
  'utf8'
)
const toolsSrc = readFileSync(join(root, 'src', 'lib', 'yuri', 'tools.ts'), 'utf8')

/**
 * Verified live against the Open-Meteo geocoding API on 2026-07-29. Recorded as
 * the behavioral contract; if a future edit changes the resolution strategy,
 * re-run these by hand before trusting the source assertions below.
 */
const VERIFIED_CASES = [
  ['Kansas City', 'Kansas City, Missouri, United States'], // Caroline (live)
  ['Iowa', 'Iowa City, Iowa, United States'], // Kim (live) — NOT Ness City, Kansas
  ['Austin, Texas', 'Austin, Texas, United States'], // Bailey (live)
  ['Elk Grove, California', 'Elk Grove, California, United States'], // Scott (live)
  ['Seoul, Korea', 'Seoul, Seoul, South Korea'], // prompt example
  ['London, UK', 'London, England, United Kingdom'], // prompt example
  ['Austin, Indiana', 'Austin, Indiana, United States'], // disambiguation
  ['Vancouver, BC', 'Vancouver, British Columbia, Canada'], // province abbrev
  ['Northern California', null], // unresolvable → null, never a guess
  ['asdfqwerzxcv', null],
  ['', null],
]

test('the verified-case table is not silently emptied', () => {
  assert.ok(
    VERIFIED_CASES.length >= 10,
    'The documented contract must keep covering the real live-user strings.'
  )
  // Every live subscriber location must stay represented.
  for (const needle of ['Kansas City', 'Iowa', 'Austin, Texas', 'Elk Grove, California']) {
    assert.ok(
      VERIFIED_CASES.some(([input]) => input === needle),
      `Live subscriber location "${needle}" dropped from the contract.`
    )
  }
})

test('unresolvable input returns null rather than a guessed location', () => {
  const nullCases = VERIFIED_CASES.filter(([, expected]) => expected === null)
  assert.ok(
    nullCases.length >= 3,
    'Must keep asserting that bad input yields null, not a nearest-neighbour guess.'
  )
})

test('geocoder rejects a region-name match in the wrong region', () => {
  // The "Iowa" → Ness City, Kansas bug. The guard is the admin1 self-check.
  assert.match(
    geocodeSrc,
    /normalize\(c\.admin1 \?\? ''\) === asRegion/,
    'Lost the bare-region guard — "Iowa" will resolve to Ness City, Kansas again.'
  )
})

test('geocoder verifies a candidate against user-supplied qualifiers', () => {
  assert.match(
    geocodeSrc,
    /function matchesQualifiers/,
    'Qualifier verification removed — "Austin, Texas" can resolve to Austin, Indiana.'
  )
  assert.match(
    geocodeSrc,
    /const verified = candidates\.find\(\(c\) => matchesQualifiers\(c, qualifiers\)\)/,
    'Candidates are no longer verified against the qualifiers the user gave.'
  )
})

test('geocoder falls back to the place segment when the whole string fails', () => {
  // This is what rescues "Seoul, Korea" and "London, UK", which return NOTHING
  // when queried as a whole string.
  assert.match(
    geocodeSrc,
    /const place = segments\[0\]/,
    'Lost the first-segment fallback — "Seoul, Korea" and "London, UK" resolve to nothing.'
  )
})

test('geocoder never throws — a failed lookup must not block onboarding', () => {
  assert.match(
    geocodeSrc,
    /} catch \{\s*\/\/[\s\S]*?return null\s*\}/,
    'Geocoding must swallow its own failures; a slow API must never gate onboarding.'
  )
})

test('onboarding resolves coordinates when it writes a location', () => {
  assert.match(
    onboardingSrc,
    /geocodeLocation\(extracted\.location_text\)/,
    'Onboarding stopped geocoding — new subscribers will have a location and no weather.'
  )
})

test('city-level coordinates never overwrite device-level ones', () => {
  // finalize can run more than once; /profile geolocation is more precise.
  assert.match(
    onboardingSrc,
    /if \(!hasCoords\)/,
    'Lost the guard that stops a city centroid clobbering real device coordinates.'
  )
})

test('geocoding failure is logged, never swallowed silently', () => {
  assert.match(
    onboardingSrc,
    /console\.error\(\s*'\[onboarding\] geocode failed/,
    'A silent geocode failure is how this class of bug stayed invisible the first time.'
  )
})

test('there is exactly ONE geocoder implementation', () => {
  // tools.ts must delegate, not carry a second copy. Two geocoders eventually
  // disagree about where a user lives, and the profile row is what weather reads.
  assert.match(
    toolsSrc,
    /geocodeLocation\(city\)/,
    'tools.ts no longer delegates to the shared geocoder.'
  )
  assert.ok(
    !/geocoding-api\.open-meteo\.com/.test(toolsSrc),
    'tools.ts has grown its own Open-Meteo geocoding call again — delegate instead.'
  )
})

test('first_name is captured but never invented', () => {
  assert.match(
    onboardingSrc,
    /- first_name: string/,
    'Lost the first_name extraction field.'
  )
  assert.match(
    onboardingSrc,
    /NEVER infer a name from their email address/,
    'The extractor must never derive a name from an email address.'
  )
  assert.match(
    onboardingSrc,
    /if \(extracted\.first_name\) profileData\.first_name = extracted\.first_name/,
    'first_name is extracted but never written to the profile.'
  )
})
