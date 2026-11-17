import { normalizeOfferCode, rememberOfferCode, codeShapeLine, codeCheckFailedLine, codeTooManyTriesLine, codeNeedsHelpLine, codeNotSavedLine } from '@/lib/offers'

/**
 * A code typed BEFORE there is an account (the sign-up page). Stripe is asked
 * through /api/offer; a code it confirms is remembered in this browser, which
 * is how the free week that starts at sign-up carries it. A code that is not
 * confirmed is not remembered: sign-up would otherwise send it along, be
 * refused, and the free week would not start over a typo.
 */
export type TypedCodeResult = { ok: true; code: string; percentOff: number; line: string } | { ok: false; line: string }

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export async function checkTypedCode(raw: string, doFetch: Fetch = (url) => fetch(url), remember: (code: string) => boolean = rememberOfferCode): Promise<TypedCodeResult> {
  const code = normalizeOfferCode(raw)
  if (!code) return { ok: false, line: codeShapeLine() }
  let res: Awaited<ReturnType<Fetch>>
  try {
    res = await doFetch(`/api/offer?code=${encodeURIComponent(code)}`)
  } catch {
    return { ok: false, line: codeCheckFailedLine() }
  }
  if (res.status === 429) return { ok: false, line: codeTooManyTriesLine() }
  if (!res.ok) return { ok: false, line: codeCheckFailedLine() }
  const o = ((await res.json().catch(() => null)) ?? {}) as { state?: unknown; line?: unknown; saved_line?: unknown; percent_off?: unknown }
  if (o.state === 'active' && typeof o.percent_off === 'number' && typeof o.saved_line === 'string') {
    // Nothing is applied yet: the code is kept in this browser and goes on
    // when the free week starts. So the sentence is "saved", not "applied",
    // and only if the browser really kept it.
    if (!remember(code)) return { ok: false, line: codeNotSavedLine(code) }
    return { ok: true, code, percentOff: o.percent_off, line: o.saved_line }
  }
  if (o.state === 'ended' && typeof o.line === 'string') return { ok: false, line: o.line }
  return { ok: false, line: codeNeedsHelpLine(code) }
}
