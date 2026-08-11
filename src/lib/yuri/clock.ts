/**
 * v11.25.0 — the shared local clock.
 *
 * ONE implementation of "what day is it for this user," used by every surface
 * that needs to know: the chat advisor, the decision-memory extractor, and the
 * proactive-nudge cron. Same discipline as `src/lib/geo/geocode.ts` — two clocks
 * eventually disagree, and the one that disagrees silently is the one that ships
 * a nudge saying "Sunday's here" on a Tuesday.
 *
 * The defect this exists to prevent (Aug 11 2026, caught by Bailey):
 * `extractAndSaveDecisionMemory` resolved Yuri's promised "Sunday" against
 * `new Date().toISOString()` — raw server UTC, with no weekday name and no user
 * timezone. Bailey messaged at 9:26 PM CT on Aug 8, which is 02:26 UTC on Aug 9.
 * The server's "today" was already Sunday while hers was still Saturday, so
 * "Sunday" resolved forward a full week-day to Monday Aug 10. She said Sunday.
 * The database said Monday. The nudge said "Sunday's here." All three disagreed.
 *
 * Everything here is deterministic date arithmetic, not judgment. It supplies
 * FACTS to the models; it never decides what to say about them.
 */

/** A user's local "now", pre-resolved so no model ever does weekday arithmetic. */
export interface LocalClock {
  /** IANA timezone actually used (falls back to 'UTC' when unknown/invalid). */
  timezone: string
  /** Bare ISO date in the user's local calendar, e.g. "2026-08-11". */
  isoDate: string
  /** Weekday name in the user's local calendar, e.g. "Tuesday". */
  weekday: string
  /** Long-form local date, e.g. "Tuesday, August 11, 2026". */
  longDate: string
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/**
 * Resolve a user's local calendar date. Never throws — an unknown or malformed
 * timezone falls back to UTC, matching the posture in advisor.ts. A wrong-but-
 * plausible clock is worse than an honest UTC one, so the fallback is explicit
 * in the returned `timezone` field and callers surface it.
 */
export function getLocalClock(timezone: string | null | undefined, now: Date = new Date()): LocalClock {
  const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const map: Record<string, string> = {}
    for (const p of parts) map[p.type] = p.value
    if (!map.year || !map.month || !map.day || !map.weekday) throw new Error('incomplete parts')
    const isoDate = `${map.year}-${map.month}-${map.day}`
    const longDate = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now)
    return { timezone: tz, isoDate, weekday: map.weekday, longDate }
  } catch {
    // Invalid IANA string (or an environment without full ICU) — fall back to UTC
    // rather than guessing. Reported honestly in `timezone`.
    const isoDate = now.toISOString().slice(0, 10)
    const weekday = WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]
    const longDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now)
    return { timezone: 'UTC', isoDate, weekday, longDate }
  }
}

/**
 * The next occurrence of a named weekday, on or after `fromIso`.
 *
 * This is the arithmetic the extractor was silently getting wrong. When Yuri
 * says "I'll check in Sunday" on a Saturday, she means TOMORROW — not eight days
 * out, and not the Monday the server's UTC clock would have drifted to. Returns
 * `fromIso` itself when the named day IS today ("I'll check in Sunday" said on a
 * Sunday means later today, not next week).
 *
 * Pure and testable; no I/O, no ambient Date.
 */
export function nextWeekdayOnOrAfter(weekdayName: string, fromIso: string): string | null {
  const target = WEEKDAYS.findIndex((d) => d.toLowerCase() === weekdayName.trim().toLowerCase())
  if (target < 0) return null
  const base = new Date(`${fromIso}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return null
  const delta = (target - base.getUTCDay() + 7) % 7
  const result = new Date(base.getTime() + delta * 86400000)
  return result.toISOString().slice(0, 10)
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime()
  const to = new Date(`${toIso}T00:00:00Z`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86400000)
}

/**
 * The clock FACT block handed to a model.
 *
 * Deliberately factual and non-imperative beyond the one anti-arithmetic rule
 * that already exists in advisor.ts ("use these values, don't compute the
 * weekday yourself"). It states what is true and stops. It does NOT tell Yuri
 * whether to mention the day, apologize for lateness, or avoid temporal
 * language — those are hers to judge. A guard test fails if this block acquires
 * instructions about what to SAY.
 *
 * Precedent: the shelf-visibility and cumulative-give instruments, both of which
 * block nothing and end by handing the decision back. The widget give/gate
 * failed twice by rewording a rule before v11.10.0 fixed it with a fact.
 */
export function clockFactBlock(clock: LocalClock): string {
  return `TODAY'S DATE (authoritative — this is the user's local calendar): ${clock.longDate} (${clock.isoDate}, ${clock.timezone}).
Today is a ${clock.weekday}. Use this value directly; never compute the weekday yourself.`
}
