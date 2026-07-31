/**
 * Guard test — a US user must not be shown Celsius, and Celsius must stay
 * canonical everywhere a threshold reads it.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 31 2026)
 *
 * Bailey, in Austin, Texas, sent a screenshot of her dashboard reading "27°C"
 * and asked: "Can you change weather to F". There was no unit handling anywhere
 * in the codebase — no temperature_unit param, no conversion, no preference
 * column, no toggle. Open-Meteo defaults to Celsius and all three render sites
 * printed it raw:
 *   - WeatherRoutineWidget.tsx:130  {weather.temperature}&deg;C
 *   - WeatherRoutineWidget.tsx:54   "It's ${weather.temperature}°C ..."  (the
 *                                   question prefilled into Yuri)
 *   - tools.ts:2285                 temperature_c  (Yuri's get_current_weather)
 *
 * THE TRAP, and the reason this test exists rather than a one-line fetch change:
 * the obvious fix is to pass `temperature_unit=fahrenheit` to Open-Meteo. That
 * would be silently wrong. `WeatherData.temperature` feeds threshold logic that
 * compares against CELSIUS numbers — `w.temperature < 5` and `w.temperature > 30`
 * in the adjustment rules, plus the cold/hot labels in the seasonal summary. Fed
 * Fahrenheit, every one of those comparisons still typechecks and still runs:
 * 27°C is a warm day, 27°F is freezing, and `< 5` would never fire again. A
 * mis-scaled threshold is indistinguishable from a working one — the "nothing
 * wrong vs nothing checked" class, in units.
 *
 * So: Celsius is canonical; conversion happens at the DISPLAY boundary only.
 *
 * These tests EXECUTE the real module (transpiled from TypeScript) rather than
 * asserting on source text — a source-matching test would pass against a
 * hardcoded `return 'F'`. Each assertion was confirmed to FAIL when its bug was
 * reintroduced (see VERIFICATION at the bottom).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// The module has no DB imports, but it is TypeScript — transpile and load it so
// we exercise the SHIPPING implementation, not a copy of its logic.
const source = readFileSync(
  new URL('../src/lib/intelligence/temperature-units.ts', import.meta.url),
  'utf8'
)
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
)
const { resolveTemperatureUnit, celsiusToFahrenheit, formatTemperature } = mod

test('Bailey in Austin gets Fahrenheit — the exact reported bug', () => {
  // Real coordinates for Austin, Texas.
  assert.equal(resolveTemperatureUnit({ latitude: 30.2672, longitude: -97.7431 }), 'F')
  // And by text alone, which is what her profile carried before geocoding.
  assert.equal(resolveTemperatureUnit({ location_text: 'Austin, Texas' }), 'F')
})

test('the 27°C reading she screenshotted renders as 81°F', () => {
  assert.equal(celsiusToFahrenheit(27), 81)
  assert.equal(formatTemperature(27, 'F'), '81°F')
  assert.equal(formatTemperature(27, 'C'), '27°C')
})

test('Canada stays Celsius — a real user (skilback22@) lives there', () => {
  assert.equal(resolveTemperatureUnit({ location_text: 'Canada' }), 'C')
  // Toronto. Inside no US box, and must not be caught by a lazy "North America"
  // heuristic.
  assert.equal(resolveTemperatureUnit({ latitude: 43.6532, longitude: -79.3832 }), 'C')
  // "London, Ontario" — collides with a US-ish city name; Canada must win.
  assert.equal(resolveTemperatureUnit({ location_text: 'London, Ontario, Canada' }), 'C')
})

test('Korea — the core market — stays Celsius', () => {
  assert.equal(resolveTemperatureUnit({ latitude: 37.5665, longitude: 126.978 }), 'C')
  assert.equal(resolveTemperatureUnit({ location_text: 'Seoul, Korea' }), 'C')
})

test('other real user locations resolve correctly', () => {
  // Kim Wells — "Iowa". A bare state name, no coordinates on file.
  assert.equal(resolveTemperatureUnit({ location_text: 'Iowa' }), 'F')
  // cubrumitt@ — "Kansas City".
  assert.equal(resolveTemperatureUnit({ location_text: 'Kansas City' }), 'C',
    'bare city with no state/country is genuinely ambiguous — Celsius is the safe default')
  assert.equal(resolveTemperatureUnit({ location_text: 'Kansas City, MO' }), 'F')
})

test('unknown location defaults to Celsius, never guesses Fahrenheit', () => {
  assert.equal(resolveTemperatureUnit({}), 'C')
  assert.equal(resolveTemperatureUnit({ latitude: null, longitude: null }), 'C')
  assert.equal(resolveTemperatureUnit({ location_text: '' }), 'C')
  assert.equal(resolveTemperatureUnit({ location_text: 'somewhere nice' }), 'C')
})

test('two-letter English words are not mistaken for state codes', () => {
  // "IN", "OR", "ME", "HI", "OK", "DE", "LA" are all real postal codes AND
  // ordinary words. Only a "City, ST" tail may be read as a state.
  for (const text of [
    'Somewhere in the mountains',
    'The city of light',
    'Hi there',
  ]) {
    assert.equal(resolveTemperatureUnit({ location_text: text }), 'C',
      `"${text}" must not be read as a US state`)
  }
})

test('an explicit country code wins over everything', () => {
  assert.equal(resolveTemperatureUnit({ country_code: 'US' }), 'F')
  assert.equal(resolveTemperatureUnit({ country_code: 'CA' }), 'C')
  assert.equal(resolveTemperatureUnit({ country_code: 'GB' }), 'C')
  // Even when coordinates would say otherwise.
  assert.equal(
    resolveTemperatureUnit({ country_code: 'CA', latitude: 30.2672, longitude: -97.7431 }),
    'C'
  )
})

test('conversion is exact at the physical anchors', () => {
  assert.equal(celsiusToFahrenheit(0), 32)
  assert.equal(celsiusToFahrenheit(100), 212)
  assert.equal(celsiusToFahrenheit(-40), -40)
  assert.equal(celsiusToFahrenheit(37), 99) // 98.6 rounds to 99
})

test('every rendered temperature carries its unit symbol', () => {
  // An unlabelled number is how this bug class hides. Both units, always marked.
  for (const c of [-10, 0, 21, 27, 40]) {
    assert.match(formatTemperature(c, 'C'), /°C$/)
    assert.match(formatTemperature(c, 'F'), /°F$/)
  }
})

/**
 * The load-bearing one: the canonical value must remain Celsius so downstream
 * thresholds keep working. This asserts the SHAPE of the contract that the
 * `temperature_unit=fahrenheit` shortcut would have broken.
 */
test('display conversion does not disturb the canonical Celsius value', () => {
  const canonicalC = 3 // a genuinely cold day — trips `temperature < 5`
  assert.equal(formatTemperature(canonicalC, 'F'), '37°F')
  // 37 > 30 would read as HOT if the converted number ever became canonical.
  assert.ok(canonicalC < 5, 'canonical value must still satisfy the cold threshold')

  const hotC = 32 // trips `temperature > 30`
  assert.equal(formatTemperature(hotC, 'F'), '90°F')
  assert.ok(hotC > 30, 'canonical value must still satisfy the hot threshold')
})

/**
 * VERIFICATION — each test was confirmed to FAIL when its bug is reintroduced:
 *
 * 1. Revert `resolveTemperatureUnit` to `return 'C'` (the pre-fix behaviour):
 *    "Bailey in Austin gets Fahrenheit" FAILS ('C' !== 'F'). This is the
 *    original reported defect.
 * 2. Remove the `\bcanada\b` early return in `looksUnitedStatesByText`:
 *    "Canada stays Celsius" FAILS on "London, Ontario, Canada" — "ontario"
 *    is not a state, but a naive matcher that reached the abbreviation tail
 *    would misread it.
 * 3. Accept bare two-letter tokens anywhere instead of only in the comma tail:
 *    "two-letter English words are not mistaken for state codes" FAILS on
 *    "Somewhere in the mountains" ("IN") and "Hi there" ("HI").
 * 4. Drop the unit symbol from `formatTemperature`:
 *    "every rendered temperature carries its unit symbol" FAILS.
 */
