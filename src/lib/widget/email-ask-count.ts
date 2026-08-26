/**
 * How many times Yuri has already offered to keep this visitor's email.
 *
 * THE DEFECT (Aug 26 2026, production transcript). A visitor arriving from the
 * blog got an excellent consult and was asked for her email in FOUR consecutive
 * replies — messages 3, 4, 5 and 6, every one of them the last paragraph of a
 * substantive answer. She never refused; she just asked her next question each
 * time. She left at message 6 of 12 with no email captured, immediately after
 * asking what to buy, which is the highest-intent moment in the conversation.
 *
 * WHY SHE REPEATED. The prompt's don't-repeat line has two branches, and only
 * one of them stops the asking (route.ts):
 *
 *   "If you made a clean, standalone offer to save their email and they clearly
 *    passed on it, let it rest. But if an earlier mention got buried — tacked
 *    onto another question, or lost in a longer answer so they never actually
 *    responded to it — a single clear, standalone offer as this piece of work
 *    lands is not nagging; it's the one that should have been made."
 *
 * "Let it rest" requires an explicit decline. A visitor who simply asks her
 * next question has not declined, so every turn routes to the second branch —
 * and because Yuri's asks WERE tacked onto substantive answers, each re-ask
 * satisfied the "buried" condition that licensed the next one. The rule fed
 * itself.
 *
 * THAT LINE IS NOT A MISTAKE, AND MUST NOT BE REVERTED. It was written on
 * Jul 22 2026 (c6389c7) to fix the OPPOSITE failure: the highest-intent
 * stranger of Jul 23 was asked exactly once, the ask was stapled to a competing
 * question, went unanswered, and the old don't-repeat line then suppressed any
 * recovery. That lead was lost too. This is the same defect from the other
 * side, and the corpus says the second ask is where the value is.
 *
 * WHAT THE DATA ACTUALLY SAYS — measured across every widget session ever:
 *
 *   0 asks   66 sessions   13.6% captured
 *   1 ask    16 sessions   43.8% captured
 *   2 asks   10 sessions   70.0% captured   <- the best state in the corpus
 *   3+ asks   6 sessions   33.3% captured
 *
 * So "ask once and stop" would have been the WRONG fix. But none of these
 * differences is significant at this sample size (Fisher exact: 2 vs 3+
 * p=0.302, 1 vs 2 p=0.248, 1-2 vs 3+ p=0.654). This module therefore reports a
 * COUNT and does not encode a threshold — a tuned cutoff would be fitting noise
 * with six sessions in the tail, and CLAUDE.md's standing rule is that a
 * classifier needing hand-tuning is a signal to stop.
 *
 * WHAT IS ALREADY WORKING AND MUST NOT BE "FIXED":
 *   - Once an email is captured, Yuri never asks again. Measured: across all 16
 *     sessions with 2+ asks, asks-after-capture is ZERO in every one.
 *   - An explicit refusal is honored. On Aug 5 a visitor answered the third ask
 *     with "No, I'm good. Maybe i'll share my email later" and Yuri let it rest
 *     and closed warmly.
 *
 * The gap is narrower than either of those: Yuri cannot distinguish "my offer
 * got buried and was never answered" from "I have now asked three times and
 * been passed over each time." Measured across the 3+ sessions, 14 of 15
 * follow-ups were a brand-new question — never a refusal, so the buried branch
 * stays true forever. This module supplies the one fact that separates them.
 */

/**
 * Yuri offering to keep or use the visitor's email, in her own idiom.
 *
 * Validated against every assistant reply ever sent. Deliberately narrow: it
 * matches the OFFER, not any mention of email. Recall matters less than
 * precision here, because an inflated count is injected as a fact and a fact
 * that is wrong is worse than one that is missing.
 */
const ASK = [
  // Custody framings.
  /\b(?:hang|hold)\s+onto\s+your\s+email\b/i,
  /\b(?:save|keep|lock\s+in)\s+(?:your|that|the)\s+(?:email|address)\b/i,
  /\b(?:guardo|guarde)\s+tu\s+email\b/i,
  // Hand-it-over framings. These are the ones the first draft missed entirely:
  // session 66251ea8 asked SIX times using "lock in your email", "drop that
  // email", "send me that email" and "add your email now", and the module
  // counted ONE. A detector fitted to a single transcript stays silent in
  // exactly the sessions the defect recurs.
  /\b(?:drop|give|send)\s+(?:me\s+)?(?:your|that|the)\s+email\b/i,
  /\badd\s+your\s+email\b/i,
  /\btype\s+(?:your|it|that)\s*(?:email|address)?\b(?=[^.!?]*\b(?:email|address|recap|write-?up)\b)/i,
  /\byour\s+email\s+address\b/i,
  // Deliverable framings.
  /\bsend\s+(?:you\s+)?(?:the|a|that|your|full)?\s*(?:written\s+)?(?:write-?up|recap|resumen)\b/i,
  /\bte\s+(?:env[ií]e|mando)\s+un\s+resumen\b/i,
]

/**
 * A CONFIRMATION that the address already landed — "Got it, saved to
 * name@example.com, and I'll send you a write-up…" — matches the recap phrasing
 * above but is the opposite event. Counting it would inflate the tally on
 * precisely the visitor who complied, which is the one case where Yuri must not
 * be told she has been asking repeatedly. Found in the real corpus, not
 * hypothesised.
 */
const CONFIRMATION = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // she echoed the address
  // Past-tense receipt. Every pattern ties the receipt to the address itself:
  // an earlier draft matched bare openers ("got it", "locked in", "you're all
  // set") and PROVABLY suppressed genuine asks, because Yuri opens replies
  // that way constantly ("sunscreen locked in daily is your job" killed a real
  // ask). A suppressed ask under-counts, which is the failure that makes this
  // module useless.
  /\bgot (?:your|the) email\b/i,
  /\b(?:saved|got) (?:your|the) (?:email|address)\b/i,
  /\byour email(?:'s| is)? saved\b/i,
  /\bgot (?:it|your),?\s+saved\b/i,
  /\bsaved to\s+[A-Za-z0-9._%+-]+@/i,
]

/** True when this reply contains an offer to keep the visitor's email. */
export function isEmailAsk(reply: string): boolean {
  const text = reply || ''
  if (!ASK.some((re) => re.test(text))) return false
  if (CONFIRMATION.some((re) => re.test(text))) return false
  return true
}

/**
 * The visitor saying no, in the idiom people actually use.
 *
 * Needed because the block cannot otherwise assert anything about HOW the
 * offer went unanswered. An earlier draft hardcoded "They have not refused"
 * while reading only assistant turns — and production session e60c9e4d proves
 * it false: after the third ask the visitor wrote "No, I'm good. Maybe i'll
 * share my email later." One more message and the block would have injected a
 * flat contradiction of the transcript directly above it, into a block whose
 * only authority is being factual.
 */
const REFUSAL = [
  /\bno,? (?:i'?m|im|i am) (?:good|fine|ok(?:ay)?)\b/i,
  /\bno thank(?:s| you)\b/i,
  /\b(?:rather|prefer) not\b/i,
  /\bmaybe (?:later|next time)\b/i,
  /\bnot (?:right )?now\b/i,
  /\bi'?ll pass\b/i,
  /\bdon'?t want to (?:give|share)\b/i,
]

/** True when a visitor message reads as declining the offer. */
export function isRefusal(message: string): boolean {
  return REFUSAL.some((re) => re.test(message || ''))
}

export interface EmailAskHistory {
  /** Replies containing an offer, across the whole conversation. */
  count: number
  /** True when Yuri's most recent reply carried an offer. */
  askedLastTurn: boolean
  /**
   * A visitor turn AFTER the first offer that reads as a decline. Null when
   * none is found — which is the common case (measured: 14 of 15 follow-ups
   * across the repeat-ask sessions were a brand-new question, not a refusal).
   */
  refusalSeen: boolean
}

export function detectEmailAsks(
  history: Array<{ role: string; content: string }>
): EmailAskHistory {
  let count = 0
  let askedLastTurn = false
  let refusalSeen = false
  for (const turn of history) {
    if (turn.role === 'assistant') {
      const asked = isEmailAsk(turn.content || '')
      if (asked) count++
      askedLastTurn = asked
      continue
    }
    // Only a visitor turn that FOLLOWS an offer can be a response to it.
    if (count > 0 && isRefusal(turn.content || '')) refusalSeen = true
  }
  return { count, askedLastTurn, refusalSeen }
}

/**
 * The fact injected into Yuri's per-turn context.
 *
 * Returns null below two asks: one prior offer is the ordinary, healthy state
 * (and the corpus's best-performing next step is a second ask), so reporting it
 * would be noise that discourages the very move most associated with capture.
 *
 * States the count and stops. It sets no ceiling, names no number as too many,
 * and does not tell her to drop the subject — the data cannot support a
 * threshold, and a cap here would recreate the Jul 23 failure where a buried
 * ask could never be recovered. What it removes is the blindness: the
 * "buried, never answered" branch of the prompt rule reads as true forever
 * when a visitor simply keeps asking new questions, and only a count can
 * distinguish that from a genuinely unanswered first offer.
 */
export function buildEmailAskBlock(h: EmailAskHistory): string | null {
  if (h.count < 2) return null

  // Only assert how the offer went unanswered when the transcript supports it.
  // "They have not refused" was hardcoded in an earlier draft and is FALSE on
  // production session e60c9e4d, where the visitor answered the third ask with
  // "No, I'm good." A block whose only authority is being factual cannot
  // afford a sentence that is sometimes a flat contradiction of the transcript
  // sitting directly above it.
  const reading = h.refusalSeen
    ? 'They have also said something that reads as a no. Take them at their word over this count.'
    : 'No refusal is detectable in what they wrote, though a person who does not want to hand over an address often signals it by simply moving on rather than saying so.'

  return `\n\n## Your Email Offers So Far (facts, not instructions)
You have offered to keep their email in ${h.count} separate replies this conversation${h.askedLastTurn ? ', including your most recent one' : ''}, and no address has come back. ${reading}
This is the one thing you cannot see by reading your last message: from inside a single turn, an offer that got buried under a long answer and an offer they have quietly passed over look identical. Which one this is, you can tell and nothing else can. Nothing here caps how many times you may ask, and if the value has genuinely just landed, saying so is right.`
}
