/**
 * A new member's first message to Yuri in the member chat, and the one case in
 * which the member chat sends it for them.
 *
 * Nov 19 2026: the first two strangers to finish the setup chat both stopped
 * with no member chat and no routine. A "Finish setup" press and then a Send
 * press on a prefilled message stood between them and a routine. Now a member
 * whose setup is complete sees "Finish setup and build my routine", and that
 * press is the send.
 *
 * The send is carried by a mark this browser tab writes when the button is
 * pressed (sessionStorage), never by the address. A link, an email or another
 * site cannot write that mark, so nothing but the member's own press can make
 * the member chat speak for them. With no mark (storage blocked, another tab,
 * a link) the sentence is only put in the box, as before.
 *
 * No imports: tests/setup-handoff-sends-routine-request.test.mjs runs this file
 * as it is.
 */
export const FIRST_MEMBER_ASK = "Let's build my routine from what you learned in my setup chat."

export const ROUTINE_HANDOFF_KEY = 'ss_routine_handoff_at'
/** The press and the arrival are one navigation apart. Two minutes covers a slow phone. */
export const ROUTINE_HANDOFF_MAX_AGE_MS = 2 * 60 * 1000

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Written by the button press. Storage that throws leaves no mark: the box is prefilled. */
export function markRoutineHandoff(store: Store | null | undefined, now: number): void {
  try {
    store?.setItem(ROUTINE_HANDOFF_KEY, String(now))
  } catch {
    // Private mode or blocked storage. Nothing is sent for them; they press Send.
  }
}

/** Is there a mark from a press in the last two minutes? Reads only. */
export function hasFreshRoutineHandoff(store: Store | null | undefined, now: number): boolean {
  try {
    const raw = store?.getItem(ROUTINE_HANDOFF_KEY)
    if (!raw || !/^\d+$/.test(raw)) return false
    const age = now - Number(raw)
    return age >= 0 && age <= ROUTINE_HANDOFF_MAX_AGE_MS
  } catch {
    return false
  }
}

/** Removed before the send, so one press sends once. */
export function clearRoutineHandoff(store: Store | null | undefined): void {
  try {
    store?.removeItem(ROUTINE_HANDOFF_KEY)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Whether the member chat sends on arrival. Every condition is needed:
 * the press's mark, the exact sentence, a signed-in member, an empty chat that
 * is not busy, and not already sent on this page.
 */
export function shouldSendOnArrival(s: {
  handoff: boolean
  ask: string | null | undefined
  signedIn: boolean
  messageCount: number
  busy: boolean
  alreadySent: boolean
}): boolean {
  return s.handoff === true && s.ask === FIRST_MEMBER_ASK && s.signedIn === true && s.messageCount === 0 && s.busy === false && s.alreadySent === false
}
