/**
 * Run the REAL content guard (verifier model + deterministic enforcement) on
 * named drafts against a real user's evidence. Read-only: loads messages,
 * decisions, plan and shelf; writes nothing; sends nothing.
 *
 * Builds the same evidence a production check-in uses (incl. FACTS ON FILE).
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/check-proactive-guard.ts <userId> "<subject>" "<message>"
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { loadUserContext } from '../src/lib/yuri/memory'
import { loadGuardEvidence, guardSourceFacts, trialDayNumber } from '../src/lib/proactive/subscriber-checkin'
import { resolveTemperatureUnit } from '../src/lib/intelligence/temperature-units'
import { fetchWeeklyForecast, formatForecastFacts } from '../src/lib/intelligence/weather-forecast'
import { getLocalClock } from '../src/lib/yuri/clock'
import { checkProactiveDraft } from '../src/lib/proactive/content-guard'

async function main() {
  const [userId, subject, message] = process.argv.slice(2)
  if (!userId || !message) throw new Error('usage: check-proactive-guard.ts <userId> "<subject>" "<message>"')
  const ctx = await loadUserContext(userId)
  // Same FACTS ON FILE the production check-in passes: today's date, location, forecast.
  const db = getServiceClient()
  const { data: p } = await db.from('ss_user_profiles').select('timezone, latitude, longitude, location_text').eq('user_id', userId).single()
  const today = getLocalClock(p?.timezone ?? null, new Date()).isoDate
  const forecast = p?.latitude != null && p?.longitude != null
    ? formatForecastFacts(await fetchWeeklyForecast(Number(p.latitude), Number(p.longitude), p.timezone), today, null, resolveTemperatureUnit({ latitude: Number(p.latitude), longitude: Number(p.longitude) }))
    : null
  // The free-week day, as production computes it (optional AS_OF=<ISO> replays a past day).
  const { data: t } = await db.from('ss_trial_starts').select('started_at').eq('user_id', userId).order('started_at', { ascending: false }).limit(1).maybeSingle()
  const asOf = process.env.AS_OF ? Date.parse(process.env.AS_OF) : Date.now()
  const freeWeek = t?.started_at
    ? { day: trialDayNumber({ startedAt: t.started_at, endsAt: null }, p?.timezone ?? null, asOf), startedOn: getLocalClock(p?.timezone ?? null, new Date(t.started_at)).isoDate }
    : null
  const evidence = await loadGuardEvidence(db, userId, ctx.decisionMemory, guardSourceFacts({ today: process.env.AS_OF ? getLocalClock(p?.timezone ?? null, new Date(asOf)).isoDate : today, statedLocation: p?.location_text ?? null, gpsLocation: ctx.locationName, forecast, freeWeek }))
  const result = await checkProactiveDraft({ message, subject: subject || null, evidence, userId })
  console.log(JSON.stringify({ pass: result.pass, reasons: result.reasons, verifier: result.verifier }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
