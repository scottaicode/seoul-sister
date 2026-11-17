/**
 * Remembers, in the browser, that someone has just created an account on the
 * sign-up page, under its sentence about the Terms (Nov 16 2026).
 *
 * Why: creating an account now STARTS the free week. Two testers and the owner
 * all expected that; the app instead made a "free account", then asked for a
 * second press on a membership page, and both testers stopped there. The week
 * is started by the first page after sign-up (the setup chat), which needs to
 * know the person came through the sign-up page and not, say, an old free
 * account signing back in. That is all this records.
 *
 * It is a convenience, not a record of consent: the consent is the sign-up
 * page's own sentence, and what is stored for it is on the Stripe subscription
 * (`terms_shown: signup`). If the browser loses this (private mode, another
 * device), nothing breaks: the person meets the membership page, which starts
 * the same free week with a tick box.
 */
export const SIGNUP_AGREEMENT_KEY = 'ss_signup_agreed_at'
/** Long enough to confirm an email or come back from Google; short enough that it is this sign-up. */
export const SIGNUP_AGREEMENT_MAX_AGE_MS = 60 * 60 * 1000

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const store = (): Store | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Called when the sign-up form is submitted or its Google button is pressed. Never throws. */
export function rememberSignupAgreement(now: number = Date.now(), s: Store | null = store()): void {
  try {
    s?.setItem(SIGNUP_AGREEMENT_KEY, String(now))
  } catch {
    // Storage blocked: the membership page starts the free week instead.
  }
}

/** True when this browser went through the sign-up page within the last hour. Never throws. */
export function hasFreshSignupAgreement(now: number = Date.now(), s: Store | null = store()): boolean {
  try {
    const at = Number(s?.getItem(SIGNUP_AGREEMENT_KEY))
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= SIGNUP_AGREEMENT_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Whether the first page after sign-up should start the free week: not a
 * member, signed in, an account made within the hour, and a browser that came
 * through the sign-up page. All four. The account's age is what keeps an older
 * free account, which can pass through the sign-up page (its Google button
 * signs anyone in), from being started without being asked. Pure, exported
 * for tests.
 */
export function shouldStartAtSignup(a: { member: boolean; hasToken: boolean; accountCreatedAt: string | null | undefined; hasMark: boolean; now: number }): boolean {
  return !a.member && a.hasToken && a.hasMark && isJustCreated(a.accountCreatedAt, a.now)
}

/** True for an account created within the last hour. An unreadable date is not "just created". */
export function isJustCreated(createdAt: string | null | undefined, now: number): boolean {
  const at = Date.parse(createdAt ?? '')
  return Number.isFinite(at) && now - at >= 0 && now - at < SIGNUP_AGREEMENT_MAX_AGE_MS
}

/**
 * Why the free week did not start, kept for this tab so a reload shows the
 * same sentence and not a different, wrong one. Keyed by account.
 */
export const START_NOTE_KEY = 'ss_free_week_note'
export function rememberStartNote(userId: string, note: string, s: Pick<Storage, 'setItem'> | null = session()): void {
  try {
    s?.setItem(`${START_NOTE_KEY}:${userId}`, note)
  } catch {
    // The note is still shown on this page load.
  }
}
export function readStartNote(userId: string, s: Pick<Storage, 'getItem'> | null = session()): string | null {
  try {
    return s?.getItem(`${START_NOTE_KEY}:${userId}`) || null
  } catch {
    return null
  }
}
function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function clearSignupAgreement(s: Store | null = store()): void {
  try {
    s?.removeItem(SIGNUP_AGREEMENT_KEY)
  } catch {
    // Nothing to clean up.
  }
}
