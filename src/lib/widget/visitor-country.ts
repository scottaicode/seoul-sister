/**
 * The country a widget visitor is browsing from, stated to Yuri as a FACT.
 *
 * Why (Oct 21 2026): Olive Young Global stopped shipping to US addresses on
 * May 29 2026. Where to send someone to buy now depends on where they are, and
 * an anonymous visitor rarely says. Vercel's edge geolocation header gives a
 * network-level guess at no cost.
 *
 * A fact, not a rule: nothing branches on it. Yuri reads it alongside what the
 * visitor says, and anything the visitor states about where they live wins
 * (VPNs and travel make the header wrong sometimes). Unknown is reported as
 * unknown, never defaulted to the US.
 */

const COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States',
  CA: 'Canada',
  GB: 'the United Kingdom',
  AU: 'Australia',
  IN: 'India',
  KR: 'South Korea',
}

/** ISO 3166-1 alpha-2 code from the edge header, or null when absent/invalid. */
export function visitorCountryCode(headerValue: string | null | undefined): string | null {
  const v = (headerValue || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(v) ? v : null
}

export function visitorCountryFact(code: string | null): string {
  if (!code) {
    return '- Visitor location: unknown. If where they buy matters to your answer, ask where they are.'
  }
  const name = COUNTRY_NAMES[code] ?? `country code ${code}`
  return `- Visitor appears to be browsing from ${name} (network guess, not something they told you — if they say otherwise, believe them).`
}
