/**
 * What a member has told Yuri about who they are: gender and exact age.
 *
 * Why (Nov 15 2026): told "I'm in my late 50s", Yuri answered "after
 * menopause... at 57" to a 59-year-old man. A read of production found the
 * same shape in 9 conversations (three setup chats with people aged 57 to 60),
 * usually as a reference group she had placed the person in ("women your
 * age") or a presupposing question ("the week before your period"), not as
 * the word menopause. The profile had nowhere to hold either fact, so a
 * correction lived only in one conversation's text.
 *
 * Rules this file holds:
 *  - Nothing is ever defaulted or inferred. Gender is the member's own word
 *    for themselves; a pregnancy, a period or hormone therapy settles nothing
 *    about it and is recorded separately, in medical_history, in their words.
 *  - An exact age is kept with the day it was given, so what Yuri sees later
 *    is a current age and not the number from years ago.
 *  - Unknown is shown as unknown, as a plain state. Reviews on two models
 *    measured what "not established, ask" lines do: listed among the setup
 *    chat's fields to collect they became a question in most chats, so gender
 *    is NOT one of those fields, and no line here is shaped like a question.
 *
 * No imports: the tests run this file as it is.
 */

export const GENDERS = ['woman', 'man', 'nonbinary'] as const
export type Gender = (typeof GENDERS)[number]

/** The stored value, or null for anything that is not exactly one of the three. */
export function cleanGender(value: unknown): Gender | null {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value) ? (value as Gender) : null
}

const AGE_MIN = 13
const AGE_MAX = 110

/** A whole number of years within the range the database accepts, or null. */
export function cleanAgeYears(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value >= AGE_MIN && value <= AGE_MAX ? value : null
}

/** The profile's age_range bucket for an exact age. Null under 18: there is no bucket. */
export function ageRangeFor(age: number): '18-24' | '25-30' | '31-35' | '36-40' | '41-50' | '50+' | null {
  if (age < 18) return null
  if (age <= 24) return '18-24'
  if (age <= 30) return '25-30'
  if (age <= 35) return '31-35'
  if (age <= 40) return '36-40'
  if (age <= 50) return '41-50'
  return '50+'
}

/** `YYYY-MM-DD` for a moment, in UTC. */
export function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * The age someone is now, given the age they stated and the day they stated
 * it. Whole years elapsed are added; nothing is known about their birthday,
 * so this is "about". Null when either half is missing or unreadable.
 */
export function currentAge(ageYears: unknown, statedOn: unknown, now: Date): number | null {
  const age = cleanAgeYears(ageYears)
  if (age === null || typeof statedOn !== 'string') return null
  const then = new Date(`${statedOn.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(then.getTime())) return null
  const years = Math.floor((now.getTime() - then.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return age + Math.max(0, years)
}

/**
 * What to write for a stated age, given what is already stored. The date is
 * set only when the number first appears or changes: the setup extractor
 * re-reads the whole conversation every message and would otherwise move it.
 * Returns {} when there is nothing to write.
 */
export function ageWrite(
  stated: unknown,
  stored: { age_years?: unknown; age_stated_on?: unknown } | null | undefined,
  now: Date
): { age_years?: number; age_stated_on?: string; age_range?: string } {
  const age = cleanAgeYears(stated)
  if (age === null) return {}
  const range = ageRangeFor(age)
  const unchanged = cleanAgeYears(stored?.age_years) === age && typeof stored?.age_stated_on === 'string'
  return {
    ...(unchanged ? {} : { age_years: age, age_stated_on: isoDay(now) }),
    ...(range ? { age_range: range } : {}),
  }
}

/** The member context's gender line. Known: their word. Unknown: a plain state. */
export function genderLine(gender: unknown): string {
  const g = cleanGender(gender)
  return g
    ? `- Gender: ${g} (their own word for themselves)`
    : '- Gender: they have not said, and nothing else in this profile tells you.'
}

/** The member context's age line: a current age when one was stated, otherwise the range as a range. */
export function ageLine(
  profile: { age_years?: unknown; age_stated_on?: unknown; age_range?: unknown },
  now: Date
): string {
  const stated = cleanAgeYears(profile.age_years)
  const current = currentAge(profile.age_years, profile.age_stated_on, now)
  if (stated !== null && current !== null) {
    const day = String(profile.age_stated_on).slice(0, 10)
    return current === stated
      ? `- Age: ${stated} (they told you on ${day})`
      : `- Age: about ${current} now (they told you ${stated} on ${day})`
  }
  return typeof profile.age_range === 'string' && profile.age_range
    ? `- Age range: ${profile.age_range} (a range is all that is on file, not a number)`
    : '- Age range: not established'
}

/**
 * Facts for the setup chat's per-turn "Where They Stand" block. The setup
 * record is read before this turn's extraction runs, so it can be one message
 * behind; the lines say so.
 */
export function setupIdentityFacts(extracted: { gender?: unknown; age_years?: unknown; age_range?: unknown }): string[] {
  const lines: string[] = []
  if (cleanGender(extracted.gender) === null) {
    lines.push(
      'Their gender: not stated in anything recorded so far. (Read before their latest message, so if they have just said it, they have.) It is not one of the things you are here to collect, and most setup chats never need it. It is here so you can see it is a gap, not something you know.'
    )
  }
  if (cleanAgeYears(extracted.age_years) === null && typeof extracted.age_range === 'string' && extracted.age_range) {
    lines.push('Their age: they gave a range, not a number, and the range is all setup needs. (Read before their latest message.)')
  }
  return lines
}

// ---------------------------------------------------------------------------
// Hormonal and reproductive facts that change (pregnancy, breastfeeding,
// menopause, hormone therapy...). They live in medical_history, in the
// member's words, each ending "(said YYYY-MM-DD)".
//
// The date is added HERE, not by the model: the setup extractor re-reads the
// whole conversation on every message, so a date written by the model moved
// to the last day the chat was touched, and the member chat stored the same
// fact again with each new date (second-model review, Nov 15 2026).
// ---------------------------------------------------------------------------

const SAID_ON = /\s*\(said \d{4}-\d{2}-\d{2}\)\s*$/

/** True for an entry that carries the day it was said. */
export function isDatedFact(entry: unknown): entry is string {
  return typeof entry === 'string' && SAID_ON.test(entry)
}

/** The wording of a fact with any date removed, for comparing two entries. */
export function factBase(entry: string): string {
  return entry.replace(SAID_ON, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const cleanFact = (x: unknown): string =>
  typeof x === 'string' ? x.replace(SAID_ON, '').replace(/\s+/g, ' ').trim().slice(0, 200) : ''

/**
 * The dated entries to store. Every dated entry already stored is kept with
 * its date untouched; a fact stated now is added with today's date only when
 * no stored dated entry has the same wording. Nothing here removes an entry:
 * an old date is how Yuri knows to treat it as a question.
 */
export function mergeDatedFacts(stored: unknown, stated: unknown, now: Date): string[] {
  const kept = Array.isArray(stored) ? stored.filter(isDatedFact) : []
  const have = new Set(kept.map(factBase))
  const out = [...kept]
  for (const raw of Array.isArray(stated) ? stated : []) {
    const fact = cleanFact(raw)
    const base = fact.toLowerCase()
    if (!fact || have.has(base)) continue
    have.add(base)
    out.push(`${fact} (said ${isoDay(now)})`)
  }
  return out
}

/** Entries of a medical history that are standing facts, not dated ones. */
export function standingFacts(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && !!x.trim() && !isDatedFact(x)) : []
}
