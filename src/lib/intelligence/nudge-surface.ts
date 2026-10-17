/**
 * Which proactive nudge, if any, is still worth showing a subscriber.
 *
 * Only the user's NEWEST nudge can surface. A newer check-in replaces an older
 * unseen one; it does not queue in front of it.
 *
 * Oct 2026: the dashboard showed the newest open nudge, so dismissing it
 * surfaced the next-oldest open one. Caroline had three pending (Aug 3, Oct 6,
 * Oct 11) and Kim two (Jul 28, Oct 11). The Oct 6 note said "I never got that
 * baseline photo from you" hours after she uploaded three; it was written before
 * a later conversation and would have appeared, out of date, as soon as she
 * cleared the Oct 11 one.
 */
export interface NudgeRow {
  status: string
  dismissed_at: string | null
  acted_at: string | null
}

/** `newest` must be the user's most recent nudge of ANY status. */
export function isSurfaceable(newest: NudgeRow | null | undefined): boolean {
  return (
    !!newest &&
    (newest.status === 'pending' || newest.status === 'surfaced') &&
    !newest.dismissed_at &&
    !newest.acted_at
  )
}
