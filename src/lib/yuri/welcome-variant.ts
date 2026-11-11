/**
 * Which greeting the member chat's empty state shows (Nov 11 2026).
 *
 * A brand-new member was greeted "Welcome back, Scott" seconds after joining,
 * because the setup conversation counted as a past conversation. Pure, so the
 * whole state table is executed by tests.
 *
 *   meet              no conversation of any kind on record
 *   first_member_chat only the setup chat, and it was recent: they just joined
 *   returning         they have chatted as a member before
 *   neutral           anything not known for sure (a failed count, an old setup
 *                     chat with no member chats). Never "Welcome back", never
 *                     "You're in".
 */
export type WelcomeVariant = 'meet' | 'first_member_chat' | 'returning' | 'neutral'

export interface WelcomeFacts {
  total_conversations: number
  /** Conversations other than setup. null/undefined = the count could not be read. */
  member_conversations?: number | null
  /** The setup chat was active within NEW_MEMBER_WINDOW_HOURS and no member chat exists. */
  new_member?: boolean | null
}

/** A setup chat older than this is not "just joined". */
export const NEW_MEMBER_WINDOW_HOURS = 48

export function welcomeVariant(ctx: WelcomeFacts | null | undefined): WelcomeVariant {
  if (!ctx || !(ctx.total_conversations > 0)) return 'meet'
  if (ctx.member_conversations == null) return 'neutral'
  if (ctx.member_conversations > 0) return 'returning'
  return ctx.new_member === true ? 'first_member_chat' : 'neutral'
}

/** True when the setup chat's last activity is within the window. Unknown time = false. */
export function isRecentSetup(setupUpdatedAt: string | null | undefined, nowMs: number): boolean {
  const t = setupUpdatedAt ? Date.parse(setupUpdatedAt) : NaN
  if (Number.isNaN(t)) return false
  return nowMs - t <= NEW_MEMBER_WINDOW_HOURS * 60 * 60 * 1000 && nowMs - t >= -5 * 60 * 1000
}
