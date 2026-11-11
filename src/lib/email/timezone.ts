/** An IANA zone this runtime accepts, else null. A bad stored value must never throw inside an email. */
export function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return null
  }
}
