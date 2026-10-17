/**
 * What actually happened to the recap email, stated to Yuri as a fact.
 *
 * Oct 17 2026: in an owner test the recap writer deliberately did not send
 * (recap_status 'suppressed'), and Yuri told the visitor three times that "your
 * write-up is on its way". She could see that an email was on file but not
 * whether the recap went out, and the prompt tells her a recap follows every
 * address, so the false claim was the reasonable inference. A visitor whose
 * recap bounced or failed would hear the same thing.
 *
 * The decision is made AFTER the reply on the turn the email arrives, so on that
 * turn this is unknown; from the next turn on it is in recap_status. Statuses
 * per LEAD-EMAIL-OBSERVABILITY.md.
 */
export function recapStatusFact(status: string | null | undefined): string {
  switch (status) {
    case 'delivered':
      return 'The recap email was sent and delivered.'
    case 'sent':
      return 'The recap email was sent (delivery not yet confirmed).'
    case 'suppressed':
      return 'No recap email was sent: when the address came in, it was judged not worth sending (for example a test or throwaway address). Nothing is on its way.'
    case 'not_their_address':
      return 'No recap email was sent: the address was judged not to be theirs. Nothing is on its way.'
    case 'send_failed':
      return 'The recap email failed to send. Nothing reached them.'
    case 'bounced':
      return 'The recap email bounced. It did not reach them.'
    case 'complained':
      return 'The recap email was reported as spam by the recipient.'
    case 'suppressed_duplicate':
      return 'No recap email was sent for this conversation: the same address was given in another recent preview conversation, so a second one was skipped. Do not tell them one is on its way.'
    case null:
    case undefined:
      // Could be a send still in flight (the address arrived seconds ago) or
      // one that never ran; the two are indistinguishable here, so claim neither.
      return 'No recap email is recorded as sent yet. If the address only just came in it may still be going out, so do not say it has arrived, and do not promise it is coming.'
    default:
      return `Recap email status: ${status}.`
  }
}
