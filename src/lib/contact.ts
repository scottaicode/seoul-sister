/**
 * Single source of truth for every human-reachable Seoul Sister address.
 *
 * WHY THIS FILE EXISTS (Aug 7 2026).
 *
 * Yuri told Bailey to email support@seoulsister.com to sync a profile field.
 * That mailbox does not exist. Neither does privacy@ or legal@ — and those two
 * were the stated contacts on the Privacy Policy and Terms pages, where a dead
 * address is a compliance problem, not a typo. Meanwhile team@seoulsister.com,
 * the one inbox that actually receives mail, appeared NOWHERE in the codebase.
 *
 * Three plausible-looking addresses were hardcoded across five files and nothing
 * checked whether any of them could receive a message. A mailbox that silently
 * swallows mail is the same failure class as the rest of this release: it looks
 * identical to one that works, right up until someone needs it.
 *
 * THE RULE: never hardcode an @seoulsister.com address in a component, page, or
 * prompt. Import from here. Adding an alias is a DNS/mailbox action first
 * (Namecheap PrivateEmail console — Scott-only, not automatable) and a code
 * change second. Do not add a constant here for a mailbox that does not exist
 * yet; that is how the dead addresses got shipped in the first place.
 */

/**
 * The brand inbox — the ONLY address confirmed to receive mail. Used for
 * billing, support, privacy and legal contact until dedicated aliases are
 * actually provisioned.
 */
export const CONTACT_EMAIL = 'team@seoulsister.com'

/**
 * Yuri's SENDING identity. Send-only: it has no inbox, so it must never be
 * offered to a user as somewhere to write. Outbound mail sets EMAIL_REPLY_TO
 * (verified present in Vercel Production) so replies reach a monitored inbox
 * instead of vanishing — see src/lib/email/send.ts.
 */
export const YURI_FROM_EMAIL = 'yuri@seoulsister.com'

/** `mailto:` href with an optional prefilled subject. */
export function contactMailto(subject?: string): string {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`
}
