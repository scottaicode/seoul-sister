/**
 * Contact-frequency rails shared by every proactive path that reaches a
 * subscriber (the rule-based proactive-nudge cron and Yuri's own check-ins in
 * yuri-wakes-up). Both write ss_user_nudges, so both count against the SAME
 * window — two crons must never add up to more contact than one is allowed.
 *
 * These decide "no matter what", never "what to say": the model owns content
 * and whether; the cap owns how often (YURI-NURTURE-AGENT-BLUEPRINT.md guardrail 2).
 */

/** Max nudges per user within NUDGE_WINDOW_DAYS (a rolling window, NOT a lifetime cap). */
export const MAX_NUDGES = 3
/**
 * The rolling window the cap applies over (v11.23.1). Chosen to match the
 * monthly billing rhythm: a subscriber can hear from Yuri proactively at most
 * three times per billing period, and never more often than SPACING_DAYS apart.
 */
export const NUDGE_WINDOW_DAYS = 30
export const SPACING_DAYS = 3
export const DAYTIME_START_HOUR = 9 // local
export const DAYTIME_END_HOUR = 20 // local (8pm)

/** Local hour in an IANA timezone, defaulting to a safe daytime hour if unknown. */
export function localHour(timezone: string | null): number {
  if (!timezone) return 12 // unknown tz → treat as midday (safe to send)
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).formatToParts(new Date())
    const h = parts.find((p) => p.type === 'hour')?.value
    const n = h ? parseInt(h, 10) : 12
    return Number.isNaN(n) ? 12 : n % 24
  } catch {
    return 12
  }
}

/**
 * Whether the cap or spacing forbids another proactive contact right now.
 * `createdAts` are ISO timestamps of ALL prior ss_user_nudges rows for the user.
 */
export function capOrSpacingBlocks(createdAts: string[], now: number = Date.now()): boolean {
  const windowStart = now - NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const inWindow = createdAts.filter((c) => new Date(c).getTime() >= windowStart)
  if (inWindow.length >= MAX_NUDGES) return true
  if (createdAts.length > 0) {
    const last = Math.max(...createdAts.map((c) => new Date(c).getTime()))
    if ((now - last) / (1000 * 60 * 60 * 24) < SPACING_DAYS) return true
  }
  return false
}
