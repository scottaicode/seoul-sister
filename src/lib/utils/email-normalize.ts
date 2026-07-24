/**
 * Email normalization + signup-abuse detection.
 *
 * The problem this solves (found July 23 2026): 11 of ~30 lifetime signups —
 * over a third — were Gmail dot-abuse accounts (`ha.van.naji.l.l.ene@gmail.com`,
 * `he.y.m.a.nt.a.e.l.o.r2.704@gmail.com`, ...). Gmail treats dots in the
 * localpart as insignificant — jane.doe@gmail.com and janedoe@gmail.com are the
 * SAME inbox — so a bot can mint unlimited "unique" accounts from one real
 * mailbox by sprinkling dots. Every one of the 11 was dead-on-arrival: 0
 * messages, onboarding never completed, free plan, 0 subscriptions. They
 * inflate GA4 and the signup tables so "did we get real signups?" stops being
 * answerable without hand-filtering.
 *
 * This module is deterministic string handling — no AI, no judgment. It (a)
 * canonicalizes an address so two spellings of the same inbox collapse to one
 * key, and (b) flags the dot-abuse shape so the register form can refuse it and
 * analytics queries can exclude the existing rows.
 *
 * Scope discipline: the dot rule applies ONLY to Gmail/Googlemail, where dots
 * are provably insignificant. On every other domain a dot is a real character
 * (first.last@company.com is a normal address), so we never touch it. A
 * corporate address like yvette.ceragioli@gilead.com is NOT flagged — verified
 * against a real human abandoner who must never be blocked.
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/** How many dots in a Gmail localpart we treat as the abuse signature.
 *  Real people occasionally use first.last (1 dot) or first.m.last (2). Three
 *  or more is the throwaway-generator pattern — verified: all 11 abuse accounts
 *  had 3+, and no real user (Kim/yvette/natalie) had more than 1. */
export const GMAIL_DOT_ABUSE_THRESHOLD = 3

function splitEmail(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return null
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) }
}

/**
 * Canonical inbox key: the address that actually receives mail, lowercased.
 * For Gmail, strips dots and any `+tag` suffix so all spellings of one inbox
 * collapse to a single key. For other domains, only lowercases (dots and tags
 * may be significant elsewhere, so we leave them alone).
 *
 * Use this as a dedup/grouping key, NOT as the value you store or send to —
 * store the address the user actually typed.
 */
export function canonicalizeEmail(email: string): string {
  const parts = splitEmail(email)
  if (!parts) return email.trim().toLowerCase()
  let { local } = parts
  const { domain } = parts

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split('+')[0].replace(/\./g, '')
    // Gmail delivers both gmail.com and googlemail.com to the same box.
    return `${local}@gmail.com`
  }
  return `${local}@${domain}`
}

/** Count of dots in the localpart (before any +tag). Gmail-relevant only. */
function gmailLocalDotCount(local: string): number {
  const base = local.split('+')[0]
  return base.length - base.replace(/\./g, '').length
}

/**
 * True when the address is a Gmail dot-abuse signup — the throwaway pattern.
 * Only ever true for Gmail/Googlemail; every other domain returns false.
 */
export function isGmailDotAbuse(email: string): boolean {
  const parts = splitEmail(email)
  if (!parts) return false
  if (!GMAIL_DOMAINS.has(parts.domain)) return false
  return gmailLocalDotCount(parts.local) >= GMAIL_DOT_ABUSE_THRESHOLD
}

/**
 * Gate for the signup form. Returns an error string to show the user, or null
 * when the address is acceptable. Kept as a plain function (not a throw) so the
 * caller controls UX. Message is deliberately quiet — it tells a real human how
 * to proceed (use their normal address) without publishing the detection rule.
 */
export function signupEmailRejection(email: string): string | null {
  if (isGmailDotAbuse(email)) {
    return 'Please sign up with your standard email address (without extra dots in the name).'
  }
  return null
}
